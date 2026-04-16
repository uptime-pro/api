import { ApiProperty } from '@nestjs/swagger';

export class ReportConfigDto {
  @ApiProperty({ description: 'Whether reports are enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Recipient email address' })
  recipientEmail: string;

  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'], description: 'Report frequency' })
  frequency: 'daily' | 'weekly' | 'monthly';
}
