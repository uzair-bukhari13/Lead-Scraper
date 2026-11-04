import { LEAD_MESSAGES } from './lead.messages.mjs';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = new Set([
  'title',
  'country',
  'postedAt',
  'createdAt',
  'updatedAt'
]);

const createValidationError = message =>
  Object.assign(new Error(message), { statusCode: 400 });

const parsePositiveInteger = (value, fallback, message, maximum = Infinity) => {
  if (typeof value === 'undefined') {
    return fallback;
  }

  if (!/^\d+$/.test(String(value))) {
    throw createValidationError(message);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw createValidationError(message);
  }

  return parsed;
};

const parseUtcDate = value => {
  const match = String(value).match(DATE_PATTERN);

  if (!match) {
    throw createValidationError(LEAD_MESSAGES.INVALID_DATE);
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createValidationError(LEAD_MESSAGES.INVALID_DATE);
  }

  return date;
};

const addUtcDays = (date, days) =>
  new Date(date.getTime() + days * 86_400_000);

const parseUtcMonthRange = value => {
  const match = String(value).match(MONTH_PATTERN);

  if (!match) {
    throw createValidationError(LEAD_MESSAGES.INVALID_MONTH);
  }

  const [, yearValue, monthValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (month < 1 || month > 12) {
    throw createValidationError(LEAD_MESSAGES.INVALID_MONTH);
  }

  return {
    $gte: new Date(Date.UTC(year, month - 1, 1)),
    $lt: new Date(Date.UTC(year, month, 1))
  };
};

const createPostedAtFilter = (query, now) => {
  const hasDate = typeof query.date !== 'undefined';
  const hasMonth = typeof query.month !== 'undefined';
  const hasRange =
    typeof query.fromDate !== 'undefined' ||
    typeof query.toDate !== 'undefined';
  const activeModes = [hasDate, hasMonth, hasRange].filter(Boolean).length;

  if (activeModes > 1) {
    throw createValidationError(LEAD_MESSAGES.INVALID_DATE_FILTER);
  }

  if (hasMonth) {
    return parseUtcMonthRange(query.month);
  }

  if (hasRange) {
    const fromDate = query.fromDate
      ? parseUtcDate(query.fromDate)
      : null;
    const toDate = query.toDate
      ? parseUtcDate(query.toDate)
      : null;

    if (fromDate && toDate && toDate < fromDate) {
      throw createValidationError(LEAD_MESSAGES.INVALID_DATE_RANGE);
    }

    return {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toDate ? { $lt: addUtcDays(toDate, 1) } : {})
    };
  }

  const date = hasDate
    ? parseUtcDate(query.date)
    : parseUtcDate(now.toISOString().slice(0, 10));

  return {
    $gte: date,
    $lt: addUtcDays(date, 1)
  };
};

const parseSortBy = value => {
  if (!value) {
    return 'postedAt:desc';
  }

  const pieces = String(value).split(',');

  for (const piece of pieces) {
    const [field, direction = 'asc', extra] = piece
      .split(':')
      .map(part => part.trim());

    if (
      extra ||
      !ALLOWED_SORT_FIELDS.has(field) ||
      !['asc', 'desc'].includes(direction.toLowerCase())
    ) {
      throw createValidationError(LEAD_MESSAGES.INVALID_SORT);
    }
  }

  return pieces.join(',');
};

const parseSearchedKeyword = value => {
  if (typeof value === 'undefined') {
    return '';
  }

  if (typeof value !== 'string' || value.trim().length > 100) {
    throw createValidationError(LEAD_MESSAGES.INVALID_KEYWORD);
  }

  return value.trim();
};

export const parseLeadListQuery = (query = {}, { now = new Date() } = {}) => ({
  filter: {
    postedAt: createPostedAtFilter(query, now)
  },
  options: {
    page: parsePositiveInteger(query.page, 1, LEAD_MESSAGES.INVALID_PAGE),
    limit: parsePositiveInteger(
      query.limit,
      10,
      LEAD_MESSAGES.INVALID_LIMIT,
      MAX_LIMIT
    ),
    search: parseSearchedKeyword(query.searchedKeyword),
    searchFields: ['searchedKeywords'],
    sortBy: parseSortBy(query.sortBy)
  }
});
