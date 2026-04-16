import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule, MONITOR_QUEUE } from '../../queue/queue.module.js';
import { WsModule } from '../websocket/ws.module.js';
import { MonitorService } from './monitor.service.js';
import { MonitorController } from './monitor.controller.js';
import { MonitorStrategyRegistry } from './strategies/strategy.registry.js';
import { HttpStrategy } from './strategies/http.strategy.js';
import { TcpStrategy } from './strategies/tcp.strategy.js';
import { PingStrategy } from './strategies/ping.strategy.js';
import { PushStrategy } from './strategies/push.strategy.js';
import { DnsStrategy } from './strategies/dns.strategy.js';
import { WebSocketStrategy } from './strategies/websocket.strategy.js';
import { PostgresStrategy } from './strategies/postgres.strategy.js';
import { MySqlStrategy } from './strategies/mysql.strategy.js';
import { MssqlStrategy } from './strategies/mssql.strategy.js';
import { MongoDbStrategy } from './strategies/mongodb.strategy.js';
import { RedisStrategy } from './strategies/redis.strategy.js';
import { RabbitmqStrategy } from './strategies/rabbitmq.strategy.js';
import { MqttStrategy } from './strategies/mqtt.strategy.js';
import { DockerStrategy } from './strategies/docker.strategy.js';
import { GrpcStrategy } from './strategies/grpc.strategy.js';
import { SteamStrategy } from './strategies/steam.strategy.js';
import { GamedigStrategy } from './strategies/gamedig.strategy.js';
import { TailscalePingStrategy } from './strategies/tailscale-ping.strategy.js';
import { SnmpStrategy } from './strategies/snmp.strategy.js';
import { SmtpCheckStrategy } from './strategies/smtp-check.strategy.js';
import { SipStrategy } from './strategies/sip.strategy.js';
import { ManualStrategy } from './strategies/manual.strategy.js';
import { GroupStrategy } from './strategies/group.strategy.js';
import { SslCertStrategy } from './strategies/ssl-cert.strategy.js';
import { DomainExpiryStrategy } from './strategies/domain-expiry.strategy.js';
import { MaintenanceService } from './maintenance.service.js';
import { MonitorWorker } from '../../workers/monitor.worker.js';
import { NotificationModule } from '../notification/notification.module.js';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [
    QueueModule,
    BullModule.registerQueue({ name: MONITOR_QUEUE }),
    WsModule,
    NotificationModule,
    MaintenanceModule,
    AuditModule,
  ],
  controllers: [MonitorController],
  providers: [
    MonitorService,
    MonitorStrategyRegistry,
    HttpStrategy,
    TcpStrategy,
    PingStrategy,
    PushStrategy,
    DnsStrategy,
    WebSocketStrategy,
    PostgresStrategy,
    MySqlStrategy,
    MssqlStrategy,
    MongoDbStrategy,
    RedisStrategy,
    RabbitmqStrategy,
    MqttStrategy,
    DockerStrategy,
    GrpcStrategy,
    SteamStrategy,
    GamedigStrategy,
    TailscalePingStrategy,
    SnmpStrategy,
    SmtpCheckStrategy,
    SipStrategy,
    ManualStrategy,
    GroupStrategy,
    SslCertStrategy,
    DomainExpiryStrategy,
    MaintenanceService,
    MonitorWorker,
  ],
  exports: [MonitorService, MonitorStrategyRegistry, MaintenanceService],
})
export class MonitorModule {}
