import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
  Min,
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
  @Min(0)
  debit!: number;

  @IsNumber()
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  foreignDebit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  foreignCredit?: number;

  @IsOptional()
  @IsString()
  foreignCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}

import { Type } from 'class-transformer';
import { ValidateNested, IsUUID, IsArray } from 'class-validator';

export class CreateJournalEntryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  journalEntryId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsString()
  entryDate?: string;

  @IsOptional()
  @IsString()
  actor?: string;
}

export class GlAccountResponseDto {
  glAccountId: string;
  accountCode: string;
  name: string;
  accountType: string;
  isGroup: boolean;
  isActive: boolean;
  parentAccountId?: string | null;
  isSystem?: boolean;
}
export class JournalEntryResponseDto {
  journalEntryId: string;
  entryNumber: string;
}
export class TrialBalanceResponseDto {
  accountCode: string;
  name: string;
  accountType: string;
  isGroup: boolean;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  ytdDebit: number;
  ytdCredit: number;
  ytdBalance: number;
}
export class GlEntryResponseDto {
  @ApiPropertyOptional()
  journalEntryId: string;

  @ApiPropertyOptional()
  entryNumber: string;

  @ApiPropertyOptional()
  entryDate: string;

  @ApiPropertyOptional()
  entryMemo?: string | null;

  @ApiPropertyOptional()
  sourceType?: string | null;

  @ApiPropertyOptional()
  sourceId?: string | null;

  @ApiPropertyOptional()
  accountCode: string;

  @ApiPropertyOptional()
  accountName: string;

  @ApiPropertyOptional()
  partyType?: string | null;

  @ApiPropertyOptional()
  partyId?: string | null;

  @ApiPropertyOptional()
  debit: string;

  @ApiPropertyOptional()
  credit: string;

  @ApiPropertyOptional()
  lineMemo?: string | null;

  @ApiPropertyOptional()
  createdBy?: string | null;

  @ApiPropertyOptional()
  createdOn?: Date | string | null;

  @ApiPropertyOptional()
  runningBalance?: number | null;
}

export class GlAccountSummaryDto {
  @ApiPropertyOptional()
  accountCode: string;

  @ApiPropertyOptional()
  accountName: string;

  @ApiPropertyOptional()
  accountType: string;

  @ApiPropertyOptional()
  openingBalance: number;

  @ApiPropertyOptional()
  periodDebit: number;

  @ApiPropertyOptional()
  periodCredit: number;

  @ApiPropertyOptional()
  netMovement: number;

  @ApiPropertyOptional()
  closingBalance: number;
}

export class GeneralLedgerResponseDto {
  @ApiPropertyOptional({ type: [GlEntryResponseDto] })
  data: GlEntryResponseDto[];

  @ApiPropertyOptional()
  page: number;

  @ApiPropertyOptional()
  limit: number;

  @ApiPropertyOptional()
  total: number;

  @ApiPropertyOptional({ type: GlAccountSummaryDto })
  accountSummary?: GlAccountSummaryDto | null;
}
export class SettingsResponseDto {
  @ApiPropertyOptional()
  settingsId?: string;

  @ApiPropertyOptional({ type: [Object] })
  accountMetadataSchema?: unknown[] | null;

  @ApiPropertyOptional()
  fiscalYearStartMonth?: number;

  @ApiPropertyOptional()
  bankMatchDateToleranceDays?: number;

  @ApiPropertyOptional()
  defaultArAccountId?: string | null;

  @ApiPropertyOptional()
  defaultApAccountId?: string | null;

  @ApiPropertyOptional()
  defaultRevenueAccountId?: string | null;

  @ApiPropertyOptional()
  defaultCogsAccountId?: string | null;

  @ApiPropertyOptional()
  defaultSalesTaxAccountId?: string | null;

  @ApiPropertyOptional()
  defaultPurchaseTaxAccountId?: string | null;

  @ApiPropertyOptional()
  defaultExpenseAccountId?: string | null;

  @ApiPropertyOptional()
  defaultInventoryAccountId?: string | null;

  @ApiPropertyOptional()
  defaultGrniAccountId?: string | null;

  @ApiPropertyOptional()
  defaultShrinkageAccountId?: string | null;

  @ApiPropertyOptional()
  defaultPpvAccountId?: string | null;

