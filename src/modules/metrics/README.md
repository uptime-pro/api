# Metrics Module

## Responsibility

Exposes a Prometheus-compatible metrics endpoint populated with real-time monitor statistics. Integrates with `@willsoto/nestjs-prometheus` and `prom-client`.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/metrics` | Public* | Prometheus text-format metrics |

The `/metrics` route is **excluded from the `/api/v1` global prefix**.

\* Restrict access at the network/reverse-proxy level in production — do not expose publicly.

## Exposed Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `uptime_monitors_total` | Gauge | Total number of active monitors |
| `uptime_checks_total` | Counter | Total heartbeat checks performed |
| `uptime_monitors_up` | Gauge | Monitors currently reporting UP |
| `uptime_monitors_down` | Gauge | Monitors currently reporting DOWN |
| (default metrics) | various | Node.js process and HTTP metrics via `prom-client` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `true` | Set to `false` to disable the `/metrics` endpoint |

## Dependencies

- `@willsoto/nestjs-prometheus` — Prometheus integration
- `prom-client` — metric registry
