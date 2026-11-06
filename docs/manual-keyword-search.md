# Manual keyword search integration

This document describes how the frontend starts and monitors an Upwork search using user-supplied keywords. On Vercel, searches must be started through the authenticated `search-run:start` Socket.IO event so the function handling the request also owns the progress socket. The HTTP endpoint below is for local development.

## Endpoint

```http
POST /v1/search-runs
Content-Type: application/json
x-api-key: <DASHBOARD_API_KEY>
```

Local backend URL:

```text
http://localhost:5050/v1/search-runs
```

Vercel backend URL:

```text
https://<deployment>.vercel.app/api/backend
Socket.IO path: /api/backend/socket.io
```

## Request body

```json
{
  "limit": 10,
  "keywords": [
    "React development",
    "Node.js API",
    "Shopify"
  ]
}
```

| Field | Type | Required | Rules |
|---|---|---:|---|
| `limit` | Integer | No | Defaults to `10`; minimum `1`, maximum `10`. This is the maximum number of jobs requested per keyword. |
| `keywords` | String array | No | Supply 1–13 entries. Each entry is trimmed, must not be empty, and may contain at most 80 characters. Duplicate entries are removed. |

When `keywords` is omitted, the backend uses its 13 configured default keywords. An empty array is invalid; omit the field to use the defaults.

The country cannot be supplied by the browser. The backend uses its configured `TARGET_COUNTRY`.

Each keyword causes one Upwork search request. For example, three keywords with `limit: 10` produce three requests and may discover up to 30 jobs before duplicate jobs are merged.

## Successful local HTTP response

The endpoint returns HTTP `202 Accepted` immediately while the search continues in the background:

```json
{
  "id": "7b325f6a-f124-4e75-bff1-bbe9f191e6fc",
  "status": "running",
  "plannedRequests": 3,
  "jobsCount": 0,
  "keywords": [
    "React development",
    "Node.js API",
    "Shopify"
  ],
  "pollUrl": "/v1/search-runs/7b325f6a-f124-4e75-bff1-bbe9f191e6fc"
}
```

`plannedRequests` is the number of unique cleaned keywords accepted by the backend.

## Local HTTP request helper

```js
export async function startSearchRun({ keywords, limit = 10 }) {
  const cleanedKeywords = keywords
    .map(keyword => keyword.trim())
    .filter(Boolean);

  return apiRequest('/v1/search-runs', {
    method: 'POST',
    body: JSON.stringify({
      limit,
      keywords: cleanedKeywords
    })
  });
}
```

Do not send `keywords: []`. To run the backend's default searches, omit `keywords`:

```js
await apiRequest('/v1/search-runs', {
  method: 'POST',
  body: JSON.stringify({ limit: 10 })
});
```

## Vercel Socket.IO start and monitoring

Connect with the WebSocket transport and the dashboard API key. Register the progress listener before emitting `search-run:start`; the server joins this socket to the run room before search work begins.

```js
import { io } from 'socket.io-client';

const API_BASE_URL = 'https://<deployment>.vercel.app/api/backend';
const socket = io(API_BASE_URL, {
  path: '/api/backend/socket.io',
  transports: ['websocket'],
  auth: { apiKey: DASHBOARD_API_KEY },
  autoConnect: false
});

let activeRunId = null;
socket.on('search-run:progress', progress => {
  if (progress.id !== activeRunId) return;
  renderProgress(progress);
  if (['complete', 'partial', 'failed'].includes(progress.status)) {
    activeRunId = null;
    loadLeads();
  }
});

socket.connect();
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});

const started = await socket.timeout(5000).emitWithAck('search-run:start', {
  limit: 10,
  keywords: ['React development', 'Node.js API', 'Shopify']
});
if (!started.success) throw new Error(started.error);
activeRunId = started.id;
renderProgress(started);
```

If the socket disconnects, Socket.IO reconnects automatically. Reconnect and reload the leads list after the run completes; run state and socket rooms are in memory and are not shared across function instances.

## Monitoring a local HTTP-started run

Register the progress listener before starting a search. After receiving the `202` response:

1. Save the returned `id` as the active run ID.
2. Subscribe to the run's Socket.IO room.
3. Immediately request `pollUrl` to recover any progress emitted before the subscription.
4. Continue processing `search-run:progress` events.
5. On `complete`, `partial`, or `failed`, unsubscribe and reload `/v1/leads`.

```js
export async function startAndMonitorSearch({ keywords, limit = 10 }) {
  const started = await startSearchRun({ keywords, limit });
  activeRunId = started.id;

  const acknowledgement = await socket
    .timeout(5000)
    .emitWithAck('search-run:subscribe', { runId: started.id });

  if (!acknowledgement.success) {
    throw new Error(acknowledgement.error);
  }

  const currentRun = await apiRequest(started.pollUrl);
  renderProgress(currentRun);
  return currentRun;
}
```

Progress snapshots include the accepted keyword list:

```json
{
  "id": "7b325f6a-f124-4e75-bff1-bbe9f191e6fc",
  "status": "running",
  "plannedRequests": 3,
  "completedRequests": 1,
  "jobsCount": 7,
  "keywords": [
    "React development",
    "Node.js API",
    "Shopify"
  ],
  "lastCompletedSearch": {
    "keyword": "React development",
    "country": "United States"
  }
}
```

Calculate progress as:

```js
const progressPercent = run.plannedRequests === 0
  ? 0
  : Math.round((run.completedRequests / run.plannedRequests) * 100);
```

## Suggested UI behavior

- Provide a tag/chip input limited to 13 keywords.
- Display a character counter with a maximum of 80 characters per keyword.
- Trim entries and prevent empty tags before submission.
- Disable the start button when there are no manual keywords, unless the UI offers a separate “Use default keywords” option.
- Disable editing and prevent another start while a run has status `running`.
- Display `completedRequests / plannedRequests` and `lastCompletedSearch.keyword`.
- After completion, reload the leads endpoint. Matching terms are stored on each lead in `searchedKeywords`.

## Validation and operational errors

Invalid keywords return HTTP `400`:

```json
{
  "error": "keywords must be an array of 1 to 13 unique, non-empty strings; each keyword may contain at most 80 characters"
}
```

Other relevant responses:

| Status | Meaning | Frontend behavior |
|---|---|---|
| `400` | Invalid `limit` or `keywords` | Show the returned validation message near the form. |
| `401` | Missing or incorrect API key | Stop the request and return to the dashboard configuration state. |
| `409` | Another search run is active | Keep monitoring the existing run; do not retry immediately. |
| `429` | Local Upwork quota limit | Display the retry message and retry only after the limit clears. |
| `500` | Backend, OAuth, MCP, or database failure | Show a generic retry message and log the request context. |

## Lead results

Search results are deduplicated by Upwork job ID. If one job appears for multiple submitted keywords, it is stored once and its `searchedKeywords` array contains every matching submitted keyword. Each lead also contains `hasAttachments`, a boolean derived from whether Upwork returned one or more job attachments.

```json
{
  "externalId": "2117709706166172517",
  "title": "Build a Node.js API",
  "hasAttachments": true,
  "searchedKeywords": ["Node.js API"]
}
```

```http
GET /v1/leads?searchedKeyword=Node.js&page=1&limit=20
x-api-key: <DASHBOARD_API_KEY>
```

The `searchedKeyword` lead filter is a case-insensitive contains search.
