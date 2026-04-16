# API Key Module

## Responsibility

Manages long-lived API keys that allow external systems and scripts to authenticate with the Uptime Pro API without browser-based cookies. Each key is tied to the creating user and carries the same permissions.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/api-keys` | JWT (cookie) | List all API keys for the current user |
| POST | `/api/v1/api-keys` | JWT (cookie) | Create a new API key (key is returned once) |
| DELETE | `/api/v1/api-keys/:id` | JWT (cookie) | Revoke an API key |

## Authentication Flow

Generated keys are passed as `Authorization: <key>` header and validated by the `ApiKeyStrategy` (Passport strategy). The raw key is stored as a bcrypt hash; it cannot be recovered after creation.

## Dependencies

- `PrismaModule` — `ApiKey` model persistence
- `UserModule` — key ownership

## Notes

- Keys do not expire by default; revoke them explicitly when no longer needed.
- Store generated keys securely — they are shown only once at creation time.
