import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateReconciliationDto {
  @IsString()
  @IsNotEmpty()
  glAccountId: string;

  @IsDateString()
  @IsNotEmpty()
  statementDate: string;

  @IsNumber()
  @IsNotEmpty()
  statementBalance: number;

  @IsString()
  @IsOptional()
  createdBy?: string;
}

export class ToggleLineDto {
  @IsBoolean()
  isCleared: boolean;

  @IsNumber()
  @IsOptional()
  amount?: number;
}

export class CreateAdjustmentDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(['debit', 'credit'])
  @IsNotEmpty()
  type: 'debit' | 'credit';

  @IsString()
  @IsNotEmpty()
  offsetAccountId: string; // The GL Account ID for the offset (e.g. Bank Fees)

  @IsString()
  @IsNotEmpty()
  memo: string;
}

export class ReconciliationListResponseDto {
  data!: any[];
}

export class CreateReconciliationResponseDto {
  reconciliationId!: string;
}

export class ReconciliationDetailResponseDto {
  reconciliationId!: string;
  glAccountId!: string;
  accountName!: string;
  statementDate!: string;
  statementBalance!: number;
  status!: string;
  openingBalance!: number;
  clearedBalance!: number;
  variance!: number;
}

export class UnreconciledLinesResponseDto {
  data!: any[];
}

export class ToggleLineResponseDto {
  success!: boolean;
}

export class PostReconciliationResponseDto {
  success!: boolean;
}

export class DiscardReconciliationResponseDto {
  success!: boolean;
}

export class CreateAdjustmentResponseDto {
  success!: boolean;
  journalEntryId!: string;
}
