export const createSearchRunRepository = ({ clock = () => Date.now() } = {}) => {
  const runs = new Map();

  const removeExpired = () => {
    const now = clock();

    for (const [id, run] of runs) {
      if (run.expiresAt < now && run.status !== 'running') {
        runs.delete(id);
      }
    }
  };

  const create = run => {
    runs.set(run.id, run);
    return run;
  };

  const findById = id => {
    removeExpired();
    return runs.get(id) || null;
  };

  return Object.freeze({
    create,
    findById,
    removeExpired
  });
};
