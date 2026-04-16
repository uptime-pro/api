import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatusPageResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() userId: number;
  @ApiProperty() slug: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() theme: string;
  @ApiProperty() published: boolean;
  @ApiPropertyOptional() customDomain?: string | null;
  @ApiPropertyOptional() customCss?: string | null;
  @ApiPropertyOptional() footerText?: string | null;
  @ApiProperty() showTags: boolean;
  @ApiPropertyOptional() googleAnalytics?: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
