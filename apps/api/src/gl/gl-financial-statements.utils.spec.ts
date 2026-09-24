import {
  classifyAndAggregateTrialBalance,
  roundCurrency,
  RawTrialBalanceItem,
  fetchProfitAndLoss,
  fetchBalanceSheet,
} from './gl-financial-statements.utils';

describe('gl-financial-statements.utils', () => {
  describe('roundCurrency', () => {
    it('rounds numbers correctly to 2 decimal places', () => {
      expect(roundCurrency(10.004)).toBe(10.0);
      expect(roundCurrency(10.005)).toBe(10.01);
      expect(roundCurrency(-15.126)).toBe(-15.13);
      expect(roundCurrency(0)).toBe(0);
    });
  });

  describe('classifyAndAggregateTrialBalance', () => {
    it('handles empty trial balance gracefully', () => {
      const result = classifyAndAggregateTrialBalance([]);
      expect(result.categories).toEqual([]);
      expect(result.grandTotals.openingBalance).toBe(0);
      expect(result.grandTotals.periodDebit).toBe(0);
      expect(result.grandTotals.periodCredit).toBe(0);
      expect(result.grandTotals.closingBalance).toBe(0);
      expect(result.executiveSummary.totalAssets).toBe(0);
      expect(result.executiveSummary.totalLiabilities).toBe(0);
      expect(result.executiveSummary.totalEquity).toBe(0);
      expect(result.executiveSummary.isBalanceSheetBalanced).toBe(true);
    });

    it('classifies accounts into standard financial buckets with correct subtotals and summaries', () => {
      const sampleLedger: RawTrialBalanceItem[] = [
        {
          accountCode: '1000',
          name: 'Operating Cash',
          accountType: 'asset',
          openingBalance: 100000,
          periodDebit: 50000,
          periodCredit: 20000,
          closingBalance: 130000,
          ytdDebit: 150000,
          ytdCredit: 20000,
          ytdBalance: 130000,
        },
        {
          accountCode: '1200',
          name: 'Trade Debtors (AR)',
          accountType: 'asset',
          openingBalance: 40000,
          periodDebit: 30000,
          periodCredit: 20000,
          closingBalance: 50000,
          ytdDebit: 70000,
          ytdCredit: 20000,
          ytdBalance: 50000,
        },
        {
          accountCode: '2000',
          name: 'Trade Creditors (AP)',
          accountType: 'liability',
          openingBalance: -30000,
          periodDebit: 20000,
          periodCredit: 30000,
          closingBalance: -40000,
          ytdDebit: 40000,
          ytdCredit: 80000,
          ytdBalance: -40000,
        },
        {
          accountCode: '3000',
          name: 'Owner Equity',
          accountType: 'equity',
          openingBalance: -110000,
          periodDebit: 0,
          periodCredit: 0,
          closingBalance: -110000,
          ytdDebit: 0,
          ytdCredit: 0,
          ytdBalance: -110000,
        },
        {
          accountCode: '4000',
          name: 'Sales Revenue',
          accountType: 'revenue',
          openingBalance: 0,
          periodDebit: 0,
          periodCredit: 50000,
          closingBalance: -50000,
          ytdDebit: 0,
          ytdCredit: 100000,
          ytdBalance: -100000,
        },
        {
          accountCode: '5000',
          name: 'Cost of Goods Sold',
          accountType: 'expense',
          openingBalance: 0,
          periodDebit: 20000,
          periodCredit: 0,
          closingBalance: 20000,
          ytdDebit: 70000,
          ytdCredit: 0,
          ytdBalance: 70000,
        },
      ];

      const result = classifyAndAggregateTrialBalance(sampleLedger);

      // Verify category bucketing
      expect(result.categories.length).toBe(5);
      expect(result.categories.map((c) => c.categoryName)).toEqual([
        'Assets',
        'Liabilities',
        'Equity',
        'Revenue & Income',
        'Expenses & Cost of Goods Sold',
      ]);
      const assetCategory = result.categories.find(
        (c) => c.categoryName === 'Assets',
      );
      expect(assetCategory?.accounts.length).toBe(2);
      expect(assetCategory?.subtotal.closingBalance).toBe(180000);

      // Verify Income Statement metrics
      // Period Revenue: 50,000, Period Expenses: 20,000 => Net Income = 30,000
      expect(result.executiveSummary.periodRevenue).toBe(50000);
      expect(result.executiveSummary.periodExpenses).toBe(20000);
      expect(result.executiveSummary.periodNetIncome).toBe(30000);

      // YTD Revenue: 100,000, YTD Expenses: 70,000 => YTD Net Income = 30,000
      expect(result.executiveSummary.ytdRevenue).toBe(100000);
      expect(result.executiveSummary.ytdExpenses).toBe(70000);
      expect(result.executiveSummary.ytdNetIncome).toBe(30000);

      // Verify Balance Sheet
      // Total Assets = 180,000
      // Total Liabilities (-40,000 in credit balance) + Equity (-110,000 in credit balance) + Net Income (30,000)
      expect(result.executiveSummary.totalAssets).toBe(180000);
      expect(result.executiveSummary.totalLiabilities).toBe(-40000);
      expect(result.executiveSummary.totalEquity).toBe(-110000);

      // Grand totals check
      expect(result.grandTotals.periodDebit).toBe(120000);
      expect(result.grandTotals.periodCredit).toBe(120000);
      expect(result.grandTotals.closingBalance).toBe(0);
    });

    it('detects unbalanced balance sheets when there is an accounting anomaly', () => {
      const unbalancedLedger: RawTrialBalanceItem[] = [
        {
          accountCode: '1000',
          name: 'Cash',
          accountType: 'asset',
          openingBalance: 1000,
          periodDebit: 0,
          periodCredit: 0,
          closingBalance: 1000,
          ytdBalance: 1000,
        },
      ];

      const result = classifyAndAggregateTrialBalance(unbalancedLedger);
      expect(result.executiveSummary.isBalanceSheetBalanced).toBe(false);
    });
  });

  describe('fetchProfitAndLoss', () => {
    it('calculates Revenue, COGS, OPEX, margins and net income correctly', async () => {
      const mockDb: any = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ fiscalYearStartMonth: 1 }]),
          }),
        }),
        execute: jest.fn().mockResolvedValue([
          {
            gl_account_id: '1',
            account_code: '4000',
            name: 'Sales Revenue',
            account_type: 'revenue',
            report_category: 'operating_revenue',
            period_debit: '0',
            period_credit: '100000',
            ytd_debit: '0',
            ytd_credit: '250000',
          },
          {
            gl_account_id: '2',
            account_code: '5000',
            name: 'Cost of Goods Sold',
            account_type: 'expense',
            report_category: 'cost_of_goods_sold',
            period_debit: '40000',
            period_credit: '0',
            ytd_debit: '100000',
            ytd_credit: '0',
          },
          {
            gl_account_id: '3',
            account_code: '6000',
            name: 'Operating Expenses',
            account_type: 'expense',
            report_category: 'operating_expense',
            period_debit: '20000',
            period_credit: '0',
            ytd_debit: '50000',
            ytd_credit: '0',
          },
          {
            gl_account_id: '4',
            account_code: '7000',
            name: 'Interest Expense',
            account_type: 'expense',
            report_category: 'interest_expense',
            period_debit: '5000',
            period_credit: '0',
            ytd_debit: '10000',
            ytd_credit: '0',
          },
        ]),
      };

      const pnl = await fetchProfitAndLoss(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        periodName: '2026-08',
      });

      expect(pnl.summary.totalRevenue).toBe(100000);
      expect(pnl.summary.totalCogs).toBe(40000);
      expect(pnl.summary.grossProfit).toBe(60000);
      expect(pnl.summary.grossMarginPercentage).toBe(60);
      expect(pnl.summary.totalOperatingExpenses).toBe(20000);
      expect(pnl.summary.operatingIncome).toBe(40000);
      expect(pnl.summary.totalOtherIncomeExpense).toBe(5000);
      expect(pnl.summary.netIncome).toBe(35000);
      expect(pnl.summary.netMarginPercentage).toBe(35);
    });

    it('handles zero revenue safely without division by zero NaN errors', async () => {
      const mockDb: any = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ fiscalYearStartMonth: 1 }]),
          }),
        }),
        execute: jest.fn().mockResolvedValue([
          {
            gl_account_id: '1',
            account_code: '6000',
            name: 'Administrative Expenses',
            account_type: 'expense',
            report_category: 'operating_expense',
            period_debit: '5000',
            period_credit: '0',
          },
        ]),
      };

      const pnl = await fetchProfitAndLoss(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(pnl.summary.totalRevenue).toBe(0);
      expect(pnl.summary.grossMarginPercentage).toBe(0);
      expect(pnl.summary.netMarginPercentage).toBe(0);
      expect(pnl.summary.netIncome).toBe(-5000);
    });

    it('classifies COGS by report_category regardless of account code or name', async () => {
      const mockDb: any = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ fiscalYearStartMonth: 1 }]),
          }),
        }),
        execute: jest.fn().mockResolvedValue([
          {
            gl_account_id: '1',
            account_code: '4000',
            name: 'Consulting Revenue',
            account_type: 'revenue',
            report_category: 'operating_revenue',
            period_debit: '0',
            period_credit: '50000',
          },
          {
            gl_account_id: '2',
            account_code: '9000',
            name: 'Direct Cost of Goods Sold',
            account_type: 'expense',
            report_category: 'cost_of_goods_sold',
            period_debit: '20000',
            period_credit: '0',
          },
        ]),
      };

      const pnl = await fetchProfitAndLoss(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(pnl.costOfGoodsSold.lines).toHaveLength(1);
      expect(pnl.costOfGoodsSold.lines[0].accountName).toBe(
        'Direct Cost of Goods Sold',
      );
      expect(pnl.summary.totalCogs).toBe(20000);
      expect(pnl.summary.grossProfit).toBe(30000);
    });
  });

  describe('fetchBalanceSheet', () => {
    it('calculates assets, liabilities, equity, net earnings and parity', async () => {
      const mockDb: any = {
        execute: jest.fn().mockResolvedValue([
          {
            gl_account_id: '1',
            account_code: '1000',
            name: 'Cash & Cash Equivalents',
            account_type: 'asset',
            report_category: 'cash_and_bank',
            total_debit: '150000',
            total_credit: '50000',
          },
          {
            gl_account_id: '2',
            account_code: '2000',
            name: 'Accounts Payable',
            account_type: 'liability',
            report_category: 'accounts_payable',
            total_debit: '10000',
            total_credit: '40000',
          },
          {
            gl_account_id: '3',
            account_code: '3000',
            name: 'Share Capital',
            account_type: 'equity',
            report_category: 'share_capital',
            total_debit: '0',
            total_credit: '50000',
          },
          {
            gl_account_id: '4',
            account_code: '4000',
            name: 'Sales Revenue',
            account_type: 'revenue',
            report_category: 'operating_revenue',
            total_debit: '0',
            total_credit: '30000',
          },
          {
            gl_account_id: '5',
            account_code: '6000',
            name: 'Operating Expense',
            account_type: 'expense',
            report_category: 'operating_expense',
            total_debit: '10000',
            total_credit: '0',
          },
        ]),
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ fiscalYearStartMonth: 1 }]),
          }),
        }),
      };

      const bs = await fetchBalanceSheet(mockDb, {
        asOfDate: '2026-08-31',
      });

      // Cash = 150,000 - 50,000 = 100,000 (Current Asset)
      expect(bs.validation.totalAssets).toBe(100000);
      // AP = 40,000 - 10,000 = 30,000 (Current Liability)
      expect(bs.validation.totalLiabilities).toBe(30000);
      // Share Capital = 50,000, Current Net Earnings = 30,000 (Rev) - 10,000 (Exp) = 20,000 => Total Equity = 70,000
      expect(bs.validation.totalEquity).toBe(70000);
      expect(bs.validation.totalLiabilitiesAndEquity).toBe(100000);
      expect(bs.validation.drift).toBe(0);
      expect(bs.validation.isBalanced).toBe(true);
    });

    it('classifies Non-Current assets and Long-Term liabilities by report_category', async () => {
      const mockDb: any = {
        execute: jest.fn().mockResolvedValue([
          {
            gl_account_id: '1',
            account_code: '9100',
            name: 'Manufacturing Plant & Fixed Asset Equipment',
            account_type: 'asset',
            report_category: 'fixed_asset',
            total_debit: '80000',
            total_credit: '0',
          },
          {
            gl_account_id: '2',
            account_code: '9200',
            name: 'Long-Term Mortgage Facility',
            account_type: 'liability',
            report_category: 'long_term_debt',
            total_debit: '0',
            total_credit: '50000',
          },
          {
            gl_account_id: '3',
            account_code: '9300',
            name: 'Common Stock Equity',
            account_type: 'equity',
            report_category: 'share_capital',
            total_debit: '0',
            total_credit: '30000',
          },
        ]),
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ fiscalYearStartMonth: 1 }]),
          }),
        }),
      };

      const bs = await fetchBalanceSheet(mockDb, {
        asOfDate: '2026-08-31',
      });

      expect(bs.nonCurrentAssets.lines).toHaveLength(1);
      expect(bs.nonCurrentAssets.total).toBe(80000);
      expect(bs.currentAssets.total).toBe(0);

      expect(bs.nonCurrentLiabilities.lines).toHaveLength(1);
      expect(bs.nonCurrentLiabilities.total).toBe(50000);
      expect(bs.currentLiabilities.total).toBe(0);

      expect(bs.equity.total).toBe(30000);
      expect(bs.validation.isBalanced).toBe(true);
    });
  });
});
