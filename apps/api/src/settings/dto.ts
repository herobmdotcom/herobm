import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsDateString,
  IsEmail,
  IsUrl,
  IsBoolean,
  IsNumber,
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

export class CreateCostCenterDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCostCenterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkImportResultDto {
  @IsNumber()
  count!: number;

  @IsNumber()
  updated!: number;
}
import { ApiProperty } from '@nestjs/swagger';
export class UomResponseDto {
  @ApiProperty() uomCode!: string;
  @ApiProperty() description!: string;
}
export class ActivityResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}
export class CostCenterResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}
export class ExchangeRateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() currencyCode!: string;
  @ApiProperty() currencyName!: string;
  @ApiProperty() buyRate!: string;
  @ApiProperty() sellRate!: string;
  @ApiProperty() effectiveDate!: Date;
}
export class OrganizationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
export class AppConfigResponseDto {
  @ApiProperty() defaultFulfillmentLocationId!: string;
  @ApiProperty() apiRateLimit!: string;
}
export class UpdateAppConfigDto {
  @ApiProperty({ required: false }) defaultFulfillmentLocationId?: string;
  @ApiProperty({ required: false }) apiRateLimit?: string;
}
export class TradingTermResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
export class EmptyBodyDto {}
