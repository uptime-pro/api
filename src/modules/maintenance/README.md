# Maintenance Module

## Responsibility

Manages scheduled maintenance windows. During an active maintenance window, affected monitors are suppressed — they continue to be checked but incidents are not raised and notifications are not sent.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/maintenance` | JWT | List all maintenance windows |
| POST | `/api/v1/maintenance` | JWT | Create a maintenance window |
| GET | `/api/v1/maintenance/:id` | JWT | Get a maintenance window by ID |
| PATCH | `/api/v1/maintenance/:id` | JWT | Update a maintenance window |
| DELETE | `/api/v1/maintenance/:id` | JWT | Delete a maintenance window |
| PUT | `/api/v1/maintenance/:id/monitors` | JWT | Replace the monitor list for a window |

## Dependencies

- `PrismaModule` — `MaintenanceWindow` and `MaintenanceWindowMonitor` model persistence
- `MonitorModule` — monitor existence validation

## Notes

- Windows have a `startsAt` / `endsAt` datetime range.
- The monitor check workers query active windows before raising incidents.
