import { Router } from 'express';
import { asyncHandler } from '../../middlewares/async-handler.mjs';
import { createSearchRunsController } from './search-runs.controller.mjs';

export const createSearchRunsRouter=({service,targetCountry,requireApiKey})=>{
  const router=Router();
  const controller=createSearchRunsController({service,targetCountry});
  router.post('/',requireApiKey,asyncHandler(controller.start));
  router.get('/:id',requireApiKey,asyncHandler(controller.get));
  return router;
};
