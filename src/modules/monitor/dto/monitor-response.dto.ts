import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MonitorResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 'Production API' })
  name: string;

  @ApiProperty({ example: 'http' })
  type: string;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ example: 60 })
  interval: number;

  @ApiProperty({ example: 60 })
  retryInterval: number;

  @ApiProperty({ example: 1 })
  maxRetries: number;

  @ApiProperty({ example: 0 })
  notificationDelay: number;

  @ApiProperty({ example: 0 })
  resendInterval: number;

  @ApiProperty({ example: false })
  upsideDown: boolean;

  @ApiProperty({ example: { url: 'https://example.com' } })
  config: Record<string, unknown>;

  @ApiProperty({ example: true, nullable: true })
  lastStatus: boolean | null;

  @ApiProperty({ example: 42.5, nullable: true })
  lastPing: number | null;

  @ApiPropertyOptional({ nullable: true })
  slaTarget?: number | null;

  @ApiPropertyOptional({ nullable: true })
  responseTimeThreshold?: number | null;

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z' })
  updatedAt: Date;
}
