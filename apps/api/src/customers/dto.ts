import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumberString,
  IsBoolean,
  IsDateString,
  IsDate,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class BaseAccountDto {
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
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
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
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  creditLimit?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsBoolean()
  isOnCreditHold?: boolean;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  overrideCreditHoldUntil?: Date;
}

export class CreateAccountDto extends BaseAccountDto {}

export class UpdateAccountDto extends PartialType(BaseAccountDto) {}

export class BaseAccountGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;
  @IsString()
  @IsNotEmpty()
  name!: string;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  defaultDiscountPercentage?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultArAccountId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultRevenueAccountId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultCostCenterId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultActivityId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  taxPositionId?: string;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  creditLimit?: string;
}

export class CreateAccountGroupDto extends BaseAccountGroupDto {}

export class UpdateAccountGroupDto extends PartialType(BaseAccountGroupDto) {}

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
  overrideCreditHoldUntil?: Date;
  tradingTermsId?: string;
  stateCode!: string;
  sourceId?: string;
  source!: string;
  createdBy?: string;
  createdOn?: Date;
  modifiedOn?: Date;

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
  taxPositionId?: string;
  modifiedOn?: Date;
}

export class EmptyBodyDto {}

export class AgedBalanceResponseDto {
  customerId!: string;
  customerName!: string;
  accountNumber!: string;
  current!: number;
  days1To30!: number;
  days31To60!: number;
  days61To90!: number;
  days90Plus!: number;
  totalOutstanding!: number;
  glBalance!: number;
  discrepancyAmount!: number;
  currencyCode!: string;
  isOnCreditHold!: boolean;
  creditLimit!: string | null;
}

export class CreditAssessmentResponseDto {
  totalArBalance!: number;
  overdueBalance!: number;
  isOverdue!: boolean;
}
