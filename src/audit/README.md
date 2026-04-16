# Audit Module

## Responsibility

Provides a fire-and-forget audit logging service. Other modules call `AuditService.log()` to record sensitive or important user actions (login, key creation, settings changes, etc.) to the `AuditLog` database table.

## Service API

```typescript
auditService.log({
  userId?: number;        // User performing the action (undefined = system)
  action: string;         // e.g. 'user.login', 'api-key.created'
  entity?: string;        // e.g. 'Monitor', 'ApiKey'
  entityId?: number;      // Primary key of the affected record
  meta?: Record<string, unknown>; // Additional context
  ip?: string;            // Client IP address
});
```

Errors are silently swallowed so that audit failures never interrupt the main request path.

## No HTTP Routes

The audit module exposes no HTTP endpoints. Logs are readable by querying the database directly or via a future admin UI.

## Dependencies

- `PrismaModule` — `AuditLog` model persistence

## Notes

- `AuditModule` is imported by `AppModule` and available globally via `PrismaModule`.
- Actions use dot-notation: `<resource>.<verb>` (e.g. `monitor.deleted`, `auth.2fa.enabled`).
