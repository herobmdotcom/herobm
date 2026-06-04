import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSalesCreditNoteDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  returnId!: string;
}

export class SalesCreditNoteResponseDto {
  @ApiProperty()
  creditNoteId!: string;

  @ApiProperty()
  creditNoteNumber!: string;

  @ApiProperty()
  stateCode!: string;
}
