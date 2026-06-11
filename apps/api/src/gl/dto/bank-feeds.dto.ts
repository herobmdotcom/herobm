import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateMappingProfileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dateColumn: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  amountColumn?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  debitColumn?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  creditColumn?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  descriptionColumn: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  typeColumn?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  payeeColumn?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  referenceColumn?: string;

  @ApiProperty()
  @IsNumber()
  headerRows: number;
}

export class UpdateMappingProfileDto extends PartialType(
  CreateMappingProfileDto,
) {}

export class CreateReconciliationRuleDto {
  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  glAccountIds?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  conditionType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  conditionValue?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  typeCondition?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  payeeConditionType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  payeeConditionValue?: string;

  @IsOptional()
  amountMin?: number;

  @IsOptional()
  amountMax?: number;

  @IsUUID()
  @IsNotEmpty()
  targetGlAccountId: string;

  @IsUUID()
  @IsOptional()
  costCenterId?: string;

  @IsUUID()
  @IsOptional()
  activityId?: string;

  @IsString()
  @IsOptional()
  partyType?: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;
}

export class UpdateReconciliationRuleDto extends PartialType(
  CreateReconciliationRuleDto,
) {}
export class ImportCsvDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The CSV file to import',
  })
  file: unknown;

  @ApiProperty()
  @IsUUID()
  glAccountId: string;

  @ApiProperty()
  @IsUUID()
  profileId: string;
}

export class FileUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The CSV file to upload',
  })
  file: unknown;
}

export class MappingProfileResponseDto extends CreateMappingProfileDto {
  @ApiProperty()
  profileId: string;
}

export class ReconciliationRuleResponseDto extends CreateReconciliationRuleDto {
  @ApiProperty()
  ruleId: string;
}

export class ParseCsvResponseDto {
  @ApiProperty({ type: [String] })
  headers: string[];

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'string' } },
  })
  sampleRows: string[][];
}

export class ImportCsvResponseDto {
  @ApiProperty()
  autoMatchedCount: number;
  @ApiProperty()
  smartMatchedCount: number;
  @ApiProperty()
  unmatchedCount: number;
}
