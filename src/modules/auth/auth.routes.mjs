import { Router } from 'express';
import { asyncHandler } from '../../middlewares/async-handler.mjs';

export const createAuthRouter=({mcp,requireApiKey})=>{
  const router=Router();

  router.get('/status',requireApiKey,asyncHandler(async(_req,res)=>res.json(await mcp.status())));
  router.post('/start',requireApiKey,asyncHandler(async(_req,res)=>{
    const result=await mcp.startOAuth();
    res.status(result.connected?200:202).json(result);
  }));
  router.get('/callback',asyncHandler(async(req,res)=>{
    if (req.query.error) return res.status(400).type('text/plain').send('Upwork authorization was not completed.');
    const params=new URLSearchParams(req.originalUrl.split('?')[1]||'');
    await mcp.finishOAuth(params);
    res.status(200).type('text/plain').send('Upwork connected successfully. You can return to the Esclatech dashboard.');
  }));
  router.post('/disconnect',requireApiKey,asyncHandler(async(_req,res)=>{
    await mcp.disconnect();
    res.json({connected:false,note:'Local tokens cleared. Revoke authorization in Upwork settings as well.'});
  }));

  return router;
};
