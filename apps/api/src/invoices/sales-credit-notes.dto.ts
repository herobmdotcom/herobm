import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateSalesCreditNoteDto {
  @IsUUID()
  @IsNotEmpty()
  returnId!: string;
}
