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
  billingAddressLine1?: string;

  @IsOptional()
  @IsString()
  billingAddressLine2?: string;

  @IsOptional()
  @IsString()
  billingAddressCity?: string;

  @IsOptional()
  @IsString()
  billingAddressStateOrProvince?: string;

  @IsOptional()
  @IsString()
  billingAddressPostalCode?: string;

  @IsString()
  @IsNotEmpty()
  billingAddressCountry!: string;

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
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  customerGroupId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  parentCustomerId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  taxPositionId?: string;

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

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
  @IsBoolean()
  isOnCreditHold?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  billingAddressLine1?: string;

  @IsOptional()
  @IsString()
  billingAddressLine2?: string;

  @IsOptional()
  @IsString()
  billingAddressCity?: string;

  @IsOptional()
  @IsString()
  billingAddressStateOrProvince?: string;

  @IsOptional()
  @IsString()
  billingAddressPostalCode?: string;

  @IsOptional()
  @IsString()
  billingAddressCountry?: string;

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
  taxPositionId?: string;

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

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
  @IsBoolean()
  isOnCreditHold?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string;
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

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsBoolean()
  isOnCreditHold?: boolean;
}

export class AccountResponseDto {
  customerId!: string;
  customerNumber!: string;
  name!: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingAddressCity?: string;
  billingAddressStateOrProvince?: string;
  billingAddressPostalCode?: string;
  billingAddressCountry!: string;
  telephone1?: string;
  fax?: string;
  emailAddress1?: string;
  customerGroupId?: string;
  parentCustomerId?: string;
  taxPositionId?: string;
  currencyCode!: string;
  customerDiscount?: string;
  notes?: string;
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  businessNumber?: string;
  isTaxRegistered?: boolean;
  creditLimit?: string;
  isOnCreditHold?: boolean;
  tradingTermsId?: string;
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
  events?: unknown[];
  contacts?: unknown[];
  deliveryAddresses?: unknown[];
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
  stateCode?: string;
  isOnCreditHold?: boolean;
  creditLimit?: string;
  tradingTermsId?: string;
  modifiedOn?: Date;
}

export class EmptyBodyDto {}
