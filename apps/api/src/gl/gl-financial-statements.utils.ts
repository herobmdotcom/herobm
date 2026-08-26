/**
 * Centralized Financial Statement & Trial Balance Classification Utilities
 *
 * Implements standard double-entry financial statement aggregation,
 * account classification, category subtotals, grand totals, Balance Sheet,
 * and Income Statement summarization.
 */

export interface RawTrialBalanceItem {
  accountCode: string;
  name: string;
  accountType: string;
  isGroup?: boolean;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  ytdDebit?: number;
  ytdCredit?: number;
  ytdBalance: number;
}

export interface ClassifiedTrialBalanceCategory {
  categoryName: string;
  accounts: Array<{
    accountCode: string;
    name: string;
    accountType: string;
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
    ytdBalance: number;
  }>;
  subtotal: {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
    ytdBalance: number;
  };
}

export interface FinancialStatementSummary {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarningsAndNetIncome: number;
  isBalanceSheetBalanced: boolean;
  periodRevenue: number;
  periodExpenses: number;
  periodNetIncome: number;
  ytdRevenue: number;
  ytdExpenses: number;
  ytdNetIncome: number;
}

export interface ClassifiedTrialBalanceResult {
  categories: ClassifiedTrialBalanceCategory[];
  grandTotals: {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
    ytdDebit: number;
    ytdCredit: number;
    ytdBalance: number;
  };
  executiveSummary: FinancialStatementSummary;
}

/**
 * Rounds a number to 2 decimal places to avoid IEEE-754 floating point drift.
 */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Aggregates and categorizes a raw Trial Balance into classified account categories,
 * calculates subtotals and grand totals, and derives formal Balance Sheet and P&L summaries.
 */
