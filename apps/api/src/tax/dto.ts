import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumberString,
  IsBoolean,
} from 'class-validator';

export class CreateTaxCategoryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(['not_relevant', 'exempt', 'zero_rated', 'tax_applies'])
  type!: 'not_relevant' | 'exempt' | 'zero_rated' | 'tax_applies';

  @IsOptional()
  @IsNumberString()
  rate?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateTaxCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(['not_relevant', 'exempt', 'zero_rated', 'tax_applies'])
  type?: 'not_relevant' | 'exempt' | 'zero_rated' | 'tax_applies';

  @IsOptional()
  @IsNumberString()
  rate?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
