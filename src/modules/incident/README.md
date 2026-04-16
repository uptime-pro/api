# Incident Module

Manages incidents and their timeline updates for status pages.

## Endpoints (all require JWT)

- `GET /api/v1/status-pages/:statusPageId/incidents` — list incidents
- `POST /api/v1/status-pages/:statusPageId/incidents` — create incident
- `GET /api/v1/incidents/:id` — get incident with updates
- `PATCH /api/v1/incidents/:id` — update incident
- `DELETE /api/v1/incidents/:id` — delete incident
- `POST /api/v1/incidents/:id/updates` — add timeline update
