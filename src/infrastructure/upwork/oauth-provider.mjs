import { randomBytes } from 'node:crypto';

export const createUpworkOAuthProvider = (secureStore, publicBaseUrl) => {
  const baseUrl = publicBaseUrl.replace(/\/$/, '');
  let authorizationUrl = null;

  const redirectUrl = `${baseUrl}/v1/auth/upwork/callback`;
  const clientMetadata = {
    client_name: 'Esclatech Upwork MCP Dashboard',
    redirect_uris: [redirectUrl],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none'
  };

  const clientInformation = async () => {
    const information = await secureStore.get('clientInformation');

    // A Vercel hostname or API prefix change changes the OAuth redirect URI.
    // Do not reuse a dynamic client registration bound to the previous URI.
    if (information && !information.redirect_uris?.includes(redirectUrl)) {
      await secureStore.remove('clientInformation');
      return undefined;
    }

    return information;
  };

  const saveClientInformation = value =>
    secureStore.set('clientInformation', value);

  const tokens = () => secureStore.get('tokens');

  const saveTokens = value => secureStore.set('tokens', value);

  const state = async () => {
    const pendingState = randomBytes(32).toString('hex');
    await secureStore.set('pendingState', {
      value: pendingState,
      startedAt: Date.now()
    });
    return pendingState;
  };

  const redirectToAuthorization = url => {
    authorizationUrl = url.toString();
  };

  const saveCodeVerifier = value =>
    secureStore.set('codeVerifier', value);

  const codeVerifier = async () => {
    const value = await secureStore.get('codeVerifier');

    if (!value) {
      throw new Error('Missing OAuth PKCE verifier');
    }

    return value;
  };

  const validCallbackState = async value => {
    const pending = await secureStore.get('pendingState');
    const pendingStateExpired = !pending ||
      Date.now() - pending.startedAt > 15 * 60_000;

    if (!value || !pending || pendingStateExpired) {
      return false;
    }

    return value === pending.value;
  };

  const clearPending = async () => {
    await Promise.all([
      secureStore.remove('pendingState'),
      secureStore.remove('codeVerifier')
    ]);
    authorizationUrl = null;
  };

  const disconnect = async () => {
    await secureStore.clear();
    authorizationUrl = null;
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
