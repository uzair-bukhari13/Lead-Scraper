import { Router } from 'express';
import { asyncHandler } from '../../middlewares/async-handler.mjs';
import { createLeadController } from './lead.controller.mjs';

export const createLeadRouter = ({ leadService, requireApiKey }) => {
  const router = Router();
  const controller = createLeadController(leadService);

  router.get('/', requireApiKey, asyncHandler(controller.list));

  return router;
};
