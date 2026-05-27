import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsObject,
  IsBoolean,
} from 'class-validator';

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
  abmImport?: boolean;

  @IsOptional()
  odooImport?: boolean;

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

  /** Non-stock billing mode */
  @IsIn(['per_shipment', 'final_invoice'])
  nonStockBillingMode: string;

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

  // --- ABM import ---
  /** If true, run the ABM extraction + import pipeline */
  @IsOptional()
  abmImport?: boolean;

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
