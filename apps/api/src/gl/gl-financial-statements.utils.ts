import { Decimal } from 'decimal.js';
import { roundMoney } from '@herobm/shared';
import { DrizzleDB } from '../drizzle/drizzle.module';
import { glSettings } from '@herobm/db-schema';
import { sql } from 'drizzle-orm';
import {
  ProfitAndLossResponseDto,
  BalanceSheetResponseDto,
  FinancialStatementLineDto,
  BalanceSheetLineDto,
} from './dto';

export interface ProfitAndLossParams {
  startDate: string;
  endDate: string;
  periodName?: string;
  fiscalYear?: number;
  periodNumber?: number;
}

export interface BalanceSheetParams {
  asOfDate: string;
  periodName?: string;
  fiscalYear?: number;
}

export async function fetchProfitAndLoss(
  db: DrizzleDB,
  params: ProfitAndLossParams,
): Promise<ProfitAndLossResponseDto> {
  const { startDate, endDate, periodName, fiscalYear, periodNumber } = params;

  // 1. Fiscal Year Start Month
  const [settings] = await db
    .select({ fiscalYearStartMonth: glSettings.fiscalYearStartMonth })
    .from(glSettings)
    .limit(1);
  const fysm = settings?.fiscalYearStartMonth || 1;

  const targetDate = new Date(endDate || new Date().toISOString().slice(0, 10));
  let fyYear = targetDate.getFullYear();
  if (targetDate.getMonth() + 1 < fysm) {
    fyYear -= 1;
  }
  const financialYearStart = `${fyYear}-${String(fysm).padStart(2, '0')}-01`;

  const startDateSql = sql`${startDate}`;
  const endDateSql = sql`${endDate}`;
  const financialYearStartSql = sql`${financialYearStart}`;

  // 2. Query Revenue & Expense accounts with period and YTD movements
  // 2. Query Revenue & Expense accounts with period and YTD movements
  const query = sql`
    SELECT
      a.gl_account_id,
      a.account_code,
      a.name,
      a.account_type,
      a.report_category,
      a.metadata,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${startDateSql} AND je.entry_date <= ${endDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS period_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${startDateSql} AND je.entry_date <= ${endDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS period_credit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${endDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS ytd_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${endDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS ytd_credit
    FROM herobm_core.gl_accounts a
    LEFT JOIN herobm_core.gl_journal_lines jl ON jl.gl_account_id = a.gl_account_id
    LEFT JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
    WHERE a.is_group = false AND a.account_type IN ('revenue', 'expense')
    GROUP BY a.gl_account_id, a.account_code, a.name, a.account_type, a.report_category, a.metadata
    ORDER BY a.account_code
  `;

  const rows = await db.execute(query);
  const resultRows = Array.isArray(rows)
    ? rows
    : (rows as { rows: unknown[] }).rows || [];

  const revenueLines: FinancialStatementLineDto[] = [];
  const cogsLines: FinancialStatementLineDto[] = [];
  const opexLines: FinancialStatementLineDto[] = [];
  const otherLines: FinancialStatementLineDto[] = [];

  for (const raw of resultRows) {
    const r = raw as {
      account_code: string;
      name: string;
      account_type: string;
      report_category?: string | null;
      metadata?: Record<string, unknown> | null;
      period_debit?: string;
      period_credit?: string;
      ytd_debit?: string;
      ytd_credit?: string;
    };

    const pDr = new Decimal(r.period_debit || '0');
    const pCr = new Decimal(r.period_credit || '0');
    const yDr = new Decimal(r.ytd_debit || '0');
    const yCr = new Decimal(r.ytd_credit || '0');

    if (r.account_type === 'revenue') {
      const amount = pCr.minus(pDr).toNumber();
      const ytdAmount = yCr.minus(yDr).toNumber();
      revenueLines.push({
        accountCode: r.account_code,
        accountName: r.name,
        amount,
        ytdAmount,
      });
    } else if (r.account_type === 'expense') {
      const amount = pDr.minus(pCr).toNumber();
      const ytdAmount = yDr.minus(yCr).toNumber();

      if (r.report_category === 'cost_of_goods_sold') {
        cogsLines.push({
          accountCode: r.account_code,
          accountName: r.name,
          amount,
          ytdAmount,
        });
      } else if (
        r.report_category === 'tax_expense' ||
        r.report_category === 'interest_expense' ||
        r.report_category === 'other_expense'
      ) {
        otherLines.push({
          accountCode: r.account_code,
          accountName: r.name,
          amount,
          ytdAmount,
        });
      } else {
        opexLines.push({
          accountCode: r.account_code,
          accountName: r.name,
          amount,
          ytdAmount,
        });
      }
    }
  }

  const totalRevenue = revenueLines.reduce(
    (s, l) => new Decimal(s).plus(l.amount).toNumber(),
    0,
  );
  const ytdRevenue = revenueLines.reduce(
    (s, l) => new Decimal(s).plus(l.ytdAmount || 0).toNumber(),
    0,
  );

  const totalCogs = cogsLines.reduce(
    (s, l) => new Decimal(s).plus(l.amount).toNumber(),
    0,
  );
  const ytdCogs = cogsLines.reduce(
    (s, l) => new Decimal(s).plus(l.ytdAmount || 0).toNumber(),
    0,
  );

  const grossProfit = new Decimal(totalRevenue).minus(totalCogs).toNumber();
  const grossMarginPercentage =
    totalRevenue !== 0
      ? new Decimal(grossProfit).div(totalRevenue).mul(100).toNumber()
      : 0;

  const totalOperatingExpenses = opexLines.reduce(
    (s, l) => new Decimal(s).plus(l.amount).toNumber(),
    0,
  );
  const ytdOperatingExpenses = opexLines.reduce(
    (s, l) => new Decimal(s).plus(l.ytdAmount || 0).toNumber(),
    0,
  );

  const operatingIncome = new Decimal(grossProfit)
    .minus(totalOperatingExpenses)
    .toNumber();

  const totalOtherIncomeExpense = otherLines.reduce(
    (s, l) => new Decimal(s).plus(l.amount).toNumber(),
    0,
  );
  const ytdOtherIncomeExpense = otherLines.reduce(
    (s, l) => new Decimal(s).plus(l.ytdAmount || 0).toNumber(),
    0,
  );

  const netIncome = new Decimal(operatingIncome)
    .minus(totalOtherIncomeExpense)
    .toNumber();
  const netMarginPercentage =
    totalRevenue !== 0
      ? new Decimal(netIncome).div(totalRevenue).mul(100).toNumber()
      : 0;

  return {
    period: {
      startDate,
      endDate,
      periodName,
      fiscalYear,
      periodNumber,
    },
    revenue: {
      title: 'Revenue',
      lines: revenueLines,
      total: totalRevenue,
      ytdTotal: ytdRevenue,
    },
    costOfGoodsSold: {
      title: 'Cost of Goods Sold',
      lines: cogsLines,
      total: totalCogs,
      ytdTotal: ytdCogs,
    },
    operatingExpenses: {
      title: 'Operating Expenses',
      lines: opexLines,
      total: totalOperatingExpenses,
      ytdTotal: ytdOperatingExpenses,
    },
    otherIncomeExpense: {
      title: 'Other Income & Expenses',
      lines: otherLines,
      total: totalOtherIncomeExpense,
      ytdTotal: ytdOtherIncomeExpense,
    },
    summary: {
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPercentage,
      totalOperatingExpenses,
      operatingIncome,
      totalOtherIncomeExpense,
      netIncome,
      netMarginPercentage,
    },
  };
}

