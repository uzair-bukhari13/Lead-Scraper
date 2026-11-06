import { createServer } from 'node:http';
import { loadEnvironment } from '../config/env.mjs';
import { connectMongoDatabase } from '../infrastructure/database/mongodb.mjs';
import { createEncryptedMongoStore } from '../infrastructure/persistence/encrypted-mongo-store.mjs';
import { createQuotaManager } from '../infrastructure/quota/quota-manager.mjs';
import { createUpworkOAuthProvider } from '../infrastructure/upwork/oauth-provider.mjs';
import { createUpworkMcpClient } from '../infrastructure/upwork/upwork-mcp.client.mjs';
import {
  createSearchRunRepository,
  createSearchRunsService,
  createSearchRunsSocket
} from '../modules/search-runs/index.mjs';
import {
  createLeadRepository,
  createLeadService
} from '../modules/leads/index.mjs';
import { createApp } from './app.mjs';

const listen = (server, port) =>
  new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });

const closeHttpServer = server =>
  new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });

export const bootstrap = async ({
  projectDir,
  env = process.env,
  listenServer = true
} = {}) => {
  if (!projectDir) {
    throw new Error('projectDir is required');
  }

  const config = loadEnvironment(env);
  const database = await connectMongoDatabase({
    uri: config.mongodbUri,
    databaseName: config.mongodbDatabaseName
  });
  const secureStore = createEncryptedMongoStore({
    collection: database.connection.collection('application_state'),
    keyHex: config.tokenEncryptionKey
  });
  const provider = createUpworkOAuthProvider(
    secureStore,
    config.publicBaseUrl
  );
  const mcp = createUpworkMcpClient(provider, config.upworkMcpUrl);
  const quota = createQuotaManager({
    collection: database.connection.collection('application_state'),
    ...config.quota
  });
  const searchRunRepository = createSearchRunRepository();
  const leadRepository = createLeadRepository();
  const leadService = createLeadService(leadRepository);
  const searchRunsSocket = createSearchRunsSocket({
    apiKey: config.apiKey,
    frontendOrigin: config.frontendOrigin,
    path: config.socketPath,
    startSearchRun: input =>
      searchRunsService.startManualRun({
        ...input,
        country: config.targetCountry,
        onRunCreated: run =>
          searchRunsSocket.joinRunRoom(input.socket, run.id)
      })
  });
  const searchRunsService = createSearchRunsService(
    mcp,
    quota,
    searchRunRepository,
    {
      publishProgress: searchRunsSocket.publishProgress,
      leadRepository
    }
  );
  const app = createApp({
    apiKey: config.apiKey,
    frontendOrigin: config.frontendOrigin,
    mcp,
    leadService,
    searchRunsService,
    targetCountry: config.targetCountry,
    allowHttpSearchStart: !config.isVercel
  });
  const server = createServer(app);

  searchRunsSocket.attach(server);
  if (listenServer) {
    try {
      await listen(server, config.port);
    } catch (error) {
      await searchRunsSocket.close().catch(() => {});
      await database.disconnect().catch(() => {});
      throw error;
    }
  }

  if (listenServer) {
    console.log(
      `Esclatech Upwork MCP backend listening on ${config.publicBaseUrl}; manual searches only.`
    );
  }

  let shutdownPromise = null;
  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      await searchRunsSocket.close();
      await closeHttpServer(server);
      await database.disconnect();
    })();

    return shutdownPromise;
  };

  return {
    app,
    server,
    config,
    mcp,
    quota,
    database,
    leadRepository,
    leadService,
    searchRunsService,
    searchRunsSocket,
    shutdown
  };
};
