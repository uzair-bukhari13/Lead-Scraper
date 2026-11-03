import 'dotenv/config';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KEYWORDS, COUNTRIES } from './config.mjs';
import { EncryptedFile } from './secure-file.mjs';
import { UpworkOAuthProvider } from './oauth.mjs';
import { QuotaManager } from './quota.mjs';
import { UpworkMcp } from './mcp.mjs';
import { SearchService } from './jobs.mjs';

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const env = process.env;
const port = Number(env.PORT || 5050);
const baseUrl = env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const targetCountry = env.TARGET_COUNTRY || 'United States';
const apiKey = env.DASHBOARD_API_KEY;
if (!apiKey || apiKey.length < 32 || apiKey.startsWith('REPLACE')) throw new Error('Set DASHBOARD_API_KEY to a random secret of 32+ characters');
if (!env.TOKEN_ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(env.TOKEN_ENCRYPTION_KEY)) throw new Error('Set TOKEN_ENCRYPTION_KEY to 64 hex characters');
if (!COUNTRIES.includes(targetCountry)) throw new Error('TARGET_COUNTRY must be United States or Canada');
if (env.AUTOMATED_POLLING_ENABLED === 'true') throw new Error('Automated recurring Upwork polling is disabled in this build');
if (env.NODE_ENV === 'production' && !baseUrl.startsWith('https://')) throw new Error('Use an HTTPS PUBLIC_BASE_URL in production');

const secureFile = new EncryptedFile(join(projectDir,'data','upwork-oauth.enc.json'),env.TOKEN_ENCRYPTION_KEY);
const provider = new UpworkOAuthProvider(secureFile,baseUrl);
const mcp = new UpworkMcp(provider,env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp');
const quota = new QuotaManager({
  path:join(projectDir,'data','quota.json'),
  minute:Number(env.SEARCH_MINUTE_LIMIT || 10),
  hour:Number(env.SEARCH_HOUR_LIMIT || 100),
  day:Number(env.SEARCH_DAY_LIMIT || 500),
  gapMs:Math.max(7000,Number(env.SEARCH_MIN_GAP_MS || 7000))
});
const search = new SearchService(mcp,quota);
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'12kb'}));
app.use((_req,res,next)=>{
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  next();
});

function requireApiKey(req,res,next) {
  const received = req.get('x-api-key') || '';
  const expected = Buffer.from(apiKey,'utf8');
  const given = Buffer.from(received,'utf8');
  if (expected.length !== given.length || !timingSafeEqual(expected,given)) return res.status(401).json({error:'unauthorized'});
  next();
}
const handle = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);

app.get('/health', (_req,res) => res.json({ok:true,service:'esclatech-upwork-mcp-backend',scheduledCollection:false}));
app.get('/v1/config', requireApiKey,(_req,res)=>res.json({keywords:KEYWORDS,targetCountry,plannedRequests:KEYWORDS.length,automatedPolling:false}));
app.get('/v1/quota', requireApiKey,(_req,res)=>res.json(quota.stats()));
app.get('/v1/auth/upwork/status', requireApiKey,(_req,res)=>res.json(mcp.status()));
app.post('/v1/auth/upwork/start', requireApiKey, handle(async(_req,res)=>{
  const result=await mcp.startOAuth();
  res.status(result.connected?200:202).json(result);
}));
app.get('/v1/auth/upwork/callback', handle(async(req,res)=>{
  if (req.query.error) return res.status(400).type('text/plain').send('Upwork authorization was not completed.');
  const params=new URLSearchParams(req.originalUrl.split('?')[1]||'');
  await mcp.finishOAuth(params);
  res.status(200).type('text/plain').send('Upwork connected successfully. You can return to the Esclatech dashboard.');
}));
app.post('/v1/auth/upwork/disconnect', requireApiKey, handle(async(_req,res)=>{
  await mcp.disconnect();res.json({connected:false,note:'Local tokens cleared. Revoke authorization in Upwork settings as well.'});
}));
app.post('/v1/jobs/search',requireApiKey,handle(async(req,res)=>{
  const {keyword,country,limit=10}=req.body||{};
  if(typeof keyword!=='string'||!keyword.trim()||keyword.length>80) return res.status(400).json({error:'keyword must be a 1–80 character string'});
  if(!COUNTRIES.includes(country)) return res.status(400).json({error:'country must be United States or Canada'});
  if(!Number.isInteger(limit)||limit<1||limit>10) return res.status(400).json({error:'limit must be 1–10'});
  const result=await search.searchOnce({keyword:keyword.trim(),country,limit});
  res.json({source:'Upwork',...result});
}));
const startManualSearchRun = handle(async(req,res)=>{
  const {limit=10}=req.body||{};
  const run=search.startManualRun({country:targetCountry,limit});
  res.status(202).json({...run,pollUrl:`/v1/search-runs/${run.id}`});
});
app.post('/v1/search-runs',requireApiKey,startManualSearchRun);
app.post('/v1/jobs/search-batch',requireApiKey,startManualSearchRun);
app.get('/v1/jobs/search-runs/:id',requireApiKey,handle(async(req,res)=>res.json(search.getRun(req.params.id))));
app.get('/v1/search-runs/:id',requireApiKey,handle(async(req,res)=>res.json(search.getRun(req.params.id))));
app.get('/v1/jobs/:id',requireApiKey,handle(async(req,res)=>{
  if (!/^\d{10,22}$/.test(req.params.id)) return res.status(400).json({error:'Invalid Upwork numeric job id'});
  res.json(await search.jobDetail(req.params.id));
}));
app.use((err,_req,res,_next)=>{
  // Don't leak OAuth codes, credentials, raw job descriptions or provider errors.
  const status=Number(err.statusCode)||500;
  const isSafe=status>=400&&status<500;
  const safeMessage=isSafe ? err.message : 'Unexpected server or MCP error. Check backend logs.';
  if (status>=500) console.error('Backend error:',err?.name || 'Error');
  res.status(status).json({error:safeMessage,...(err.retryAfterSeconds?{retryAfterSeconds:err.retryAfterSeconds}:{})});
});
app.listen(port,()=>console.log(`Esclatech Upwork MCP backend listening on ${baseUrl}; manual searches only.`));
