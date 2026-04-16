# Settings Module

## Responsibility

Provides a key-value store for application-wide configuration that is persisted in the database. Used by other modules (reports, status pages) to store and retrieve runtime settings without requiring a restart.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/settings` | JWT (Admin) | Get all application settings |
| PATCH | `/api/v1/settings` | JWT (Admin) | Update one or more settings |

## Known Setting Keys

| Key | Description |
|-----|-------------|
| `reportEnabled` | Whether scheduled email reports are active |
| `reportSchedule` | Cron expression for report dispatch |
| `reportRecipients` | JSON array of recipient email addresses |
| `reportIncludeMonitors` | JSON array of monitor IDs (empty = all) |

## Dependencies

- `PrismaModule` — `Setting` model persistence

## Notes

- Only users with the `ADMIN` role can read or modify settings.
- Settings are stored as string values; callers are responsible for parsing JSON where needed.
