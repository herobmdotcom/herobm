import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PutawayLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['goods_receipt', 'sales_return', 'transfer_receipt', 'work_order'])
  sourceType!:
    | 'goods_receipt'
    | 'sales_return'
    | 'transfer_receipt'
    | 'work_order';

  @IsString()
  @IsNotEmpty()
  destinationBinId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsNumberString()
  newTotalQuantity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class EmptyBodyDto {}

export class PutawayBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PutawayLineDto)
  putaways!: PutawayLineDto[];
}

export class QuarantineMoveDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceBinId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetBinId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @ApiProperty({
    required: false,
    enum: ['goods_receipt', 'sales_return', 'manual'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['goods_receipt', 'sales_return', 'manual'])
  sourceType?: 'goods_receipt' | 'sales_return' | 'manual';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lineId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MoveStockDto {
  @ApiProperty({ isArray: true, type: () => MoveStockLineDto })
  @ValidateNested({ each: true })
  @Type(() => MoveStockLineDto)
  lines!: MoveStockLineDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MoveStockLineDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  sourceBinId!: string;

  @ApiProperty()
  @IsString()
  targetBinId!: string;

  @ApiProperty()
  @IsNumberString()
  quantity!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uomCode?: string;
}

export class InventoryResponseDto {
  inventoryLevelId!: string;
  productId!: string;
  productNumber!: string;
  productName!: string;
  locationNo!: string;
  locationName!: string;
  quantityOnHand!: string;
  quantityCommitted!: string;
  quantityReserved!: string;
  quantityOnOrder!: string;
  quantityAvailable!: string;
  alternateProductNumber?: string | null;
  defaultBinNumber?: string | null;
}

export class InventoryBinResponseDto {
  @ApiProperty()
  binId!: string;
  @ApiProperty({ required: false })
  zoneId?: string;
  @ApiProperty({ required: false })
  zoneCode?: string;
  @ApiProperty()
  binNumber!: string;
  @ApiProperty({ required: false })
  binType?: string;
  @ApiProperty({ required: false })
  isUnavailable?: boolean;
  @ApiProperty()
  onHand!: string;
}

export class AvailableBinDto {
  @ApiProperty()
  binId!: string;
  @ApiProperty()
  binNumber!: string;
  @ApiProperty()
  binType!: string;
  @ApiProperty({ required: false })
  zoneCode?: string;
}

export class PutawayContextResponseDto {
  @ApiProperty({ required: false, nullable: true })
  primaryBinId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  primaryBinNumber!: string | null;

  @ApiProperty()
  currentQuantity!: number;

  @ApiProperty({ type: () => [AvailableBinDto] })
  availableBins!: AvailableBinDto[];
}

export class InventoryLocationResponseDto {
  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class TopographyLocationResponseDto extends InventoryLocationResponseDto {
  @ApiProperty({ required: false })
  zones?: Record<string, unknown>[];
}

export class InventoryMovementResponseDto {
  movementId!: string;
  productId!: string;
  quantity!: string;
  date!: Date;
}

export class InventoryLedgerResponseDto {
  ledgerId!: string;
  productId!: string;
  quantity!: string;
  date!: Date;
}

export class InventoryEntryDetailsResponseDto {
  entryId!: string;
  productId!: string;
  quantity!: string;
  date!: Date;
}

export class FindByProductIdsBulkDto {
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class PendingPutawayResponseDto {
  @ApiProperty()
  putawayId!: string;
  @ApiProperty()
  sourceType!: string;
  @ApiProperty()
  referenceNumber!: string;
  @ApiProperty()
  productId!: string;
  @ApiProperty()
  productName!: string;
  @ApiProperty()
  productNumber!: string;
  @ApiProperty()
  quantity!: string;
  @ApiProperty()
  putawayStatus!: string;
  @ApiProperty()
  locationId!: string;
  @ApiProperty({ required: false })
  createdOn!: Date;
  @ApiProperty()
  sourceBinCode!: string;
  @ApiProperty({ required: false })
  returnReason?: string;
  @ApiPropertyOptional({ required: false, nullable: true })
  projectId?: string | null;
  @ApiPropertyOptional({ required: false, nullable: true })
  projectNumber?: string | null;
  @ApiPropertyOptional({ required: false, nullable: true })
  projectName?: string | null;
  @ApiPropertyOptional({ required: false, nullable: true })
  projectStagingBinId?: string | null;
  @ApiPropertyOptional({ required: false, nullable: true })
  projectStagingBinNumber?: string | null;
  @ApiPropertyOptional({ required: false, nullable: true })
  isProjectReturn?: boolean | null;
}

export class InventorySuccessResponseDto {
  @ApiProperty()
  success!: boolean;
}

export class AdjustStockLineDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  binId!: string;

  @IsNumberString()
  newQuantity!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uomCode?: string;
}

export class AdjustStockDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjustStockLineDto)
  lines!: AdjustStockLineDto[];

  @IsOptional()
  @IsString()
  reason?: string;
}

// ── Restock DTOs ──

export class RestockItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiPropertyOptional()
  productDescription?: string | null;

  @ApiPropertyOptional()
  productGroupId?: string | null;

  @ApiPropertyOptional()
  productGroupName?: string | null;

  @ApiPropertyOptional()
  productGroupCode?: string | null;

  @ApiProperty()
  productType!: string;

  @ApiProperty()
  baseUom!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  locationName!: string;

  @ApiProperty()
  locationCode!: string;

  @ApiProperty()
  binId!: string;

  @ApiProperty()
  binNumber!: string;

  @ApiProperty()
  binType!: string;

  @ApiProperty()
  quantityOnHand!: number;

  @ApiProperty()
  quantityCommitted!: number;

  @ApiProperty()
  quantityOnOrder!: number;

  @ApiProperty()
  availableQuantity!: number;

  @ApiProperty()
  minQuantity!: number;

  @ApiPropertyOptional()
  maxQuantity?: number | null;

  @ApiProperty()
  suggestedRestockQty!: number;

  @ApiPropertyOptional()
  vendorId?: string | null;

  @ApiPropertyOptional()
  vendorName?: string | null;

  @ApiPropertyOptional()
  costPrice?: number | null;

  @ApiPropertyOptional()
  currencyCode?: string | null;

  @ApiPropertyOptional()
  minPurchaseQty?: number | null;

  @ApiPropertyOptional()
  purchaseUnit?: string | null;
}

