import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMappingProfileDto {
  @IsUUID()
  glAccountId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  dateColumn: string;

  @IsString()
  @IsNotEmpty()
  amountColumn: string;

  @IsString()
  @IsNotEmpty()
  descriptionColumn: string;

  @IsString()
  @IsOptional()
  referenceColumn?: string;

  @IsNumber()
  headerRows: number;
}

export class CreateReconciliationRuleDto {
  @IsUUID()
  @IsOptional()
  glAccountId?: string;

  @IsString()
  @IsNotEmpty()
  conditionType: string;

  @IsString()
  @IsNotEmpty()
  conditionValue: string;

  @IsUUID()
  @IsNotEmpty()
  targetGlAccountId: string;

  @IsNumber()
  @IsOptional()
  priority?: number;
}

export class ImportCsvDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The CSV file to import',
  })
  file: any;

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
  file: any;
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