export async function fetchBalanceSheet(
  db: DrizzleDB,
  params: BalanceSheetParams,
): Promise<BalanceSheetResponseDto> {
  const { asOfDate, periodName, fiscalYear } = params;

  // 1. Fiscal Year Start Month
  const [settings] = await db
    .select({ fiscalYearStartMonth: glSettings.fiscalYearStartMonth })
    .from(glSettings)
    .limit(1);
  const fysm = settings?.fiscalYearStartMonth || 1;

  const targetDateStr = asOfDate || new Date().toISOString().slice(0, 10);
  const [yearStr, monthStr, dayStr] = targetDateStr.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);

  // MTD: from 1st of current month to target date
  const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;

  // YTD: from fiscal year start to target date
  let fyYear = yearNum;
  if (monthNum < fysm) {
    fyYear -= 1;
  }
  const financialYearStart = `${fyYear}-${String(fysm).padStart(2, '0')}-01`;

  // Last YTD: from prior fiscal year start to comparative prior year date
  const lastFinancialYearStart = `${fyYear - 1}-${String(fysm).padStart(2, '0')}-01`;
  const lastYearMaxDay = new Date(yearNum - 1, monthNum, 0).getDate();
  const compDay = Math.min(dayNum, lastYearMaxDay);
  const lastYearEndDate = `${yearNum - 1}-${String(monthNum).padStart(2, '0')}-${String(compDay).padStart(2, '0')}`;

  const asOfDateSql = asOfDate ? sql`${asOfDate}` : sql`CURRENT_DATE`;
  const monthStartSql = sql`${monthStart}`;
  const financialYearStartSql = sql`${financialYearStart}`;
  const lastFinancialYearStartSql = sql`${lastFinancialYearStart}`;
  const lastYearEndDateSql = sql`${lastYearEndDate}`;

  // 2. Query all non-group balance sheet accounts with revenue/expense for unclosed earnings
  const query = sql`
    SELECT
      a.gl_account_id,
      a.account_code,
      a.name,
      a.account_type,
      a.report_category,
      a.metadata,
      COALESCE(SUM(CASE WHEN je.entry_date <= ${asOfDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS total_debit,
      COALESCE(SUM(CASE WHEN je.entry_date <= ${asOfDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS total_credit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${monthStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS mtd_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${monthStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS mtd_credit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS ytd_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS ytd_credit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${lastFinancialYearStartSql} AND je.entry_date <= ${lastYearEndDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS last_ytd_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${lastFinancialYearStartSql} AND je.entry_date <= ${lastYearEndDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS last_ytd_credit
    FROM herobm_core.gl_accounts a
    LEFT JOIN herobm_core.gl_journal_lines jl ON jl.gl_account_id = a.gl_account_id
    LEFT JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
    WHERE a.is_group = false
    GROUP BY a.gl_account_id, a.account_code, a.name, a.account_type, a.report_category, a.metadata
    ORDER BY a.account_code
  `;

  const rows = await db.execute(query);
  const resultRows = Array.isArray(rows)
    ? rows
    : (rows as { rows: unknown[] }).rows || [];

  const currentAssets: BalanceSheetLineDto[] = [];
  const nonCurrentAssets: BalanceSheetLineDto[] = [];
  const currentLiabilities: BalanceSheetLineDto[] = [];
  const nonCurrentLiabilities: BalanceSheetLineDto[] = [];
  const equityLines: BalanceSheetLineDto[] = [];

  let totalRevenueCr = 0;
  let totalRevenueDr = 0;
  let totalExpenseDr = 0;
  let totalExpenseCr = 0;

  let mtdRevenueCr = 0;
  let mtdRevenueDr = 0;
  let mtdExpenseDr = 0;
  let mtdExpenseCr = 0;

  let ytdRevenueCr = 0;
  let ytdRevenueDr = 0;
  let ytdExpenseDr = 0;
  let ytdExpenseCr = 0;

  let lastYtdRevenueCr = 0;
  let lastYtdRevenueDr = 0;
  let lastYtdExpenseDr = 0;
  let lastYtdExpenseCr = 0;

  for (const raw of resultRows) {
    const r = raw as {
      account_code: string;
      name: string;
      account_type: string;
      report_category?: string | null;
      metadata?: Record<string, unknown> | null;
      total_debit?: string;
      total_credit?: string;
      mtd_debit?: string;
      mtd_credit?: string;
      ytd_debit?: string;
      ytd_credit?: string;
      last_ytd_debit?: string;
      last_ytd_credit?: string;
    };

    const dr = new Decimal(r.total_debit || '0');
    const cr = new Decimal(r.total_credit || '0');

    const mtdDr = new Decimal(r.mtd_debit || '0');
    const mtdCr = new Decimal(r.mtd_credit || '0');

    const ytdDr = new Decimal(r.ytd_debit || '0');
    const ytdCr = new Decimal(r.ytd_credit || '0');

    const lastYtdDr = new Decimal(r.last_ytd_debit || '0');
    const lastYtdCr = new Decimal(r.last_ytd_credit || '0');

    if (r.account_type === 'asset') {
      const balance = dr.minus(cr).toNumber();
      const movementMtd = mtdDr.minus(mtdCr).toNumber();
      const movementYtd = ytdDr.minus(ytdCr).toNumber();
      const movementLastYtd = lastYtdDr.minus(lastYtdCr).toNumber();

      const isNonCurrent =
        r.report_category === 'fixed_asset' ||
        r.report_category === 'accumulated_depreciation' ||
        r.report_category === 'non_current_asset' ||
        r.report_category === 'intangible_asset';

      if (!isNonCurrent) {
        currentAssets.push({
          accountCode: r.account_code,
          accountName: r.name,
          balance,
          movementMtd,
          movementYtd,
          movementLastYtd,
        });
      } else {
        nonCurrentAssets.push({
          accountCode: r.account_code,
          accountName: r.name,
          balance,
          movementMtd,
          movementYtd,
          movementLastYtd,
        });
      }
    } else if (r.account_type === 'liability') {
      const balance = cr.minus(dr).toNumber();
      const movementMtd = mtdCr.minus(mtdDr).toNumber();
      const movementYtd = ytdCr.minus(ytdDr).toNumber();
      const movementLastYtd = lastYtdCr.minus(lastYtdDr).toNumber();

      const isNonCurrent =
        r.report_category === 'long_term_debt' ||
        r.report_category === 'non_current_liability';

      if (!isNonCurrent) {
        currentLiabilities.push({
          accountCode: r.account_code,
          accountName: r.name,
          balance,
          movementMtd,
          movementYtd,
          movementLastYtd,
        });
      } else {
        nonCurrentLiabilities.push({
          accountCode: r.account_code,
          accountName: r.name,
          balance,
          movementMtd,
          movementYtd,
          movementLastYtd,
        });
      }
    } else if (r.account_type === 'equity') {
      const balance = cr.minus(dr).toNumber();
      const movementMtd = mtdCr.minus(mtdDr).toNumber();
      const movementYtd = ytdCr.minus(ytdDr).toNumber();
      const movementLastYtd = lastYtdCr.minus(lastYtdDr).toNumber();

      equityLines.push({
        accountCode: r.account_code,
        accountName: r.name,
        balance,
        movementMtd,
        movementYtd,
        movementLastYtd,
      });
    } else if (r.account_type === 'revenue') {
      totalRevenueCr = new Decimal(totalRevenueCr).plus(cr).toNumber();
      totalRevenueDr = new Decimal(totalRevenueDr).plus(dr).toNumber();
      mtdRevenueCr = new Decimal(mtdRevenueCr).plus(mtdCr).toNumber();
      mtdRevenueDr = new Decimal(mtdRevenueDr).plus(mtdDr).toNumber();
      ytdRevenueCr = new Decimal(ytdRevenueCr).plus(ytdCr).toNumber();
      ytdRevenueDr = new Decimal(ytdRevenueDr).plus(ytdDr).toNumber();
      lastYtdRevenueCr = new Decimal(lastYtdRevenueCr)
        .plus(lastYtdCr)
        .toNumber();
      lastYtdRevenueDr = new Decimal(lastYtdRevenueDr)
        .plus(lastYtdDr)
        .toNumber();
    } else if (r.account_type === 'expense') {
      totalExpenseDr = new Decimal(totalExpenseDr).plus(dr).toNumber();
      totalExpenseCr = new Decimal(totalExpenseCr).plus(cr).toNumber();
      mtdExpenseDr = new Decimal(mtdExpenseDr).plus(mtdDr).toNumber();
      mtdExpenseCr = new Decimal(mtdExpenseCr).plus(mtdCr).toNumber();
      ytdExpenseDr = new Decimal(ytdExpenseDr).plus(ytdDr).toNumber();
      ytdExpenseCr = new Decimal(ytdExpenseCr).plus(ytdCr).toNumber();
      lastYtdExpenseDr = new Decimal(lastYtdExpenseDr)
        .plus(lastYtdDr)
        .toNumber();
      lastYtdExpenseCr = new Decimal(lastYtdExpenseCr)
        .plus(lastYtdCr)
        .toNumber();
    }
  }

  // Current Period Earnings / Unclosed Net Income
  const netEarnings = new Decimal(totalRevenueCr)
    .minus(totalRevenueDr)
    .minus(new Decimal(totalExpenseDr).minus(totalExpenseCr))
    .toNumber();
  const mtdNetEarnings = new Decimal(mtdRevenueCr)
    .minus(mtdRevenueDr)
    .minus(new Decimal(mtdExpenseDr).minus(mtdExpenseCr))
    .toNumber();
  const ytdNetEarnings = new Decimal(ytdRevenueCr)
    .minus(ytdRevenueDr)
    .minus(new Decimal(ytdExpenseDr).minus(ytdExpenseCr))
    .toNumber();
  const lastYtdNetEarnings = new Decimal(lastYtdRevenueCr)
    .minus(lastYtdRevenueDr)
    .minus(new Decimal(lastYtdExpenseDr).minus(lastYtdExpenseCr))
    .toNumber();

  // If there are unclosed earnings, add Current Period Earnings to Equity without hardcoded code
  equityLines.push({
    accountCode: '',
    accountName: 'Current Period Earnings / Net Income',
    balance: netEarnings,
    movementMtd: mtdNetEarnings,
    movementYtd: ytdNetEarnings,
    movementLastYtd: lastYtdNetEarnings,
  });

  const totalCurrentAssets = currentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.balance).toNumber(),
    0,
  );
  const totalCurrentAssetsMtd = currentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.movementMtd || 0).toNumber(),
    0,
  );
  const totalCurrentAssetsYtd = currentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.movementYtd || 0).toNumber(),
    0,
  );
  const totalCurrentAssetsLastYtd = currentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.movementLastYtd || 0).toNumber(),
    0,
  );

  const totalNonCurrentAssets = nonCurrentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.balance).toNumber(),
    0,
  );
  const totalNonCurrentAssetsMtd = nonCurrentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.movementMtd || 0).toNumber(),
    0,
  );
  const totalNonCurrentAssetsYtd = nonCurrentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.movementYtd || 0).toNumber(),
    0,
  );
  const totalNonCurrentAssetsLastYtd = nonCurrentAssets.reduce(
    (s, l) => new Decimal(s).plus(l.movementLastYtd || 0).toNumber(),
    0,
  );

  const totalAssets = new Decimal(totalCurrentAssets)
    .plus(totalNonCurrentAssets)
    .toNumber();
  const totalAssetsMtd = new Decimal(totalCurrentAssetsMtd)
    .plus(totalNonCurrentAssetsMtd)
    .toNumber();
  const totalAssetsYtd = new Decimal(totalCurrentAssetsYtd)
    .plus(totalNonCurrentAssetsYtd)
    .toNumber();
  const totalAssetsLastYtd = new Decimal(totalCurrentAssetsLastYtd)
    .plus(totalNonCurrentAssetsLastYtd)
    .toNumber();

  const totalCurrentLiabilities = currentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.balance).toNumber(),
    0,
  );
  const totalCurrentLiabilitiesMtd = currentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.movementMtd || 0).toNumber(),
    0,
  );
  const totalCurrentLiabilitiesYtd = currentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.movementYtd || 0).toNumber(),
    0,
  );
  const totalCurrentLiabilitiesLastYtd = currentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.movementLastYtd || 0).toNumber(),
    0,
  );

  const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.balance).toNumber(),
    0,
  );
  const totalNonCurrentLiabilitiesMtd = nonCurrentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.movementMtd || 0).toNumber(),
    0,
  );
  const totalNonCurrentLiabilitiesYtd = nonCurrentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.movementYtd || 0).toNumber(),
    0,
  );
  const totalNonCurrentLiabilitiesLastYtd = nonCurrentLiabilities.reduce(
    (s, l) => new Decimal(s).plus(l.movementLastYtd || 0).toNumber(),
    0,
  );

  const totalLiabilities = new Decimal(totalCurrentLiabilities)
    .plus(totalNonCurrentLiabilities)
    .toNumber();
  const totalLiabilitiesMtd = new Decimal(totalCurrentLiabilitiesMtd)
    .plus(totalNonCurrentLiabilitiesMtd)
    .toNumber();
  const totalLiabilitiesYtd = new Decimal(totalCurrentLiabilitiesYtd)
    .plus(totalNonCurrentLiabilitiesYtd)
    .toNumber();
  const totalLiabilitiesLastYtd = new Decimal(totalCurrentLiabilitiesLastYtd)
    .plus(totalNonCurrentLiabilitiesLastYtd)
    .toNumber();

  const totalEquity = equityLines.reduce(
    (s, l) => new Decimal(s).plus(l.balance).toNumber(),
    0,
  );
  const totalEquityMtd = equityLines.reduce(
    (s, l) => new Decimal(s).plus(l.movementMtd || 0).toNumber(),
    0,
  );
  const totalEquityYtd = equityLines.reduce(
    (s, l) => new Decimal(s).plus(l.movementYtd || 0).toNumber(),
    0,
  );
  const totalEquityLastYtd = equityLines.reduce(
    (s, l) => new Decimal(s).plus(l.movementLastYtd || 0).toNumber(),
    0,
  );

  const totalLiabilitiesAndEquity = new Decimal(totalLiabilities)
    .plus(totalEquity)
    .toNumber();
  const totalLiabilitiesAndEquityMtd = new Decimal(totalLiabilitiesMtd)
    .plus(totalEquityMtd)
    .toNumber();
  const totalLiabilitiesAndEquityYtd = new Decimal(totalLiabilitiesYtd)
    .plus(totalEquityYtd)
    .toNumber();
  const totalLiabilitiesAndEquityLastYtd = new Decimal(totalLiabilitiesLastYtd)
    .plus(totalEquityLastYtd)
    .toNumber();

  const drift = new Decimal(totalAssets)
    .minus(totalLiabilitiesAndEquity)
    .toDecimalPlaces(2)
    .toNumber();
  const isBalanced = Math.abs(drift) < 0.01;

  return {
    period: {
      asOfDate,
      periodName,
      fiscalYear,
    },
    currentAssets: {
      title: 'Current Assets',
      lines: currentAssets,
      total: totalCurrentAssets,
      totalMovementMtd: totalCurrentAssetsMtd,
      totalMovementYtd: totalCurrentAssetsYtd,
      totalMovementLastYtd: totalCurrentAssetsLastYtd,
    },
    nonCurrentAssets: {
      title: 'Non-Current Assets',
      lines: nonCurrentAssets,
      total: totalNonCurrentAssets,
      totalMovementMtd: totalNonCurrentAssetsMtd,
      totalMovementYtd: totalNonCurrentAssetsYtd,
      totalMovementLastYtd: totalNonCurrentAssetsLastYtd,
    },
    currentLiabilities: {
      title: 'Current Liabilities',
      lines: currentLiabilities,
      total: totalCurrentLiabilities,
      totalMovementMtd: totalCurrentLiabilitiesMtd,
      totalMovementYtd: totalCurrentLiabilitiesYtd,
      totalMovementLastYtd: totalCurrentLiabilitiesLastYtd,
    },
    nonCurrentLiabilities: {
      title: 'Non-Current Liabilities',
      lines: nonCurrentLiabilities,
      total: totalNonCurrentLiabilities,
      totalMovementMtd: totalNonCurrentLiabilitiesMtd,
      totalMovementYtd: totalNonCurrentLiabilitiesYtd,
      totalMovementLastYtd: totalNonCurrentLiabilitiesLastYtd,
    },
    equity: {
      title: 'Equity',
      lines: equityLines,
      total: totalEquity,
      totalMovementMtd: totalEquityMtd,
      totalMovementYtd: totalEquityYtd,
      totalMovementLastYtd: totalEquityLastYtd,
    },
    validation: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      drift,
      isBalanced,
      totalAssetsMovementMtd: totalAssetsMtd,
      totalLiabilitiesAndEquityMovementMtd: totalLiabilitiesAndEquityMtd,
      totalAssetsMovementYtd: totalAssetsYtd,
      totalLiabilitiesAndEquityMovementYtd: totalLiabilitiesAndEquityYtd,
      totalAssetsMovementLastYtd: totalAssetsLastYtd,
      totalLiabilitiesAndEquityMovementLastYtd:
        totalLiabilitiesAndEquityLastYtd,
    },
  };
}

