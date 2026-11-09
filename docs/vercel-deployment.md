# Deploy to Vercel

This backend uses the Vercel Node.js function at `api/index.mjs`. Rewrites in `vercel.json` forward `/api/backend/*` requests to that function, which restores the original backend path before passing it to Express. Fluid Compute is enabled in `vercel.json`. On Vercel, start searches with the `search-run:start` socket event; the local HTTP `POST /v1/search-runs` endpoint returns `405` in the Vercel environment.

## 1. Prepare the Vercel project

Push this repository to a Git provider, then import it in Vercel. Keep the project root at this repository's root (the directory containing `package.json` and `vercel.json`), use the Node.js runtime, and do not set a custom output directory. `api/index.mjs` is the function entry point; the Vercel rewrites route the public API paths to it.

Alternatively, install/use the Vercel CLI and run `vercel` from this directory to link and create a preview deployment. Use `vercel --prod` after preview configuration is verified.

## 2. Add environment variables

Add these in **Project → Settings → Environment Variables** for Preview and Production. Add them to Development only if you want `vercel dev` to use the deployed services. Copy secret values from your secure source; do not commit `.env`.

| Variable | Value |
|---|---|
| `MONGODB_URI` | The MongoDB connection URI that works from your environment |
| `MONGODB_DATABASE_NAME` | `esclatech_upwork` (or your chosen database) |
| `DASHBOARD_API_KEY` | A random secret of at least 32 characters; use the same value in the trusted frontend configuration |
| `TOKEN_ENCRYPTION_KEY` | The existing 64-character hexadecimal key used to encrypt stored Upwork credentials; keep it stable across deployments |
| `FRONTEND_ORIGIN` | Exact browser origin of the dashboard, with no route path, e.g. `https://dashboard.example.com` |
| `PUBLIC_BASE_URL` | The deployment's external backend URL including the function prefix, e.g. `https://my-backend.vercel.app/api/backend` |
| `TARGET_COUNTRY` | `United States` or `Canada` |
| `AUTOMATED_POLLING_ENABLED` | `false` |

`UPWORK_MCP_URL` and `SEARCH_MINUTE_LIMIT`, `SEARCH_HOUR_LIMIT`, `SEARCH_DAY_LIMIT`, and `SEARCH_MIN_GAP_MS` are optional; defaults are in `.env.example`. Do not set `SOCKET_IO_PATH` unless overriding the deployment path intentionally.

After the first deployment, update `PUBLIC_BASE_URL` to the actual stable production deployment URL and redeploy. In the Upwork OAuth app, register the exact callback URL:

```text
https://my-backend.vercel.app/api/backend/v1/auth/upwork/callback
```

MongoDB Atlas must allow network connections from the Vercel deployment. Configure Atlas network access for your Vercel project/plan and verify the database user has read/write access to the selected database.

## 3. Configure the dashboard

Set the frontend API base URL to:

```text
https://my-backend.vercel.app/api/backend
```

Use Socket.IO path `/api/backend/socket.io`, `transports: ['websocket']`, and `auth: { apiKey: DASHBOARD_API_KEY }`. Emit `search-run:start` with `{ limit, keywords }`, then listen for `search-run:progress`. The implementation example is in [manual-keyword-search.md](manual-keyword-search.md).

The dashboard API key is visible to a browser user when shipped in client code. This setup is appropriate only for a private, trusted, single-user dashboard. Keep the deployment access restricted accordingly.

## 4. Deploy and verify

Deploy a Preview first. Check `https://<deployment>.vercel.app/api/backend/health`, then check the Upwork status endpoint with `x-api-key`. Connect Upwork through OAuth and verify the callback resolves through the configured public URL. Start a short search from the dashboard and confirm `search-run:progress` events arrive and leads appear in MongoDB. Promote/deploy Production only after these checks succeed.

Vercel closes WebSocket connections when the function reaches its configured maximum duration, and reconnects can land on another instance. The browser should reconnect and refresh leads after a run; this backend keeps active run snapshots and socket rooms in memory, so they do not survive an instance change or deployment. For longer-lived/durable runs, move run coordination and event delivery to an external queue/pub-sub service.
