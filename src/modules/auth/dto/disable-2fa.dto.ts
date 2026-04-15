import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Disable2faDto {
  @ApiProperty({ description: 'Current password to confirm disable' })
  @IsString()
  password: string;
}
