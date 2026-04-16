import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';

enum IncidentSeverityDto {
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  MAINTENANCE = 'MAINTENANCE',
}

export class CreateIncidentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: IncidentSeverityDto, default: 'MINOR' })
  @IsOptional()
  @IsEnum(IncidentSeverityDto)
  severity?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
