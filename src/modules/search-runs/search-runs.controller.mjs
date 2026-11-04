import { parseStartSearchRunInput } from './search-runs.validation.mjs';

export const createSearchRunsController = ({ service, targetCountry }) => {
  const startSearchRunHandler = (req, res) => {
    // Validation decides which request-body values are safe for the service.
    const { limit } = parseStartSearchRunInput(req.body);

    // The configured country comes from the server, not from user input.
    const run = service.startManualRun({
      country: targetCountry,
      limit
    });

    return res.status(202).json({
      ...run,
      pollUrl: `/v1/search-runs/${run.id}`
    });
  };

  const getSearchRunHandler = (req, res) => {
    const run = service.getRun(req.params.id);
    return res.status(200).json(run);
  };

  return Object.freeze({
    start: startSearchRunHandler,
    get: getSearchRunHandler
  });
};
