import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsUUID,
  IsEmail,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RETURN_RESOLUTION, type ReturnResolution } from '@herobm/shared';

export class OrderCustomFieldsDto {
  @IsOptional()
  @IsString()
  analysisCode?: string;
}

export class ReturnLineResponseDto {
  @ApiProperty() lineId!: string;
  @ApiProperty() description!: string;
  @ApiProperty() quantityReturned!: string;
  @ApiProperty() pricePerUnit!: string;
  @ApiProperty() discountPercentage!: string;
  @ApiProperty() taxRate!: string;
  @ApiProperty() returnFee!: string;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional() resolution?: string;
}

export class ReturnResponseDto {
  @ApiProperty() returnId!: string;
  @ApiProperty() returnNumber!: string;
  @ApiProperty() stateCode!: string;
  @ApiPropertyOptional() orderNumber?: string;
  @ApiPropertyOptional() customerId?: string;
  @ApiPropertyOptional() customerNumber?: string;
  @ApiPropertyOptional() customerName?: string;
  @ApiPropertyOptional() locationId?: string;
  @ApiPropertyOptional() locationName?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty({ type: () => [ReturnLineResponseDto] })
  lines!: ReturnLineResponseDto[];
}

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
  unitCost?: string;

  @IsOptional()
  @IsNumberString()
  discountPercentage?: string;

  @IsOptional()
  @IsString()
  taxCategoryId?: string;

  @IsOptional()
  @IsNumberString()
  tax?: string;

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
  unitCost?: string;

  @IsOptional()
  @IsNumberString()
  discountPercentage?: string;

  @IsOptional()
  @IsString()
  taxCategoryId?: string;

  @IsOptional()
  @IsNumberString()
  tax?: string;

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

  @IsOptional()
  @IsString()
  shippingNotes?: string;

  @IsOptional()
  @IsString()
  deliveryCompanyName?: string;

  @IsOptional()
  @IsString()
  deliveryName?: string;

  @IsOptional()
  @IsString()
  deliveryPhone?: string;

  @IsOptional()
  @IsString()
  deliveryAddressLine1?: string;

  @IsOptional()
  @IsString()
  deliveryAddressLine2?: string;

  @IsOptional()
  @IsString()
  deliveryCity?: string;

  @IsOptional()
  @IsString()
  deliveryState?: string;

  @IsOptional()
  @IsString()
  deliveryPostalCode?: string;

  @IsOptional()
  @IsString()
  deliveryCountry?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines!: CreateOrderLineDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderCustomFieldsDto)
  customFields?: OrderCustomFieldsDto;
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

  @IsOptional()
  @IsString()
  shippingNotes?: string;

  @IsOptional()
  @IsString()
  deliveryCompanyName?: string;

  @IsOptional()
  @IsString()
  deliveryName?: string;

  @IsOptional()
  @IsString()
  deliveryPhone?: string;

  @IsOptional()
  @IsString()
  deliveryAddressLine1?: string;

  @IsOptional()
  @IsString()
  deliveryAddressLine2?: string;

  @IsOptional()
  @IsString()
  deliveryCity?: string;

  @IsOptional()
  @IsString()
  deliveryState?: string;

  @IsOptional()
  @IsString()
  deliveryPostalCode?: string;

  @IsOptional()
  @IsString()
  deliveryCountry?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderCustomFieldsDto)
  customFields?: OrderCustomFieldsDto;
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
  @IsIn(Object.values(RETURN_RESOLUTION))
  resolution?: ReturnResolution;

  @IsOptional()
  @IsNumberString()
  returnFee?: string;
}

export class CreateReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnLineDto)
  lines!: CreateReturnLineDto[];
}

export class UpdateReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
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

  @IsOptional()
  @IsIn(['refund', 'replace'])
  resolution?: 'refund' | 'replace';
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

  @IsOptional()
  @IsIn(['refund', 'replace'])
  resolution?: 'refund' | 'replace';
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
  deliveryCompanyName?: string;

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
  deliveryCompanyName?: string;

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
  customFields?: Record<string, unknown> | null;
  discrepanciesAcknowledged!: boolean;
  taxProvider?: string | null;
  sourceId?: string | null;
  source!: string;
  isCreditBlocked?: boolean;
  creditHoldOverrideAt?: Date | null;
  createdBy?: string | null;
  createdOn?: Date | null;
  modifiedOn?: Date | null;
  productQuantity?: number;
  productQuantityShipped?: number;
}

