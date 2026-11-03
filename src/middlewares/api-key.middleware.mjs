import { timingSafeEqual } from 'node:crypto';

export const createApiKeyMiddleware=apiKey=>{
  const expected=Buffer.from(apiKey,'utf8');
  return (req,res,next)=>{
    const given=Buffer.from(req.get('x-api-key')||'','utf8');
    if (expected.length!==given.length||!timingSafeEqual(expected,given)) {
      return res.status(401).json({error:'unauthorized'});
    }
    next();
  };
};
