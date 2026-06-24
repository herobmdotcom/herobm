import { calculateAgedTotals, AgedBalanceRow } from './accounting';

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
});
