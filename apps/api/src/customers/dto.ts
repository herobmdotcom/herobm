import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumberString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  customerNumber!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  address1Line1?: string;

  @IsOptional()
  @IsString()
  address1Line2?: string;

  @IsOptional()
  @IsString()
  address1City?: string;

  @IsOptional()
  @IsString()
  address1StateOrProvince?: string;

  @IsOptional()
  @IsString()
  address1PostalCode?: string;

  @IsString()
  @IsNotEmpty()
  address1Country!: string;

  @IsOptional()
  @IsString()
  telephone1?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  emailAddress1?: string;

  @IsOptional()
  @IsString()
  primaryContactName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  primaryContactEmail?: string;

  @IsOptional()
  @IsString()
  primaryContactPhone?: string;

  @IsOptional()
  @IsUUID()
  customerGroupId?: string;

  @IsOptional()
  @IsUUID()
  parentCustomerId?: string;

  @IsOptional()
  @IsUUID()
  taxCategoryId?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsNumberString()
  customerDiscount?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankBsb?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address1Line1?: string;

  @IsOptional()
  @IsString()
  address1Line2?: string;

  @IsOptional()
  @IsString()
  address1City?: string;

  @IsOptional()
  @IsString()
  address1StateOrProvince?: string;

  @IsOptional()
  @IsString()
  address1PostalCode?: string;

  @IsOptional()
  @IsString()
  address1Country?: string;

  @IsOptional()
  @IsString()
  telephone1?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  emailAddress1?: string;

  @IsOptional()
  @IsString()
  primaryContactName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  primaryContactEmail?: string;

  @IsOptional()
  @IsString()
  primaryContactPhone?: string;

  @IsOptional()
  @IsUUID()
  customerGroupId?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsUUID()
  parentCustomerId?: string;

  @IsOptional()
  @IsUUID()
  taxCategoryId?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsNumberString()
  customerDiscount?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankBsb?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;
}

export class CreateAccountGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsNumberString()
  defaultDiscountPercentage?: string;

  @IsOptional()
  @IsUUID()
  defaultArAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultRevenueAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

  @IsOptional()
  @IsUUID()
  defaultActivityId?: string;
}

export class UpdateAccountGroupDto {
  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumberString()
  defaultDiscountPercentage?: string;

  @IsOptional()
  @IsUUID()
  defaultArAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultRevenueAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

  @IsOptional()
  @IsUUID()
  defaultActivityId?: string;
}

export class AccountResponseDto {
  customerId!: string;
  customerNumber!: string;
  name!: string;
  address1Line1?: string;
  address1Line2?: string;
  address1City?: string;
  address1StateOrProvince?: string;
  address1PostalCode?: string;
  address1Country!: string;
  telephone1?: string;
  fax?: string;
  emailAddress1?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  customerGroupId?: string;
  parentCustomerId?: string;
  taxCategoryId?: string;
  currencyCode!: string;
  customerDiscount?: string;
  notes?: string;
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  businessNumber?: string;
  isTaxRegistered?: boolean;
  stateCode!: string;
  sourceId?: string;
  source!: string;
  createdBy?: string;
  createdOn?: Date;
  modifiedOn?: Date;

  customerGroupName?: string;
  customerGroupCode?: string;
  customerGroupTradingTermsId?: string;
  customerGroupCreditLimit?: string;
  customerGroupIsOnCreditHold?: boolean;
  gstCategoryName?: string;
  events?: any[];
}

export class AccountGroupResponseDto {
  customerGroupId!: string;
  groupCode!: string;
  name!: string;
  defaultDiscountPercentage?: string;
  defaultArAccountId?: string;
  defaultRevenueAccountId?: string;
  defaultCostCenterId?: string;
  defaultActivityId?: string;
  isOnCreditHold?: boolean;
  creditLimit?: string;
  tradingTermsId?: string;
  modifiedOn?: Date;
}

export class EmptyBodyDto {}