// ---------------------------------------------------------------------------
// Trial Balance Classification & Summary Utility
// ---------------------------------------------------------------------------

export function roundCurrency(val: number | string | Decimal): number {
  return roundMoney(val).toNumber();
}

export interface RawTrialBalanceItem {
  accountCode: string;
  name: string;
  accountType: string;
  openingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
  closingBalance?: number;
  ytdDebit?: number;
  ytdCredit?: number;
  ytdBalance?: number;
}

export interface ClassifiedTrialBalanceItem {
  accountCode: string;
  name: string;
  accountType: string;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  ytdDebit?: number;
  ytdCredit?: number;
  ytdBalance: number;
}

export interface ClassifiedCategory {
  categoryName: string;
  accountType: string;
  accounts: ClassifiedTrialBalanceItem[];
  subtotal: {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
    ytdDebit: number;
    ytdCredit: number;
    ytdBalance: number;
  };
}

export interface TrialBalanceClassificationResult {
  categories: ClassifiedCategory[];
  grandTotals: {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
    ytdDebit: number;
    ytdCredit: number;
    ytdBalance: number;
  };
  executiveSummary: {
    periodRevenue: number;
    periodExpenses: number;
    periodNetIncome: number;
    ytdRevenue: number;
    ytdExpenses: number;
    ytdNetIncome: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    retainedEarningsAndNetIncome: number;
    isBalanceSheetBalanced: boolean;
  };
}

