import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
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
}
