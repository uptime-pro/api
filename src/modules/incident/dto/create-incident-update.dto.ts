import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateIncidentUpdateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'] })
  @IsEnum(['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'])
  status: string;
}