  @ApiPropertyOptional()
  defaultFeeRevenueAccountId?: string | null;

  @ApiPropertyOptional()
  defaultDiscountsReceivedAccountId?: string | null;

  @ApiPropertyOptional()
  defaultDiscountsGivenAccountId?: string | null;

  @ApiPropertyOptional()
  defaultCostCenterId?: string | null;

  @ApiPropertyOptional()
  defaultActivityId?: string | null;

  @ApiPropertyOptional()
  realisedFxGainAccountId?: string | null;

  @ApiPropertyOptional()
  realisedFxLossAccountId?: string | null;

  @ApiPropertyOptional()
  unrealisedFxGainAccountId?: string | null;

  @ApiPropertyOptional()
  unrealisedFxLossAccountId?: string | null;

  @ApiPropertyOptional()
  baseCurrency?: string;

  @ApiPropertyOptional({ type: [String] })
  supportedBatchPaymentFormats?: string[];

  @ApiPropertyOptional()
  revenueRoutingPrecedence?: string;

  @ApiPropertyOptional()
  expenseRoutingPrecedence?: string;
}

export class UpdateGlSettingsDto {
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  accountMetadataSchema?: unknown[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fiscalYearStartMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bankMatchDateToleranceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultArAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultApAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultRevenueAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultCogsAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultSalesTaxAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPurchaseTaxAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultExpenseAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultInventoryAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultGrniAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultShrinkageAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPpvAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultFeeRevenueAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultDiscountsReceivedAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultDiscountsGivenAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultCostCenterId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultActivityId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  realisedFxGainAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  realisedFxLossAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unrealisedFxGainAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unrealisedFxLossAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  supportedBatchPaymentFormats?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  revenueRoutingPrecedence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expenseRoutingPrecedence?: string;
}
export class SuccessMessageResponseDto {
  success: boolean;
  message?: string;
}
export class ChartFileDto {
  @ApiProperty() filename!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) countryCode?: string;
}

export class SettingsFileDto {
  @ApiProperty() filename!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) countryCode?: string;
}

export class CreateAccountRequestDto {
  @IsString()
  @IsNotEmpty()
  accountCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  accountType!: string;

  @IsString()
  @IsOptional()
  parentAccountId?: string;

  @IsBoolean()
  @IsOptional()
  isGroup?: boolean;

  @IsBoolean()
  @IsOptional()
  isBankAccount?: boolean;

  @IsString()
  @IsOptional()
  currencyCode?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
export class UpdateAccountRequestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isBankAccount?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
export class SeedTaxRequestDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;
}
export class SeedRequestDto {
  @IsString()
  @IsOptional()
  filename?: string;
}
export class EmptyBodyDto {}

export class MatchConfirmedResponseDto {
  @ApiProperty({ description: 'Whether the match was successful' })
  success: boolean;
}

export class RunFxRevaluationDto {
  @IsString()
  @IsNotEmpty()
  revaluationDate: string;
}

export class CommitFxRevaluationDto {
  @IsString()
  @IsNotEmpty()
  revaluationDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class FxRevalCandidatesResponseDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() revaluationDate!: string;
  @ApiProperty({ type: [JournalLineDto] }) candidates!: JournalLineDto[];
}

export class FxRevalCommitResponseDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() revaluationDate!: string;
  @ApiProperty() entriesGenerated!: number;
}

// ---------------------------------------------------------------------------
// Fiscal Period Governance DTOs
// ---------------------------------------------------------------------------

export class FiscalPeriodResponseDto {
  @ApiProperty() periodId!: string;
  @ApiProperty() periodName!: string;
  @ApiProperty() fiscalYear!: number;
  @ApiProperty() periodNumber!: number;
  @ApiProperty() startDate!: string;
  @ApiProperty() endDate!: string;
  @ApiProperty({ enum: ['open', 'soft_locked', 'hard_closed'] })
  status!: 'open' | 'soft_locked' | 'hard_closed';
  @ApiPropertyOptional() lockedBy?: string | null;
  @ApiPropertyOptional() lockedAt?: string | null;
  @ApiPropertyOptional() closedBy?: string | null;
  @ApiPropertyOptional() closedAt?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() createdOn?: string | null;
  @ApiPropertyOptional() modifiedOn?: string | null;
  @ApiPropertyOptional({ type: [Object] }) events?: unknown[];
}

