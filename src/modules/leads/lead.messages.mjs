export const LEAD_MESSAGES = Object.freeze({
  INVALID_DATE_FILTER:
    'Use only one date filter mode: date, month, or fromDate/toDate',
  INVALID_DATE: 'date, fromDate and toDate must use YYYY-MM-DD',
  INVALID_MONTH: 'month must use YYYY-MM',
  INVALID_DATE_RANGE: 'toDate must be on or after fromDate',
  INVALID_PAGE: 'page must be a positive integer',
  INVALID_LIMIT: 'limit must be an integer from 1 to 100',
  INVALID_SORT: 'sortBy contains an unsupported field or direction',
  INVALID_KEYWORD: 'searchedKeyword must be a string of 100 characters or fewer'
});
