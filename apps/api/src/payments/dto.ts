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

export class CreatePaymentDto {
  @IsEnum(['receive', 'pay'])
  paymentType: 'receive' | 'pay';

  @IsEnum(['customer', 'supplier'])
  partyType: 'customer' | 'supplier';

  @IsUUID()
  partyId: string;

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
