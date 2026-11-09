import 'dotenv/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap } from '../src/app/bootstrap.mjs';

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const runtime = await bootstrap({
  projectDir,
  listenServer: false
});

const handler = (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const backendPath = requestUrl.searchParams.get('__path');

  if (backendPath !== null) {
    requestUrl.searchParams.delete('__path');
    const query = requestUrl.searchParams.toString();
    req.url = `/api/backend${backendPath.startsWith('/') ? backendPath : `/${backendPath}`}${query ? `?${query}` : ''}`;
  }

  runtime.server.emit('request', req, res);
};

export default handler;
