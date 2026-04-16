# Health Module

## Responsibility

Provides a liveness / readiness health-check endpoint that reports on the status of all critical dependencies (PostgreSQL, DragonflyDB/Redis). Powered by `@nestjs/terminus`.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Returns overall health status and per-indicator details |

The `/health` route is **excluded from the `/api/v1` global prefix** so load balancers and container orchestrators can reach it directly.

## Response Example

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": { ... }
}
```

## Dependencies

- `PrismaModule` — database ping indicator
- `@nestjs/terminus` — health-check framework

## Notes

- A `503` response with `status: "error"` means at least one indicator failed.
- Suitable for use as a Docker `HEALTHCHECK` or Kubernetes readiness probe.
