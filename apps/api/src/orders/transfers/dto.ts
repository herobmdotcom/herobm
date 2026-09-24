import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQuery } from '../../common/pagination';

export class TransferPaginationQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  destinationLocationId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(
    ({ value }) =>
      value === 'true' || value === true || value === '1' || value === 1,
  )
  hasPendingReceipt?: boolean;
}

export class CreateTransferOrderLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsString()
  projectTaskId?: string;
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
  projectId?: string;

  @IsOptional()
  @IsString()
  projectTaskId?: string;

  @IsOptional()
  @IsBoolean()
  isProjectReturn?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  shippingNotes?: string;

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
  projectId?: string;

  @IsOptional()
  @IsString()
  projectTaskId?: string;

  @IsOptional()
  @IsBoolean()
  isProjectReturn?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  shippingNotes?: string;
}

export class UpdateTransferOrderLineDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsString()
  projectTaskId?: string;
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

export class ReceiveTransferLineDto {
  @IsString()
  @IsNotEmpty()
  transferOrderLineId!: string;

  @IsNumberString()
  quantityReceived!: string;
}

export class ReceiveTransferDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferLineDto)
  lines!: ReceiveTransferLineDto[];
}

export class EmptyBodyDto {}

export class TransferLineResponseDto {
  @ApiProperty() transferOrderLineId!: string;
  @ApiProperty() productId!: string;
  @ApiPropertyOptional() productNumber?: string;
  @ApiPropertyOptional() productDescription?: string;
  @ApiPropertyOptional() projectTaskId?: string;
  @ApiProperty() quantity!: string;
  @ApiPropertyOptional() quantityShipped?: string;
  @ApiPropertyOptional() quantityReceived?: string;
  @ApiPropertyOptional() quantityPutaway?: string;
}

export class TransferEventResponseDto {
  @ApiProperty() eventId!: string;
  @ApiProperty() eventType!: string;
  @ApiPropertyOptional() payload?: Record<string, unknown>;
  @ApiPropertyOptional() actor?: string;
  @ApiProperty() createdOn!: Date;
}

export class TransferResponseDto {
  @ApiProperty() transferOrderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() stateCode!: string;
  @ApiProperty() sourceLocationId!: string;
  @ApiPropertyOptional() sourceLocationName?: string;
  @ApiProperty() destinationLocationId!: string;
  @ApiPropertyOptional() destinationLocationName?: string;
  @ApiPropertyOptional() projectId?: string;
  @ApiPropertyOptional() projectTaskId?: string;
  @ApiPropertyOptional() isProjectReturn?: boolean;
  @ApiPropertyOptional() projectNumber?: string;
  @ApiPropertyOptional() projectName?: string;
  @ApiPropertyOptional() stagingBinId?: string;
  @ApiPropertyOptional() stagingBinNumber?: string;
  @ApiPropertyOptional() sourceBinId?: string;
  @ApiPropertyOptional() sourceBinNumber?: string;
  @ApiPropertyOptional() destinationBinId?: string;
  @ApiPropertyOptional() destinationBinNumber?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional() shippingNotes?: string;
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
