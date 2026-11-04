import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const parseMcpResult = result => {
  if (result?.isError) {
    throw new Error('Upwork MCP returned a tool error');
  }

  if (
    result?.structuredContent &&
    typeof result.structuredContent === 'object'
  ) {
    return result.structuredContent;
  }

  const textContent = (result?.content || []).filter(
    item => item.type === 'text'
  );

  for (const item of textContent) {
    try {
      return JSON.parse(item.text);
    } catch {
      // Continue to the next text item.
    }
  }

  return {
    text: textContent.map(item => item.text).join('\n')
  };
};

export const createUpworkMcpClient = (
  provider,
  endpoint = 'https://mcp.upwork.com/mcp'
) => {
  const url = new URL(endpoint);

  if (url.protocol !== 'https:' || url.hostname !== 'mcp.upwork.com') {
    throw new Error('Unexpected Upwork MCP origin');
  }

  let client = null;
  let transport = null;
  let pendingTransport = null;
  let orgUid = null;
  let connecting = null;
  const toolNames = new Map();

  const callDirect = async (name, args) => {
    const toolName = toolNames.get(name);

    if (!toolName) {
      throw new Error(`MCP tool ${name} unavailable`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    return parseMcpResult(result);
  };

  const discover = async () => {
    const list = await client.listTools();

    for (const tool of list.tools || []) {
      if (tool.name === 'find_jobs' || tool.name.endsWith('__find_jobs')) {
        toolNames.set('find_jobs', tool.name);
      }

      if (
        tool.name === 'list_accounts' ||
        tool.name.endsWith('__list_accounts')
      ) {
        toolNames.set('list_accounts', tool.name);
      }
    }

    if (!toolNames.has('find_jobs') || !toolNames.has('list_accounts')) {
      throw new Error(
        'Upwork MCP tool names not found; check the connected account and MCP capabilities'
      );
    }

    const accounts = await callDirect('list_accounts', {});
    const account =
      accounts.accounts?.find(item => item.role === 'TALENT') ||
      accounts.accounts?.[0];

    if (!account?.org_uid) {
      throw new Error('No Upwork account org_uid available');
    }

    orgUid = account.org_uid;
  };

  const openConnection = async () => {
    const nextClient = new Client({
      name: 'esclatech-upwork-client',
      version: '0.1.0'
    });
    const nextTransport = new StreamableHTTPClientTransport(url, {
      authProvider: provider
    });

    await nextClient.connect(nextTransport);

    client = nextClient;
    transport = nextTransport;
    pendingTransport = null;

    await discover();
    return client;
  };

  const connect = async () => {
    if (client) {
      return client;
    }

    if (connecting) {
      return connecting;
    }

    connecting = openConnection().finally(() => {
      connecting = null;
    });

    return connecting;
  };

  const startOAuth = async () => {
    if (client) {
      return { connected: true };
    }

    if (pendingTransport && provider.authorizationUrl) {
      return {
        connected: false,
        authorizationUrl: provider.authorizationUrl
      };
    }

    const nextClient = new Client({
      name: 'esclatech-upwork-client',
      version: '0.1.0'
    });
    const nextTransport = new StreamableHTTPClientTransport(url, {
      authProvider: provider
    });

    try {
      await nextClient.connect(nextTransport);
      client = nextClient;
      transport = nextTransport;
      await discover();

      return { connected: true };
    } catch (error) {
      if (
        !(error instanceof UnauthorizedError) ||
        !provider.authorizationUrl
      ) {
        throw error;
      }

      pendingTransport = nextTransport;

      return {
        connected: false,
        authorizationUrl: provider.authorizationUrl
      };
    }
  };

  const finishOAuth = async params => {
    if (!pendingTransport) {
      throw new Error(
        'OAuth pending session is missing; restart connection'
      );
    }

    const state = params.get('state');
    const code = params.get('code');

    if (!code || !provider.validCallbackState(state)) {
      throw new Error('Invalid OAuth callback or expired state');
    }

    await pendingTransport.finishAuth(
      code,
      params.get('iss') || undefined
    );

    provider.clearPending();
    pendingTransport = null;
    await openConnection();
  };

  const call = async (name, params = {}) => {
    await connect();

    const output = await callDirect('find_jobs', {
      action: name,
      org_uid: orgUid,
      params
    });

    if (output?.status === 'error') {
      throw new Error(
        output.reason || output.message || 'Upwork tool action failed'
      );
    }

    return output;
  };

  const status = () => ({
    connected: Boolean(client),
    credentialPresent: Boolean(provider.tokens()),
    orgUidAvailable: Boolean(orgUid)
  });

  const disconnect = async () => {
    try {
      await client?.close();
    } finally {
      client = null;
      transport = null;
      pendingTransport = null;
      orgUid = null;
      toolNames.clear();
      provider.disconnect();
    }
  };

  return Object.freeze({
    connect,
    startOAuth,
    finishOAuth,
    call,
    status,
    disconnect
  });
};
