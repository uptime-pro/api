import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ example: '123456', description: 'TOTP code or backup code' })
  @IsString()
  code: string;
}
