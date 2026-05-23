import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumberString,
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
