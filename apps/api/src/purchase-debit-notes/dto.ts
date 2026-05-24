import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDebitNoteLineDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderLineId: string;

  @IsNumberString()
  @IsNotEmpty()
  quantityInvoiced: string;

  @IsNumberString()
  @IsNotEmpty()
  pricePerUnit: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsNumberString()
  @IsOptional()
  taxAmount?: string;
}

export class CreateDebitNoteDto {
  @IsString()
  @IsNotEmpty()
  returnId: string;

  @IsString()
  @IsOptional()
  supplierReferenceNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteLineDto)
  lines: CreateDebitNoteLineDto[];

  @IsNumberString()
  @IsOptional()
  taxAmount?: string;

  @IsNumberString()
  @IsOptional()
  feeAmount?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
