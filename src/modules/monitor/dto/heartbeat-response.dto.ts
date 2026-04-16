import { ApiProperty } from '@nestjs/swagger';

export class HeartbeatResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  monitorId: number;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 42.5, nullable: true })
  ping: number | null;

  @ApiProperty({ example: '200 OK', nullable: true })
  msg: string | null;

  @ApiProperty({ example: false })
  important: boolean;

  @ApiProperty({ example: 0 })
  downCount: number;

  @ApiProperty({ example: 0 })
  duration: number;

  @ApiProperty({ example: 0 })
  retries: number;

  @ApiProperty({ example: '2026-04-15T00:00:00.000Z' })
  createdAt: Date;
}
