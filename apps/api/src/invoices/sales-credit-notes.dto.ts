import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateSalesCreditNoteLineDto {
  @IsString()
  @ApiProperty()
  description!: string;

  @IsNumber()
  @ApiProperty()
  amount!: number;

  @IsUUID()
  @ApiProperty()
  accountId!: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({ required: false })
  taxCategoryId?: string;
}

export class CreateSalesCreditNoteDto {
  @IsUUID()
  @IsOptional()
  @ApiProperty({ required: false })
  returnId?: string;

  @IsUUID()
  @IsOptional()
  @ApiProperty({ required: false })
  customerId?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  notes?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesCreditNoteLineDto)
  @ApiProperty({ type: [CreateSalesCreditNoteLineDto], required: false })
  lines?: CreateSalesCreditNoteLineDto[];
}

export class EmptyBodyDto {}

export class SalesCreditNoteResponseDto {
  @ApiProperty()
  creditNoteId!: string;

  @ApiProperty()
  creditNoteNumber!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiProperty({ required: false, type: Object })
  metadata?: Record<string, unknown>;
}
