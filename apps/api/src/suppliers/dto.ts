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
