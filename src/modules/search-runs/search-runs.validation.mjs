import { SEARCH_RUN_MESSAGES } from './search-runs.messages.mjs';
import { normalizeCountry } from '../../config/search.config.mjs';

const parseKeywords=value=>{
  if (typeof value==='undefined') return undefined;
  if (!Array.isArray(value)||value.length<1||value.length>13) {
    throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidKeywords),{statusCode:400});
  }

  const keywords=[...new Set(value.map(keyword=>{
    if (typeof keyword!=='string') {
      throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidKeywords),{statusCode:400});
    }
    const cleaned=keyword.trim();
    if (!cleaned||cleaned.length>80) {
      throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidKeywords),{statusCode:400});
    }
    return cleaned;
  }))];

  if (keywords.length<1||keywords.length>13) {
    throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidKeywords),{statusCode:400});
  }
  return keywords;
};

export const parseStartSearchRunInput=body=>{
  const input=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
  const limit=input.limit??10;
  if (!Number.isInteger(limit)||limit<1||limit>50) {
    throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidLimit),{statusCode:400});
  }
  let country;
  if (typeof input.country!=='undefined') {
    country=normalizeCountry(input.country);
    if (!country) {
      throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidCountry),{statusCode:400});
    }
  }
  return {
    limit,
    keywords:parseKeywords(input.keywords),
    ...(country?{country}:{})
  };
};
