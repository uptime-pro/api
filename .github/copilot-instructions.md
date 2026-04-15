# Uptime Pro — Backend Agent Instructions

## Project Context

This is the **`api/`** directory of Uptime Pro, a self-hosted uptime monitoring platform.

- **Framework**: NestJS 11 (Node.js + TypeScript)
- **Database**: PostgreSQL 18 (primary) via Prisma 7; SQLite supported for dev/hobbyist
- **Queue/Cache**: BullMQ + DragonflyDB (Redis-compatible)
- **Auth**: HttpOnly JWT cookies (browser) + Bearer API keys (programmatic)
- **API style**: REST under `/api/v1/`; WebSocket gateway for real-time push only
- **Docs**: Swagger UI at `/api/docs`, raw OpenAPI JSON at `/api/docs/json`
- **Linting**: ESLint + Prettier (`pnpm lint`, `pnpm format`)
- **Package manager**: pnpm
- **MCP**: `@nestjs-mcp/server` installed — wire up `McpModule` when building modules that benefit from agent tool access (e.g., monitor management, schema inspection)

Frontend and backend are built **in tandem**. Every phase delivers both API and UI. **The Swagger spec is the contract the frontend builds against — update it before starting frontend work in each phase.**

---

## Absolute Rules

1. **Every new `process.env.SOME_VAR` must be added to `.env.example` and `docs/environment.md` in the same commit.** No exceptions. CI fails if an undocumented env var is found.
2. **Every new NestJS module must include a `README.md` stub** in its folder documenting routes, env vars it reads, and its module dependencies.
3. **Never put business logic in controllers.** Controllers handle HTTP in/out only. All logic lives in services.
4. **Every resource read/write must check `userId` ownership** before acting. Admin role bypasses ownership checks.
5. **Never log sensitive data** (passwords, tokens, notification provider credentials, encryption keys).
6. **Every controller must be decorated with `@ApiTags`, every endpoint with `@ApiOperation` and response decorators.** Swagger spec grows with every phase.
7. **All background work goes through BullMQ.** Never use `setInterval` or `setTimeout` for recurring monitor checks.
8. **Notification provider credentials are encrypted at rest** (AES-256-GCM, key from `ENCRYPTION_KEY` env var). Never store plaintext secrets in the database.

---

## Module Structure

Every feature is a NestJS module following this pattern:

```
src/modules/<feature>/
├── README.md                     ← REQUIRED: routes, env vars, dependencies
├── <feature>.module.ts
├── <feature>.controller.ts       ← HTTP in/out only, no logic
├── <feature>.service.ts          ← all business logic
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── <feature>-response.dto.ts
└── entities/
    └── <feature>.entity.ts       ← typed representation of Prisma model
```

For modules with strategies (monitor types, notification providers):

```
src/modules/monitor/
├── strategies/
│   ├── monitor-strategy.interface.ts
│   ├── http.strategy.ts
│   ├── tcp.strategy.ts
│   └── ...
└── monitor.module.ts
```

---

## Controller Pattern

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiCookieAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../guards/jwt-auth.guard'
import { CurrentUser } from '../../decorators/current-user.decorator'

@ApiTags('monitors')
@ApiCookieAuth('cookie-auth')
@Controller('monitors')
@UseGuards(JwtAuthGuard)
export class MonitorsController {

