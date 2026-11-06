import 'dotenv/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap } from './src/app/bootstrap.mjs';

const projectDir=dirname(fileURLToPath(import.meta.url));
let runtime;

try {
  runtime=await bootstrap({projectDir});
} catch (error) {
  if (error?.code==='EADDRINUSE') {
    console.error(
      `Cannot start backend: port ${process.env.PORT||5050} is already in use. Stop the other backend process or configure a different PORT.`
    );
  } else {
    console.error('Backend startup failed:',error);
  }
  process.exitCode=1;
}

if (runtime) {
  let stopping=false;
  const stop=async signal=>{
    if (stopping) return;
    stopping=true;
    console.log(`Received ${signal}; shutting down backend.`);

    try {
      await runtime.shutdown();
      process.exit(0);
    } catch (error) {
      console.error('Backend shutdown failed:',error);
      process.exit(1);
    }
  };

  for (const signal of ['SIGINT','SIGTERM','SIGUSR2']) {
    process.once(signal,()=>void stop(signal));
  }
}
