# Status Page Module

Manages status pages, their monitors, subscribers, and public display.

## Endpoints

### Protected (JWT required)
- `GET /api/v1/status-pages` — list status pages
- `POST /api/v1/status-pages` — create status page
- `GET /api/v1/status-pages/:id` — get status page
- `PATCH /api/v1/status-pages/:id` — update status page
- `DELETE /api/v1/status-pages/:id` — delete status page
- `PUT /api/v1/status-pages/:id/monitors` — replace monitors
- `GET /api/v1/status-pages/:id/monitors` — list monitors

### Public
- `GET /api/v1/status/:slug` — public status page
- `GET /api/v1/status/domain/:domain` — public status page by domain
- `POST /api/v1/status-pages/:id/subscribe` — subscribe to notifications
- `DELETE /api/v1/subscribers/unsubscribe/:token` — unsubscribe
