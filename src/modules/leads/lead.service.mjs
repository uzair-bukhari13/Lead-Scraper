export const createLeadService = leadRepository => {
  const listLeads = (filter, options) =>
    leadRepository.list(filter, options);

  return Object.freeze({
    listLeads
  });
};
