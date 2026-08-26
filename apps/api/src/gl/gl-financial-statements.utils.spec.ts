import {
  classifyAndAggregateTrialBalance,
  roundCurrency,
  RawTrialBalanceItem,
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
      const assetCategory = result.categories.find((c) =>
        c.categoryName.includes('Assets'),
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
});
