import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferOrderLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumberString()
  quantity!: string;
}

export class CreateTransferOrderDto {
  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsString()
  @IsNotEmpty()
  destinationLocationId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferOrderLineDto)
  lines!: CreateTransferOrderLineDto[];
}

export class UpdateTransferOrderDto {
  @IsOptional()
  @IsString()
  sourceLocationId?: string;

  @IsOptional()
  @IsString()
  destinationLocationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTransferOrderLineDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;
}

export class CreateTransferFromDemandsDto {
  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @IsArray()
  @IsString({ each: true })
  backorderIds!: string[];
}

export class PickLineDto {
  @IsString()
  @IsNotEmpty()
  binId!: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;
}

export class ReceiveTransferDto {
  @IsString()
  @IsNotEmpty()
  destinationBinId!: string;
}

export class EmptyBodyDto {}

export class TransferResponseDto {
  id!: string;
  transferNumber!: string;
  sourceLocationId!: string;
  destinationLocationId!: string;
  status!: string;
  notes?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class TransferEventResponseDto {
  id!: string;
  transferOrderId!: string;
  eventType!: string;
  eventData!: any;
  createdAt!: Date;
}

export class TransferPickingSummaryResponseDto {
  lineId!: string;
  productId!: string;
  orderedQuantity!: string;
  pickedQuantity!: string;
}
