import 'dotenv/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap } from '../src/app/bootstrap.mjs';

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const runtime = await bootstrap({
  projectDir,
  listenServer: false
});

export default runtime.server;
