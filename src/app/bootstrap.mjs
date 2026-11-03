import { join } from 'node:path';
import { loadEnvironment } from '../config/env.mjs';
import { EncryptedFile } from '../infrastructure/persistence/encrypted-file.mjs';
import { QuotaManager } from '../infrastructure/quota/quota-manager.mjs';
import { UpworkOAuthProvider } from '../infrastructure/upwork/oauth-provider.mjs';
import { UpworkMcpClient } from '../infrastructure/upwork/upwork-mcp.client.mjs';
import { SearchRunRepository, SearchRunsService } from '../modules/search-runs/index.mjs';
import { createApp } from './app.mjs';

export const bootstrap=({projectDir,env=process.env}={})=>{
  if (!projectDir) throw new Error('projectDir is required');
  const config=loadEnvironment(env);
  const secureFile=new EncryptedFile(
    join(projectDir,'data','upwork-oauth.enc.json'),
    config.tokenEncryptionKey
  );
  const provider=new UpworkOAuthProvider(secureFile,config.publicBaseUrl);
  const mcp=new UpworkMcpClient(provider,config.upworkMcpUrl);
  const quota=new QuotaManager({
    path:join(projectDir,'data','quota.json'),
    ...config.quota
  });
  const searchRunRepository=new SearchRunRepository();
  const searchRunsService=new SearchRunsService(mcp,quota,searchRunRepository);
  const app=createApp({
    apiKey:config.apiKey,
    mcp,
    searchRunsService,
    targetCountry:config.targetCountry
  });
  const server=app.listen(config.port,()=>{
    console.log(`Esclatech Upwork MCP backend listening on ${config.publicBaseUrl}; manual searches only.`);
  });
  return {app,server,config,mcp,quota,searchRunsService};
};
