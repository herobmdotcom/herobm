import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
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

export class CreatePurchaseBillDto {
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
