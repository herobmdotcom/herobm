import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumberString,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional, PartialType, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class BaseSupplierDto {
  @IsString()
  @IsNotEmpty()
  vendorNumber!: string;
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
  @Transform(({ value }) => (value === '' ? null : value))
  @IsEmail()
  emailAddress1?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  earlyPaymentDiscount?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsNumber()
  earlyPaymentDiscountDays?: number;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  creditLimit?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsBoolean()
  isPurchasingBlocked?: boolean;
  @IsOptional()
  @IsIn([
    'compliance_breach',
    'quality_issues',
    'dispute',
    'financial_risk',
    'other',
  ])
  purchasingBlockReason?:
    | 'compliance_breach'
    | 'quality_issues'
    | 'dispute'
    | 'financial_risk'
    | 'other';
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsBoolean()
  isPaymentBlocked?: boolean;
  @IsOptional()
  @IsIn(['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'])
  paymentBlockReason?:
    | 'invoice_dispute'
    | 'missing_goods'
    | 'contractual_breach'
    | 'other';
  @IsOptional()
  @IsString()
  blockNotes?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  supplierGroupId?: string;
  @IsOptional()
  @IsString()
  currencyCode?: string;
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
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  taxPositionId?: string;
}

export class CreateSupplierDto extends BaseSupplierDto {}

export class UpdateSupplierDto extends PartialType(BaseSupplierDto) {}

export class BaseSupplierGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;
  @IsString()
  @IsNotEmpty()
  name!: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultApAccountId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultExpenseAccountId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  earlyPaymentDiscount?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsNumber()
  earlyPaymentDiscountDays?: number;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  creditLimit?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsBoolean()
  isPurchasingBlocked?: boolean;
  @IsOptional()
  @IsIn([
    'compliance_breach',
    'quality_issues',
    'dispute',
    'financial_risk',
    'other',
  ])
  purchasingBlockReason?:
    | 'compliance_breach'
    | 'quality_issues'
    | 'dispute'
    | 'financial_risk'
    | 'other';
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsBoolean()
  isPaymentBlocked?: boolean;
  @IsOptional()
  @IsIn(['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'])
  paymentBlockReason?:
    | 'invoice_dispute'
    | 'missing_goods'
    | 'contractual_breach'
    | 'other';
  @IsOptional()
  @IsString()
  blockNotes?: string;
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
  taxPositionId?: string;
}

export class CreateSupplierGroupDto extends BaseSupplierGroupDto {}

export class UpdateSupplierGroupDto extends PartialType(BaseSupplierGroupDto) {}

export class CreateSupplierExpiryDto {
  @IsIn(['insurance', 'tax_certificate', 'trial_period', 'other'])
  @IsNotEmpty()
  expiryType!: 'insurance' | 'tax_certificate' | 'trial_period' | 'other';

  @IsDateString()
  @IsNotEmpty()
  expiryDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierExpiryDto {
  @IsOptional()
  @IsIn(['insurance', 'tax_certificate', 'trial_period', 'other'])
  expiryType?: 'insurance' | 'tax_certificate' | 'trial_period' | 'other';

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SupplierResponseDto {
  id: string;
  vendorNumber: string;
  name: string;
  address1Line1: string | null;
  address1Line2: string | null;
  address1City: string | null;
  address1StateOrProvince: string | null;
  address1PostalCode: string | null;
  address1Country: string;
  telephone1: string | null;
  fax: string | null;
  emailAddress1: string | null;
  tradingTermsId: string | null;
  earlyPaymentDiscount: string | null;
  earlyPaymentDiscountDays: number | null;
  creditLimit: string | null;
  isPurchasingBlocked: boolean;
  purchasingBlockReason: string | null;
  isPaymentBlocked: boolean;
  paymentBlockReason: string | null;
  blockNotes: string | null;
  supplierGroupId: string | null;
  currencyCode: string | null;
  notes: string | null;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  businessNumber: string | null;
  isTaxRegistered: boolean;
  taxPositionId: string | null;
  stateCode: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SupplierGroupResponseDto {
  id: string;
  groupCode: string;
  name: string;
  defaultApAccountId: string | null;
  defaultExpenseAccountId: string | null;
  tradingTermsId: string | null;
  earlyPaymentDiscount: string | null;
  earlyPaymentDiscountDays: number | null;
  creditLimit: string | null;
  isPurchasingBlocked: boolean;
  purchasingBlockReason: string | null;
  isPaymentBlocked: boolean;
  paymentBlockReason: string | null;
  blockNotes: string | null;
  defaultCostCenterId: string | null;
  defaultActivityId: string | null;
  taxPositionId: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmptyBodyDto {}

export class SupplierAgedBalanceResponseDto {
  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  supplierName: string;

  @ApiProperty()
  supplierNumber: string;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty()
  isPaymentBlocked: boolean;

  @ApiPropertyOptional()
  creditLimit: string | null;

  @ApiProperty()
  glBalance: number;

  @ApiProperty()
  totalOutstanding: number;

  @ApiProperty()
  discrepancyAmount: number;

  @ApiProperty()
  current: number;

  @ApiProperty()
  days1To30: number;

  @ApiProperty()
  days31To60: number;

  @ApiProperty()
  days61To90: number;

  @ApiProperty()
  days90Plus: number;
}
