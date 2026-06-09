import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsUUID,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MODES_OF_PAYMENT = [
  'Cash',
  'EFT',
  'Credit Card',
  'Cheque',
] as const;

export type ModeOfPayment = (typeof MODES_OF_PAYMENT)[number];

export class PaymentLineDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class CreatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId: string;

  @IsEnum(['receive', 'pay'])
  paymentType: 'receive' | 'pay';

  @IsEnum(['customer', 'supplier', 'gl_account'])
  partyType: 'customer' | 'supplier' | 'gl_account';

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsString()
  @IsNotEmpty()
  paymentDate: string;

  @IsEnum(MODES_OF_PAYMENT, {
    message: `modeOfPayment must be one of: ${MODES_OF_PAYMENT.join(', ')}`,
  })
  modeOfPayment: ModeOfPayment;

  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @IsUUID()
  glAccountBank: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  currencyCode: string;

  @IsOptional()
  submitImmediately?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentLineDto)
  lines?: PaymentLineDto[];
}

export class AllocationDto {
  @IsEnum(['sales_invoice', 'purchase_invoice'])
  referenceType: 'sales_invoice' | 'purchase_invoice';

  @IsUUID()
  referenceId: string;

  @IsNumber()
  @Min(0.01)
  allocatedAmount: number;
}

export class AllocatePaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations: AllocationDto[];
}

export class BatchPaymentActionDto {
  @IsArray()
  @IsString({ each: true })
  paymentIds: string[];
}

export class PaymentResponseDto {
  paymentId: string;
  paymentNumber: string;
  paymentType: string;
  partyType: string;
  partyId: string;
  paymentDate: Date | string;
  modeOfPayment: string;
  totalAmount: string | number;
  unallocatedAmount: string | number;
  stateCode: string;
  currencyCode: string;
  glAccountBank: string;
  referenceNumber: string | null;
  createdOn: Date | string;
  createdBy: string;
  partyName: string;
}
export class ExportAbaResponseDto {
  fileContent: string;
}
export class ConfirmRejectResponseDto {
  success: boolean;
}
export class EmptyBodyDto {}
