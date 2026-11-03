import { SEARCH_RUN_MESSAGES } from './search-runs.messages.mjs';

export const parseStartSearchRunInput=body=>{
  const input=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
  const limit=input.limit??10;
  if (!Number.isInteger(limit)||limit<1||limit>10) {
    throw Object.assign(new Error(SEARCH_RUN_MESSAGES.invalidLimit),{statusCode:400});
  }
  return {limit};
};
