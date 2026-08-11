import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmptyBodyDto {}

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
