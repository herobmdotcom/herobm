import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EmptyBodyDto {}

export class PickWorkOrderComponentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  binId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  quantity!: string;
}

export class WorkOrderComponentResponseDto {
  @ApiProperty()
  workOrderComponentId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  expectedQuantity!: string;

  @ApiPropertyOptional()
  unitCost?: string | null;

  @ApiPropertyOptional()
  stagedQuantity?: string | null;

  @ApiPropertyOptional()
  wipBinQuantity?: string | null;

  @ApiPropertyOptional()
  currentQuantity?: string | null;
}

export class WorkOrderResponseDto {
  @ApiProperty()
  workOrderId!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  targetQuantity!: string;

  @ApiProperty()
  completedQuantity!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  locationName!: string;

  @ApiPropertyOptional()
  wipBinId?: string | null;

  @ApiPropertyOptional()
  wipBinName?: string | null;

  @ApiProperty()
  stateCode!: string;

  @ApiPropertyOptional()
  totalCost?: string | null;

  @ApiPropertyOptional()
  createdBy?: string | null;

  @ApiPropertyOptional()
  createdOn?: Date | string | null;

  @ApiPropertyOptional()
  modifiedOn?: Date | string | null;

  @ApiPropertyOptional({ type: [WorkOrderComponentResponseDto] })
  components?: WorkOrderComponentResponseDto[];
}

export class WorkOrderAvailableBinDto {
  @ApiProperty()
  binId!: string;

  @ApiProperty()
  binName!: string;

  @ApiProperty()
  onHand!: string;
}

export class WorkOrderPickingLineDto {
  @ApiProperty()
  salesOrderLineId!: string;

  @ApiProperty()
  lineNumber!: number;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productType!: string;

  @ApiProperty()
  productDescription!: string;

  @ApiProperty()
  locationName!: string;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  quantityPicked!: string;

  @ApiProperty()
  quantityShipped!: string;

  @ApiProperty()
  remaining!: string;

  @ApiProperty()
  isFullyPicked!: boolean;

  @ApiProperty()
  isPhysical!: boolean;

  @ApiProperty()
  onHand!: string;

  @ApiProperty({ type: [WorkOrderAvailableBinDto] })
  availableBins!: WorkOrderAvailableBinDto[];
}

export class WorkOrderPickDetailDto {
  @ApiProperty()
  pickId!: string;

  @ApiProperty()
  salesOrderId!: string;

  @ApiProperty()
  salesOrderLineId!: string;

  @ApiProperty()
  productId!: string;

  @ApiPropertyOptional()
  binId?: string | null;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiPropertyOptional()
  binName?: string | null;
}

export class WorkOrderPickingSummaryDto {
  @ApiProperty()
  totalLines!: number;

  @ApiProperty()
  fullyPickedLines!: number;

  @ApiProperty()
  isFullyPicked!: boolean;

  @ApiProperty({ type: [WorkOrderPickingLineDto] })
  lines!: WorkOrderPickingLineDto[];

  @ApiProperty({ type: [WorkOrderPickDetailDto] })
  picks!: WorkOrderPickDetailDto[];
}
