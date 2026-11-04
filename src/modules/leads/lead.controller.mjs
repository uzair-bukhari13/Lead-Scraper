import { parseLeadListQuery } from './lead.validation.mjs';

export const createLeadController = leadService => {
  const listLeadsHandler = async (req, res) => {
    const { filter, options } = parseLeadListQuery(req.query);
    const result = await leadService.listLeads(filter, options);

    return res.status(200).json(result);
  };

  return Object.freeze({
    list: listLeadsHandler
  });
};
