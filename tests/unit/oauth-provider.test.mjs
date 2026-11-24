import assert from 'node:assert/strict';
import test from 'node:test';
import { createUpworkOAuthProvider } from '../../src/infrastructure/upwork/oauth-provider.mjs';

const createStore = initial => {
  const values = new Map(Object.entries(initial));

  return {
    values,
    async get(field) {
      return values.get(field);
    },
    async set(field, value) {
      values.set(field, value);
    },
    async remove(field) {
      values.delete(field);
    },
    async clear() {
      values.clear();
    }
  };
};

test('invalidating rejected tokens preserves the registered OAuth client', async () => {
  const store = createStore({
    clientInformation: { client_id: 'registered-client' },
    tokens: { access_token: 'expired', refresh_token: 'revoked' },
    codeVerifier: 'pending-verifier'
  });
  const provider = createUpworkOAuthProvider(
    store,
    'http://localhost:5050'
  );

  await provider.invalidateCredentials('tokens');

  assert.equal(store.values.has('tokens'), false);
  assert.deepEqual(store.values.get('clientInformation'), {
    client_id: 'registered-client'
  });
  assert.equal(store.values.get('codeVerifier'), 'pending-verifier');
});

test('invalidating all credentials clears persisted and in-memory OAuth state', async () => {
  const store = createStore({
    clientInformation: { client_id: 'rejected-client' },
    tokens: { access_token: 'expired' }
  });
  const provider = createUpworkOAuthProvider(
    store,
    'http://localhost:5050'
  );
  provider.redirectToAuthorization(new URL('https://example.com/authorize'));

  await provider.invalidateCredentials('all');

  assert.equal(store.values.size, 0);
  assert.equal(provider.authorizationUrl, null);
});
