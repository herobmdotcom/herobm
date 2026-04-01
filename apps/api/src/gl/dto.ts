import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';

export class JournalLineDto {
  /** Account code (e.g. "1100") — resolved to gl_account_id internally */
  @IsString()
  @IsNotEmpty()
  accountCode!: string;

  @IsOptional()
  @IsEnum(['customer', 'supplier'])
  partyType?: 'customer' | 'supplier' | null;

  @IsOptional()
  @IsString()
  partyId?: string | null;

  @IsNumber()
  debit!: number;

  @IsNumber()
  credit!: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
