import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 'My Discord Alert' })
  name: string;

  @ApiProperty({ example: 'discord' })
  type: string;

  @ApiProperty({ description: 'Provider config with secrets redacted' })
  config: Record<string, unknown>;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
