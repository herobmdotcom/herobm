import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsArray,
  IsObject,
} from 'class-validator';

export class EmptyBodyDto {}

export class HookDto {
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) contexts!: string[];
}

export class ReportDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() template!: string;
  @ApiPropertyOptional() outputNamePattern?: string;
  @ApiPropertyOptional({ type: [String] }) contexts?: string[];
  @ApiProperty() isSystem!: boolean;
}

export class ReportResponseDto {
  @ApiProperty({ type: ReportDto }) data!: ReportDto;
}

export class HookAssignmentDto {
  @ApiProperty() hookSlug!: string;
  @ApiProperty() reportId!: string;
  @ApiProperty() contextSlug!: string;
}

export class RandomIdData {
  @ApiProperty() id!: string;
}

export class RandomIdResponseDto {
  @ApiProperty({ type: RandomIdData }) data!: RandomIdData;
}

export class CreateReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  template!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outputNamePattern?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contexts?: string[];
}

export class UpdateReportDto extends PartialType(CreateReportDto) {}

export class PreviewReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  template!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  mockData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hookSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}

export class UpdateHookAssignmentDto {
  @IsString()
  @IsOptional()
  reportId?: string;

  @IsString()
  @IsOptional()
  contextSlug?: string;
}

export class RunHookOptionsDto {
  @ApiPropertyOptional({
    description: 'Optional shipment ID for shipment/picking hooks',
  })
  @IsString()
  @IsOptional()
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customPdfText?: string;

  @ApiPropertyOptional({
    description: 'Deprecated legacy alias for customPdfText',
  })
  @IsString()
  @IsOptional()
  quoteIntroText?: string;
}

export class RunHookBodyDto extends RunHookOptionsDto {}
