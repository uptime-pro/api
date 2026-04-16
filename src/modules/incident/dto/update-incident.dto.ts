import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateIncidentDto } from './create-incident.dto.js';

enum IncidentStatusDto {
  INVESTIGATING = 'INVESTIGATING',
  IDENTIFIED = 'IDENTIFIED',
  MONITORING = 'MONITORING',
  RESOLVED = 'RESOLVED',
}

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @ApiPropertyOptional({ enum: IncidentStatusDto })
  @IsOptional()
  @IsEnum(IncidentStatusDto)
  status?: string;
}