  constructor(private readonly monitorsService: MonitorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all monitors for the authenticated user' })
  @ApiOkResponse({ type: [MonitorResponseDto] })
  findAll(@CurrentUser() user: AuthUser) {
    return this.monitorsService.findAll(user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new monitor' })
  @ApiCreatedResponse({ type: MonitorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  create(@Body() dto: CreateMonitorDto, @CurrentUser() user: AuthUser) {
    return this.monitorsService.create(dto, user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single monitor by ID' })
  @ApiOkResponse({ type: MonitorResponseDto })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.monitorsService.findOne(id, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a monitor' })
  @ApiOkResponse({ type: MonitorResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMonitorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monitorsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a monitor' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.monitorsService.remove(id, user.id)
  }
}
```

---

## DTO Pattern

All DTOs use `class-validator` decorators for validation and `@nestjs/swagger` decorators for documentation. Both are required on every field.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsEnum, IsInt, IsOptional, IsUrl, Min, MinLength } from 'class-validator'
import { MonitorType } from '../entities/monitor.entity'

export class CreateMonitorDto {
  @ApiProperty({ example: 'Production API', description: 'Human-readable monitor name' })
  @IsString()
  @MinLength(1)
  name: string

  @ApiProperty({ example: 'http', enum: MonitorType, description: 'Monitor type' })
  @IsEnum(MonitorType)
  type: MonitorType

  @ApiProperty({ example: 60, description: 'Check interval in seconds', minimum: 20 })
  @IsInt()
  @Min(20)
  interval: number

  @ApiPropertyOptional({ example: 'https://example.com', description: 'Target URL (HTTP/HTTPS types only)' })
  @IsOptional()
  @IsUrl()
  url?: string
}
```

Response DTOs must also have `@ApiProperty` with `example` values so the Swagger UI is useful:

```typescript
export class MonitorResponseDto {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'Production API' })
  name: string

  @ApiProperty({ example: 'http', enum: MonitorType })
  type: MonitorType

  @ApiProperty({ example: true })
  active: boolean

  @ApiProperty({ example: 60 })
  interval: number

  @ApiProperty({ example: true, nullable: true })
  lastStatus: boolean | null

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z' })
  createdAt: string
}
```

---

## Service Pattern

Services own all business logic. They use `PrismaService` for database access.

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class MonitorsService {

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    return this.prisma.monitor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: number, userId: number) {
    const monitor = await this.prisma.monitor.findUnique({ where: { id } })
    if (!monitor) throw new NotFoundException(`Monitor ${id} not found`)
    if (monitor.userId !== userId) throw new ForbiddenException()
    return monitor
  }

  async create(dto: CreateMonitorDto, userId: number) {
    return this.prisma.monitor.create({
      data: { ...dto, userId },
    })
  }

  async update(id: number, dto: UpdateMonitorDto, userId: number) {
    await this.findOne(id, userId)  // ownership check
    return this.prisma.monitor.update({ where: { id }, data: dto })
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId)  // ownership check
    await this.prisma.monitor.delete({ where: { id } })
  }
}
```

---

## API Response Conventions

All responses follow this structure:

- **Success reads**: `{ data: T }` or `{ data: T[], meta: { total, page, limit } }` for paginated
- **Success create**: `{ data: T }` with HTTP 201
- **Success delete**: HTTP 204 No Content (empty body)
- **Error**: `{ error: string, details?: object }` with appropriate HTTP status

Standard HTTP status codes:

| Code | Use |
|---|---|
| 200 | Successful read or action |
| 201 | Successful POST (created) |
| 204 | Successful DELETE (no content) |
| 400 | Validation error (`class-validator` failure) |
| 401 | No or invalid credentials |
| 403 | Authenticated but no permission (ownership check failed) |
| 404 | Resource not found |
| 409 | Conflict (duplicate slug, username, etc.) |
| 422 | Semantically invalid (valid format but invalid business logic) |
| 429 | Rate limit hit |
| 500 | Internal server error |

---

## Auth Guards

Three guards are available. Apply the appropriate one to every controller or endpoint:

```typescript
// Browser-authenticated routes (JWT cookie)
@UseGuards(JwtAuthGuard)

// Programmatic API access (Bearer token in Authorization header)
@UseGuards(ApiKeyGuard)

// Either JWT cookie or API key (supports both)
@UseGuards(AnyAuthGuard)

// Specific roles required
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
```

Get the current user in a controller:

```typescript
@CurrentUser() user: AuthUser
// user.id, user.role, user.username
```

---

## Prisma Patterns

```typescript
// Always use PrismaService (not PrismaClient directly)
import { PrismaService } from '../../prisma/prisma.service'

// Ownership check pattern (use findOne from service, not raw prisma in controller)
const record = await this.prisma.model.findUnique({ where: { id } })
if (!record) throw new NotFoundException()
if (record.userId !== userId) throw new ForbiddenException()

// Pagination
const [data, total] = await this.prisma.$transaction([
  this.prisma.monitor.findMany({ where, skip, take, orderBy }),
  this.prisma.monitor.count({ where }),
])
return { data, meta: { total, page, limit } }

// Soft-delete alternative: use `active: false` rather than deleting records
// where historical data (heartbeats) must be preserved
```

---

## BullMQ Job Architecture

All recurring and async work goes through BullMQ. Never use `setInterval`.

```typescript
// Dispatching a job
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

@Injectable()
export class MonitorScheduler {
  constructor(@InjectQueue('monitor-checks') private queue: Queue) {}

  async scheduleMonitor(monitor: Monitor) {
    await this.queue.upsertJobScheduler(
      `monitor-${monitor.id}`,
      { every: monitor.interval * 1000 },
      { name: 'check', data: { monitorId: monitor.id } },
    )
  }

  async unscheduleMonitor(monitorId: number) {
    await this.queue.removeJobScheduler(`monitor-${monitorId}`)
  }
}
```

```typescript
// Processing a job
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'

@Processor('monitor-checks')
export class MonitorWorker extends WorkerHost {
  async process(job: Job<{ monitorId: number }>) {
    const { monitorId } = job.data
    // 1. Load monitor from DB
    // 2. Check maintenance window
    // 3. Run strategy.check()
    // 4. Write heartbeat
    // 5. Evaluate status change
    // 6. Dispatch notification job if status changed
    // 7. Emit WebSocket event via DragonflyDB pub/sub
  }
}
```

Job queues:
- `monitor-checks` — repeating monitor check jobs
- `notifications` — async notification dispatch
- Workers live in `src/workers/`

---

## WebSocket Gateway

The WebSocket gateway is **push-only** — no CRUD over WebSocket. All mutations go through REST. The gateway lives in `src/modules/websocket/`.

### Gateway Decorators

| Decorator | Import | Purpose |
|---|---|---|
| `@WebSocketGateway(port?, opts?)` | `@nestjs/websockets` | Marks class as a WebSocket gateway |
| `@WebSocketServer()` | `@nestjs/websockets` | Injects the underlying server instance |
| `@SubscribeMessage(event)` | `@nestjs/websockets` | Handles incoming events by name |
| `@MessageBody(key?)` | `@nestjs/websockets` | Extracts event payload (or a key from it) |
| `@ConnectedSocket()` | `@nestjs/websockets` | Injects the socket of the sending client |
| `@Ack()` | `@nestjs/websockets` | Injects the acknowledgment callback |

### Lifecycle Interfaces

| Interface | Method | When |
|---|---|---|
| `OnGatewayInit` | `afterInit(server)` | After server is created |
| `OnGatewayConnection` | `handleConnection(client, ...args)` | Client connects |
| `OnGatewayDisconnect` | `handleDisconnect(client)` | Client disconnects |

All three are imported from `@nestjs/websockets`.

### Uptime Pro Gateway

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'

@WebSocketGateway({ namespace: '/ws', cors: { origin: process.env.WEBUI_URL, credentials: true } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(EventsGateway.name)

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized')
  }

  handleConnection(client: Socket) {
    // 1. Extract JWT from handshake cookie
    // 2. Verify token — call disconnect() if invalid
    // 3. Join user room: client.join(`user:${userId}`)
    this.logger.debug(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  /** Push a heartbeat event to all sockets in the user's room */
  emitToUser(userId: number, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data)
  }
}
```

### Emitted Events (Server → Client, push-only)

| Event | Payload | Trigger |
|---|---|---|
| `heartbeat` | `{ monitorId, status, ping, msg, timestamp }` | After every monitor check |
| `monitorStatus` | `{ monitorId, up, previous }` | Up/down state changes |
| `monitorListDelta` | `{ action: 'add'|'update'|'delete', monitor }` | Monitor CRUD |
| `incidentUpdate` | `{ incidentId, monitorId, action, cause }` | Incident lifecycle changes |
| `serverInfo` | `{ version, hostname }` | Server info changes |

### Listening for Client Events (if needed)

If a client needs to send data (e.g., subscribe to specific monitors), use `@SubscribeMessage`:

```typescript
@SubscribeMessage('subscribe')
handleSubscribe(
  @ConnectedSocket() client: Socket,
  @MessageBody() payload: { monitorIds: number[] },
): void {
  // Join per-monitor rooms for granular filtering
  payload.monitorIds.forEach(id => client.join(`monitor:${id}`))
}
```

For bi-directional acknowledgment responses, return `WsResponse<T>`:

```typescript
import { WsResponse } from '@nestjs/websockets'

@SubscribeMessage('ping')
handlePing(@MessageBody() data: unknown): WsResponse<string> {
  return { event: 'pong', data: 'ok' }
}
```

---

## WebSocket Adapter (DragonflyDB)

DragonflyDB is Redis-compatible. Use `@socket.io/redis-adapter` to broadcast events across multiple API instances (horizontal scaling).

```typescript
// src/modules/websocket/dragonfly-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io'
import { ServerOptions } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

export class DragonflyIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>

  async connectToDragonfly(): Promise<void> {
    const pubClient = createClient({ url: process.env.DRAGONFLY_URL ?? 'redis://localhost:6379' })
    const subClient = pubClient.duplicate()

    await Promise.all([pubClient.connect(), subClient.connect()])

    this.adapterConstructor = createAdapter(pubClient, subClient)
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options)
    server.adapter(this.adapterConstructor)
    return server
  }
}
```

Wire it up in `main.ts`:

```typescript
const adapter = new DragonflyIoAdapter(app)
await adapter.connectToDragonfly()
app.useWebSocketAdapter(adapter)
```

> **Note:** For multi-instance deployments you must also configure sticky sessions in the load balancer, or disable long-polling by setting `transports: ['websocket']` on the client.

### Custom Adapter Interface

If building a fully custom adapter, implement `WebSocketAdapter` from `@nestjs/common`:

```typescript
interface WebSocketAdapter {
  create(port: number, options?: any): any
  bindClientConnect(server: any, callback: Function): void
  bindClientDisconnect?(server: any, callback: Function): void
  bindMessageHandlers(client: any, handlers: MessageMappingProperties[], process: (data: any) => Observable<any>): void
  close(server: any): void
}
```

---

## NestJS Decorator Quick Reference

### HTTP & Routing

| Decorator | Usage |
|---|---|
| `@Controller(path?)` | Marks class as a controller; sets route prefix |
| `@Get(path?)` `@Post` `@Put` `@Patch` `@Delete` `@Options` `@Head` `@All` | HTTP method handlers |
| `@HttpCode(code)` | Override default response status code |
| `@Redirect(url, status?)` | Redirect response |
| `@Header(name, value)` | Set response header |

### Request Data

| Decorator | Usage |
|---|---|
| `@Body(key?)` | Full request body or a named key |
| `@Param(key?)` | Route param (`:id`) — always use `ParseIntPipe` for numeric IDs |
| `@Query(key?)` | Query string param |
| `@Headers(key?)` | Request header |
| `@Req()` | Raw request object (Express/Fastify) |
| `@Res()` | Raw response object — avoid unless necessary, breaks interceptors |
| `@Ip()` | Client IP |
| `@HostParam()` | Hostname route param |

### DI & Module

| Decorator | Usage |
|---|---|
| `@Injectable()` | Mark class as provider (service, guard, pipe, etc.) |
| `@Inject(token)` | Inject by token (for non-class providers) |
| `@Module(metadata)` | Declare module with `imports`, `controllers`, `providers`, `exports` |
| `@Global()` | Make module global — use sparingly (only for PrismaModule, ConfigModule) |
| `@Optional()` | Mark injected dep as optional |

### Lifecycle & Metadata

| Decorator | Usage |
|---|---|
| `@UseGuards(...guards)` | Apply auth/role guards |
| `@UseInterceptors(...interceptors)` | Apply interceptors |
| `@UsePipes(...pipes)` | Apply validation pipes |
| `@UseFilters(...filters)` | Apply exception filters |
| `@SetMetadata(key, value)` | Attach metadata (consumed by guards via `Reflector`) |
| `@Roles(...roles)` | Custom decorator built on `@SetMetadata` |

### WebSocket

| Decorator | Usage |
|---|---|
| `@WebSocketGateway(port?, opts?)` | Declare gateway class |
| `@WebSocketServer()` | Inject server instance |
| `@SubscribeMessage(event)` | Handle incoming event by name |
| `@MessageBody(key?)` | Extract event payload |
| `@ConnectedSocket()` | Inject sending socket |
| `@Ack()` | Inject acknowledgment callback |

---

## NestJS Best Practices

### Dependency Injection

- Always inject via constructor — never instantiate services manually with `new`
- Avoid circular dependencies — they cause memory leaks and startup failures. Break cycles with `forwardRef()`:

```typescript
@Injectable()
export class MonitorService {
  constructor(
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}
}
```

- Keep provider scope as `DEFAULT` (singleton) unless you have a specific reason to use `REQUEST` or `TRANSIENT` scope. Scoped providers propagate up the injection chain and can cause unexpected behavior.

### Module Design

- One module per domain feature — never put unrelated controllers/services in the same module
- Register gateways in their module's `providers` array — gateways are not instantiated until referenced there
- Export only what other modules need — keep the public surface small
- Use lazy-loaded modules for heavy, infrequently-used features:

```typescript
const { HeavyModule } = await import('./heavy/heavy.module')
const moduleRef = await this.lazyModuleLoader.load(() => HeavyModule)
const service = moduleRef.get(HeavyService)
```

### Middleware & Interceptors

- Middleware runs before route handlers and has access to `req`/`res` — keep it lightweight and targeted (don't apply globally unless required)
- Interceptors wrap request handling and can modify input/output — avoid overriding the response object inside interceptors (breaks streaming, SSE, and other features)
- Combine multiple small interceptors into one when performance matters — each interceptor adds overhead

### Error Handling

Use NestJS built-in HTTP exceptions consistently:

```typescript
import {
  BadRequestException,    // 400
  UnauthorizedException,  // 401
  ForbiddenException,     // 403
  NotFoundException,      // 404
  ConflictException,      // 409
  UnprocessableEntityException, // 422
  InternalServerErrorException, // 500
} from '@nestjs/common'

// Good: throw the right exception
throw new NotFoundException(`Monitor ${id} not found`)

// Bad: generic 500
throw new Error('something went wrong')
```

For domain-wide exception handling, create a global `AllExceptionsFilter`:

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR
    // log + respond
  }
}
```

### Performance

- Never use `setInterval` / `setTimeout` for recurring work — use BullMQ repeating jobs
- Use `select` in Prisma queries to fetch only needed fields — avoid `SELECT *` on large tables
- Add database indexes on: foreign keys, `userId` lookups, `status` + `userId` composite, `createdAt` DESC for pagination
- Use `prisma.$transaction` for paginated queries that need a count in parallel
- Avoid `N+1` queries — use Prisma's `include` or batch lookups

---

## Swagger Setup (`main.ts`)

The Swagger module is wired once in `main.ts`. Every controller and DTO must carry its own decorators — the spec builds automatically.

```typescript
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('Uptime Pro API')
      .setDescription('REST API for Uptime Pro. Real-time events delivered via WebSocket — see docs/build_plan.md.')
      .setVersion('1.0')
      .addCookieAuth('jwt', { type: 'apiKey', in: 'cookie', name: 'jwt' }, 'cookie-auth')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'API Key' }, 'api-key')
      .addTag('auth').addTag('monitors').addTag('heartbeats').addTag('notifications')
      .addTag('status-pages').addTag('incidents').addTag('maintenance').addTag('tags')
      .addTag('settings').addTag('api-keys').addTag('users').addTag('metrics')
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
    })
  }

