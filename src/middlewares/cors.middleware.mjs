const ALLOWED_METHODS = 'GET,POST,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,x-api-key';

export const createCorsMiddleware = frontendOrigin =>
  (req, res, next) => {
    const requestOrigin = req.get('origin');

    if (requestOrigin === frontendOrigin) {
      res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  };
