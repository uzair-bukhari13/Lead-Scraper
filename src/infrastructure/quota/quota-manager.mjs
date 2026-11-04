import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const createQuotaError = (waitMs, window) => {
  const error = new Error(
    `Local Upwork safety limit reached (${window}); retry later`
  );

  error.name = 'QuotaError';
  error.statusCode = 429;
  error.retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));

  return error;
};

export const createQuotaManager = ({
  path,
  minute = 10,
  hour = 100,
  day = 500,
  gapMs = 7000,
  clock = () => Date.now()
} = {}) => {
  const limits = [
    { label: 'minute', ms: 60_000, max: minute },
    { label: 'hour', ms: 3_600_000, max: hour },
    { label: 'day', ms: 86_400_000, max: day }
  ];
  let history = [];

  if (path) {
    try {
      history = JSON.parse(readFileSync(path, 'utf8')).history || [];
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (!Array.isArray(history)) {
    throw new Error('Invalid quota store');
  }

  const prune = now => {
    history = history.filter(
      timestamp => Number.isFinite(timestamp) && timestamp >= now - 86_400_000
    );
  };

  const check = (now = clock()) => {
    prune(now);

    const lastRequestAt = history.at(-1);

    if (lastRequestAt !== undefined && now < lastRequestAt + gapMs) {
      return {
        waitMs: lastRequestAt + gapMs - now,
        window: 'spacing'
      };
    }

    for (const { label, ms, max } of limits) {
      const activeRequests = history.filter(timestamp => timestamp > now - ms);

      if (activeRequests.length >= max) {
        return {
          waitMs: activeRequests[activeRequests.length - max] + ms - now + 1,
          window: label
        };
      }
    }

    return null;
  };

  const persist = () => {
    if (!path) {
      return;
    }

    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

    const tempPath = `${path}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify({ history }), { mode: 0o600 });
    renameSync(tempPath, path);
  };

  const reserve = () => {
    const now = clock();
    const blocked = check(now);

    if (blocked) {
      throw createQuotaError(blocked.waitMs, blocked.window);
    }

    history.push(now);
    persist();
  };

  const nextAvailableMs = () => check()?.waitMs || 0;

  const stats = () => {
    const now = clock();
    prune(now);

    return {
      source: 'locally-recorded requests only',
      limits: Object.fromEntries(
        limits.map(({ label, max, ms }) => [
          label,
          {
            used: history.filter(timestamp => timestamp > now - ms).length,
            max
          }
        ])
      ),
      nextAllowedInSeconds: Math.ceil(nextAvailableMs() / 1000)
    };
  };

  return Object.freeze({
    check,
    reserve,
    nextAvailableMs,
    stats
  });
};
