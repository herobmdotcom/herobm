import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsObject,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ExportCsvQueryDto {
  @ApiProperty({
    required: false,
    description: 'Whether to include archived/inactive records',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiProperty({
    required: false,
    description: 'Optional maximum number of records to export',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

// ---------------------------------------------------------------------------
// POST /api/setup/test-abm
// ---------------------------------------------------------------------------
export class TestAbmConnectionDto {
  @IsString()
  host: string;

  @IsString()
  database: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;
}

// ---------------------------------------------------------------------------
// POST /api/setup/test-odoo
// ---------------------------------------------------------------------------
export class TestOdooConnectionDto {
  @IsString()
  host: string;

  @IsString()
  database: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;
}

export class DbConfigDto {
  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsNumber()
  port?: number;
}

// ---------------------------------------------------------------------------
// POST /api/setup/execute-elt
// ---------------------------------------------------------------------------
export class ExecuteEltDto {
  @IsOptional()
  @IsObject()
  dbConfig?: DbConfigDto;

  @IsOptional()
  @IsString()
  @IsIn(['abm', 'odoo'])
  source?: 'abm' | 'odoo';

  @IsOptional()
  @IsBoolean()
  resumeExtraction?: boolean;

  @IsOptional()
  @IsBoolean()
  skipExtraction?: boolean;

  @IsOptional()
  @IsString()
  defaultLocationCode?: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsOptional()
  @IsString()
  defaultTaxCategoryCode?: string;

  @ApiProperty({
    description:
      'If provided, all legacy invoices (sales and purchase) with a due date before this date will be considered paid.',
    required: false,
  })
  @IsOptional()
  @IsString()
  legacyInvoicesPaidBeforeDate?: string;

  @ApiProperty({
    description:
      'Cut-off date mode for General Ledger opening balances take-on (start_of_month or current_date).',
    enum: ['start_of_month', 'current_date'],
    required: false,
    default: 'start_of_month',
  })
  @IsOptional()
  @IsIn(['start_of_month', 'current_date'])
  glCutoffMode?: 'start_of_month' | 'current_date';
}

// ---------------------------------------------------------------------------
// POST /api/setup/initialize
// ---------------------------------------------------------------------------
export class ExecuteSetupDto {
  /** Transient DB Config mapping overridable from the UI test phase */
  @IsOptional()
  @IsObject()
  dbConfig?: DbConfigDto;

  /** COA preset filename, e.g. 'au_standard.json' */
  @IsString()
  coaPreset: string;

  /** ISO currency code, e.g. 'AUD' */
  @IsString()
  baseCurrency: string;

  /** Month (1-12) the fiscal year starts */
  @IsNumber()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth: number;

  /** Inventory valuation method */
  @IsIn(['weighted_average', 'fifo', 'standard'])
  inventoryValuationMethod: string;

  /** Inventory accounting mode */
  @IsIn(['periodic', 'perpetual'])
  inventoryAccountingMode: string;

  /** Revenue routing precedence */
  @IsIn(['product_first', 'customer_first'])
  revenueRoutingPrecedence: string;

  /** Expense routing precedence */
  @IsIn(['product_first', 'supplier_first'])
  expenseRoutingPrecedence: string;

  // --- Default fulfillment location ---
  /** Location code (e.g. 'MAIN'). Required for sterile setup. */
  @IsOptional()
  @IsString()
  defaultLocationCode?: string;

  /** Location name (e.g. 'Main Warehouse'). Required for sterile setup. */
  @IsOptional()
  @IsString()
  defaultLocationName?: string;

  /** Existing location UUID (from ABM import preview). */
  @IsOptional()
  @IsString()
  defaultLocationId?: string;

  // --- Organization details ---
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsOptional()
  @IsString()
  companyPhone?: string;

  @IsOptional()
  @IsString()
  companyEmail?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  // --- Import Source ---
  /** Source pipeline to run for initial setup */
  @IsOptional()
  @IsString()
  @IsIn(['abm', 'odoo'])
  source?: 'abm' | 'odoo';

  /** If true, skips data extraction for tables that completed gracefully on a previous attempt */
  @IsOptional()
  @IsBoolean()
  resumeExtraction?: boolean;

  /** If true, skips data extraction entirely */
  @IsOptional()
  @IsBoolean()
  skipExtraction?: boolean;

  /** Required when re-running setup on an already-completed instance */
  @IsOptional()
  @IsString()
  confirmReset?: string;
}

// ---------------------------------------------------------------------------
// Setup Response DTOs
// ---------------------------------------------------------------------------

export class TestConnectionResultDto {
  @ApiProperty()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty({ required: false })
  @IsOptional()
  preview?: Record<string, unknown>;
}

export class ResumeStateDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  completedTables: string[];
}

export class JobResultDto {
  @ApiProperty()
  @IsString()
  jobId: string;
}

export class ImportSummaryDto {
  @ApiProperty()
  @IsNumber()
  products: number;

  @ApiProperty()
  @IsNumber()
  customers: number;

  @ApiProperty()
  @IsNumber()
  orders: number;
}

export interface ActiveJob {
  status: string;
  type: string;
  progress: { step: number; name: string; status: string }[];
  logs: string[];
  lastActivityAt: number;
}

export interface MetadataSchema {
  type?: string;
  properties?: Record<string, unknown>;
}

export class ActiveJobDto {
  @ApiProperty({ required: false, nullable: true })
  jobId: string | null;

  @ApiProperty({ required: false, nullable: true })
  type: string | null;
}

export class CsvMetadataDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  uniqueKey: string;

  @IsString({ each: true })
  columns: string[];
}

export class ExecuteCsvDto {
  @IsString()
  tableName: string;

  @IsString()
  strategy: string;
}

export class JobProgressDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiProperty({ type: [Object], required: false })
  @IsArray()
  progress: Record<string, unknown>[];

  @ApiProperty({ type: [String] })
  @IsArray()
  logs: string[];
}

export class SetupValidationDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiProperty({ type: Object, required: false })
  @IsObject()
  metrics: Record<string, unknown>;

  @ApiProperty({ type: Object, required: false })
  @IsObject()
  dataCounts: Record<string, number>;
}

export class SuccessResponseDto {
  @ApiProperty()
  @IsBoolean()
  success: boolean;
}
