import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDebitNoteShipmentAllocationDto {
  @IsString()
  @IsNotEmpty()
  shipmentLineId!: string;

  @IsNumberString()
  @IsNotEmpty()
  quantityCredited!: string;
}

export class CreateDebitNoteLineDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderLineId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteShipmentAllocationDto)
  shipmentAllocations?: CreateDebitNoteShipmentAllocationDto[];

  @IsNumberString()
  @IsNotEmpty()
  quantityInvoiced: string;

  @IsNumberString()
  @IsNotEmpty()
  pricePerUnit: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsNumberString()
  @IsOptional()
  taxAmount?: string;
}

export class CreateDebitNoteDto {
  @IsString()
  @IsNotEmpty()
  returnId: string;

  @IsString()
  @IsOptional()
  supplierReferenceNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteLineDto)
  lines: CreateDebitNoteLineDto[];

  @IsNumberString()
  @IsOptional()
  taxAmount?: string;

  @IsNumberString()
  @IsOptional()
  feeAmount?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class EmptyBodyDto {}

export class PurchaseDebitNoteLineResponseDto {
  debitNoteLineId!: string;
  debitNoteId!: string;
  purchaseOrderLineId!: string;
  quantityInvoiced!: string;
  pricePerUnit!: string;
  amount!: string;
  taxAmount?: string | null;
  shipmentAllocations?: {
    shipmentLineId: string;
    quantityCredited: string;
  }[];
}

export class PurchaseDebitNoteResponseDto {
  debitNoteId!: string;
  debitNoteNumber!: string;
  returnId!: string;
  purchaseOrderId!: string;
  stateCode!: string;
  totalAmount!: string;
  taxAmount!: string;
  feeAmount!: string;
  createdOn?: Date | null;
  modifiedOn?: Date | null;
  lines?: PurchaseDebitNoteLineResponseDto[];
}
