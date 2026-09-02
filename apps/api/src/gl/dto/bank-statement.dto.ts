import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class MatchedJournalLineDto {
  @ApiProperty()
  debit: number;

  @ApiProperty()
  credit: number;

  @ApiProperty({ required: false, nullable: true })
  memo?: string;

  @ApiProperty({ type: String, format: 'date' })
  entryDate: Date;

  @ApiProperty()
  isReconciled: boolean;
}

export class BankStatementLineDto {
  @ApiProperty()
  lineId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  date: Date;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ required: false, nullable: true })
  reference?: string;

  @ApiProperty({ required: false, nullable: true })
  type?: string;

  @ApiProperty({ required: false, nullable: true })
  payee?: string;

  @ApiProperty()
  isReconciled: boolean;

  @ApiProperty({ required: false, nullable: true })
  matchedJournalLineId?: string;

  @ApiProperty({ type: MatchedJournalLineDto, required: false, nullable: true })
  matchedJournalLine?: MatchedJournalLineDto;

  @ApiProperty({ required: false, nullable: true })
  matchGroupId?: string;
}

export class BankStatementLinesResponseDto {
  @ApiProperty({ type: [BankStatementLineDto] })
  data: BankStatementLineDto[];
}

export class BankStatementConfirmMatchDto {
  @ApiPropertyOptional({
    description:
      'Optional reconciliation ID to link the matched ledger line to',
  })
  @IsOptional()
  @IsString()
  reconciliationId?: string;
}

export class BankStatementManualMatchDto {
  @ApiProperty({ description: 'The journal line ID to link against' })
  @IsString()
  @IsNotEmpty()
  journalLineId!: string;

  @ApiPropertyOptional({
    description:
      'Optional reconciliation ID to link the matched ledger line to',
  })
  @IsOptional()
  @IsString()
  reconciliationId?: string;
}

export class CreateBankStatementLineDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  glAccountId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  payee?: string;
}

export class BankStatementBulkMatchDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  bankLineIds: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  journalLineIds: string[];

  @ApiProperty({
    required: true,
    description: 'Reconciliation ID to link the lines to',
  })
  @IsString()
  @IsNotEmpty()
  reconciliationId: string;
}

export class AutoMatchProposedRuleMatchDto {
  @ApiProperty()
  bankLineId: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  ruleId: string;

  @ApiProperty()
  targetGlAccountId: string;
}

export class AutoMatchSmartMatchDto {
  @ApiProperty({ type: [String] })
  bankLineIds: string[];

  @ApiProperty({ type: [String] })
  journalLineIds: string[];

  @ApiProperty({ enum: ['high', 'medium'] })
  confidence: 'high' | 'medium';

  @ApiProperty()
  date: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: number;
}

export class AutoMatchResponseDto {
  @ApiProperty()
  autoMatchedCount: number;

  @ApiProperty()
  smartMatchedCount: number;

  @ApiProperty()
  unmatchedCount: number;

  @ApiProperty({ type: [AutoMatchSmartMatchDto] })
  smartMatches: AutoMatchSmartMatchDto[];

  @ApiProperty({ type: [AutoMatchProposedRuleMatchDto], required: false })
  proposedRuleMatches?: AutoMatchProposedRuleMatchDto[];
}

export class AutoMatchRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  glAccountId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reconciliationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  dryRun?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ignoredStatementLineIds?: string[];
}

export class UnmatchRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  matchGroupId: string;
}

export class BankStatementSuccessResponseDto {
  @ApiProperty()
  success: boolean;
}

export class BankStatementMatchGroupResponseDto {
  @ApiProperty()
  matchGroupId: string;

  @ApiProperty()
  matchType: string;

  @ApiProperty({ required: false, nullable: true })
  ruleName: string | null;

  @ApiProperty()
  createdBy: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdOn: Date;

  @ApiProperty({ type: [Object], required: false })
  bankLines?: Record<string, unknown>[];

  @ApiProperty({ type: [Object], required: false })
  ledgerLines?: Record<string, unknown>[];
}