export class RestockSummaryDto {
  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  totalSuggestedUnits!: number;

  @ApiProperty()
  totalEstimatedCost!: number;
}

export class RestockResponseDto {
  @ApiProperty({ type: () => [RestockItemDto] })
  data!: RestockItemDto[];

  @ApiProperty({ type: () => RestockSummaryDto })
  summary!: RestockSummaryDto;
}

// ── Movement DTOs ──

export class MovementBreakdownDto {
  @ApiProperty()
  poReceipts!: number;

  @ApiProperty()
  soShipments!: number;

  @ApiProperty()
  customerReturns!: number;

  @ApiProperty()
  supplierReturns!: number;

  @ApiProperty()
  adjustments!: number;

  @ApiProperty()
  transfersIn!: number;

  @ApiProperty()
  transfersOut!: number;

  @ApiProperty()
  workOrders!: number;
}

export class MovementItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiPropertyOptional()
  productGroupId?: string | null;

  @ApiPropertyOptional()
  productGroupName?: string | null;

  @ApiProperty()
  baseUom!: string;

  @ApiPropertyOptional()
  locationId?: string | null;

  @ApiPropertyOptional()
  locationName?: string | null;

  @ApiPropertyOptional()
  locationCode?: string | null;

  @ApiProperty()
  openingQuantity!: number;

  @ApiProperty()
  stockIn!: number;

  @ApiProperty()
  stockOut!: number;

  @ApiProperty()
  netMovement!: number;

  @ApiProperty()
  closingQuantity!: number;

  @ApiProperty()
  currentOnHand!: number;

  @ApiProperty({ type: () => MovementBreakdownDto })
  breakdown!: MovementBreakdownDto;
}

export class MovementLedgerLineDto {
  @ApiProperty()
  ledgerId!: string;

  @ApiProperty()
  entryId!: string;

  @ApiProperty()
  entryNumber!: string;

  @ApiProperty()
  entryDate!: string;

  @ApiProperty()
  sourceType!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiPropertyOptional()
  productGroupId?: string | null;

  @ApiPropertyOptional()
  productGroupName?: string | null;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  locationName!: string;

  @ApiProperty()
  locationCode!: string;

  @ApiProperty()
  binId!: string;

  @ApiProperty()
  binNumber!: string;

  @ApiProperty()
  quantity!: number;

  @ApiPropertyOptional()
  memo?: string | null;

  @ApiPropertyOptional()
  createdBy?: string | null;
}

export class MovementSummaryDto {
  @ApiProperty()
  totalProducts!: number;

  @ApiProperty()
  totalOpening!: number;

  @ApiProperty()
  totalIn!: number;

  @ApiProperty()
  totalOut!: number;

  @ApiProperty()
  totalNet!: number;

  @ApiProperty()
  totalClosing!: number;
}

export class MovementReportResponseDto {
  @ApiProperty({ type: () => [MovementItemDto] })
  data!: MovementItemDto[];

  @ApiProperty({ type: () => [MovementLedgerLineDto] })
  movements!: MovementLedgerLineDto[];

  @ApiProperty({ type: () => MovementSummaryDto })
  summary!: MovementSummaryDto;
}
