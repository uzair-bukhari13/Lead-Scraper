import { Router } from 'express';
import { createAuthRouter } from './modules/auth/index.mjs';
import { createHealthRouter } from './modules/health/health.routes.mjs';
import { createLeadRouter } from './modules/leads/index.mjs';
import { createSearchRunsRouter } from './modules/search-runs/index.mjs';

export const createRoutes=({mcp,leadService,searchRunsService,targetCountry,requireApiKey})=>{
  const router=Router();
  router.use('/health',createHealthRouter());
  router.use('/v1/auth/upwork',createAuthRouter({mcp,requireApiKey}));
  router.use('/v1/leads',createLeadRouter({leadService,requireApiKey}));
  router.use('/v1/search-runs',createSearchRunsRouter({
    service:searchRunsService,
    targetCountry,
    requireApiKey
  }));
  return router;
};
