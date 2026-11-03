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

The legacy `POST /v1/jobs/search-batch` and `GET /v1/jobs/search-runs/:id` routes remain available as compatibility aliases.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/v1/config` | Keywords, fixed target country, and planned request count |
| GET | `/v1/quota` | Locally recorded quota usage |
| POST | `/v1/auth/upwork/start` | Start Upwork OAuth |
| GET | `/v1/auth/upwork/callback` | OAuth callback |
| GET | `/v1/auth/upwork/status` | Connection status |
| POST | `/v1/auth/upwork/disconnect` | Clear local OAuth credentials |
| POST | `/v1/jobs/search` | Run one explicit keyword/country search |
| POST | `/v1/search-runs` | Manually start all 13 configured searches |
| GET | `/v1/search-runs/:id` | Read run progress and transient results |
| GET | `/v1/jobs/:id` | Retrieve one job's details |

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
