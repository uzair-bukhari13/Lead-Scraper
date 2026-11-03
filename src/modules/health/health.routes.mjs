import { Router } from 'express';

export const createHealthRouter=()=>{
  const router=Router();
  router.get('/',(_req,res)=>res.json({
    ok:true,
    service:'esclatech-upwork-mcp-backend',
    scheduledCollection:false
  }));
  return router;
};
