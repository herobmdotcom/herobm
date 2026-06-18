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
  @ApiProperty({ required: false }) taxProviderMappings?: Record<
    string,
    string
  >;
  @ApiProperty({ required: false }) enrichmentProviderMappings?: Record<
    string,
    Record<string, string>
  >;
  @ApiProperty({ required: false }) smtpHost?: string;
  @ApiProperty({ required: false }) smtpPort?: number;
  @ApiProperty({ required: false }) smtpUser?: string;
  @ApiProperty({ required: false }) smtpPass?: string;
  @ApiProperty({ required: false }) smtpFromAddress?: string;
  @ApiProperty({ required: false }) defaultPurchaseTaxCategoryId?: string;
  @ApiProperty({ required: false }) defaultSalesTaxCategoryId?: string;
}
export class UpdateAppConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultFulfillmentLocationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultPurchaseTaxCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultSalesTaxCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  apiRateLimit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  taxProviderMappings?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  enrichmentProviderMappings?: Record<string, Record<string, string>>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpFromAddress?: string;
}
export class TradingTermResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() description!: string;
  @ApiProperty() days!: number;
  @ApiProperty() type!: string;
  @ApiProperty() isDefaultCustomer!: boolean;
  @ApiProperty() isDefaultSupplier!: boolean;
}

export class CreateTradingTermDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  days!: number;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsBoolean()
  isDefaultCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultSupplier?: boolean;
}

export class UpdateTradingTermDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  days?: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultSupplier?: boolean;
}

export class EmptyBodyDto {}

export class SettingsSuccessResponseDto {
  @ApiProperty()
  success!: boolean;
}
