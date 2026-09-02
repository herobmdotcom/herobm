import {
  calculateAgedTotals,
  AgedBalanceRow,
  isDebitNormalAccount,
  computeAccountNetBalance,
  computeRunningBalances,
  GL_ACCOUNT_TYPE,
} from './accounting';

describe('accounting calculations', () => {
  describe('calculateAgedTotals', () => {
    it('should sum up aging buckets across multiple rows', () => {
      const balances: AgedBalanceRow[] = [
        { current: 100, days1To30: 50, totalOutstanding: 150 },
        { current: 200, days31To60: 75, days90Plus: 25, totalOutstanding: 300 },
        { days61To90: 100, totalOutstanding: 100 },
        {}, // Empty row to test undefined handling
      ];

      const result = calculateAgedTotals(balances);

      expect(result.current).toBe(300);
      expect(result.days1To30).toBe(50);
      expect(result.days31To60).toBe(75);
      expect(result.days61To90).toBe(100);
      expect(result.days90Plus).toBe(25);

      // Total outstanding should be explicitly the sum of the buckets
      expect(result.totalOutstanding).toBe(550);
    });

    it('should handle floating point drift correctly', () => {
      const balances: AgedBalanceRow[] = [
        { current: 0.1, days1To30: 0.2 },
      ];

      const result = calculateAgedTotals(balances);

      // 0.1 + 0.2 = 0.30000000000000004 in standard JS float, should be rounded to 0.3
      expect(result.current).toBe(0.1);
      expect(result.days1To30).toBe(0.2);
      expect(result.totalOutstanding).toBe(0.3); // Explicitly 0.3, not 0.30000000000000004
    });
  });

  describe('isDebitNormalAccount', () => {
    it('should identify asset and expense as debit normal', () => {
      expect(isDebitNormalAccount(GL_ACCOUNT_TYPE.ASSET)).toBe(true);
      expect(isDebitNormalAccount(GL_ACCOUNT_TYPE.EXPENSE)).toBe(true);
      expect(isDebitNormalAccount('ASSET')).toBe(true);
      expect(isDebitNormalAccount('Expense')).toBe(true);
    });

    it('should identify liability, equity, and revenue as credit normal', () => {
      expect(isDebitNormalAccount(GL_ACCOUNT_TYPE.LIABILITY)).toBe(false);
      expect(isDebitNormalAccount(GL_ACCOUNT_TYPE.EQUITY)).toBe(false);
      expect(isDebitNormalAccount(GL_ACCOUNT_TYPE.REVENUE)).toBe(false);
      expect(isDebitNormalAccount('liability')).toBe(false);
      expect(isDebitNormalAccount('revenue')).toBe(false);
    });

    it('should default to true if account type is undefined or null', () => {
      expect(isDebitNormalAccount(undefined)).toBe(true);
      expect(isDebitNormalAccount(null)).toBe(true);
    });
  });

  describe('computeAccountNetBalance', () => {
    it('should compute debit minus credit with 2 decimal precision', () => {
      expect(computeAccountNetBalance(100.5, 30.25)).toBe(70.25);
      expect(computeAccountNetBalance(50, 80)).toBe(-30);
    });

    it('should handle string inputs and null/undefined values', () => {
      expect(computeAccountNetBalance('150.00', '50.00')).toBe(100);
      expect(computeAccountNetBalance('200', null)).toBe(200);
      expect(computeAccountNetBalance(undefined, '75.50')).toBe(-75.5);
    });

    it('should avoid floating point drift', () => {
      expect(computeAccountNetBalance(0.3, 0.1)).toBe(0.2);
      expect(computeAccountNetBalance(1.05, 0.05)).toBe(1.0);
    });
  });

  describe('computeRunningBalances', () => {
    it('should handle empty lines array with opening balance', () => {
      const result = computeRunningBalances(1000, []);
      expect(result.lines).toEqual([]);
      expect(result.summary).toEqual({
        openingBalance: 1000,
        periodDebit: 0,
        periodCredit: 0,
        netMovement: 0,
        closingBalance: 1000,
      });
    });

    it('should accumulate running balances chronologically across lines', () => {
      const lines = [
        { id: 1, debit: 500, credit: 0 },
        { id: 2, debit: 0, credit: 200 },
        { id: 3, debit: 150, credit: 50 },
      ];

      const result = computeRunningBalances(1000, lines);

      expect(result.lines).toEqual([
        { id: 1, debit: 500, credit: 0, runningBalance: 1500 },
        { id: 2, debit: 0, credit: 200, runningBalance: 1300 },
        { id: 3, debit: 150, credit: 50, runningBalance: 1400 },
      ]);

      expect(result.summary).toEqual({
        openingBalance: 1000,
        periodDebit: 650,
        periodCredit: 250,
        netMovement: 400,
        closingBalance: 1400,
      });
    });

    it('should handle string debit and credit inputs and string opening balance', () => {
      const lines = [
        { id: 1, debit: '125.50', credit: '0.00' },
        { id: 2, debit: '0.00', credit: '25.50' },
      ];

      const result = computeRunningBalances('500.00', lines);

      expect(result.lines[0].runningBalance).toBe(625.5);
      expect(result.lines[1].runningBalance).toBe(600);
      expect(result.summary).toEqual({
        openingBalance: 500,
        periodDebit: 125.5,
        periodCredit: 25.5,
        netMovement: 100,
        closingBalance: 600,
      });
    });

    it('should resist floating point drift over many fractional calculations', () => {
      const lines = [
        { debit: 0.1, credit: 0 },
        { debit: 0.2, credit: 0 },
        { debit: 0, credit: 0.3 },
        { debit: 0.1, credit: 0.2 },
      ];

      const result = computeRunningBalances(0, lines);

      expect(result.lines[0].runningBalance).toBe(0.1);
      expect(result.lines[1].runningBalance).toBe(0.3);
      expect(result.lines[2].runningBalance).toBe(0);
      expect(result.lines[3].runningBalance).toBe(-0.1);

      expect(result.summary.closingBalance).toBe(-0.1);
    });

    it('should handle null, undefined, or missing debit/credit fields gracefully', () => {
      const lines = [
        { id: 1 },
        { id: 2, debit: null, credit: undefined },
        { id: 3, debit: 100 },
      ];

      const result = computeRunningBalances(200, lines);

      expect(result.lines[0].runningBalance).toBe(200);
      expect(result.lines[1].runningBalance).toBe(200);
      expect(result.lines[2].runningBalance).toBe(300);
      expect(result.summary.closingBalance).toBe(300);
    });
  });
});

