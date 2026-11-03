import { randomUUID } from 'node:crypto';
import { KEYWORDS, expandSearches } from '../../config/search.config.mjs';
import { formatJobs } from './search-runs.parsed-response.mjs';
import { SearchRunRepository } from './search-runs.repository.mjs';
import { SEARCH_RUN_MESSAGES } from './search-runs.messages.mjs';

const RUN_TTL_MS=15*60_000;
const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

export class SearchRunsService {
  constructor(mcp,quota,repository=new SearchRunRepository()) {
    this.mcp=mcp;
    this.quota=quota;
    this.repository=repository;
    this.busy=false;
  }
  #regulatedCall=async(action,params)=>{
    const wait=this.quota.nextAvailableMs();
    if (wait>60_000) throw Object.assign(new Error(SEARCH_RUN_MESSAGES.quotaExhausted),{statusCode:429});
    if (wait) await pause(wait+10);
    this.quota.reserve();
    return this.mcp.call(action,params);
  };
  startManualRun=({country,limit=10}={})=>{
    this.repository.removeExpired();
    if (this.busy) throw Object.assign(new Error(SEARCH_RUN_MESSAGES.busy),{statusCode:409});
    const searches=expandSearches({keywords:KEYWORDS,country});
    const id=randomUUID();
    const run={
      id,
      status:'running',
      startedAt:new Date().toISOString(),
      finishedAt:null,
      expiresAt:Date.now()+RUN_TTL_MS,
      plannedRequests:searches.length,
      completedRequests:0,
      errors:[],
      jobs:[],
      trigger:'manual',
      country,
      stored:false
    };
    this.repository.create(run);
    this.busy=true;
    this.#execute(run,searches,limit).catch(()=>{});
    return {id,status:run.status,plannedRequests:run.plannedRequests};
  };
  #execute=async(run,searches,limit)=>{
    const ids=new Set();
    try {
      for (const {keyword,country} of searches) {
        const params={query:keyword,sort:'recency',limit,location:country};
        let response;
        try {response=await this.#regulatedCall('search',params);}
        catch(error) {
          run.errors.push({keyword,country,message:error.message});
          break;
        }
        run.completedRequests++;
        if (response.filters_rejected?.length||response.filters_ignored?.length) {
          run.errors.push({keyword,country,message:SEARCH_RUN_MESSAGES.filtersRejected});
          continue;
        }
        for (const job of formatJobs(response.jobs||[],country)) {
          if (!ids.has(job.id)) {
            ids.add(job.id);
            run.jobs.push(job);
          }
        }
      }
      run.status=run.errors.length?'partial':'complete';
    } catch(error) {
      run.errors.push({message:error.message});
      run.status='failed';
    } finally {
      this.busy=false;
      run.finishedAt=new Date().toISOString();
      run.expiresAt=Date.now()+RUN_TTL_MS;
    }
  };
  getRun=id=>{
    const run=this.repository.findById(id);
    if (!run) throw Object.assign(new Error(SEARCH_RUN_MESSAGES.notFound),{statusCode:404});
    return run;
  };
}
