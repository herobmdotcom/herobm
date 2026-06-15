import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateTaxPositionDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateTaxPositionDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class TaxPositionResponseDto {
  @ApiProperty()
  taxPositionId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  isDefault!: boolean;
}

export class CreateTaxPositionMappingDto {
  @IsString()
  @IsNotEmpty()
  sourceTaxCategoryId!: string;

  @IsString()
  @IsNotEmpty()
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
