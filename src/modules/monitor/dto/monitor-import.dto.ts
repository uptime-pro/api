import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const MONITOR_TYPES = ['http','tcp','ping','push','dns','websocket','postgres','mysql','mssql','mongodb','redis','rabbitmq','mqtt','docker','grpc','steam','gamedig','tailscale-ping','snmp','smtp','sip','manual','group'] as const;

export class MonitorImportItemDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: MONITOR_TYPES }) @IsString() @IsIn(MONITOR_TYPES) type: string;
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

export class MonitorImportDto {
  @ApiProperty({ type: [MonitorImportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonitorImportItemDto)
  monitors: MonitorImportItemDto[];
}

export class MonitorImportResultDto {
  @ApiProperty() imported: number;
  @ApiProperty() skipped: number;
  @ApiProperty({ type: [String] }) errors: string[];
}
