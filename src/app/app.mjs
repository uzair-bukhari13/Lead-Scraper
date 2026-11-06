import express from 'express';
import { createApiKeyMiddleware } from '../middlewares/api-key.middleware.mjs';
import { createCorsMiddleware } from '../middlewares/cors.middleware.mjs';
import { errorHandler, notFoundHandler } from '../middlewares/error.middleware.mjs';
import { createRoutes } from '../routes.mjs';

export const createApp=({apiKey,frontendOrigin,mcp,leadService,searchRunsService,targetCountry,allowHttpSearchStart=true})=>{
  const app=express();
  app.disable('x-powered-by');
  app.use((req,_res,next)=>{
    for (const functionPrefix of ['/api/backend', '/backend']) {
      if (req.url===functionPrefix||req.url.startsWith(`${functionPrefix}/`)) {
        req.url=req.url.slice(functionPrefix.length)||'/';
        break;
      }
    }
    next();
  });
  app.use(createCorsMiddleware(frontendOrigin));
  app.use(express.json({limit:'12kb'}));
  app.use((_req,res,next)=>{
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    next();
  });

  const requireApiKey=createApiKeyMiddleware(apiKey);
  app.use(createRoutes({mcp,leadService,searchRunsService,targetCountry,requireApiKey,allowHttpSearchStart}));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