  await app.listen(process.env.PORT ?? 3001)
}
bootstrap()
```

---

## Module README Format

Every new module folder requires a `README.md`:

```markdown
# MonitorModule

Manages monitor lifecycle (CRUD), schedules BullMQ jobs, and handles heartbeat recording.

## Routes
- `GET /api/v1/monitors` — list all monitors for the authenticated user
- `POST /api/v1/monitors` — create a new monitor
- `GET /api/v1/monitors/:id` — get a single monitor
- `PATCH /api/v1/monitors/:id` — update a monitor
- `DELETE /api/v1/monitors/:id` — delete a monitor

## Environment Variables
- `MONITOR_WORKER_CONCURRENCY` — number of concurrent BullMQ workers (default: 5)
- `MONITOR_MAX_INTERVAL` — maximum allowed interval in seconds (default: 3600)
- `MONITOR_MIN_INTERVAL` — minimum allowed interval in seconds (default: 20)

## Depends On
- `PrismaModule` — database access
- `BullModule` — job scheduling
- `WebSocketGateway` — push events on state change
```

---

## Monitor Strategy Pattern

Each of the 23 monitor types is a strategy class:

```typescript
// src/modules/monitor/strategies/monitor-strategy.interface.ts
export interface MonitorStrategy {
  readonly type: string
  check(monitor: Monitor): Promise<CheckResult>
}