export class GenerateFiscalPeriodsDto {
  @ApiProperty({ description: 'Fiscal year e.g. 2026', example: 2026 })
  @IsNumber()
  fiscalYear!: number;
}

export class UpdateFiscalPeriodStatusDto {
  @ApiProperty({ enum: ['open', 'soft_locked', 'hard_closed'] })
  @IsEnum(['open', 'soft_locked', 'hard_closed'])
  status!: 'open' | 'soft_locked' | 'hard_closed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryFiscalPeriodsDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fiscalYear?: number;

  @ApiPropertyOptional({ enum: ['open', 'soft_locked', 'hard_closed'] })
  @IsOptional()
  @IsEnum(['open', 'soft_locked', 'hard_closed'])
  status?: 'open' | 'soft_locked' | 'hard_closed';
}

// ---------------------------------------------------------------------------
// Continuous Subledger Reconciliation DTOs
// ---------------------------------------------------------------------------

export class TrialBalanceZeroSumDto {
  @ApiProperty() totalDebit!: number;
  @ApiProperty() totalCredit!: number;
  @ApiProperty() netDifference!: number;
  @ApiProperty() isBalanced!: boolean;
}

export class SubledgerParityItemDto {
  @ApiProperty() controlAccountCode!: string;
  @ApiProperty() controlAccountName!: string;
  @ApiProperty() subledgerBalance!: number;
  @ApiProperty() glBalance!: number;
  @ApiProperty() drift!: number;
  @ApiProperty() isMatched!: boolean;
}

export class SubledgerReconciliationResponseDto {
  @ApiProperty() timestamp!: string;
  @ApiProperty() isOverallBalanced!: boolean;
  @ApiProperty({ type: TrialBalanceZeroSumDto })
  trialBalanceZeroSum!: TrialBalanceZeroSumDto;
  @ApiProperty({ type: SubledgerParityItemDto })
  accountsReceivable!: SubledgerParityItemDto;
  @ApiProperty({ type: SubledgerParityItemDto })
  accountsPayable!: SubledgerParityItemDto;
  @ApiProperty({ type: SubledgerParityItemDto })
  goodsReceivedNotInvoiced!: SubledgerParityItemDto;
  @ApiProperty({ type: SubledgerParityItemDto })
  perpetualInventory!: SubledgerParityItemDto;
}

// ---------------------------------------------------------------------------
// Statement of Cash Flows DTOs
// ---------------------------------------------------------------------------

export class CashFlowLineItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['operating', 'investing', 'financing'] })
  category!: 'operating' | 'investing' | 'financing';
  @ApiProperty() amount!: number;
  @ApiPropertyOptional({ type: [String] }) accountCodes?: string[];
}

export class CashFlowSectionDto {
  @ApiProperty() title!: string;
  @ApiProperty({ type: [CashFlowLineItemDto] }) lines!: CashFlowLineItemDto[];
  @ApiProperty() netCash!: number;
}

export class CashFlowReconciliationDto {
  @ApiProperty() beginningCash!: number;
  @ApiProperty() netChangeInCash!: number;
  @ApiProperty() endingCash!: number;
  @ApiProperty() glCashBalance!: number;
  @ApiProperty() drift!: number;
  @ApiProperty() isReconciled!: boolean;
}

export class CashFlowPeriodDto {
  @ApiProperty() startDate!: string;
  @ApiProperty() endDate!: string;
  @ApiPropertyOptional() periodName?: string;
  @ApiPropertyOptional() fiscalYear?: number;
  @ApiPropertyOptional() periodNumber?: number;
}

export class CashFlowStatementResponseDto {
  @ApiProperty({ type: CashFlowPeriodDto }) period!: CashFlowPeriodDto;
  @ApiProperty({ type: CashFlowSectionDto })
  operatingActivities!: CashFlowSectionDto;
  @ApiProperty({ type: CashFlowSectionDto })
  investingActivities!: CashFlowSectionDto;
  @ApiProperty({ type: CashFlowSectionDto })
  financingActivities!: CashFlowSectionDto;
  @ApiProperty({ type: CashFlowReconciliationDto })
  reconciliation!: CashFlowReconciliationDto;
  @ApiPropertyOptional({ type: () => CashFlowStatementResponseDto })
  comparativePeriod?: CashFlowStatementResponseDto;
}
