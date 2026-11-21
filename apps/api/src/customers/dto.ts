import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CUSTOMER_STATE, type CustomerState } from '@herobm/shared';
import { PaginatedResponse } from '../common/pagination';

export class BaseCustomerDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  organizationId?: string;
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
  taxPositionId?: string;
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
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  earlyPaymentDiscount?: string;
  @IsOptional()
  @Type(() => Number)
  earlyPaymentDiscountDays?: number;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  parentCustomerId?: string | null;
  @IsOptional()
  @IsString()
  stateCode?: string;

  @ApiPropertyOptional({ type: Object, description: 'Custom metadata object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateCustomerDto extends BaseCustomerDto {}

export class UpdateCustomerDto extends PartialType(BaseCustomerDto) {}

export class BaseCustomerGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;
  @IsString()
  @IsNotEmpty()
  name!: string;
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
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  earlyPaymentDiscount?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  earlyPaymentDiscountDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  stateCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? false : Boolean(value),
  )
  @IsBoolean()
  isOnCreditHold?: boolean;
}

export class CreateCustomerGroupDto extends BaseCustomerGroupDto {}

export class UpdateCustomerGroupDto extends PartialType(BaseCustomerGroupDto) {}

export class CustomerResponseDto {
  customerId!: string;
  organizationId!: string;
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
  isSalesBlocked?: boolean;
  salesBlockReasons?: string[];
  overrideCreditHoldUntil?: Date;
  tradingTermsId?: string;
  earlyPaymentDiscount?: string;
  earlyPaymentDiscountDays?: number;
  stateCode!: string;
  sourceId?: string;
  source!: string;
  createdBy?: string;
  createdOn?: Date;
  modifiedOn?: Date;
  metadata?: Record<string, unknown> | null;
  parentCustomerId?: string | null;
  parentCustomerName?: string | null;
  childCustomers?: CustomerResponseDto[];

  events?: unknown[];
  contacts?: unknown[];
  deliveryAddresses?: unknown[];
  creditAssessment?: {
    totalInvoiceBalance: number;
    overdueInvoiceBalance: number;
    glBalance: number;
    isOverdue: boolean;
    oldestOverdueInvoice?: string;
    oldestOverdueInvoiceId?: string;
  };
  effectiveCreditLimit?: string;
  effectiveTradingTermsId?: string | null;
  customerGroupTradingTermsId?: string | null;
  customerGroupCreditLimit?: string | null;
  customerGroupIsOnCreditHold?: boolean;
  effectiveEarlyPaymentDiscount?: string | null;
  effectiveEarlyPaymentDiscountDays?: number | null;
  totalOutstanding?: number;
  uninvoicedOrdersTotal?: number;
}

export class CustomerGroupResponseDto {
  customerGroupId!: string;
  groupCode!: string;
  name!: string;
  defaultArAccountId?: string;
  defaultRevenueAccountId?: string;
  defaultCostCenterId?: string;
  defaultActivityId?: string;
  stateCode?: string;
  @ApiProperty({ required: false })
  isOnCreditHold?: boolean;
  creditLimit?: string;
  tradingTermsId?: string;
  taxPositionId?: string;

  @ApiProperty({ required: false })
  earlyPaymentDiscount?: string;

  @ApiProperty({ required: false })
  earlyPaymentDiscountDays?: number;

  modifiedOn?: Date;
}

export class EmptyBodyDto {}

export class AgedBalanceResponseDto {
  customerId!: string;
  customerName!: string;
  customerNumber!: string;
  current!: number;
  days1To30!: number;
  days31To60!: number;
  days61To90!: number;
  days90Plus!: number;
  totalOutstanding!: number;
  glBalance!: number;
  discrepancyAmount!: number;
  uninvoicedOrdersTotal?: number;
  currencyCode!: string;
  isOnCreditHold!: boolean;
  creditLimit!: string | null;
  stateCode!: string;
}

export class AgedBalancesTotalsDto {
  @ApiProperty()
  current!: number;

  @ApiProperty()
  days1To30!: number;

  @ApiProperty()
  days31To60!: number;

  @ApiProperty()
  days61To90!: number;

  @ApiProperty()
  days90Plus!: number;

  @ApiProperty()
  totalOutstanding!: number;
}

export class AgedBalancesPaginatedResponseDto extends PaginatedResponse<AgedBalanceResponseDto> {
  @ApiProperty({ type: [AgedBalanceResponseDto] })
  declare data: AgedBalanceResponseDto[];

  @ApiProperty({ type: AgedBalancesTotalsDto, required: false })
  totals?: AgedBalancesTotalsDto;
}

export class CreditAssessmentResponseDto {
  totalInvoiceBalance!: number;
  overdueInvoiceBalance!: number;
  totalCreditNoteBalance?: number;
  unallocatedPaymentBalance?: number;
  netOutstandingBalance?: number;
  glBalance!: number;
  isOverdue!: boolean;
  oldestOverdueInvoice?: string;
  oldestOverdueInvoiceId?: string;
}

export class DeleteCustomerGroupResponseDto {
  @ApiProperty()
  deleted!: boolean;
}

export class BulkUpdateCustomersDto {
  @ApiProperty({
    description: 'Array of customer IDs to update',
    type: [String],
    example: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiPropertyOptional({
    description: 'New customer group ID, or null to clear',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  customerGroupId?: string | null;

  @ApiPropertyOptional({
    description: 'New tax position ID, or null to clear',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  taxPositionId?: string | null;

  @ApiPropertyOptional({
    description: 'Currency code',
    type: String,
  })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'New trading terms ID, or null to inherit from customer group',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  tradingTermsId?: string | null;

  @ApiPropertyOptional({
    description: 'Price tier level (e.g. "tier_1", "tier_2", or "1", "2")',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  priceTier?: string | null;

  @ApiPropertyOptional({
    description: 'Credit hold status override',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsBoolean()
  isOnCreditHold?: boolean;

  @ApiPropertyOptional({
    description: 'Credit limit string, or null to inherit from customer group',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  creditLimit?: string | null;

  @ApiPropertyOptional({
    description: 'Target customer lifecycle state',
    enum: CUSTOMER_STATE,
  })
  @IsOptional()
  @IsString()
  stateCode?: CustomerState;
}

export { EmailDocumentDto } from '../orders/dto';
