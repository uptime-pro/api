import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsBoolean, IsOptional, IsObject } from 'class-validator';

export const NOTIFICATION_TYPES = ['discord', 'slack', 'email', 'webhook', 'teams', 'telegram', 'pushover', 'gotify', 'ntfy'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export class CreateNotificationDto {
  @ApiProperty({ example: 'My Discord Alert' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @ApiProperty({ description: 'Provider-specific configuration object' })
  @IsObject()
  config: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
