import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsBoolean,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export const MAINTENANCE_STRATEGIES = [
  'manual',
  'one-time',
  'recurring-interval',
  'recurring-weekday',
  'recurring-day-of-month',
  'cron',
] as const;

export class CreateMaintenanceDto {
  @ApiProperty({ example: 'Weekly Maintenance' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: MAINTENANCE_STRATEGIES })
  @IsIn(MAINTENANCE_STRATEGIES)
  strategy: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-01-02T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ type: [Number], description: 'Weekdays 0-6 (Sunday=0)' })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  weekdays?: number[];

  @ApiPropertyOptional({ type: [Number], description: 'Hours 0-23' })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  @IsOptional()
  hours?: number[];

  @ApiPropertyOptional({ default: 60 })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: '0 2 * * 0' })
  @IsString()
  @IsOptional()
  cronExpr?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  monitorIds?: number[];
}
