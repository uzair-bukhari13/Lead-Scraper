import { parseStartSearchRunInput } from './search-runs.validation.mjs';

export const createSearchRunsController = ({ service, targetCountry }) => {
  const startSearchRunHandler = (req, res) => {
    // Validation decides which request-body values are safe for the service.
    const { limit, keywords, country } = parseStartSearchRunInput(req.body);

    const run = service.startManualRun({
      country: country ?? targetCountry,
      limit,
      keywords
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
