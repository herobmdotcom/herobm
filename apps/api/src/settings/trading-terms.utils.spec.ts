import { calculateDueDate } from './trading-terms.utils';

describe('trading-terms.utils', () => {
  describe('calculateDueDate', () => {
    it('should return the invoice date for cash_on_delivery', () => {
      const invoiceDate = new Date('2026-06-15T00:00:00Z');
      const result = calculateDueDate(invoiceDate, 'cash_on_delivery', 0);
      expect(result).toEqual(invoiceDate);
    });

    it('should add days for net terms', () => {
      const invoiceDate = new Date('2026-06-15T00:00:00Z');
      const result = calculateDueDate(invoiceDate, 'net', 30);

      const expected = new Date('2026-06-15T00:00:00Z');
      expected.setDate(expected.getDate() + 30);
      expect(result).toEqual(expected);
    });

    it('should calculate end of month plus days correctly', () => {
      const invoiceDate = new Date('2026-06-15T00:00:00Z');
      const result = calculateDueDate(invoiceDate, 'end_of_month', 30);

      // End of June 2026 is June 30.
      // 30 days after June 30 is July 30.
      const expected = new Date('2026-07-30T00:00:00Z');
      expect(result).toEqual(expected);
    });

    it('should handle leap years for end of month', () => {
      const invoiceDate = new Date('2024-02-15T00:00:00Z'); // 2024 is a leap year
      const result = calculateDueDate(invoiceDate, 'end_of_month', 0);

      // End of Feb 2024 is Feb 29.
      const expected = new Date('2024-02-29T00:00:00Z');
      expect(result).toEqual(expected);
    });

    it('should fallback to net for unknown term type', () => {
      const invoiceDate = new Date('2026-06-15T00:00:00Z');
      const result = calculateDueDate(invoiceDate, 'unknown', 15);

      const expected = new Date('2026-06-15T00:00:00Z');
      expected.setDate(expected.getDate() + 15);
      expect(result).toEqual(expected);
    });
  });
});
