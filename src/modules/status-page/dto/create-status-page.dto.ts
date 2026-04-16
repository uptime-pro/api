import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateStatusPageDto {
  @ApiProperty({ example: 'My Services' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'my-services' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'auto' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customCss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footerText?: string;
}