export class EmptyBodyDto {}

export class ChangeOrderStateDto {
  @IsString()
  @IsNotEmpty()
  stateCode!: string;

  @IsOptional()
  generateBackorders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  discrepanciesAcknowledged?: boolean;
}

export class EmailDocumentDto {
  @ApiProperty({ description: 'The recipient email address' })
  @IsEmail()
  emailAddress!: string;

  @ApiProperty({ description: 'The email subject' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'The text body for the email' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({
    description:
      'The hook slug for the PDF template to use (e.g. sales-order-quote)',
  })
  @IsOptional()
  @IsString()
  hookSlug?: string;

  @ApiPropertyOptional({
    description: 'Custom text injected into the generated PDF',
  })
  @IsOptional()
  @IsString()
  customPdfText?: string;

  @ApiPropertyOptional({
    description: 'The target entity ID, if different from the order ID',
  })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'The context slug for the report data source',
  })
  @IsOptional()
  @IsString()
  contextSlug?: string;
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
  transfers?: Record<string, unknown>[];
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
  deliveryName?: string;
  deliveryPhone?: string;
  deliveryAddressLine1?: string;
  deliveryAddressLine2?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPostalCode?: string;
  deliveryCountry?: string;
  shippingNotes?: string;
  @ApiProperty({
    type: () => ShipmentLineResponseDto,
    isArray: true,
    required: false,
  })
  lines?: ShipmentLineResponseDto[];
}

export class ShippingContextLineDto {
  @ApiProperty() salesOrderLineId!: string;
  @ApiProperty() lineNumber!: number;
  @ApiProperty() productId!: string;
  @ApiProperty() productNumber!: string;
  @ApiProperty() productDescription!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty() quantityPicked!: string;
  @ApiProperty() quantityShipped!: string;
  @ApiProperty() isPhysical!: boolean;
  @ApiProperty() availableToShip!: string;
}

export class ShippingContextDto {
  @ApiPropertyOptional() isCreditBlocked?: boolean;
  @ApiProperty({ type: () => [ShippingContextLineDto] })
  lines!: ShippingContextLineDto[];

  @ApiProperty({ type: () => [ShipmentResponseDto] })
  shipments!: ShipmentResponseDto[];
}

export class PickingSummaryAvailableBinDto {
  @ApiProperty() binId!: string;
  @ApiProperty() binName!: string;
  @ApiProperty() onHand!: string;
}

export class PickingSummaryLineDto {
  @ApiProperty() salesOrderLineId!: string;
  @ApiProperty() lineNumber!: number;
  @ApiProperty() productId!: string;
  @ApiProperty() productNumber!: string;
  @ApiPropertyOptional() productType?: string;
  @ApiProperty() productDescription!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty() quantityPicked!: string;
  @ApiProperty() quantityShipped!: string;
  @ApiProperty() remaining!: string;
  @ApiProperty() isFullyPicked!: boolean;
  @ApiProperty() isPhysical!: boolean;
  @ApiProperty() onHand!: string;
  @ApiProperty({ type: () => [PickingSummaryAvailableBinDto] })
  availableBins!: PickingSummaryAvailableBinDto[];
  @ApiProperty() hasAllocation!: boolean;
}

export class PickingSummaryPickDto {
  @ApiProperty() pickId!: string;
  @ApiProperty() salesOrderId!: string;
  @ApiProperty() salesOrderLineId!: string;
  @ApiProperty() productId!: string;
  @ApiPropertyOptional() binId?: string | null;
  @ApiProperty() quantity!: string;
  @ApiProperty() stateCode!: string;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdOn!: Date;
  @ApiProperty() modifiedOn!: Date;
  @ApiPropertyOptional() binName?: string | null;
}

export class PickingSummaryDto {
  @ApiPropertyOptional() isCreditBlocked?: boolean;
  @ApiProperty() totalLines!: number;
  @ApiProperty() fullyPickedLines!: number;
  @ApiProperty() isFullyPicked!: boolean;
  @ApiProperty({ type: () => [PickingSummaryLineDto] })
  lines!: PickingSummaryLineDto[];
  @ApiProperty({ type: () => [PickingSummaryPickDto] })
  picks!: PickingSummaryPickDto[];
}

export class OrderQueueBaseDto {
  @ApiProperty() id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiPropertyOptional() name?: string | null;
  @ApiProperty() customerName!: string;
  @ApiPropertyOptional() customerOrderNumber?: string | null;
  @ApiProperty() stateCode!: string;
  @ApiProperty() createdOn!: Date;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() currencyCode?: string | null;
  @ApiProperty() isCreditBlocked!: boolean;
}

