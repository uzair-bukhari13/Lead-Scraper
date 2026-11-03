# Esclatech Upwork MCP Backend — Phase 1

Node.js REST backend for one authorized Upwork account. Job discovery is started manually and uses the official Upwork MCP endpoint.

## Current behavior

- OAuth 2.1 through the official Model Context Protocol SDK.
- Thirteen predefined search keywords.
- One fixed target country configured with `TARGET_COUNTRY`.
- A manual discovery cycle makes exactly 13 searches: one for each keyword.
- Searches run serially through conservative local rate limits.
- Overlapping search cycles return HTTP `409`.
- Jobs are deduplicated within a search cycle.
- Search progress and results remain in memory for 15 minutes after completion.
- No scheduled or recurring Upwork polling.
- No database persistence or scoring yet.

## Why discovery is manually triggered

Upwork publishes Search and Discovery rate limits but separately advises clients not to create automations that poll for changes every few minutes. This backend therefore starts a discovery cycle only after an explicit API request.

- https://support.upwork.com/hc/en-us/articles/56577997707923-Rate-limits-for-Upwork-MCP
- https://www.upwork.com/legal#apimcpterms
- https://www.upwork.com/ai/mcp

## Requirements

- Node.js 22 or newer
- npm
- An Upwork account with access to Upwork MCP

## Project structure

```text
esclatech-upwork-mcp-backend/
├── data/                         # Runtime OAuth and quota files (ignored by Git)
├── docs/
│   └── architecture.md
├── src/
│   ├── app/                      # Express composition and dependency bootstrap
│   ├── config/                   # Environment and search configuration
│   ├── infrastructure/
│   │   ├── persistence/          # Encrypted local credential storage
│   │   ├── quota/                # Local request quota tracking
│   │   └── upwork/               # OAuth provider and Upwork MCP client
│   ├── middlewares/              # API key, async, 404 and error handlers
│   ├── modules/
│   │   ├── auth/                 # Upwork authorization routes
│   │   ├── health/               # Health route
│   │   └── search-runs/          # Controller, routes, service and repository
│   └── routes.mjs                # Central route registry
├── tests/
│   └── unit/
├── server.mjs                    # Main entry point
├── package.json
└── README.md
```

See [docs/architecture.md](docs/architecture.md) for layer responsibilities and request flow.

## Configuration

Copy `.env.example` to `.env`, then configure:

```dotenv
PORT=5050
PUBLIC_BASE_URL=http://localhost:5050
UPWORK_MCP_URL=https://mcp.upwork.com/mcp
TARGET_COUNTRY=United States
DASHBOARD_API_KEY=REPLACE_WITH_RANDOM_LONG_SECRET
TOKEN_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARACTERS
AUTOMATED_POLLING_ENABLED=false
```

`TARGET_COUNTRY` must be either `United States` or `Canada`.

Generate separate secrets for `DASHBOARD_API_KEY` and `TOKEN_ENCRYPTION_KEY`. Keep both on the backend and never expose them in browser JavaScript.

## Run locally

From the VS Code PowerShell terminal:

```powershell
npm.cmd install
npm.cmd run dev
```

For normal mode without file watching:

```powershell
npm.cmd start
```

The default address is `http://localhost:5050`.

## Authentication

Every endpoint except `/health` and `/v1/auth/upwork/callback` requires:

```http
x-api-key: <DASHBOARD_API_KEY>
```

Start OAuth:

```powershell
$headers = @{ 'x-api-key' = $env:DASHBOARD_API_KEY }
Invoke-RestMethod -Method Post `
  -Uri http://localhost:5050/v1/auth/upwork/start `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body '{}'
```

Open the returned `authorizationUrl` and complete authorization at Upwork.

## Manual discovery cycle

Start all 13 configured keyword searches against `TARGET_COUNTRY`:

```powershell
$headers = @{ 'x-api-key' = $env:DASHBOARD_API_KEY }
$body = @{ limit = 10 } | ConvertTo-Json

$run = Invoke-RestMethod -Method Post `
  -Uri http://localhost:5050/v1/search-runs `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body

$run
```

The endpoint returns HTTP `202`:

```json
{
  "id": "search-run-uuid",
  "status": "running",
  "plannedRequests": 13,
  "pollUrl": "/v1/search-runs/search-run-uuid"
}
```

Read progress from the local backend. This status request does not call Upwork:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:5050$($run.pollUrl)" `
  -Headers $headers
```

Each returned job includes its Upwork posting timestamp and every configured keyword search in which it appeared:

```json
{
  "id": "2117709706166172517",
  "title": "Example job",
  "postedAt": "2026-11-03T20:05:15.584Z",
  "searchedKeywords": [
    "Web development",
    "SaaS Development"
  ]
}
```

`postedAt` is an ISO 8601 UTC timestamp. A deduplicated job can contain multiple values in `searchedKeywords`.

The run object also includes `jobsCount`, which is the number of unique jobs discovered so far and always matches the length of the `jobs` array.

## Search API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/v1/search-runs` | Manually start all 13 configured searches |
| GET | `/v1/search-runs/:id` | Read run progress and transient results |

These are the only application-facing search routes.

## Operational support routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/v1/auth/upwork/start` | Start Upwork OAuth |
| GET | `/v1/auth/upwork/callback` | Required OAuth callback |
| GET | `/v1/auth/upwork/status` | Connection status |
| POST | `/v1/auth/upwork/disconnect` | Clear local OAuth credentials |

The support routes are required for initial authorization, reconnection, and health monitoring. Normal job discovery uses only the two search routes above.

## Rate management

Local defaults are 10 requests/minute, 100/hour, 500/day, and at least seven seconds between Upwork calls. Counters are stored in `data/quota.json`. Upwork's server-side limits remain authoritative.

## Tests

```powershell
npm.cmd test
npm.cmd run check
```

Offline tests cover the 13-keyword search plan, country validation, result filtering, deduplication, and local rate limits. Live OAuth and MCP calls require an authorized account.

## Planned next phase

The next phase can add MongoDB persistence, cross-run deduplication, configurable lead scoring, and a filtered `GET /v1/jobs` endpoint. Scheduled discovery remains disabled.
