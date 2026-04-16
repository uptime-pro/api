import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SlaStatsDto {
  @ApiPropertyOptional({ nullable: true }) slaTarget: number | null;
  @ApiProperty() uptimePercent: number;
  @ApiProperty() totalChecks: number;
  @ApiProperty() upChecks: number;
}
