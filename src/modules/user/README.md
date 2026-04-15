# User Module

Manages user accounts for Uptime Pro.

## Endpoints

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/v1/users` | Cookie | ADMIN | List all users |
| GET | `/api/v1/users/:id` | Cookie | ADMIN | Get user by ID |
| POST | `/api/v1/users` | Cookie | ADMIN | Create new user |
| PATCH | `/api/v1/users/:id` | Cookie | ADMIN or self | Update user |
| DELETE | `/api/v1/users/:id` | Cookie | ADMIN | Delete user |

## Role Enforcement
- `ADMIN`: Full access
- `EDITOR`: Can update own account only (no role change)
- `VIEWER`: Can update own account only (no role change)

## Security
- Passwords are always bcrypt-hashed (never returned in responses)
- `twoFaSecret` and `backupCodes` are never returned in responses
- Role escalation is blocked for non-admin users
