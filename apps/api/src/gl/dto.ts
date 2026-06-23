import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
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
  @IsNumber()
  foreignDebit?: number;

  @IsOptional()
  @IsNumber()
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
  accountId: string;
  accountCode: string;
  name: string;
  balance: number;
}
export class GeneralLedgerResponseDto {
  glEntryId: string;
}
export class SettingsResponseDto {
  id: string;
  accountMetadataSchema?: Record<string, unknown>;
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

export class PaginatedJournalEntriesDto {
  data!: JournalEntryResponseDto[];
  meta!: Record<string, unknown>;
}

export class PaginatedGeneralLedgerDto {
  data!: GeneralLedgerResponseDto[];
  meta!: Record<string, unknown>;
}

export class UpdateGLSettingsDto {
  @IsOptional() @IsObject() accountMetadataSchema?: Record<string, unknown>;
  @IsOptional() @IsNumber() fiscalYearStartMonth?: number;
  @IsOptional() @IsString() defaultArAccountId?: string | null;
  @IsOptional() @IsString() defaultApAccountId?: string | null;
  @IsOptional() @IsString() defaultRevenueAccountId?: string | null;
  @IsOptional() @IsString() defaultCogsAccountId?: string | null;
  @IsOptional() @IsString() defaultTaxAccountId?: string | null;
  @IsOptional() @IsString() defaultExpenseAccountId?: string | null;
  @IsOptional() @IsString() defaultInventoryAccountId?: string | null;
  @IsOptional() @IsString() defaultGrniAccountId?: string | null;
  @IsOptional() @IsString() defaultShrinkageAccountId?: string | null;
  @IsOptional() @IsString() defaultFeeRevenueAccountId?: string | null;
  @IsOptional() @IsString() defaultDiscountsReceivedAccountId?: string | null;
  @IsOptional() @IsString() defaultDiscountsGivenAccountId?: string | null;
  @IsOptional() @IsString() defaultCostCenterId?: string | null;
  @IsOptional() @IsString() defaultActivityId?: string | null;
  @IsOptional() @IsString() realisedFxGainAccountId?: string | null;
  @IsOptional() @IsString() realisedFxLossAccountId?: string | null;
  @IsOptional() @IsString() unrealisedFxGainAccountId?: string | null;
  @IsOptional() @IsString() unrealisedFxLossAccountId?: string | null;
  @IsOptional() @IsString() baseCurrency?: string;
  @IsOptional() @IsArray() supportedBatchPaymentFormats?: string[];
  @IsOptional() @IsString() revenueRoutingPrecedence?: string;
  @IsOptional() @IsString() expenseRoutingPrecedence?: string;
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
