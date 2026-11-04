import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { io as createSocketClient } from 'socket.io-client';
import {
  createSearchRunsSocket,
  SEARCH_RUN_SOCKET_EVENTS
} from '../../src/modules/search-runs/search-runs.socket.mjs';

const waitForEvent = (socket, event) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      2000
    );

    socket.once(event, value => {
      clearTimeout(timeout);
      resolve(value);
    });
  });

test('subscribed frontend receives progress for its search run', async t => {
  const apiKey = 'a'.repeat(32);
  const runId = '123e4567-e89b-42d3-a456-426614174000';
  const httpServer = createServer();
  const searchRunsSocket = createSearchRunsSocket({
    apiKey,
    frontendOrigin: 'http://localhost:3000'
  });

  searchRunsSocket.attach(httpServer);
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));

  const address = httpServer.address();
  const client = createSocketClient(`http://127.0.0.1:${address.port}`, {
    auth: { apiKey },
    transports: ['websocket']
  });

  t.after(async () => {
    client.close();
    await searchRunsSocket.close();
  });

  await waitForEvent(client, 'connect');

  const subscription = await client.emitWithAck(
    SEARCH_RUN_SOCKET_EVENTS.SUBSCRIBE,
    { runId }
  );

  assert.deepEqual(subscription, { success: true, runId });

  const progressPromise = waitForEvent(
    client,
    SEARCH_RUN_SOCKET_EVENTS.PROGRESS
  );

  searchRunsSocket.publishProgress({
    id: runId,
    status: 'running',
    completedRequests: 1,
    plannedRequests: 13,
    jobs: []
  });

  const progress = await progressPromise;
  assert.equal(progress.id, runId);
  assert.equal(progress.completedRequests, 1);
});
