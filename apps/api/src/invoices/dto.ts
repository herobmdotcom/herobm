import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceLineResponseDto {
  @ApiProperty() lineId!: string;
  @ApiProperty() invoiceId!: string;
  @ApiProperty() description!: string;
  @ApiProperty() quantityInvoiced!: string;
  @ApiProperty() pricePerUnit!: string;
  @ApiProperty() amount!: string;
  @ApiPropertyOptional() productId?: string;
  @ApiPropertyOptional() productNumber?: string;
  @ApiPropertyOptional() glAccountId?: string;
  @ApiProperty() matchStatus!: string;
  @ApiPropertyOptional() purchaseOrderId?: string;
  @ApiPropertyOptional() purchaseOrderNumber?: string;
  @ApiPropertyOptional() purchaseOrderLineId?: string;
}

export class PurchaseInvoiceResponseDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty() vendorId!: string;
  @ApiProperty() vendorName!: string;
  @ApiPropertyOptional() supplierInvoiceNumber?: string;
  @ApiProperty() totalAmount!: string;
  @ApiProperty() outstandingAmount!: string;
  @ApiProperty() taxAmount!: string;
  @ApiProperty() currencyCode!: string;
  @ApiProperty() stateCode!: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() purchaseOrderId?: string;
  @ApiPropertyOptional() earlyPaymentDiscount?: string;
  @ApiPropertyOptional() earlyPaymentDiscountDays?: number;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdOn!: Date;
  @ApiPropertyOptional() invoiceDate?: Date;
  @ApiPropertyOptional() dueDate?: Date;

  @ApiProperty({ type: () => [InvoiceLineResponseDto] })
  lines!: InvoiceLineResponseDto[];

  @ApiPropertyOptional({ type: () => [Object] })
  allocations?: Record<string, unknown>[];
}

export class PurchaseInvoiceListResponseDto {
  @ApiProperty({ type: () => [PurchaseInvoiceResponseDto] })
  data!: PurchaseInvoiceResponseDto[];
}

export class SalesInvoiceResponseDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() customerName!: string;
  @ApiPropertyOptional() customerOrderNumber?: string;
  @ApiProperty() totalAmount!: string;
  @ApiProperty() outstandingAmount!: string;
  @ApiProperty() taxAmount!: string;
  @ApiProperty() currencyCode!: string;
  @ApiProperty() stateCode!: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() salesOrderId?: string;
  @ApiPropertyOptional() earlyPaymentDiscount?: string;
  @ApiPropertyOptional() earlyPaymentDiscountDays?: number;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdOn!: Date;
  @ApiPropertyOptional() invoiceDate?: Date;
  @ApiPropertyOptional() dueDate?: Date;

  @ApiProperty({ type: () => [InvoiceLineResponseDto] })
  lines!: InvoiceLineResponseDto[];

  @ApiPropertyOptional({ type: () => [Object] })
  allocations?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: () => [Object] })
  events?: Record<string, unknown>[];

  @ApiPropertyOptional()
  termsDescription?: string;
}

export class SalesInvoiceListResponseDto {
  @ApiProperty({ type: () => [SalesInvoiceResponseDto] })
  data!: SalesInvoiceResponseDto[];
}

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

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

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

export class UpdatePurchaseInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptFilename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string;
}
