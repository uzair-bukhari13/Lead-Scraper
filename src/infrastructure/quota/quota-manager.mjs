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
  collection,
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

  if (collection) {
    const stateId = 'upwork-search-quota';
    const ensureState = async () => {
      try {
        await collection.updateOne(
          { _id: stateId },
          { $setOnInsert: { history: [] } },
          { upsert: true }
        );
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    };

    const readHistory = async () => {
      await ensureState();
      const state = await collection.findOne({ _id: stateId });
      return Array.isArray(state?.history) ? state.history : [];
    };

    const blockedBy = (history, now) => {
      const activeHistory = history.filter(
        timestamp => Number.isFinite(timestamp) && timestamp >= now - 86_400_000
      );
      const lastRequestAt = activeHistory.at(-1);

      if (lastRequestAt !== undefined && now < lastRequestAt + gapMs) {
        return {
          waitMs: lastRequestAt + gapMs - now,
          window: 'spacing'
        };
      }

      for (const { label, ms, max } of limits) {
        const activeRequests = activeHistory.filter(
          timestamp => timestamp > now - ms
        );

        if (activeRequests.length >= max) {
          return {
            waitMs: activeRequests[activeRequests.length - max] + ms - now + 1,
            window: label
          };
        }
      }

      return null;
    };

    const checkMongo = async (now = clock()) =>
      blockedBy(await readHistory(), now);

    const reserveMongo = async () => {
      const now = clock();
      const conditions = [
        {
          $or: [
            { $eq: [{ $size: '$history' }, 0] },
            {
              $lte: [
                { $add: [{ $arrayElemAt: ['$history', -1] }, gapMs] },
                now
              ]
            }
          ]
        },
        ...limits.map(({ ms, max }) => ({
          $lt: [
            {
              $size: {
                $filter: {
                  input: '$history',
                  as: 'timestamp',
                  cond: { $gt: ['$$timestamp', now - ms] }
                }
              }
            },
            max
          ]
        }))
      ];

      await ensureState();
      const result = await collection.updateOne(
        { _id: stateId, $expr: { $and: conditions } },
        [
          {
            $set: {
              history: {
                $concatArrays: [
                  {
                    $filter: {
                      input: '$history',
                      as: 'timestamp',
                      cond: { $gte: ['$$timestamp', now - 86_400_000] }
                    }
                  },
                  [now]
                ]
              }
            }
          }
        ]
      );

      if (result.modifiedCount === 1) {
        return;
      }

      const blocked = blockedBy(await readHistory(), now);
      if (blocked) {
        throw createQuotaError(blocked.waitMs, blocked.window);
      }

      throw new Error('Could not reserve an Upwork quota slot');
    };

    const statsMongo = async () => {
      const now = clock();
      const history = await readHistory();
      const blocked = blockedBy(history, now);

      return {
        source: 'MongoDB-persisted requests',
        limits: Object.fromEntries(
          limits.map(({ label, max, ms }) => [
            label,
            {
              used: history.filter(timestamp => timestamp > now - ms).length,
              max
            }
          ])
        ),
        nextAllowedInSeconds: Math.ceil((blocked?.waitMs || 0) / 1000)
      };
    };

    return Object.freeze({
      check: checkMongo,
      reserve: reserveMongo,
      nextAvailableMs: async () => (await checkMongo())?.waitMs || 0,
      stats: statsMongo
    });
  }

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
