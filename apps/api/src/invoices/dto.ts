import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesInvoiceLineDto {
  @IsUUID()
  salesOrderLineId!: string;

  @IsNumber()
  quantityToInvoice!: number;
}

export class CreateSalesInvoiceDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceLineDto)
  lines?: CreateSalesInvoiceLineDto[];
}

export class CreateStandaloneInvoiceLineDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsNumber()
  quantityInvoiced!: number;

  @IsNumber()
  pricePerUnit!: number;

  @IsOptional()
  @IsUUID()
  purchaseOrderLineId?: string;
}

export class CreateStandaloneInvoiceDto {
  @IsUUID()
  vendorId!: string;

  @IsString()
  @IsNotEmpty()
  supplierInvoiceNumber!: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsString()
  currencyCode!: string;

  @IsNumber()
  totalAmount!: number;

  @IsNumber()
  taxAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptFilename?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStandaloneInvoiceLineDto)
  lines?: CreateStandaloneInvoiceLineDto[];
}

export class ChangeInvoiceStateDto {
  @IsString()
  stateCode!: string;

  @IsOptional()
  discrepanciesAcknowledged?: boolean;
}

export class ResolveInvoiceLineDto {
  @IsUUID()
  purchaseOrderLineId!: string;
}

export class AutoMatchPurchaseOrderDto {
  @IsUUID()
  purchaseOrderId!: string;
}

export class UpdateInvoiceLineDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsOptional()
  @IsNumber()
  quantityInvoiced?: number;

  @IsOptional()
  @IsNumber()
  pricePerUnit?: number;
}
