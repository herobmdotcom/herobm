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

import { ApiProperty } from '@nestjs/swagger';
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

export class PutawayContextResponseDto {
  productId!: string;
  productName!: string;
  locationId!: string;
  bins!: any[];
  defaultBinId?: string | null;
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
  id!: string;
  productId!: string;
  quantity!: string;
}

export class LocationsResponseDto {
  @ApiProperty({ type: () => [InventoryLocationResponseDto] })
  data!: InventoryLocationResponseDto[];

  @ApiProperty({ required: false, type: String })
  defaultFulfillmentLocationId?: string;
}
