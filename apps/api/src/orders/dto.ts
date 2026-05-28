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
  @IsUUID()
  @IsNotEmpty()
  salesOrderId!: string;

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

export class OrderResponseDto {
  salesOrderId!: string;
  orderNumber!: string;
  name?: string | null;
  customerId!: string;
  customerOrderNumber?: string | null;
  fulfillmentLocationId!: string;
  stateCode!: string;
  currencyCode!: string;
  notes?: string | null;
  customFields?: Record<string, any> | null;
  discrepanciesAcknowledged!: boolean;
  sourceId?: string | null;
  source!: string;
  createdBy?: string | null;
  createdOn?: Date | null;
  modifiedOn?: Date | null;
}

export class EmptyBodyDto {}

export class ChangeOrderStateDto {
  @IsString()
  @IsNotEmpty()
  stateCode!: string;

  @IsOptional()
  generateBackorders?: boolean;

  @IsOptional()
  discrepanciesAcknowledged?: boolean;
}

export class ReallocateDemandDto {
  @IsUUID()
  locationId!: string;
}

export class LinkDemandToPoDto {
  @IsUUID()
  demandId!: string;

  @IsUUID()
  purchaseOrderLineId!: string;

  @IsNumberString()
  quantity!: string;
}

export class GeneratePoLineDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  backorderIds?: string[];
}

export class GeneratePoDto {
  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsUUID()
  deliveryLocationId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  soNumbers?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratePoLineDto)
  lines!: GeneratePoLineDto[];
}

export class GeneratePOsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratePoDto)
  pos!: GeneratePoDto[];
}

export class GenerateTransfersDto {
  @IsOptional()
  @IsArray()
  transfers?: any[];
}

export class PickOrderLineDto {
  @IsUUID()
  binId!: string;

  @IsNumberString()
  quantity!: string;
}

export class ChangeReturnStateDto {
  @IsString()
  stateCode!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class ChangeShipmentStateDto {
  @IsString()
  stateCode!: string;
}

export class ShipmentLineResponseDto {
  shipmentLineId!: string;
  shipmentId!: string;
  orderLineId!: string;
  productId!: string;
  quantity!: string;
}

export class ShipmentResponseDto {
  shipmentId!: string;
  shipmentNumber!: string;
  orderId!: string;
  stateCode!: string;
  trackingNumber?: string;
  carrierId?: string;
  notes?: string;
  createdOn?: Date;
  @ApiProperty({ type: () => ShipmentLineResponseDto, isArray: true, required: false })
  lines?: ShipmentLineResponseDto[];
}

export class ShippingContextDto {
  @ApiProperty({ type: () => Object, isArray: true })
  lines!: any[];

  @ApiProperty({ type: () => ShipmentResponseDto, isArray: true })
  shipments!: ShipmentResponseDto[];
}
