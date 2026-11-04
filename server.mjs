import 'dotenv/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap } from './src/app/bootstrap.mjs';

const projectDir=dirname(fileURLToPath(import.meta.url));
await bootstrap({projectDir});
