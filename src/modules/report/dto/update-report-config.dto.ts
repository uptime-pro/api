import { IsBoolean, IsEmail, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReportConfigDto {
  @ApiPropertyOptional({ description: 'Enable scheduled reports' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Recipient email address' })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly'], description: 'Report frequency' })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency?: 'daily' | 'weekly' | 'monthly';
}
