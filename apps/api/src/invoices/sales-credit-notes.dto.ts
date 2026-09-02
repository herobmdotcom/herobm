import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
}
