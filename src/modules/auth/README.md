# Auth Module

Handles authentication and session management for Uptime Pro.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Login with username + password (+ optional TOTP) |
| POST | `/api/v1/auth/logout` | Cookie | Logout and clear session |
| GET | `/api/v1/auth/me` | Cookie | Get current user profile |
| POST | `/api/v1/auth/change-password` | Cookie | Change password |
| POST | `/api/v1/auth/2fa/setup` | Cookie | Initiate TOTP 2FA setup |
| POST | `/api/v1/auth/2fa/verify` | Cookie | Verify TOTP and activate 2FA |
| DELETE | `/api/v1/auth/2fa` | Cookie | Disable 2FA |
| GET | `/api/v1/auth/2fa/status` | Cookie | Get 2FA enabled status |
| GET | `/api/v1/auth/setup-status` | Public | Check if initial setup is complete |
| POST | `/api/v1/auth/setup` | Public | Create first admin (only before setup complete) |

## JWT
- Stored in HttpOnly cookie `access_token`
- Payload: `{ sub: userId, username, role }`
- 30-day expiry by default

## 2FA
- TOTP via `otplib` (compatible with Google Authenticator, Authy, etc.)
- 8 backup codes generated on activation (format: `XXXX-XXXX`)
- Backup codes are single-use and stored as bcrypt hashes
