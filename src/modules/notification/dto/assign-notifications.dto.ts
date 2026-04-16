import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class AssignNotificationsDto {
  @ApiProperty({ type: [Number], description: 'Array of notification IDs to assign' })
  @IsArray()
  @IsInt({ each: true })
  notificationIds: number[];
}
