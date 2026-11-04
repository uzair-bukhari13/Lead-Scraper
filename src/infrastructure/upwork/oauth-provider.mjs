import { randomBytes } from 'node:crypto';

export const createUpworkOAuthProvider = (secureFile, publicBaseUrl) => {
  const baseUrl = publicBaseUrl.replace(/\/$/, '');
  let record = secureFile.read({});
  let authorizationUrl = null;

  const save = () => {
    secureFile.write(record);
  };

  const redirectUrl = `${baseUrl}/v1/auth/upwork/callback`;
  const clientMetadata = {
    client_name: 'Esclatech Upwork MCP Dashboard',
    redirect_uris: [redirectUrl],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none'
  };

  const clientInformation = () => record.clientInformation;

  const saveClientInformation = value => {
    record.clientInformation = value;
    save();
  };

  const tokens = () => record.tokens;

  const saveTokens = value => {
    record.tokens = value;
    save();
  };

  const state = () => {
    record.pendingState = randomBytes(32).toString('hex');
    record.pendingStartedAt = Date.now();
    save();
    return record.pendingState;
  };

  const redirectToAuthorization = url => {
    authorizationUrl = url.toString();
  };

  const saveCodeVerifier = value => {
    record.codeVerifier = value;
    save();
  };

  const codeVerifier = () => {
    if (!record.codeVerifier) {
      throw new Error('Missing OAuth PKCE verifier');
    }

    return record.codeVerifier;
  };

  const validCallbackState = value => {
    const pendingStateExpired =
      Date.now() - record.pendingStartedAt > 15 * 60_000;

    if (!value || !record.pendingState || pendingStateExpired) {
      return false;
    }

    return value === record.pendingState;
  };

  const clearPending = () => {
    delete record.pendingState;
    delete record.pendingStartedAt;
    delete record.codeVerifier;
    authorizationUrl = null;
    save();
  };

  const disconnect = () => {
    record = {};
    authorizationUrl = null;
    save();
  };

  return Object.freeze({
    redirectUrl,
    clientMetadata,
    get authorizationUrl() {
      return authorizationUrl;
    },
    clientInformation,
    saveClientInformation,
    tokens,
    saveTokens,
    state,
    redirectToAuthorization,
    saveCodeVerifier,
    codeVerifier,
    validCallbackState,
    clearPending,
    disconnect
  });
};
