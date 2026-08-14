import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ── PO Line DTOs ──

export class CreatePurchaseOrderLineDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  productDescription?: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsOptional()
  @IsNumberString()
  discountPercentage?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  taxCategoryId?: string;
}

export class UpdatePurchaseOrderLineDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsNumberString()
  pricePerUnit?: string;

  @IsOptional()
  @IsNumberString()
  discountPercentage?: string;

  @IsOptional()
  @IsString()
  productDescription?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  taxCategoryId?: string;
}

// ── PO Header DTOs ──

export class CreatePurchaseOrderDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @IsString()
  @IsNotEmpty()
  deliveryLocationId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  expectedDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines?: CreatePurchaseOrderLineDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  deliveryLocationId?: string;

  @IsOptional()
  @IsString()
  expectedDate?: string;
}

// ── PO Return DTOs ──
export class CreatePurchaseReturnLineDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderLineId!: string;

  @IsNumberString()
  quantityReturned!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumberString()
  returnFee?: string;

  @IsOptional()
  @IsUUID()
  sourceBinId?: string;
}

export class CreatePurchaseReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnLineDto)
  lines!: CreatePurchaseReturnLineDto[];
}

export class ShipPurchaseReturnDto {
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PurchaseOrderResponseDto {
  purchaseOrderId!: string;
  orderNumber!: string;
  name?: string | null;
  vendorId?: string | null;
  deliveryLocationId!: string;
  referenceNumber?: string | null;
  stateCode!: string;
  currencyCode!: string;
  notes?: string | null;
  customFields?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdOn?: Date | null;
  modifiedOn?: Date | null;
  expectedDate?: Date | null;

  vendorName?: string;
  @ApiProperty({
    type: () => PurchaseOrderLineResponseDto,
    isArray: true,
    required: false,
  })
  lines?: PurchaseOrderLineResponseDto[];
}

export class PurchaseOrderLineResponseDto {
  purchaseOrderLineId!: string;
  purchaseOrderId!: string;
  lineNumber!: number;
  productId?: string | null;
  productDescription?: string | null;
  quantity!: string;
  pricePerUnit!: string;
  discountPercentage?: string | null;
  amount?: string | null;
  taxCategoryId!: string;
  tax?: string | null;
  totalAmount?: string | null;
  unitOfMeasure?: string | null;
  quantityReceived?: string | null;
}

export class EmptyBodyDto {}
export class ChangeStateDto {
  @IsString()
  stateCode: string;
}

export class PurchaseReturnLineResponseDto {
  returnLineId!: string;
  returnId!: string;
  purchaseOrderLineId!: string;
  quantityReturned!: string;
  reason?: string | null;
  returnFee?: string | null;
}

export class PurchaseReturnResponseDto {
  returnId!: string;
  returnNumber!: string;
  purchaseOrderId!: string;
  stateCode!: string;
  notes?: string | null;
  createdBy?: string | null;
  createdOn?: Date | null;
  modifiedOn?: Date | null;
  lines?: PurchaseReturnLineResponseDto[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO expansion without typing
  shipments?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO expansion without typing
  shipmentLines?: any[];
}
