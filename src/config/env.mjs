import { COUNTRIES } from './search.config.mjs';

const positiveInteger=(value,fallback,name)=>{
  const parsed=Number(value??fallback);
  if (!Number.isInteger(parsed)||parsed<1) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

export const loadEnvironment=(env=process.env)=>{
  const port=positiveInteger(env.PORT,5050,'PORT');
  const publicBaseUrl=env.PUBLIC_BASE_URL||`http://localhost:${port}`;
  const frontendOrigin=new URL(env.FRONTEND_ORIGIN||publicBaseUrl).origin;
  const targetCountry=env.TARGET_COUNTRY||'United States';
  const isVercel=env.VERCEL==='1'||env.VERCEL==='true';
  // Vercel strips the function route prefix (/api) before dispatching to the
  // exported server. The catch-all function then receives /backend/socket.io.
  const socketPath=env.SOCKET_IO_PATH||(isVercel?'/backend/socket.io':'/socket.io');
  const apiKey=env.DASHBOARD_API_KEY;
  const mongodbUri=env.MONGODB_URI;

  if (!apiKey||apiKey.length<32||apiKey.startsWith('REPLACE')) throw new Error('Set DASHBOARD_API_KEY to a random secret of 32+ characters');
  if (!mongodbUri||!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri)) throw new Error('Set MONGODB_URI to a valid MongoDB connection string');
  if (!/^[0-9a-fA-F]{64}$/.test(env.TOKEN_ENCRYPTION_KEY||'')) throw new Error('Set TOKEN_ENCRYPTION_KEY to 64 hex characters');
  if (!COUNTRIES.includes(targetCountry)) throw new Error('TARGET_COUNTRY must be United States or Canada');
  if (env.AUTOMATED_POLLING_ENABLED==='true') throw new Error('Automated recurring Upwork polling is disabled in this build');
  if (env.NODE_ENV==='production'&&!publicBaseUrl.startsWith('https://')) throw new Error('Use an HTTPS PUBLIC_BASE_URL in production');
  if (!socketPath.startsWith('/')) throw new Error('SOCKET_IO_PATH must start with /');

  return Object.freeze({
    port,
    publicBaseUrl,
    frontendOrigin,
    socketPath,
    isVercel,
    targetCountry,
    apiKey,
    mongodbUri,
    mongodbDatabaseName:env.MONGODB_DATABASE_NAME||'esclatech_upwork',
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
