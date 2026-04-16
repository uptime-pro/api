import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';
import { NOTIFICATION_TYPES } from './create-notification.dto.js';
import type { NotificationType } from './create-notification.dto.js';

export class TestNotificationDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @ApiProperty({ description: 'Provider-specific configuration object' })
  @IsObject()
  config: Record<string, unknown>;
}
