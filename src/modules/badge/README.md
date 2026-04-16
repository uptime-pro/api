# Badge Module

## Responsibility

Generates embeddable SVG status and uptime badges for monitors. Badges are publicly accessible — no authentication required — and are suitable for embedding in README files or external dashboards.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/badge/:id/status` | Public | SVG badge showing current monitor status (UP / DOWN) |
| GET | `/badge/:id/uptime` | Public | SVG badge showing 30-day uptime percentage |

## Notes

- `:id` is the monitor's numeric ID.
- Responses have `Content-Type: image/svg+xml` and short-lived cache headers.
- Badges use the global prefix exclusion — they are served at `/badge/…`, **not** under `/api/v1/`.
- No environment variables specific to this module.

## Dependencies

- `PrismaModule` — reads monitor status and heartbeat history
