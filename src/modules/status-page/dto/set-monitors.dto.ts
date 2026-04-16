import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StatusPageMonitorItemDto {
  @ApiProperty()
  @IsInt()
  monitorId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordering?: number;
}

export class SetStatusPageMonitorsDto {
  @ApiProperty({ type: [StatusPageMonitorItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusPageMonitorItemDto)
  monitors: StatusPageMonitorItemDto[];
}
