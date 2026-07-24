import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateBusinessReportDto {
  @ApiProperty({ description: 'The unique slug of the report configuration' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ description: 'The name of the report' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description of the report' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The data source hook' })
  @IsString()
  @IsNotEmpty()
  dataSourceHook!: string;

  @ApiPropertyOptional({ description: 'UI configuration as JSON object' })
  @IsObject()
  @IsOptional()
  uiConfig?: Record<string, unknown>;
}

export class UpdateBusinessReportDto {
  @ApiPropertyOptional({ description: 'The name of the report' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the report' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'The data source hook' })
  @IsString()
  @IsOptional()
  dataSourceHook?: string;

  @ApiPropertyOptional({ description: 'UI configuration as JSON object' })
  @IsObject()
  @IsOptional()
  uiConfig?: Record<string, unknown>;
}

export class BusinessReportResponseDto {
  @ApiProperty()
  reportId!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  dataSourceHook!: string;

  @ApiPropertyOptional()
  uiConfig?: Record<string, unknown>;

  @ApiProperty()
  isSystem!: boolean;
}
