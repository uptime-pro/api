# Notification Module

## Responsibility

Manages notification channels (email, webhook, Slack, etc.) and their associations with monitors. When a monitor changes state, the notification worker dispatches alerts to all configured channels linked to that monitor.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/notifications` | JWT | List all notification channels |
| POST | `/api/v1/notifications` | JWT | Create a notification channel |
| GET | `/api/v1/notifications/monitor/:monitorId` | JWT | List channels linked to a monitor |
| PUT | `/api/v1/notifications/monitor/:monitorId` | JWT | Replace channel links for a monitor |
| GET | `/api/v1/notifications/:id` | JWT | Get a notification channel by ID |
| PATCH | `/api/v1/notifications/:id` | JWT | Update a notification channel |
| DELETE | `/api/v1/notifications/:id` | JWT | Delete a notification channel |
| POST | `/api/v1/notifications/:id/test` | JWT | Send a test notification |

## Supported Channel Types

| Type | Config fields |
|------|--------------|
| `email` | `to`, uses `SMTP_*` env vars |
| `webhook` | `url`, `method`, optional `headers` |
| `slack` | `webhookUrl` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_SECURE` | Use TLS (`true`) or STARTTLS (`false`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address |
| `ENCRYPTION_KEY` | Used to encrypt sensitive channel config at rest |

## Dependencies

- `PrismaModule` — `NotificationChannel` and `MonitorNotification` models
- `QueueModule` — notification dispatch queue
- `EncryptionModule` — encrypts webhook URLs, passwords, and tokens
