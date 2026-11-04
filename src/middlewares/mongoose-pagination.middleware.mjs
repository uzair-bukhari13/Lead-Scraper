const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const DEFAULT_SORT = '-createdAt';

const escapeRegExp = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const createSearchFilter = (filter, options) => {
  const findFilter = { ...(filter || {}) };
  const searchFields = Array.isArray(options.searchFields)
    ? options.searchFields.filter(
        field => typeof field === 'string' && field.trim()
      )
    : [];
  const searchValue = String(options.search || '').trim();

  if (!searchValue || searchFields.length === 0) {
    return findFilter;
  }

  const prefix = options.searchMode === 'startsWith' ? '^' : '';
  const regex = new RegExp(`${prefix}${escapeRegExp(searchValue)}`, 'i');
  const searchConditions = searchFields.map(field => ({
    [field.trim()]: regex
  }));

  findFilter.$or = Array.isArray(findFilter.$or)
    ? [...findFilter.$or, ...searchConditions]
    : searchConditions;

  return findFilter;
};

const createSort = sortBy => {
  if (!sortBy) {
    return DEFAULT_SORT;
  }

  const fields = String(sortBy)
    .split(',')
    .map(piece => {
      const [rawField, rawOrder] = piece.split(':');
      const field = rawField?.trim();

      if (!field) {
        return null;
      }

      const descending = rawOrder?.trim().toLowerCase() === 'desc';
      return `${descending ? '-' : ''}${field}`;
    })
    .filter(Boolean);

  return fields.length > 0 ? fields.join(' ') : DEFAULT_SORT;
};

const createNestedPopulate = path =>
  path
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .reduceRight(
      (populate, part) =>
        populate ? { path: part, populate } : { path: part },
      null
    );

const normalizePopulates = populate => {
  if (!populate) {
    return [];
  }

  if (Array.isArray(populate)) {
    return populate.filter(Boolean);
  }

  return String(populate)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const serializeDocument = (document, currentUserId) => {
  if (typeof document?.toJSON !== 'function') {
    return document;
  }

  return currentUserId
    ? document.toJSON({ currentUserId })
    : document.toJSON();
};

export const isMongooseModel = model =>
  Boolean(
    model &&
      typeof model.find === 'function' &&
      typeof model.countDocuments === 'function' &&
      model.collection
  );

export const mongoPaginate = async (
  model,
  filter = {},
  options = {},
  skipPagination = false
) => {
  if (!isMongooseModel(model)) {
    throw new TypeError('mongoPaginate: Expected a Mongoose model');
  }

  const findFilter = createSearchFilter(filter, options);
  const page = toPositiveInteger(options.page, DEFAULT_PAGE);
  const limit = toPositiveInteger(options.limit, DEFAULT_LIMIT);
  const skip = (page - 1) * limit;
  const sort = createSort(options.sortBy);

  const countPromise = model.countDocuments(findFilter).exec();
  let query = model.find(findFilter).sort(sort);

  if (!skipPagination) {
    query = query.skip(skip).limit(limit);
  }

  if (options.select) {
    query = query.select(options.select);
  }

  for (const populate of normalizePopulates(options.populate)) {
    if (typeof populate === 'string') {
      const nestedPopulate = createNestedPopulate(populate);

      if (nestedPopulate) {
        query = query.populate(nestedPopulate);
      }
    } else if (typeof populate === 'object') {
      query = query.populate(populate);
    }
  }

  const [totalResults, documents] = await Promise.all([
    countPromise,
    query.exec()
  ]);
  const totalPages = skipPagination
    ? 0
    : Math.ceil(totalResults / limit);
  const data = documents.map(document =>
    serializeDocument(document, options.currentUserId)
  );

  return {
    data,
    page,
    limit,
    totalPages,
    totalResults
  };
};