export interface CheckResult {
  status: boolean
  ping: number | null
  msg: string
}
```

```typescript
// src/modules/monitor/strategies/http.strategy.ts
import { Injectable } from '@nestjs/common'
import { MonitorStrategy, CheckResult } from './monitor-strategy.interface'

@Injectable()
export class HttpStrategy implements MonitorStrategy {
  readonly type = 'http'

  async check(monitor: Monitor): Promise<CheckResult> {
    // implementation
  }
}
```

Strategies are injected into `MonitorService` via a registry map. All 23 types:
`http`, `https`, `tcp`, `ping`, `push`, `dns`, `docker`, `mqtt`, `grpc`, `steam`, `gamedig`, `tailscale`, `websocket`, `postgres`, `mysql`, `mssql`, `mongodb`, `redis`, `rabbitmq`, `snmp`, `smtp`, `sip`, `oracle`, `browser`, `globalping`, `system-service`, `manual`, `group`

---

## Notification Strategy Pattern

```typescript
// src/modules/notification/providers/notification-strategy.interface.ts
export interface NotificationStrategy {
  readonly type: string
  send(notification: Notification, monitor: Monitor, heartbeat: Heartbeat): Promise<void>
}
```

Providers live in `src/modules/notification/providers/` — one file per provider. Credentials are decrypted at use time using `EncryptionService`. Never log decrypted credentials.

---

## Environment Variable Documentation Rule

Every time `process.env.SOME_VAR` appears in code, both of these files must be updated **in the same commit**:

1. **`.env.example`** — add the variable with a comment block:
   ```bash
   # Description of what this var does, its type, and default value
   SOME_VAR=default-value
   ```

2. **`docs/environment.md`** — add a row to the reference table:
   ```markdown
   | `SOME_VAR` | No | `default-value` | Description of the variable |
   ```

CI will fail if any `process.env.*` reference in `src/` is not present in `.env.example`.

---

## Project Structure

```
api/
├── src/
│   ├── main.ts                       ← app bootstrap, Swagger setup, global pipes
│   ├── app.module.ts                 ← root module, imports all feature modules
│   │
│   ├── modules/
│   │   ├── auth/                     ← login, logout, me, 2FA, change-password
│   │   ├── user/                     ← CRUD, roles
│   │   ├── monitor/
│   │   │   └── strategies/           ← one file per monitor type
│   │   ├── notification/
│   │   │   └── providers/            ← one file per notification provider
│   │   ├── status-page/
│   │   ├── incident/
│   │   ├── maintenance/
│   │   ├── tag/
│   │   ├── settings/
│   │   ├── api-key/
│   │   ├── metrics/                  ← Prometheus /metrics, badge endpoints
│   │   └── websocket/                ← NestJS WebSocket Gateway
│   │
│   ├── workers/
│   │   ├── monitor.worker.ts         ← BullMQ processor for monitor-checks queue
│   │   └── notification.worker.ts   ← BullMQ processor for notifications queue
│   │
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── api-key.guard.ts
│   │   ├── any-auth.guard.ts
│   │   └── roles.guard.ts
│   │
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   │
│   ├── interceptors/
│   │   └── logging.interceptor.ts    ← request/response logging via Pino
│   │
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts
│
├── prisma/
│   └── schema.prisma                 ← source of truth for all models
│
└── test/
    ├── app.e2e-spec.ts
    └── jest-e2e.json
