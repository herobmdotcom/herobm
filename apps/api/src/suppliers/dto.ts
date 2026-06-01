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
} from 'class-validator';
export class CreateSupplierDto {
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
  @IsEmail()
  emailAddress1?: string;

  @IsOptional()
  @IsUUID()
  tradingTermsId?: string;

  @IsOptional()
  @IsNumberString()
  earlyPaymentDiscount?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
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
}

export class UpdateSupplierDto {
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
  @IsEmail()
  emailAddress1?: string;

  @IsOptional()
  @IsUUID()
  tradingTermsId?: string;

  @IsOptional()
  @IsNumberString()
  earlyPaymentDiscount?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
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
  stateCode?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;
}

export class CreateSupplierGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  defaultApAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  tradingTermsId?: string;

  @IsOptional()
  @IsNumberString()
  earlyPaymentDiscount?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
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
  @IsUUID()
  defaultCostCenterId?: string;

  @IsOptional()
  @IsUUID()
  defaultActivityId?: string;
}

export class UpdateSupplierGroupDto {
  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  defaultApAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  tradingTermsId?: string;

  @IsOptional()
  @IsNumberString()
  earlyPaymentDiscount?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
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
  @IsUUID()
  defaultCostCenterId?: string;

  @IsOptional()
  @IsUUID()
  defaultActivityId?: string;
}

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
  address1Country: string | null;
  telephone1: string | null;
  fax: string | null;
  emailAddress1: string | null;
  tradingTermsId: string | null;
  earlyPaymentDiscount: string | null;
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
  creditLimit: string | null;
  isPurchasingBlocked: boolean;
  purchasingBlockReason: string | null;
  isPaymentBlocked: boolean;
  paymentBlockReason: string | null;
  blockNotes: string | null;
  defaultCostCenterId: string | null;
  defaultActivityId: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmptyBodyDto {}
