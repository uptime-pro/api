import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Uptime Pro' })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({ example: 60, minimum: 10, maximum: 3600 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  checkIntervalSeconds?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultResendIntervalMinutes?: number;

  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dateFormat?: string;
}
