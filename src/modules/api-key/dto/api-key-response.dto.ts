import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() permission: string;
  @ApiProperty() active: boolean;
  @ApiPropertyOptional({ nullable: true }) expires: Date | null;
  @ApiProperty() createdAt: Date;
}

export class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {
  @ApiProperty({ description: 'Raw key — shown once only' }) key: string;
}
