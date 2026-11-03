import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';

export const parseMcpResult=result=>{
  if (result?.isError) throw new Error('Upwork MCP returned a tool error');
  if (result?.structuredContent&&typeof result.structuredContent==='object') return result.structuredContent;
  const content=(result?.content||[]).filter(item=>item.type==='text');
  for (const item of content) {
    try {return JSON.parse(item.text);} catch {/* Continue to the next text item. */}
  }
  return {text:content.map(item=>item.text).join('\n')};
};

export class UpworkMcpClient {
  constructor(provider,url='https://mcp.upwork.com/mcp') {
    this.provider=provider;
    this.url=new URL(url);
    if (this.url.protocol!=='https:'||this.url.hostname!=='mcp.upwork.com') throw new Error('Unexpected Upwork MCP origin');
    this.client=null;
    this.transport=null;
    this.pendingTransport=null;
    this.orgUid=null;
    this.toolNames=new Map();
    this.connecting=null;
  }
  #newConnection=async()=>{
    const client=new Client({name:'esclatech-upwork-client',version:'0.1.0'});
    const transport=new StreamableHTTPClientTransport(this.url,{authProvider:this.provider});
    await client.connect(transport);
    this.client=client;
    this.transport=transport;
    this.pendingTransport=null;
    await this.#discover();
    return client;
  };
  #discover=async()=>{
    const list=await this.client.listTools();
    for (const tool of list.tools||[]) {
      if (tool.name==='find_jobs'||tool.name.endsWith('__find_jobs')) this.toolNames.set('find_jobs',tool.name);
      if (tool.name==='list_accounts'||tool.name.endsWith('__list_accounts')) this.toolNames.set('list_accounts',tool.name);
    }
    if (!this.toolNames.has('find_jobs')||!this.toolNames.has('list_accounts')) {
      throw new Error('Upwork MCP tool names not found; check the connected account and MCP capabilities');
    }
    const accounts=await this.#callDirect('list_accounts',{});
    const account=accounts.accounts?.find(item=>item.role==='TALENT')||accounts.accounts?.[0];
    if (!account?.org_uid) throw new Error('No Upwork account org_uid available');
    this.orgUid=account.org_uid;
  };
  #callDirect=async(name,args)=>{
    const toolName=this.toolNames.get(name);
    if (!toolName) throw new Error(`MCP tool ${name} unavailable`);
    return parseMcpResult(await this.client.callTool({name:toolName,arguments:args}));
  };
  connect=async()=>{
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting=this.#newConnection().finally(()=>{this.connecting=null;});
    return this.connecting;
  };
  startOAuth=async()=>{
    if (this.client) return {connected:true};
    if (this.pendingTransport&&this.provider.authorizationUrl) return {connected:false,authorizationUrl:this.provider.authorizationUrl};
    const client=new Client({name:'esclatech-upwork-client',version:'0.1.0'});
    const transport=new StreamableHTTPClientTransport(this.url,{authProvider:this.provider});
    try {
      await client.connect(transport);
      this.client=client;
      this.transport=transport;
      await this.#discover();
      return {connected:true};
    } catch(error) {
      if (!(error instanceof UnauthorizedError)||!this.provider.authorizationUrl) throw error;
      this.pendingTransport=transport;
      return {connected:false,authorizationUrl:this.provider.authorizationUrl};
    }
  };
  finishOAuth=async params=>{
    if (!this.pendingTransport) throw new Error('OAuth pending session is missing; restart connection');
    const state=params.get('state');
    const code=params.get('code');
    if (!code||!this.provider.validCallbackState(state)) throw new Error('Invalid OAuth callback or expired state');
    await this.pendingTransport.finishAuth(code,params.get('iss')||undefined);
    this.provider.clearPending();
    this.pendingTransport=null;
    await this.#newConnection();
  };
  call=async(name,params={})=>{
    await this.connect();
    const output=await this.#callDirect('find_jobs',{action:name,org_uid:this.orgUid,params});
    if (output?.status==='error') throw new Error(output.reason||output.message||'Upwork tool action failed');
    return output;
  };
  status=()=>{
    return {connected:!!this.client,credentialPresent:!!this.provider.tokens(),orgUidAvailable:!!this.orgUid};
  };
  disconnect=async()=>{
    try {await this.client?.close();}
    finally {
      this.client=null;
      this.transport=null;
      this.pendingTransport=null;
      this.orgUid=null;
      this.toolNames.clear();
      this.provider.disconnect();
    }
  };
}
