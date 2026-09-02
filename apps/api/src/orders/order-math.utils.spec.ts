import {
  getAvailableToInvoice,
  getAvailableToCredit,
} from './order-math.utils';

describe('order-math.utils', () => {
  describe('getAvailableToInvoice', () => {
    it('returns shipped minus invoiced for standard workflow', () => {
      expect(getAvailableToInvoice(10, 0, 0)).toBe(10);
      expect(getAvailableToInvoice(10, 5, 0)).toBe(5);
      expect(getAvailableToInvoice(10, 10, 0)).toBe(0);
    });

    it('reduces invoiceable amount by refunded quantity', () => {
      // Ship 10, return 2 for refund
      expect(getAvailableToInvoice(10, 0, 2)).toBe(8);
      // Ship 10, invoice 5, return 2 for refund
      expect(getAvailableToInvoice(10, 5, 2)).toBe(3);
    });

    it('never returns negative values', () => {
      expect(getAvailableToInvoice(10, 10, 2)).toBe(0);
    });
  });

  describe('getAvailableToCredit', () => {
    it('returns 0 if nothing has been invoiced', () => {
      expect(getAvailableToCredit(10, 0, 5, 0)).toBe(0);
    });

    it('returns 0 if they kept all billed items', () => {
      // Shipped 10. Invoiced 8. Refunded 2.
      // Kept 8. Billed for 8. Credit = 0.
      expect(getAvailableToCredit(10, 8, 2, 0)).toBe(0);
    });

    it('issues credit for items that were billed but returned', () => {
      // Shipped 10. Invoiced 10. Refunded 2.
      // Kept 8. Billed for 10. Credit = 2.
      expect(getAvailableToCredit(10, 10, 2, 0)).toBe(2);

      // Shipped 10. Invoiced 9. Refunded 3.
      // Kept 7. Billed for 9. Credit = 2.
      expect(getAvailableToCredit(10, 9, 3, 0)).toBe(2);
    });

    it('subtracts previously issued credits', () => {
      // Shipped 10. Invoiced 10. Refunded 5. Credited 3 already.
      // Kept 5. Billed 10. Needs 5 total. Since 3 given, owes 2.
      expect(getAvailableToCredit(10, 10, 5, 3)).toBe(2);
    });

    it('handles multiple progressive refunds naturally', () => {
      // Time 0: Shipped 10, Invoiced 10.
      // Return 1: 3 refunded.
      expect(getAvailableToCredit(10, 10, 3, 0)).toBe(3);

      // Return 2: 2 more refunded (total 5). Previous credit was 3.
      expect(getAvailableToCredit(10, 10, 5, 3)).toBe(2);
    });

    it('handles cases where invoice happened after first return', () => {
      // Return 1: 3 refunded. Nothing invoiced yet.
      expect(getAvailableToCredit(10, 0, 3, 0)).toBe(0);

      // Invoice 7 (Max allowed: 10 shipped - 3 refunded - 0 invoiced = 7).
      // Return 2: 2 more refunded. Total refunded = 5. Total invoiced = 7.
      // Kept = 10 - 5 = 5. Billed = 7. Total credit needed = 2.
      expect(getAvailableToCredit(10, 7, 5, 0)).toBe(2);
    });
  });
});
