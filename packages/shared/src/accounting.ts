export const GL_ACCOUNT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const;

export type GLAccountType = typeof GL_ACCOUNT_TYPE[keyof typeof GL_ACCOUNT_TYPE];

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
  const totals = balances.reduce<AgedTotals>(
    (acc, row) => {
      acc.current += row.current || 0;
      acc.days1To30 += row.days1To30 || 0;
      acc.days31To60 += row.days31To60 || 0;
      acc.days61To90 += row.days61To90 || 0;
      acc.days90Plus += row.days90Plus || 0;
      return acc;
    },
    { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0, totalOutstanding: 0 }
  );

  // Round values to 2 decimal places to avoid floating point drift
  const current = Math.round(totals.current * 100) / 100;
  const days1To30 = Math.round(totals.days1To30 * 100) / 100;
  const days31To60 = Math.round(totals.days31To60 * 100) / 100;
  const days61To90 = Math.round(totals.days61To90 * 100) / 100;
  const days90Plus = Math.round(totals.days90Plus * 100) / 100;

  // Total outstanding is explicitly the sum of the buckets
  const totalOutstanding = Math.round((current + days1To30 + days31To60 + days61To90 + days90Plus) * 100) / 100;

  return {
    current,
    days1To30,
    days31To60,
    days61To90,
    days90Plus,
    totalOutstanding,
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
  const d = Math.round(Number(debit || 0) * 100) / 100;
  const c = Math.round(Number(credit || 0) * 100) / 100;
  return Math.round((d - c) * 100) / 100;
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
  const initial = Math.round(Number(openingBalance || 0) * 100) / 100;
  let running = initial;
  let periodDebit = 0;
  let periodCredit = 0;

  const resultLines = lines.map((line) => {
    const d = Math.round(Number(line.debit || 0) * 100) / 100;
    const c = Math.round(Number(line.credit || 0) * 100) / 100;
    periodDebit += d;
    periodCredit += c;
    running = Math.round((running + d - c) * 100) / 100;

    return {
      ...line,
      runningBalance: running,
    };
  });

  const roundedPeriodDebit = Math.round(periodDebit * 100) / 100;
  const roundedPeriodCredit = Math.round(periodCredit * 100) / 100;
  const netMovement = Math.round((roundedPeriodDebit - roundedPeriodCredit) * 100) / 100;
  const closingBalance = Math.round((initial + netMovement) * 100) / 100;

  return {
    lines: resultLines,
    summary: {
      openingBalance: initial,
      periodDebit: roundedPeriodDebit,
      periodCredit: roundedPeriodCredit,
      netMovement,
      closingBalance,
    },
  };
}

