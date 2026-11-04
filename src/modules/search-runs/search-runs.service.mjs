import { randomUUID } from 'node:crypto';
import { KEYWORDS, expandSearches } from '../../config/search.config.mjs';
import { SEARCH_RUN_MESSAGES } from './search-runs.messages.mjs';
import { formatJobs } from './search-runs.parsed-response.mjs';
import { createSearchRunRepository } from './search-runs.repository.mjs';

const RUN_TTL_MS = 15 * 60_000;
const MAX_QUOTA_WAIT_MS = 60_000;

const pause = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const createHttpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const createSearchRunRecord = ({ country, plannedRequests }) => ({
  id: randomUUID(),
  status: 'running',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  expiresAt: Date.now() + RUN_TTL_MS,
  plannedRequests,
  completedRequests: 0,
  errors: [],
  jobs: [],
  jobsCount: 0,
  trigger: 'manual',
  country,
  stored: false
});

const addUniqueJobsToRun = (run, jobsById, jobs) => {
  for (const job of jobs) {
    const existingJob = jobsById.get(job.id);

    if (!existingJob) {
      jobsById.set(job.id, job);
      run.jobs.push(job);
      run.jobsCount = run.jobs.length;
      continue;
    }

    for (const searchedKeyword of job.searchedKeywords) {
      if (!existingJob.searchedKeywords.includes(searchedKeyword)) {
        existingJob.searchedKeywords.push(searchedKeyword);
      }
    }
  }
};

export const createSearchRunsService = (
  mcp,
  quota,
  repository = createSearchRunRepository(),
  {
    publishProgress = () => {},
    leadRepository = { upsertMany: async () => null }
  } = {}
) => {
  let busy = false;

  const publishRunProgress = (run, lastCompletedSearch = null) => {
    const progress = structuredClone({
      ...run,
      lastCompletedSearch
    });

    try {
      publishProgress(progress);
    } catch {
      // A socket delivery problem must not stop the search run.
    }
  };

  const callUpworkWithinQuota = async (action, params) => {
    const waitTime = quota.nextAvailableMs();

    if (waitTime > MAX_QUOTA_WAIT_MS) {
      throw createHttpError(SEARCH_RUN_MESSAGES.quotaExhausted, 429);
    }

    if (waitTime > 0) {
      await pause(waitTime + 10);
    }

    quota.reserve();
    return mcp.call(action, params);
  };

  const executeSearchRun = async (run, searches, limit) => {
    const jobsById = new Map();
    let lastCompletedSearch = null;
    let leadStorageFailed = false;

    try {
      for (const { keyword, country } of searches) {
        const params = {
          query: keyword,
          sort: 'recency',
          limit,
          location: country
        };

        let response;

        try {
          response = await callUpworkWithinQuota('search', params);
        } catch (error) {
          run.errors.push({
            keyword,
            country,
            message: error.message
          });
          break;
        }

        run.completedRequests += 1;
        lastCompletedSearch = { keyword, country };

        if (
          response.filters_rejected?.length ||
          response.filters_ignored?.length
        ) {
          run.errors.push({
            keyword,
            country,
            message: SEARCH_RUN_MESSAGES.filtersRejected
          });
          publishRunProgress(run, lastCompletedSearch);
          continue;
        }

        const formattedJobs = formatJobs(
          response.jobs || [],
          country,
          keyword
        );

        addUniqueJobsToRun(run, jobsById, formattedJobs);

        try {
          await leadRepository.upsertMany(formattedJobs, {
            searchRunId: run.id
          });
        } catch (error) {
          leadStorageFailed = true;
          run.errors.push({
            keyword,
            country,
            message: SEARCH_RUN_MESSAGES.leadStorageFailed
          });
          console.error('Lead persistence error:', error?.message || error);
        }

        publishRunProgress(run, lastCompletedSearch);
      }

      run.status = run.errors.length > 0 ? 'partial' : 'complete';
    } catch (error) {
      run.errors.push({ message: error.message });
      run.status = 'failed';
    } finally {
      busy = false;
      run.finishedAt = new Date().toISOString();
      run.expiresAt = Date.now() + RUN_TTL_MS;
      run.stored = !leadStorageFailed;
      publishRunProgress(run, lastCompletedSearch);
    }
  };

  const startManualRun = ({ country, limit = 10 } = {}) => {
    repository.removeExpired();

    if (busy) {
      throw createHttpError(SEARCH_RUN_MESSAGES.busy, 409);
    }

    const searches = expandSearches({ keywords: KEYWORDS, country });
    const run = createSearchRunRecord({
      country,
      plannedRequests: searches.length
    });

    repository.create(run);
    busy = true;

    // The HTTP request returns immediately. Progress is read through getRun().
    void executeSearchRun(run, searches, limit);

    return {
      id: run.id,
      status: run.status,
      plannedRequests: run.plannedRequests,
      jobsCount: run.jobsCount
    };
  };

  const getRun = id => {
    const run = repository.findById(id);

    if (!run) {
      throw createHttpError(SEARCH_RUN_MESSAGES.notFound, 404);
    }

    return run;
  };

  return Object.freeze({
    startManualRun,
    getRun
  });
};
