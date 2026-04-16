# WebSocket Module

Real-time monitor event streaming via native WebSocket (`ws`).

## Connection

```
ws://localhost:3001/ws
```

Authentication is via the `access_token` HttpOnly cookie (same cookie used by the REST API). If the token is missing or invalid, the connection is closed with code `1008 Unauthorized`.

## Events

All messages are JSON objects with `event` and `data` fields.

### `heartbeat`

Emitted after every monitor check.

```json
{
  "event": "heartbeat",
  "data": {
    "monitorId": 1,
    "status": true,
    "ping": 45,
    "msg": "HTTP 200 OK in 45ms",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### `monitorStatus`

Emitted only when the monitor's status changes (up → down or down → up).

```json
{
  "event": "monitorStatus",
  "data": {
    "monitorId": 1,
    "status": false,
    "previousStatus": true,
    "ping": 0,
    "msg": "Request failed: ECONNREFUSED",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Notes

- Each authenticated user only receives events for their own monitors.
- Multiple WebSocket connections from the same user are all notified.
