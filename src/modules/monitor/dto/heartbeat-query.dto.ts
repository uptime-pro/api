import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsDateString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class HeartbeatQueryDto {
  @ApiPropertyOptional({ default: 100 }) @IsOptional() @IsInt() @Min(1) @Max(500) @Type(() => Number) limit?: number = 100;
  @ApiPropertyOptional() @IsOptional() @IsDateString() before?: string;
}
