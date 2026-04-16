# Tag Module

## Responsibility

Provides a tagging system for monitors. Tags are user-defined labels (e.g. `production`, `europe`, `critical`) that enable grouping, filtering, and bulk operations across monitors.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/tags` | JWT | List all tags |
| POST | `/api/v1/tags` | JWT | Create a tag |
| GET | `/api/v1/tags/:id` | JWT | Get a tag by ID |
| PATCH | `/api/v1/tags/:id` | JWT | Update a tag |
| DELETE | `/api/v1/tags/:id` | JWT | Delete a tag |
| PUT | `/api/v1/tags/:id/monitors` | JWT | Replace the monitor list for a tag |
| GET | `/api/v1/tags/:id/monitors` | JWT | List monitors associated with a tag |

## Dependencies

- `PrismaModule` — `Tag` and `MonitorTag` model persistence
- `MonitorModule` — monitor existence validation

## Notes

- Tags are global (not per-user); all authenticated users can read and manage them.
- Deleting a tag removes all its monitor associations.
