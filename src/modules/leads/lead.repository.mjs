import { LeadModel } from './lead.model.mjs';
import { mongoPaginate } from '../../middlewares/mongoose-pagination.middleware.mjs';

const toOptionalString = value => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const toOptionalDate = value => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toUniqueStrings = values =>
  [...new Set((values || []).filter(value => typeof value === 'string'))];

const createLeadUpsert = (lead, searchRunId) => ({
  updateOne: {
    filter: { externalId: lead.id },
    update: {
      $set: {
        title: lead.title,
        url: lead.url,
        source: lead.source,
        country: lead.country,
        budget: toOptionalString(lead.budget),
        jobType: toOptionalString(lead.jobType),
        duration: toOptionalString(lead.duration),
        postedAt: toOptionalDate(lead.postedAt),
        hasAttachments: lead.hasAttachments === true,
        summary: toOptionalString(lead.summary),
        lastSearchRunId: searchRunId
      },
      $setOnInsert: {
        externalId: lead.id
      },
      $addToSet: {
        searchedKeywords: {
          $each: toUniqueStrings(lead.searchedKeywords)
        },
        skills: {
          $each: toUniqueStrings(lead.skills)
        }
      }
    },
    upsert: true
  }
});

export const createLeadRepository = ({ model = LeadModel } = {}) => {
  const list = (filter = {}, options = {}) =>
    mongoPaginate(model, filter, options);

  const upsertMany = async (leads, { searchRunId }) => {
    if (!leads.length) {
      return null;
    }

    const operations = leads.map(lead =>
      createLeadUpsert(lead, searchRunId)
    );

    return model.bulkWrite(operations, { ordered: false });
  };

  return Object.freeze({
    list,
    upsertMany
  });
};
