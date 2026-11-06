import { Router } from 'express';
import { asyncHandler } from '../../middlewares/async-handler.mjs';
import { createSearchRunsController } from './search-runs.controller.mjs';

export const createSearchRunsRouter=({service,targetCountry,requireApiKey,allowHttpStart=true})=>{
  const router=Router();
  const controller=createSearchRunsController({service,targetCountry});
  if (allowHttpStart) {
    router.post('/',requireApiKey,asyncHandler(controller.start));
  } else {
    router.post('/',requireApiKey,(_req,res)=>res.status(405).json({
      error:'Start searches through the authenticated search-run:start Socket.IO event'
    }));
  }
  router.get('/:id',requireApiKey,asyncHandler(controller.get));
  return router;
};
