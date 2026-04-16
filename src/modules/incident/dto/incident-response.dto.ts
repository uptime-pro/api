import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IncidentUpdateResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() incidentId: number;
  @ApiProperty() content: string;
  @ApiProperty() status: string;
  @ApiProperty() createdAt: Date;
}

export class IncidentResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() statusPageId: number;
  @ApiProperty() title: string;
  @ApiProperty() content: string;
  @ApiProperty() severity: string;
  @ApiProperty() status: string;
  @ApiProperty() pinned: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ type: [IncidentUpdateResponseDto] })
  updates?: IncidentUpdateResponseDto[];
}
