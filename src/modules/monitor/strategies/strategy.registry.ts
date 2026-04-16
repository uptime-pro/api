import { Injectable, BadRequestException } from '@nestjs/common';
import type { MonitorStrategy } from './monitor-strategy.interface.js';
import { HttpStrategy } from './http.strategy.js';
import { TcpStrategy } from './tcp.strategy.js';
import { PingStrategy } from './ping.strategy.js';
import { PushStrategy } from './push.strategy.js';
import { DnsStrategy } from './dns.strategy.js';
import { WebSocketStrategy } from './websocket.strategy.js';
import { PostgresStrategy } from './postgres.strategy.js';
import { MySqlStrategy } from './mysql.strategy.js';
import { MssqlStrategy } from './mssql.strategy.js';
import { MongoDbStrategy } from './mongodb.strategy.js';
import { RedisStrategy } from './redis.strategy.js';
import { RabbitmqStrategy } from './rabbitmq.strategy.js';
import { MqttStrategy } from './mqtt.strategy.js';
import { DockerStrategy } from './docker.strategy.js';
import { GrpcStrategy } from './grpc.strategy.js';
import { SteamStrategy } from './steam.strategy.js';
import { GamedigStrategy } from './gamedig.strategy.js';
import { TailscalePingStrategy } from './tailscale-ping.strategy.js';
import { SnmpStrategy } from './snmp.strategy.js';
import { SmtpCheckStrategy } from './smtp-check.strategy.js';
import { SipStrategy } from './sip.strategy.js';
import { ManualStrategy } from './manual.strategy.js';
import { GroupStrategy } from './group.strategy.js';

@Injectable()
export class MonitorStrategyRegistry {
  private readonly strategies: Map<string, MonitorStrategy>;

  constructor(
    private readonly httpStrategy: HttpStrategy,
    private readonly tcpStrategy: TcpStrategy,
    private readonly pingStrategy: PingStrategy,
    private readonly pushStrategy: PushStrategy,
    private readonly dnsStrategy: DnsStrategy,
    private readonly webSocketStrategy: WebSocketStrategy,
    private readonly postgresStrategy: PostgresStrategy,
    private readonly mySqlStrategy: MySqlStrategy,
    private readonly mssqlStrategy: MssqlStrategy,
    private readonly mongoDbStrategy: MongoDbStrategy,
    private readonly redisStrategy: RedisStrategy,
    private readonly rabbitmqStrategy: RabbitmqStrategy,
    private readonly mqttStrategy: MqttStrategy,
    private readonly dockerStrategy: DockerStrategy,
    private readonly grpcStrategy: GrpcStrategy,
    private readonly steamStrategy: SteamStrategy,
    private readonly gamedigStrategy: GamedigStrategy,
    private readonly tailscalePingStrategy: TailscalePingStrategy,
    private readonly snmpStrategy: SnmpStrategy,
    private readonly smtpCheckStrategy: SmtpCheckStrategy,
    private readonly sipStrategy: SipStrategy,
    private readonly manualStrategy: ManualStrategy,
    private readonly groupStrategy: GroupStrategy,
  ) {
    this.strategies = new Map([
      ['http', this.httpStrategy],
      ['tcp', this.tcpStrategy],
      ['ping', this.pingStrategy],
      ['push', this.pushStrategy],
      ['dns', this.dnsStrategy],
      ['websocket', this.webSocketStrategy],
      ['postgres', this.postgresStrategy],
      ['mysql', this.mySqlStrategy],
      ['mssql', this.mssqlStrategy],
      ['mongodb', this.mongoDbStrategy],
      ['redis', this.redisStrategy],
      ['rabbitmq', this.rabbitmqStrategy],
      ['mqtt', this.mqttStrategy],
      ['docker', this.dockerStrategy],
      ['grpc', this.grpcStrategy],
      ['steam', this.steamStrategy],
      ['gamedig', this.gamedigStrategy],
      ['tailscale-ping', this.tailscalePingStrategy],
      ['snmp', this.snmpStrategy],
      ['smtp', this.smtpCheckStrategy],
      ['sip', this.sipStrategy],
      ['manual', this.manualStrategy],
      ['group', this.groupStrategy],
    ]);
  }

  getStrategy(type: string): MonitorStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new BadRequestException(`Unknown monitor type: ${type}`);
    }
    return strategy;
  }
}
