import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsIn } from 'class-validator';

const MONITOR_TYPES = [
  'http', 'tcp', 'ping', 'push', 'dns',
  'websocket', 'postgres', 'mysql', 'mssql', 'mongodb',
  'redis', 'rabbitmq', 'mqtt', 'docker', 'grpc',
  'steam', 'gamedig', 'tailscale-ping', 'snmp', 'smtp',
  'sip', 'manual', 'group', 'ssl-cert', 'domain-expiry',
] as const;

export class CreateMonitorDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: MONITOR_TYPES })
  @IsString()
  @IsIn(MONITOR_TYPES)
  type: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() interval?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() retryInterval?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxRetries?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() notificationDelay?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() resendInterval?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() upsideDown?: boolean;
  @ApiProperty({ type: Object }) @IsObject() config: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsNumber() slaTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() responseTimeThreshold?: number;
}
