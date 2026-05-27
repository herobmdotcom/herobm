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
  @IsUUID()
  @IsNotEmpty()
  goodsReceivedId!: string;

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
