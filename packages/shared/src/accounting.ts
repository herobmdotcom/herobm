export const GL_ACCOUNT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const;

export type GLAccountType = typeof GL_ACCOUNT_TYPE[keyof typeof GL_ACCOUNT_TYPE];

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
