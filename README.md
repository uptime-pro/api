# Uptime Pro — API

The backend service for **Uptime Pro**, a self-hosted uptime and infrastructure monitoring platform. Built with [NestJS](https://nestjs.com) and TypeScript, it handles monitor scheduling, alerting, status pages, and exposes a fully documented REST API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL 18 via Prisma ORM |
| Queue / Cache | DragonflyDB (Redis-compatible) + BullMQ |
| Auth | JWT (cookie-based) + TOTP 2FA |
| API Docs | Swagger / OpenAPI (`/api/docs`) |
| Metrics | Prometheus (`/metrics`) |
| Job Scheduler | `@nestjs/schedule` + BullMQ workers |
| Queue UI | Bull Board (`/admin/queues`) |

---

## Features

### Monitor Types (23)

`http` · `tcp` · `ping` · `push` · `dns` · `websocket` · `postgres` · `mysql` · `mssql` · `mongodb` · `redis` · `rabbitmq` · `mqtt` · `docker` · `grpc` · `steam` · `gamedig` · `tailscale-ping` · `snmp` · `smtp-check` · `sip` · `manual` · `group`

### Notification Channels (9)

`email` · `discord` · `slack` · `teams` · `telegram` · `pushover` · `gotify` · `ntfy` · `webhook`

### Core Capabilities

- **Multi-user** with role-based access (ADMIN / EDITOR / VIEWER)
- **Two-factor authentication** (TOTP + backup codes)
- **API keys** with per-user scoping and expiry
- **Status pages** — public-facing pages with custom domains, CSS, and Google Analytics
- **Incident management** — severity levels + full lifecycle tracking on status pages
- **Maintenance windows** — one-time, weekly-recurring, or cron-scheduled
- **Scheduled email reports** — daily, weekly, or monthly uptime summaries
- **Tags** — colour-coded labels for monitor organisation
- **Import / export** — JSON bulk import and export of monitor configs
- **Audit logging** — complete action log across all entities
- **Prometheus metrics** — at `/metrics` (unauthenticated)
- **SVG badges** — embeddable status and uptime badges (unauthenticated)
- **Infrastructure stats** — BullMQ queue health, DragonflyDB metrics, PostgreSQL stats

---

## Project Structure

```
src/
├── modules/
│   ├── auth/           # JWT auth, 2FA, session management
│   ├── user/           # User CRUD and role management
│   ├── api-key/        # API key generation and validation
│   ├── monitor/        # Monitor CRUD + 23 check strategies
│   ├── notification/   # Notification channels + dispatch
│   ├── status-page/    # Public status page management
│   ├── incident/       # Incident lifecycle management
│   ├── maintenance/    # Maintenance window scheduling
│   ├── tag/            # Monitor tagging
│   ├── report/         # Scheduled email report generation
│   ├── infrastructure/ # Queue, cache, and DB health stats
│   ├── badge/          # SVG status/uptime badge endpoints
│   ├── settings/       # Global key-value settings store
│   ├── metrics/        # Prometheus metrics integration
│   ├── health/         # Health check endpoint + push monitor receiver
│   └── websocket/      # Real-time heartbeat events via WebSocket
├── workers/
│   ├── monitor.worker.ts      # Executes monitor checks from BullMQ
│   └── notification.worker.ts # Dispatches notifications from BullMQ
├── queue/              # BullMQ queue module configuration
├── audit/              # Audit log service
├── encryption/         # AES encryption for sensitive credentials
└── prisma/             # Prisma client service
prisma/
└── schema.prisma       # Database schema (17 models)
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 18 (or Docker)
- DragonflyDB or Redis-compatible server (or Docker)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the required variables are:

```env
# Database
DATABASE_URL=postgresql://uptime:uptime@localhost:5432/uptimepro

# Queue / Cache
DRAGONFLY_URL=redis://localhost:6379

# Auth — generate with: openssl rand -hex 64
JWT_SECRET=your-secret-here

# Encryption — generate with: openssl rand -hex 32
ENCRYPTION_KEY=your-32-byte-hex-key

# Application
FRONTEND_URL=http://localhost:3000
```

### 3. Run database migrations

```bash
pnpm exec prisma migrate deploy
# or for local development:
pnpm exec prisma migrate dev
```

### 4. Start the server

```bash
# development (watch mode)
pnpm run start:dev

# production
pnpm run start:prod
```

The API is available at `http://localhost:3001`.

---

## API Reference

Swagger UI is available at [`http://localhost:3001/api/docs`](http://localhost:3001/api/docs) when `SWAGGER_ENABLED=true` (default in development).

### Authentication

All endpoints (except `/health`, `/metrics`, `/status/*`, `/badge/*`, and `/health/push/:token`) require authentication.

**Cookie auth** (browser/WebUI): log in via `POST /api/v1/auth/login` — a JWT is set as an `access_token` cookie.

**API key auth** (automation): pass your key in the `X-API-Key` header.

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Log in, receive JWT cookie |
| `POST` | `/api/v1/auth/logout` | Invalidate session |
| `GET` | `/api/v1/monitors` | List all monitors |
| `POST` | `/api/v1/monitors` | Create a monitor |
| `GET` | `/api/v1/monitors/:id/heartbeats` | Paginated heartbeat history |
| `GET` | `/api/v1/monitors/:id/sla` | SLA statistics |
| `POST` | `/api/v1/monitors/import` | Bulk import monitors (JSON) |
| `GET` | `/api/v1/monitors/export` | Export all monitors (JSON) |
| `GET` | `/api/v1/notifications` | List notification channels |
| `POST` | `/api/v1/notifications/test` | Test a channel without saving |
| `GET` | `/api/v1/status-pages` | List status pages |
| `GET` | `/api/v1/infrastructure/queues` | BullMQ queue stats |
| `GET` | `/api/v1/infrastructure/dragonfly` | DragonflyDB stats |
| `GET` | `/api/v1/infrastructure/postgres` | PostgreSQL stats |
| `GET` | `/api/v1/badge/:id/status` | SVG status badge |
| `GET` | `/api/v1/badge/:id/uptime` | SVG uptime badge |
| `POST` | `/health/push/:token` | Heartbeat push receiver |
| `GET` | `/health` | Service health check |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/admin/queues` | Bull Board queue inspector UI |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `DRAGONFLY_URL` | ✅ | — | Redis-compatible URL |
| `JWT_SECRET` | ✅ | — | Secret for signing JWTs |
| `ENCRYPTION_KEY` | ✅ | — | 32-byte hex key for credential encryption (`openssl rand -hex 32`) |
| `PORT` | | `3001` | HTTP port |
| `FRONTEND_URL` | | `http://localhost:3000` | CORS allowed origin |
| `JWT_EXPIRY` | | `30d` | JWT token lifetime |
| `SWAGGER_ENABLED` | | `true` | Enable `/api/docs` Swagger UI |
| `METRICS_ENABLED` | | `true` | Enable `/metrics` Prometheus endpoint |
| `SMTP_HOST` | | — | SMTP server hostname |
| `SMTP_PORT` | | `587` | SMTP port |
| `SMTP_SECURE` | | `false` | Use TLS (`true` for port 465) |
| `SMTP_USER` | | — | SMTP username |
| `SMTP_PASS` | | — | SMTP password |
| `SMTP_FROM` | | `noreply@example.com` | From address for email notifications |
| `REPORT_FROM_EMAIL` | | `noreply@example.com` | From address for scheduled reports |
| `COOKIE_SECURE` | | `false` | Set `Secure` flag on auth cookie (enable behind HTTPS) |
| `NODE_ENV` | | `development` | `development` or `production` |

---

## Scripts

```bash
pnpm run start:dev      # Start in watch mode
pnpm run start:prod     # Start compiled output
pnpm run build          # Compile TypeScript
pnpm run lint           # ESLint
pnpm run format         # Prettier
pnpm run test           # Unit tests
pnpm run test:cov       # Unit tests with coverage
pnpm run test:e2e       # End-to-end tests
pnpm run generate:openapi  # Export OpenAPI JSON spec
```

---

## Database

Prisma is used for schema management and query building. The schema lives in `prisma/schema.prisma`.

```bash
# Apply pending migrations (production)
pnpm exec prisma migrate deploy

# Create a new migration (development)
pnpm exec prisma migrate dev --name your-migration-name

# Open Prisma Studio (visual DB browser)
pnpm exec prisma studio

# Regenerate the Prisma client after schema changes
pnpm exec prisma generate
```

---

## Docker

The API is deployed as part of the multi-container stack defined in `../compose.yaml`. See the root `deploy.sh` for the full deployment workflow.

To build the API image standalone:

```bash
docker build -t uptimepro-api .
```
