import { COUNTRIES } from './search.config.mjs';

const positiveInteger=(value,fallback,name)=>{
  const parsed=Number(value??fallback);
  if (!Number.isInteger(parsed)||parsed<1) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

export const loadEnvironment=(env=process.env)=>{
  const port=positiveInteger(env.PORT,5050,'PORT');
  const publicBaseUrl=env.PUBLIC_BASE_URL||`http://localhost:${port}`;
  const targetCountry=env.TARGET_COUNTRY||'United States';
  const apiKey=env.DASHBOARD_API_KEY;

  if (!apiKey||apiKey.length<32||apiKey.startsWith('REPLACE')) throw new Error('Set DASHBOARD_API_KEY to a random secret of 32+ characters');
  if (!/^[0-9a-fA-F]{64}$/.test(env.TOKEN_ENCRYPTION_KEY||'')) throw new Error('Set TOKEN_ENCRYPTION_KEY to 64 hex characters');
  if (!COUNTRIES.includes(targetCountry)) throw new Error('TARGET_COUNTRY must be United States or Canada');
  if (env.AUTOMATED_POLLING_ENABLED==='true') throw new Error('Automated recurring Upwork polling is disabled in this build');
  if (env.NODE_ENV==='production'&&!publicBaseUrl.startsWith('https://')) throw new Error('Use an HTTPS PUBLIC_BASE_URL in production');

  return Object.freeze({
    port,
    publicBaseUrl,
    targetCountry,
    apiKey,
    tokenEncryptionKey:env.TOKEN_ENCRYPTION_KEY,
    upworkMcpUrl:env.UPWORK_MCP_URL||'https://mcp.upwork.com/mcp',
    quota:Object.freeze({
      minute:positiveInteger(env.SEARCH_MINUTE_LIMIT,10,'SEARCH_MINUTE_LIMIT'),
      hour:positiveInteger(env.SEARCH_HOUR_LIMIT,100,'SEARCH_HOUR_LIMIT'),
      day:positiveInteger(env.SEARCH_DAY_LIMIT,500,'SEARCH_DAY_LIMIT'),
      gapMs:Math.max(7000,positiveInteger(env.SEARCH_MIN_GAP_MS,7000,'SEARCH_MIN_GAP_MS'))
    })
  });
};