export function classifyAndAggregateTrialBalance(
  rawItems: RawTrialBalanceItem[],
): TrialBalanceClassificationResult {
  const categoryOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  const categoryNameMap: Record<string, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue & Income',
    expense: 'Expenses & Cost of Goods Sold',
  };

  if (!rawItems || rawItems.length === 0) {
    return {
      categories: [],
      grandTotals: {
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: 0,
        ytdDebit: 0,
        ytdCredit: 0,
        ytdBalance: 0,
      },
      executiveSummary: {
        periodRevenue: 0,
        periodExpenses: 0,
        periodNetIncome: 0,
        ytdRevenue: 0,
        ytdExpenses: 0,
        ytdNetIncome: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        retainedEarningsAndNetIncome: 0,
        isBalanceSheetBalanced: true,
      },
    };
  }

  const items: ClassifiedTrialBalanceItem[] = rawItems.map((item) => ({
    accountCode: item.accountCode,
    name: item.name,
    accountType: item.accountType,
    openingBalance: item.openingBalance ?? 0,
    periodDebit: item.periodDebit ?? 0,
    periodCredit: item.periodCredit ?? 0,
    closingBalance: item.closingBalance ?? 0,
    ytdDebit: item.ytdDebit ?? 0,
    ytdCredit: item.ytdCredit ?? 0,
    ytdBalance: item.ytdBalance ?? 0,
  }));

  const grouped = new Map<string, ClassifiedTrialBalanceItem[]>();
  for (const item of items) {
    const list = grouped.get(item.accountType) || [];
    list.push(item);
    grouped.set(item.accountType, list);
  }

  const categories: ClassifiedCategory[] = [];
  for (const type of categoryOrder) {
    const accounts = grouped.get(type);
    if (!accounts || accounts.length === 0) continue;

    const subtotal = {
      openingBalance: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.openingBalance || 0).toNumber(),
        0,
      ),
      periodDebit: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.periodDebit || 0).toNumber(),
        0,
      ),
      periodCredit: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.periodCredit || 0).toNumber(),
        0,
      ),
      closingBalance: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.closingBalance || 0).toNumber(),
        0,
      ),
      ytdDebit: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.ytdDebit || 0).toNumber(),
        0,
      ),
      ytdCredit: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.ytdCredit || 0).toNumber(),
        0,
      ),
      ytdBalance: accounts.reduce(
        (s, a) => new Decimal(s).plus(a.ytdBalance || 0).toNumber(),
        0,
      ),
    };

    categories.push({
      categoryName: categoryNameMap[type] || type,
      accountType: type,
      accounts,
      subtotal,
    });
  }

  const grandTotals = {
    openingBalance: items.reduce(
      (s, a) => new Decimal(s).plus(a.openingBalance || 0).toNumber(),
      0,
    ),
    periodDebit: items.reduce(
      (s, a) => new Decimal(s).plus(a.periodDebit || 0).toNumber(),
      0,
    ),
    periodCredit: items.reduce(
      (s, a) => new Decimal(s).plus(a.periodCredit || 0).toNumber(),
      0,
    ),
    closingBalance: items.reduce(
      (s, a) => new Decimal(s).plus(a.closingBalance || 0).toNumber(),
      0,
    ),
    ytdDebit: items.reduce(
      (s, a) => new Decimal(s).plus(a.ytdDebit || 0).toNumber(),
      0,
    ),
    ytdCredit: items.reduce(
      (s, a) => new Decimal(s).plus(a.ytdCredit || 0).toNumber(),
      0,
    ),
    ytdBalance: items.reduce(
      (s, a) => new Decimal(s).plus(a.ytdBalance || 0).toNumber(),
      0,
    ),
  };

  const revenueAccounts = items.filter((a) => a.accountType === 'revenue');
  const expenseAccounts = items.filter((a) => a.accountType === 'expense');
  const assetAccounts = items.filter((a) => a.accountType === 'asset');
  const liabilityAccounts = items.filter((a) => a.accountType === 'liability');
  const equityAccounts = items.filter((a) => a.accountType === 'equity');

  const periodRevenue = revenueAccounts.reduce(
    (s, a) =>
      new Decimal(s)
        .plus(new Decimal(a.periodCredit || 0).minus(a.periodDebit || 0))
        .toNumber(),
    0,
  );
  const periodExpenses = expenseAccounts.reduce(
    (s, a) =>
      new Decimal(s)
        .plus(new Decimal(a.periodDebit || 0).minus(a.periodCredit || 0))
        .toNumber(),
    0,
  );
  const periodNetIncome = new Decimal(periodRevenue)
    .minus(periodExpenses)
    .toDecimalPlaces(2)
    .toNumber();

  const ytdRevenue = revenueAccounts.reduce(
    (s, a) =>
      new Decimal(s)
        .plus(new Decimal(a.ytdCredit || 0).minus(a.ytdDebit || 0))
        .toNumber(),
    0,
  );
  const ytdExpenses = expenseAccounts.reduce(
    (s, a) =>
      new Decimal(s)
        .plus(new Decimal(a.ytdDebit || 0).minus(a.ytdCredit || 0))
        .toNumber(),
    0,
  );
  const ytdNetIncome = new Decimal(ytdRevenue)
    .minus(ytdExpenses)
    .toDecimalPlaces(2)
    .toNumber();

  const totalAssets = assetAccounts.reduce(
    (s, a) => new Decimal(s).plus(a.closingBalance || 0).toNumber(),
    0,
  );
  const totalLiabilities = liabilityAccounts.reduce(
    (s, a) => new Decimal(s).plus(a.closingBalance || 0).toNumber(),
    0,
  );
  const totalEquity = equityAccounts.reduce(
    (s, a) => new Decimal(s).plus(a.closingBalance || 0).toNumber(),
    0,
  );

  const isBalanceSheetBalanced = new Decimal(totalAssets)
    .plus(totalLiabilities)
    .plus(totalEquity)
    .minus(ytdNetIncome)
    .abs()
    .lt(0.01);

  return {
    categories,
    grandTotals,
    executiveSummary: {
      periodRevenue,
      periodExpenses,
      periodNetIncome,
      ytdRevenue,
      ytdExpenses,
      ytdNetIncome,
      totalAssets,
      totalLiabilities,
      totalEquity,
      retainedEarningsAndNetIncome: ytdNetIncome,
      isBalanceSheetBalanced,
    },
  };
}
