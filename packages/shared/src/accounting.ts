import Decimal from 'decimal.js';

export const GL_ACCOUNT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const;

export type GLAccountType = typeof GL_ACCOUNT_TYPE[keyof typeof GL_ACCOUNT_TYPE];

export const GL_REPORT_CATEGORY = {
  // Assets
  CASH_AND_BANK: 'cash_and_bank',
  ACCOUNTS_RECEIVABLE: 'accounts_receivable',
  INVENTORY: 'inventory',
  CURRENT_ASSET: 'current_asset',
  FIXED_ASSET: 'fixed_asset',
  ACCUMULATED_DEPRECIATION: 'accumulated_depreciation',
  NON_CURRENT_ASSET: 'non_current_asset',
  INTANGIBLE_ASSET: 'intangible_asset',

  // Liabilities
  ACCOUNTS_PAYABLE: 'accounts_payable',
  TAX_LIABILITY: 'tax_liability',
  PAYROLL_LIABILITY: 'payroll_liability',
  CURRENT_LIABILITY: 'current_liability',
  LONG_TERM_DEBT: 'long_term_debt',
  NON_CURRENT_LIABILITY: 'non_current_liability',

  // Equity
  SHARE_CAPITAL: 'share_capital',
  RETAINED_EARNINGS: 'retained_earnings',
  CURRENT_EARNINGS: 'current_earnings',
  DRAWINGS: 'drawings',
  SUSPENSE: 'suspense',
  OTHER_EQUITY: 'other_equity',

  // Revenue
  OPERATING_REVENUE: 'operating_revenue',
  OTHER_REVENUE: 'other_revenue',
  SALES_DISCOUNT: 'sales_discount',

  // Expenses
  COST_OF_GOODS_SOLD: 'cost_of_goods_sold',
  OPERATING_EXPENSE: 'operating_expense',
  PAYROLL_EXPENSE: 'payroll_expense',
  DEPRECIATION_EXPENSE: 'depreciation_expense',
  TAX_EXPENSE: 'tax_expense',
  INTEREST_EXPENSE: 'interest_expense',
  OTHER_EXPENSE: 'other_expense',
} as const;

export type GLReportCategory = (typeof GL_REPORT_CATEGORY)[keyof typeof GL_REPORT_CATEGORY];

export const JOURNAL_ENTRY_SOURCE_TYPE = {
  // System Automated Subsystems
  SALES_INVOICE: 'sales_invoice',
  SALES_INVOICE_REVERSAL: 'sales_invoice_reversal',
  PURCHASE_INVOICE: 'purchase_invoice',
  PURCHASE_INVOICE_REVERSAL: 'purchase_invoice_reversal',
  SALES_CREDIT_NOTE: 'sales_credit_note',
  PURCHASE_DEBIT_NOTE: 'purchase_debit_note',
  PAYMENT_ENTRY: 'payment_entry',
  INVENTORY_RECEIPT: 'inventory_receipt',
  INVENTORY_DISPATCH: 'inventory_dispatch',
  INVENTORY_ADJUSTMENT: 'inventory_adjustment',
  FX_REVALUATION: 'fx_revaluation',
  YEAR_END_CLOSE: 'year_end_close',

  // Migration & Setup
  INITIAL_IMPORT: 'initial_import',
  OPENING_BALANCE: 'opening_balance',

  // Manual User-Postable
  MANUAL: 'manual',
  ADJUSTMENT: 'adjustment',
  PAYROLL: 'payroll',
  TAX_SETTLEMENT: 'tax_settlement',
} as const;

export type JournalEntrySourceType =
  (typeof JOURNAL_ENTRY_SOURCE_TYPE)[keyof typeof JOURNAL_ENTRY_SOURCE_TYPE];

/** Source types that a user can select when creating a manual journal entry */
export const USER_SELECTABLE_JOURNAL_SOURCE_TYPES = [
  JOURNAL_ENTRY_SOURCE_TYPE.MANUAL,
  JOURNAL_ENTRY_SOURCE_TYPE.OPENING_BALANCE,
  JOURNAL_ENTRY_SOURCE_TYPE.ADJUSTMENT,
  JOURNAL_ENTRY_SOURCE_TYPE.PAYROLL,
  JOURNAL_ENTRY_SOURCE_TYPE.TAX_SETTLEMENT,
] as const;

/** Source types that represent balance take-on / migration (excluded from period operational cash flows) */
export const TAKE_ON_JOURNAL_SOURCE_TYPES = [
  JOURNAL_ENTRY_SOURCE_TYPE.INITIAL_IMPORT,
  JOURNAL_ENTRY_SOURCE_TYPE.OPENING_BALANCE,
] as const;

export interface AgedBalanceRow {
  current?: number;
  days1To30?: number;
  days31To60?: number;
  days61To90?: number;
  days90Plus?: number;
  totalOutstanding?: number;
}

