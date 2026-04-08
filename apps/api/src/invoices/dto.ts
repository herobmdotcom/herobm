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

export class CreatePurchaseBillLineDto {
  @IsUUID()
  purchaseOrderLineId!: string;

  @IsNumber()
  quantityToInvoice!: number;
}

export class CreatePurchaseBillDto {
  @IsNotEmpty()
  @IsString()
  supplierInvoiceNumber!: string;

  @IsOptional()
  @IsString()
  receiptFilename?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseBillLineDto)
  lines?: CreatePurchaseBillLineDto[];
}