export function classifyAndAggregateTrialBalance(
  tbRows: RawTrialBalanceItem[],
): ClassifiedTrialBalanceResult {
  const categoriesMap: Record<
    string,
    {
      categoryName: string;
      accounts: ClassifiedTrialBalanceCategory['accounts'];
      subtotal: ClassifiedTrialBalanceCategory['subtotal'];
    }
  > = {
    asset: {
      categoryName: 'Assets (1000 - 1999)',
      accounts: [],
      subtotal: {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: 0,
        ytdBalance: 0,
      },
    },
    liability: {
      categoryName: 'Liabilities (2000 - 2999)',
      accounts: [],
      subtotal: {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: 0,
        ytdBalance: 0,
      },
    },
    equity: {
      categoryName: 'Equity (3000 - 3999)',
      accounts: [],
      subtotal: {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: 0,
        ytdBalance: 0,
      },
    },
    revenue: {
      categoryName: 'Revenue & Income (4000 - 4999)',
      accounts: [],
      subtotal: {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: 0,
        ytdBalance: 0,
      },
    },
    expense: {
      categoryName: 'Expenses & COGS (5000 - 6999)',
      accounts: [],
      subtotal: {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: 0,
        ytdBalance: 0,
      },
    },
  };

  let grandOpening = 0;
  let grandPeriodDr = 0;
  let grandPeriodCr = 0;
  let grandClosing = 0;
  let grandYtdDr = 0;
  let grandYtdCr = 0;
  let grandYtd = 0;

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let periodRevenue = 0;
  let periodExpenses = 0;
  let ytdRevenue = 0;
  let ytdExpenses = 0;

  for (const r of tbRows) {
    const typeKey = (r.accountType || '').toLowerCase();
    let bucket = categoriesMap.expense;

    if (typeKey === 'asset') {
      bucket = categoriesMap.asset;
      totalAssets += r.closingBalance;
    } else if (typeKey === 'liability') {
      bucket = categoriesMap.liability;
      totalLiabilities += r.closingBalance;
    } else if (typeKey === 'equity') {
      bucket = categoriesMap.equity;
      totalEquity += r.closingBalance;
    } else if (typeKey === 'revenue' || typeKey === 'income') {
      bucket = categoriesMap.revenue;
      periodRevenue += r.periodCredit - r.periodDebit;
      ytdRevenue += (r.ytdCredit ?? 0) - (r.ytdDebit ?? 0);
    } else {
      // Expense, COGS, direct cost, overhead
      bucket = categoriesMap.expense;
      periodExpenses += r.periodDebit - r.periodCredit;
      ytdExpenses += (r.ytdDebit ?? 0) - (r.ytdCredit ?? 0);
    }

    bucket.accounts.push({
      accountCode: r.accountCode,
      name: r.name,
      accountType: r.accountType,
      openingBalance: roundCurrency(r.openingBalance),
      periodDebit: roundCurrency(r.periodDebit),
      periodCredit: roundCurrency(r.periodCredit),
      closingBalance: roundCurrency(r.closingBalance),
      ytdBalance: roundCurrency(r.ytdBalance),
    });

    bucket.subtotal.openingBalance += r.openingBalance;
    bucket.subtotal.periodDebit += r.periodDebit;
    bucket.subtotal.periodCredit += r.periodCredit;
    bucket.subtotal.closingBalance += r.closingBalance;
    bucket.subtotal.ytdBalance += r.ytdBalance;

    grandOpening += r.openingBalance;
    grandPeriodDr += r.periodDebit;
    grandPeriodCr += r.periodCredit;
    grandClosing += r.closingBalance;
    grandYtdDr += r.ytdDebit ?? 0;
    grandYtdCr += r.ytdCredit ?? 0;
    grandYtd += r.ytdBalance;
  }

  // Round subtotals
  for (const bucket of Object.values(categoriesMap)) {
    bucket.subtotal.openingBalance = roundCurrency(
      bucket.subtotal.openingBalance,
    );
    bucket.subtotal.periodDebit = roundCurrency(bucket.subtotal.periodDebit);
    bucket.subtotal.periodCredit = roundCurrency(bucket.subtotal.periodCredit);
    bucket.subtotal.closingBalance = roundCurrency(
      bucket.subtotal.closingBalance,
    );
    bucket.subtotal.ytdBalance = roundCurrency(bucket.subtotal.ytdBalance);
  }

  const categories = Object.values(categoriesMap).filter(
    (c) => c.accounts.length > 0,
  );

  const roundedPeriodRevenue = roundCurrency(periodRevenue);
  const roundedPeriodExpenses = roundCurrency(periodExpenses);
  const periodNetIncome = roundCurrency(periodRevenue - periodExpenses);

  const roundedYtdRevenue = roundCurrency(ytdRevenue);
  const roundedYtdExpenses = roundCurrency(ytdExpenses);
  const ytdNetIncome = roundCurrency(ytdRevenue - ytdExpenses);

  const roundedTotalAssets = roundCurrency(totalAssets);
  const roundedTotalLiabilities = roundCurrency(totalLiabilities);
  const roundedTotalEquity = roundCurrency(totalEquity);

  const retainedEarningsAndNetIncome = roundCurrency(
    totalLiabilities + totalEquity + ytdNetIncome,
  );

  const isBalanceSheetBalanced =
    Math.abs(roundedTotalAssets - retainedEarningsAndNetIncome) < 0.05;

  return {
    categories,
    grandTotals: {
      openingBalance: roundCurrency(grandOpening),
      periodDebit: roundCurrency(grandPeriodDr),
      periodCredit: roundCurrency(grandPeriodCr),
      closingBalance: roundCurrency(grandClosing),
      ytdDebit: roundCurrency(grandYtdDr),
      ytdCredit: roundCurrency(grandYtdCr),
      ytdBalance: roundCurrency(grandYtd),
    },
    executiveSummary: {
      totalAssets: roundedTotalAssets,
      totalLiabilities: roundedTotalLiabilities,
      totalEquity: roundedTotalEquity,
      retainedEarningsAndNetIncome,
      isBalanceSheetBalanced,
      periodRevenue: roundedPeriodRevenue,
      periodExpenses: roundedPeriodExpenses,
      periodNetIncome,
      ytdRevenue: roundedYtdRevenue,
      ytdExpenses: roundedYtdExpenses,
      ytdNetIncome,
    },
  };
}
