# Architecture

The backend uses a small feature-based modular structure.

## Request flow

1. The root server entry loads environment variables and calls the application bootstrap.
2. The application bootstrap connects to MongoDB and constructs infrastructure and feature dependencies.
3. The app factory configures Express, security headers, routes, and error handling.
4. The route registry mounts health, OAuth, and search-run modules.
5. The search-run controller validates HTTP input and delegates to its service.
6. The service coordinates rate-limited Upwork MCP calls.
7. Each formatted job batch is upserted into the MongoDB `leads` collection.
8. After persistence, the service publishes an immutable progress snapshot.
9. The Socket.IO adapter emits that snapshot to clients subscribed to the run's room.
10. The search-run repository holds transient progress and results for 15 minutes.

## Boundaries

- config: validated environment and fixed search configuration.
- infrastructure: MongoDB, MCP, OAuth, encrypted files, and quota persistence.
- middlewares: reusable HTTP concerns.
- modules: feature-owned routes, controllers, validation, services, repositories, and socket adapters.
- app: application composition and startup.

The in-memory repository returned by `createSearchRunRepository` is intentionally isolated so a MongoDB repository can replace it later without changing the HTTP routes or search orchestration.