export interface AgedTotals {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalOutstanding: number;
}

/**
 * Calculates the sums for a list of aged balances.
 * Total Outstanding is calculated as the sum of all aging buckets to ensure it perfectly adds up.
 */
export function calculateAgedTotals(balances: AgedBalanceRow[]): AgedTotals {
  let current = new Decimal(0);
  let days1To30 = new Decimal(0);
  let days31To60 = new Decimal(0);
  let days61To90 = new Decimal(0);
  let days90Plus = new Decimal(0);

  for (const row of balances) {
    current = current.plus(row.current || 0);
    days1To30 = days1To30.plus(row.days1To30 || 0);
    days31To60 = days31To60.plus(row.days31To60 || 0);
    days61To90 = days61To90.plus(row.days61To90 || 0);
    days90Plus = days90Plus.plus(row.days90Plus || 0);
  }

  // Round values to 2 decimal places to avoid floating point drift
  const roundedCurrent = current.toDecimalPlaces(2);
  const roundedDays1To30 = days1To30.toDecimalPlaces(2);
  const roundedDays31To60 = days31To60.toDecimalPlaces(2);
  const roundedDays61To90 = days61To90.toDecimalPlaces(2);
  const roundedDays90Plus = days90Plus.toDecimalPlaces(2);

  // Total outstanding is explicitly the sum of the buckets
  const totalOutstanding = roundedCurrent
    .plus(roundedDays1To30)
    .plus(roundedDays31To60)
    .plus(roundedDays61To90)
    .plus(roundedDays90Plus)
    .toDecimalPlaces(2);

  return {
    current: roundedCurrent.toNumber(),
    days1To30: roundedDays1To30.toNumber(),
    days31To60: roundedDays31To60.toNumber(),
    days61To90: roundedDays61To90.toNumber(),
    days90Plus: roundedDays90Plus.toNumber(),
    totalOutstanding: totalOutstanding.toNumber(),
  };
}

/**
 * Determines if an account type is debit-normal (Asset, Expense) or credit-normal (Liability, Equity, Revenue).
 */
export function isDebitNormalAccount(accountType?: string | null): boolean {
  if (!accountType) return true;
  const normalized = accountType.toLowerCase();
  return normalized === GL_ACCOUNT_TYPE.ASSET || normalized === GL_ACCOUNT_TYPE.EXPENSE;
}

/**
 * Computes net signed balance for an account based on debit/credit activity.
 * Returns standard debit-positive (debit - credit) by default.
 */
export function computeAccountNetBalance(
  debit: number | string | null | undefined,
  credit: number | string | null | undefined,
): number {
  const d = new Decimal(debit || 0).toDecimalPlaces(2);
  const c = new Decimal(credit || 0).toDecimalPlaces(2);
  return d.minus(c).toDecimalPlaces(2).toNumber();
}

export interface RunningBalanceInputLine {
  debit?: number | string | null;
  credit?: number | string | null;
  [key: string]: unknown;
}

export interface AccountPeriodSummary {
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  netMovement: number;
  closingBalance: number;
}

/**
 * Computes chronological row-by-row running balance and period summary.
 * Inputs are processed chronologically (oldest to newest).
 * Precision is anchored at 2 decimal places per step to prevent IEEE-754 floating point drift.
 */
export function computeRunningBalances<T extends RunningBalanceInputLine>(
  openingBalance: number | string = 0,
  lines: T[] = [],
): {
  lines: (T & { runningBalance: number })[];
  summary: AccountPeriodSummary;
} {
  const initial = new Decimal(openingBalance || 0).toDecimalPlaces(2);
  let running = initial;
  let periodDebit = new Decimal(0);
  let periodCredit = new Decimal(0);

  const resultLines = lines.map((line) => {
    const d = new Decimal(line.debit || 0).toDecimalPlaces(2);
    const c = new Decimal(line.credit || 0).toDecimalPlaces(2);
    periodDebit = periodDebit.plus(d);
    periodCredit = periodCredit.plus(c);
    running = running.plus(d).minus(c).toDecimalPlaces(2);

    return {
      ...line,
      runningBalance: running.toNumber(),
    };
  });

  const roundedPeriodDebit = periodDebit.toDecimalPlaces(2);
  const roundedPeriodCredit = periodCredit.toDecimalPlaces(2);
  const netMovement = roundedPeriodDebit.minus(roundedPeriodCredit).toDecimalPlaces(2);
  const closingBalance = initial.plus(netMovement).toDecimalPlaces(2);

  return {
    lines: resultLines,
    summary: {
      openingBalance: initial.toNumber(),
      periodDebit: roundedPeriodDebit.toNumber(),
      periodCredit: roundedPeriodCredit.toNumber(),
      netMovement: netMovement.toNumber(),
      closingBalance: closingBalance.toNumber(),
    },
  };
}

