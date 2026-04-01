import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsDateString,
  IsEmail,
  IsUrl,
} from 'class-validator';

export class CreateUomDto {
  @IsString()
  @IsNotEmpty()
  uomCode!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class UpdateUomDto {
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateExchangeRateDto {
  @IsString()
  @IsNotEmpty()
  currencyCode!: string;

  @IsString()
  @IsNotEmpty()
  currencyName!: string;

  @IsNumberString()
  buyRate!: string;

  @IsNumberString()
  sellRate!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

export class UpdateExchangeRateDto {
  @IsOptional()
  @IsString()
  currencyName?: string;

  @IsOptional()
  @IsNumberString()
  buyRate?: string;

  @IsOptional()
  @IsNumberString()
  sellRate?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postCode?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  companyNumber?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankSwiftBic?: string;

  @IsOptional()
  @IsString()
  bankIban?: string;
}
