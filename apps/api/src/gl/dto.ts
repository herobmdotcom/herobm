import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';

export * from './dto/reconciliation.dto';
export class JournalLineDto {
  /** Account code (e.g. "1100") — resolved to gl_account_id internally */
  @IsOptional()
  @IsString()
  accountCode?: string;

  /** Or pass the account UUID directly */
  @IsOptional()
  @IsString()
  accountId?: string;

  /** Financial dimension: Cost Center */
  @IsOptional()
  @IsString()
  costCenterId?: string;

  /** Financial dimension: Activity */
  @IsOptional()
  @IsString()
  activityId?: string;

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
