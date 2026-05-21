import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Order Line DTOs ──

export class CreateOrderLineDto {
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
  taxCategoryId?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  fulfillmentLocationId?: string;
}

export class UpdateOrderLineDto {
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
  taxCategoryId?: string;

  @IsOptional()
  @IsString()
  productDescription?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  fulfillmentLocationId?: string;
}

// ── Order Header DTOs ──

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsString()
  customerOrderNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString() // We can use @IsUUID() but string is safer for compatibility/stubs
  fulfillmentLocationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines!: CreateOrderLineDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  customerOrderNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  fulfillmentLocationId?: string;
}

// ── Return DTOs ──

export class CreateReturnLineDto {
  @IsString()
  @IsNotEmpty()
  salesOrderLineId!: string;

  @IsNumberString()
  quantityReturned!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumberString()
  returnFee?: string;
}

export class CreateReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnLineDto)
  lines!: CreateReturnLineDto[];
}

export class UpdateReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddReturnLineDto {
  @IsString()
  @IsNotEmpty()
  salesOrderLineId!: string;

  @IsNumberString()
  quantityReturned!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumberString()
  returnFee?: string;
}

export class UpdateReturnLineDto {
  @IsOptional()
  @IsNumberString()
  quantityReturned?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumberString()
  returnFee?: string;
}

export class ReceiveReturnLineDto {
  @IsString()
  @IsNotEmpty()
  returnLineId!: string;

  @IsNumberString()
  quantityReceived!: string;
}

export class ReceiveReturnDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnLineDto)
  lines!: ReceiveReturnLineDto[];
}

// ── Shipment DTOs ──

export class CreateShipmentLineDto {
  @IsString()
  @IsNotEmpty()
  salesOrderLineId!: string;

  @IsNumberString()
  quantityShipped!: string;
}

export class CreateShipmentDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentLineDto)
  lines!: CreateShipmentLineDto[];
}

export class UpdateShipmentDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export class AddShipmentLineDto {
  @IsString()
  @IsNotEmpty()
  salesOrderLineId!: string;

  @IsNumberString()
  quantityShipped!: string;
}

export class UpdateShipmentLineDto {
  @IsOptional()
  @IsNumberString()
  quantityShipped?: string;
}
