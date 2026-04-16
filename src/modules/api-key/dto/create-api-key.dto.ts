import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, IsDateString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: ['read', 'read-write'] }) @IsIn(['read', 'read-write']) permission: 'read' | 'read-write';
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}