```

---

## Rate Limiting

Applied globally via `@nestjs/throttler`. Override per-route as needed:

| Scope | Limit |
|---|---|
| `POST /api/v1/auth/login` | 10 req / 15 min per IP |
| `POST /api/v1/auth/2fa/verify` | 5 req / 15 min per IP |
| `/api/v1/` external API routes | 300 req / min per API key |
| Global | 1000 req / min per IP |

---

## Security Checklist

- [ ] Passwords hashed with bcrypt (min 12 rounds)
- [ ] JWT: RS256, 24h expiry, HttpOnly cookie (`HttpOnly; Secure; SameSite=Strict; Path=/`)
- [ ] No token in localStorage, URL, or response body
- [ ] Every resource query includes `userId` ownership check
- [ ] Admin role bypasses ownership check — no other exceptions
- [ ] Notification credentials encrypted at rest (AES-256-GCM)
- [ ] Monitor credentials (basic auth, API tokens) encrypted at rest
- [ ] All body inputs validated via `ValidationPipe` + `class-validator`
- [ ] Path params validated as positive integers with `ParseIntPipe`
- [ ] Swagger disabled by default in production (`SWAGGER_ENABLED=false`)

---

## Linting & Formatting

```bash
pnpm lint     # eslint
pnpm format   # prettier --write
pnpm build    # nest build (TypeScript compile check)
pnpm test     # jest unit tests
pnpm test:e2e # jest e2e tests
```
