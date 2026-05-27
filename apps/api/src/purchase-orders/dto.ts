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
