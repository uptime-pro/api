import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ required: false, nullable: true })
  email: string | null;

  @ApiProperty()
  role: string;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  twoFaActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  timezone: string | null;

  @ApiProperty()
  theme: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
