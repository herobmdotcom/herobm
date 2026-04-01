import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumberString,
  IsBoolean,
} from 'class-validator';

export class CreateGstCategoryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(['not_relevant', 'exempt', 'zero_rated', 'gst_applies'])
  type!: 'not_relevant' | 'exempt' | 'zero_rated' | 'gst_applies';

  @IsOptional()
  @IsNumberString()
  rate?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateGstCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(['not_relevant', 'exempt', 'zero_rated', 'gst_applies'])
  type?: 'not_relevant' | 'exempt' | 'zero_rated' | 'gst_applies';

  @IsOptional()
  @IsNumberString()
  rate?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
