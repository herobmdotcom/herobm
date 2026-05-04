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

  @IsString()
  @IsNotEmpty()
  modeOfPayment: string;

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
