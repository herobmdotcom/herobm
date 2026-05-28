import { ApiPropertyOptional } from '@nestjs/swagger';
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
  accountId: string;
  accountCode: string;
  name: string;
  accountType: string;
  isGroup: boolean;
  isActive: boolean;
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
  accountMetadataSchema?: Record<string, any>;
}
export class SuccessMessageResponseDto {
  success: boolean;
  message?: string;
}
export class ArrayResponseDto {
  items: any[];
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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

export class PaginatedJournalEntriesDto {
  data!: JournalEntryResponseDto[];
  meta!: any;
}

export class PaginatedGeneralLedgerDto {
  data!: GeneralLedgerResponseDto[];
  meta!: any;
}

export class UpdateGLSettingsDto {
  // Allow dynamic key-value configuration settings
  [key: string]: any;
}