export class PickingQueueOrderDto extends OrderQueueBaseDto {
  @ApiPropertyOptional() type?: string;
  @ApiProperty() pickabilityStatus!: string;
  @ApiProperty() hasAllocation!: boolean;
}

export class PickingQueueQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ enum: ['ready', 'partial', 'blocked', 'all'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PickingQueueMetaDto {
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() readyCount!: number;
  @ApiProperty() partialCount!: number;
  @ApiProperty() blockedCount!: number;
}

export class PickingQueueResponseDto {
  @ApiProperty({ type: () => [PickingQueueOrderDto] })
  data!: PickingQueueOrderDto[];

  @ApiProperty({ type: () => PickingQueueMetaDto })
  meta!: PickingQueueMetaDto;
}

export class ShippingQueueOrderDto extends OrderQueueBaseDto {
  @ApiProperty() shippabilityStatus!: string;
  @ApiProperty() totalShippableLines!: number;
  @ApiProperty() totalLines!: number;
}

export class GlobalShipmentListResponseDto {
  @ApiProperty({ type: () => [ShipmentResponseDto] })
  data!: ShipmentResponseDto[];
}

export class GlobalReturnListResponseDto {
  @ApiProperty({ type: () => [ReturnResponseDto] })
  data!: ReturnResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number' },
    },
  })
  meta!: { total: number };
}

export class OpenDemandLocationAvailabilityDto {
  @ApiProperty() locationId!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty() availableQty!: number;
}

export class OpenDemandDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() salesOrderId?: string | null;
  @ApiPropertyOptional() demandWorkOrderId?: string | null;
  @ApiPropertyOptional() workOrderComponentId?: string | null;
  @ApiPropertyOptional() demandType?: string | null;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiPropertyOptional() productDescription?: string | null;
  @ApiProperty() quantity!: number;
  @ApiProperty() createdOn!: string;
  @ApiPropertyOptional() vendorId?: string | null;
  @ApiPropertyOptional() vendorName?: string | null;
  @ApiPropertyOptional() costPrice?: number | null;
  @ApiPropertyOptional() currencyCode?: string | null;
  @ApiPropertyOptional() locationId?: string | null;
  @ApiPropertyOptional() locationName?: string | null;
  @ApiPropertyOptional() purchaseOrderId?: string | null;
  @ApiPropertyOptional() purchaseOrderNumber?: string | null;
  @ApiPropertyOptional() purchaseOrderState?: string | null;
  @ApiPropertyOptional() transferOrderId?: string | null;
  @ApiPropertyOptional() transferOrderNumber?: string | null;
  @ApiPropertyOptional() transferOrderState?: string | null;
  @ApiProperty({ type: () => [OpenDemandLocationAvailabilityDto] })
  availableElsewhere!: OpenDemandLocationAvailabilityDto[];
}

export class OpenDemandsListResponseDto {
  @ApiProperty({ type: () => [OpenDemandDto] })
  data!: OpenDemandDto[];
}

export class PoAllocationDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() salesOrderId?: string | null;
  @ApiPropertyOptional() demandWorkOrderId?: string | null;
  @ApiPropertyOptional() workOrderComponentId?: string | null;
  @ApiPropertyOptional() demandType?: string | null;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() createdOn!: string;
  @ApiPropertyOptional() purchaseOrderLineId?: string | null;
  @ApiProperty() stateCode!: string;
}

export class PoAllocationsListResponseDto {
  @ApiProperty({ type: () => [PoAllocationDto] })
  data!: PoAllocationDto[];
}

export class AvailablePoLineDto {
  @ApiProperty() purchaseOrderId!: string;
  @ApiProperty() purchaseOrderLineId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() stateCode!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty() vendorId!: string;
  @ApiProperty() vendorName!: string;
  @ApiProperty() deliveryLocationId!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty() availableQty!: number;
}

export class AvailablePoLinesListResponseDto {
  @ApiProperty({ type: () => [AvailablePoLineDto] })
  data!: AvailablePoLineDto[];
}

export class AllocationSuccessResponseDto {
  @ApiProperty() success!: boolean;
}

export class AllocationResolveResponseDto {
  @ApiProperty() success!: boolean;
  @ApiPropertyOptional() message?: string;
}

export class OverrideCreditHoldDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Reason for overriding the credit hold' })
  reason!: string;
}
