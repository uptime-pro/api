import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MaintenanceResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  strategy: string;

  @ApiProperty()
  active: boolean;

  @ApiPropertyOptional()
  startDate: Date | null;

  @ApiPropertyOptional()
  endDate: Date | null;

  @ApiProperty({ type: [Number] })
  weekdays: number[];

  @ApiProperty({ type: [Number] })
  hours: number[];

  @ApiProperty()
  durationMinutes: number;

  @ApiPropertyOptional()
  cronExpr: string | null;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [Number] })
  monitorIds: number[];
}
