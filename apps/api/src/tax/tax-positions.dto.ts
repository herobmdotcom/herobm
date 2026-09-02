import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateTaxPositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;
}

export class UpdateTaxPositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class TaxPositionResponseDto {
  @ApiProperty()
  taxPositionId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  title!: string;
}

export class CreateTaxPositionMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sourceTaxCategoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  destinationTaxCategoryId!: string;
}

export class TaxPositionMappingResponseDto {
  @ApiProperty()
  taxPositionId!: string;

  @ApiProperty()
  sourceTaxCategoryId!: string;

  @ApiProperty()
  destinationTaxCategoryId!: string;
}
