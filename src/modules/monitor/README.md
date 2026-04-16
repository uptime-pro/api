# Monitor Module

Handles creation, scheduling, and reporting of uptime monitors.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/monitors` | JWT | List monitors for current user |
| POST | `/api/v1/monitors` | JWT | Create a monitor |
| POST | `/api/v1/monitors/push/:token` | None | Receive push heartbeat |
| GET | `/api/v1/monitors/:id` | JWT | Get monitor by ID |
| PATCH | `/api/v1/monitors/:id` | JWT | Update monitor |
| DELETE | `/api/v1/monitors/:id` | JWT | Delete monitor |
| POST | `/api/v1/monitors/:id/pause` | JWT | Pause monitor |
| POST | `/api/v1/monitors/:id/resume` | JWT | Resume monitor |
| POST | `/api/v1/monitors/:id/check` | JWT | Trigger manual check |
| GET | `/api/v1/monitors/:id/heartbeats` | JWT | Get heartbeat history |
| DELETE | `/api/v1/monitors/:id/heartbeats` | JWT | Delete heartbeats |

## Monitor Types & Config

### `http`
```json
{
  "url": "https://example.com",
  "method": "GET",
  "expectedStatus": 200,
  "keyword": "optional string to find in body"
}
```

### `tcp`
```json
{
  "host": "example.com",
  "port": 443
}
```

### `ping`
```json
{
  "host": "example.com"
}
```

### `push`
```json
{}
```
A `pushToken` is auto-generated on creation. Send a `POST /api/v1/monitors/push/:token` request from your service to record a heartbeat.

### `dns`
```json
{
  "host": "example.com",
  "type": "A",
  "expectedValue": "1.2.3.4"
}
```
Supported `type` values: `A`, `AAAA`, `CNAME`, `MX`, `TXT`.
