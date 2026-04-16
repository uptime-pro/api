import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({ example: 'Uptime Pro' })
  siteName: string;

  @ApiProperty({ example: 60 })
  checkIntervalSeconds: number;

  @ApiProperty({ example: 60 })
  defaultResendIntervalMinutes: number;

  @ApiProperty({ example: 3 })
  retryCount: number;

  @ApiProperty({ example: 'UTC' })
  timezone: string;

  @ApiProperty({ example: 'YYYY-MM-DD' })
  dateFormat: string;
}
