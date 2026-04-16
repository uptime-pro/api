import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonitorExportItemDto {
  @ApiProperty() name: string;
  @ApiProperty() type: string;
  @ApiProperty() active: boolean;
  @ApiProperty() interval: number;
  @ApiProperty() retryInterval: number;
  @ApiProperty() maxRetries: number;
  @ApiProperty() notificationDelay: number;
  @ApiProperty() resendInterval: number;
  @ApiProperty() upsideDown: boolean;
  @ApiProperty() config: Record<string, unknown>;
  @ApiPropertyOptional() slaTarget?: number;
  @ApiPropertyOptional() responseTimeThreshold?: number;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
}

export class MonitorExportDto {
  @ApiProperty() version: string;
  @ApiProperty() exportedAt: string;
  @ApiProperty({ type: [MonitorExportItemDto] }) monitors: MonitorExportItemDto[];
}
