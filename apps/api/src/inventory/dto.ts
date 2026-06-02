import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PutawayLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['goods_receipt', 'sales_return'])
  sourceType!: 'goods_receipt' | 'sales_return';

  @IsString()
  @IsNotEmpty()
  destinationBinId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsNumberString()
  newTotalQuantity?: string;
}

export class EmptyBodyDto {}

export class PutawayBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PutawayLineDto)
  putaways!: PutawayLineDto[];
}

export class ToggleQuarantineDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['goods_receipt', 'sales_return'])
  sourceType!: 'goods_receipt' | 'sales_return';

  @IsOptional()
  @IsString()
  reason?: string;
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
  binId!: string;
  binNumber!: string;
  binType?: string;
  isUnavailable?: boolean;
  onHand!: string;
}

export class AvailableBinDto {
  @ApiProperty()
  binId!: string;
  @ApiProperty()
  binNumber!: string;
  @ApiProperty()
  binType!: string;
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

export class InventoryMovementResponseDto {
  id!: string;
  productId!: string;
  quantity!: string;
  date!: Date;
}

export class InventoryLedgerResponseDto {
  id!: string;
  productId!: string;
  quantity!: string;
  date!: Date;
}

export class InventoryEntryDetailsResponseDto {
  id!: string;
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
  id!: string;
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
}

export class InventorySuccessResponseDto {
  @ApiProperty()
  success!: boolean;
}
