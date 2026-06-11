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

export class CreateGoodsReceivedLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumberString()
  quantityReceived!: string;
}

export class CreateGoodsReceivedDto {
  @IsOptional()
  @IsUUID()
  goodsReceivedId?: string;

  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsOptional()
  @IsString()
  packingSlipNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceivedLineDto)
  lines!: CreateGoodsReceivedLineDto[];
}

export class ResolveAllocationDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderLineId!: string;

  @IsOptional()
  @IsNumberString()
  allocatedQuantity?: string;
}

export class GoodsReceivedResponseDto {
  goodsReceivedId!: string;
  receiptNumber!: string;
  vendorId!: string;
  locationId!: string;
  packingSlipNumber?: string;
  notes?: string;
  stateCode!: string;
  createdBy?: string;
  createdOn?: Date;
  modifiedOn?: Date;

  vendorName?: string;
  vendorNumber?: string;
  totalLines?: number;
  matchedLines?: number;
}

export class GoodsReceivedLineResponseDto {
  goodsReceivedLineId!: string;
  goodsReceivedId!: string;
  productId!: string;
  purchaseOrderLineId?: string;
  purchaseOrderId?: string;
  quantityReceived!: string;
  matchStatus!: string;
  putawayStatus!: string;
  createdOn?: Date;
  modifiedOn?: Date;

  receiptNumber?: string;
  packingSlipNumber?: string;
  vendorId?: string;
  vendorName?: string;
  vendorNumber?: string;
  locationId?: string;
  locationName?: string;
  productNumber?: string;
  productName?: string;
  orderNumber?: string;
  stateCode?: string;
}

export class PaginatedGoodsReceivedDto {
  data!: GoodsReceivedResponseDto[];
  meta!: Record<string, unknown>;
}

export class PaginatedGoodsReceivedLineDto {
  data!: GoodsReceivedLineResponseDto[];
  meta!: Record<string, unknown>;
}

export class CancelReceptionResponseDto {
  success!: boolean;
}

export class EmptyBodyDto {}

export class ResolveAllocationResponseDto {
  success!: boolean;
  splitLine?: Record<string, unknown>;
}
