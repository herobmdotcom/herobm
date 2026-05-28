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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferLineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() transferOrderLineId!: string;
  @ApiProperty() productId!: string;
  @ApiPropertyOptional() productNumber?: string;
  @ApiPropertyOptional() productDescription?: string;
  @ApiProperty() quantity!: string;
  @ApiPropertyOptional() quantityShipped?: string;
  @ApiPropertyOptional() quantityReceived?: string;
}

export class TransferEventResponseDto {
  @ApiProperty() eventId!: string;
  @ApiProperty() eventType!: string;
  @ApiPropertyOptional() payload?: any;
  @ApiPropertyOptional() actor?: string;
  @ApiProperty() createdOn!: Date;
}

export class TransferResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() transferOrderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() stateCode!: string;
  @ApiProperty() sourceLocationId!: string;
  @ApiPropertyOptional() sourceLocationName?: string;
  @ApiProperty() destinationLocationId!: string;
  @ApiPropertyOptional() destinationLocationName?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() createdBy?: string;
  @ApiProperty() createdOn!: Date;
  @ApiPropertyOptional({ type: [TransferLineResponseDto] })
  lines?: TransferLineResponseDto[];
  @ApiPropertyOptional({ type: [TransferEventResponseDto] })
  events?: TransferEventResponseDto[];
}

export class TransferPickingSummaryResponseDto {
  @ApiProperty() lineId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() orderedQuantity!: string;
  @ApiProperty() pickedQuantity!: string;
}
