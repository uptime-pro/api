# Report Module

## Responsibility

Generates and schedules periodic uptime summary reports delivered by email. Report configuration (recipients, schedule, enabled flag) is persisted in the `Setting` table.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/reports/config` | JWT (Admin) | Get current report schedule configuration |
| PATCH | `/api/v1/reports/config` | JWT (Admin) | Update report schedule configuration |

## Report Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether scheduled reports are active |
| `schedule` | string | Cron expression (e.g. `0 8 * * 1` for Monday 08:00) |
| `recipients` | string[] | List of email addresses to receive reports |
| `includeMonitors` | number[] | Monitor IDs to include (empty = all) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPORT_FROM_EMAIL` | `noreply@example.com` | From address for outgoing report emails |
| `SMTP_*` | — | SMTP credentials (see Notification module) |

## Dependencies

- `PrismaModule` — reads heartbeat/incident history; stores config in `Setting`
- `@nestjs/schedule` — cron-based report dispatch
- `NotificationModule` — email sending
