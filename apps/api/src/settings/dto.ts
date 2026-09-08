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
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderedSettingDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsNumber()
  order!: number;
}

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

export class UpdateOrganizationSettingsDto {
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
  @ApiProperty() activityId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}
export class CostCenterResponseDto {
  @ApiProperty() costCenterId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}
export class ExchangeRateResponseDto {
  @ApiProperty() exchangeRateId!: string;
  @ApiProperty() currencyCode!: string;
  @ApiProperty() currencyName!: string;
  @ApiProperty() buyRate!: string;
  @ApiProperty() sellRate!: string;
  @ApiProperty() effectiveDate!: Date;
}
export class OrganizationSettingsResponseDto {
  @ApiProperty({ required: false }) tenantSettingsId?: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) addressLine1?: string;
  @ApiProperty({ required: false }) addressLine2?: string;
  @ApiProperty({ required: false }) city?: string;
  @ApiProperty({ required: false }) state?: string;
  @ApiProperty({ required: false }) country?: string;
  @ApiProperty({ required: false }) postCode?: string;
  @ApiProperty({ required: false }) email?: string;
  @ApiProperty({ required: false }) phone?: string;
  @ApiProperty({ required: false }) website?: string;
  @ApiProperty({ required: false }) companyNumber?: string;
  @ApiProperty({ required: false }) taxNumber?: string;
  @ApiProperty({ required: false }) logoUrl?: string;
  @ApiProperty({ required: false }) bankName?: string;
  @ApiProperty({ required: false }) bankAccountName?: string;
  @ApiProperty({ required: false }) bankAccountNumber?: string;
  @ApiProperty({ required: false }) bankSwiftBic?: string;
  @ApiProperty({ required: false }) bankIban?: string;
}
export class AppConfigResponseDto {
  @ApiProperty() defaultFulfillmentLocationId!: string;
  @ApiProperty() apiRateLimit!: string;
  @ApiProperty({ required: false }) creditLimitBehavior?:
    | 'hard'
    | 'soft'
    | 'notify';
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
  @ApiProperty({ required: false }) defaultCustomerTermsId?: string;
  @ApiProperty({ required: false }) defaultSupplierTermsId?: string;
  @ApiProperty({ required: false }) defaultCustomerTaxPositionId?: string;
  @ApiProperty({ required: false }) defaultSupplierTaxPositionId?: string;
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  organizationTags?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  organizationContactRoles?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  opportunityContactRoles?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  opportunityOrganizationRoles?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  opportunityStages?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  opportunityTypes?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  activityTypes?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  referralModes?: OrderedSettingDto[];
  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  salesAnalysisCodes?: OrderedSettingDto[];
}
export class UpdateAppConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultFulfillmentLocationId?: string;

  @ApiProperty({ required: false, enum: ['hard', 'soft', 'notify'] })
  @IsOptional()
  @IsEnum(['hard', 'soft', 'notify'])
  creditLimitBehavior?: 'hard' | 'soft' | 'notify';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultCustomerTermsId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultSupplierTermsId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultCustomerTaxPositionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultSupplierTaxPositionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultPurchaseTaxCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultSalesTaxCategoryId?: string;

  @ApiProperty({ required: false, type: 'string', format: 'email' })
  @IsOptional()
  @IsEmail()
  smtpFromAddress?: string;

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
  @IsNumberString()
  apiRateLimit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  taxProviderMappings?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  enrichmentProviderMappings?: Record<string, Record<string, string>>;

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  organizationTags?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  organizationContactRoles?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  opportunityContactRoles?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  opportunityOrganizationRoles?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  opportunityStages?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  opportunityTypes?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  activityTypes?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  referralModes?: OrderedSettingDto[];

  @ApiProperty({ required: false, type: [OrderedSettingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedSettingDto)
  salesAnalysisCodes?: OrderedSettingDto[];
}
export class TradingTermResponseDto {
  @ApiProperty() tradingTermsId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() description!: string;
  @ApiProperty() days!: number;
  @ApiProperty() type!: string;
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
}

export class EmptyBodyDto {}

export class SettingsSuccessResponseDto {
  @ApiProperty()
  success!: boolean;
}

export class ApplyLicenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  licenseKey!: string;
}
