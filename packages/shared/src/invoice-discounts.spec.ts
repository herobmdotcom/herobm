import { calculateEarlyPaymentDiscount } from './invoice-discounts';

describe('calculateEarlyPaymentDiscount', () => {
  const baseInvoiceDate = new Date('2026-06-01T12:00:00');

  it('returns not eligible when no discount is set', () => {
    const result = calculateEarlyPaymentDiscount({
      invoiceDate: baseInvoiceDate,
      outstandingAmount: '1000',
      earlyPaymentDiscount: null,
      earlyPaymentDiscountDays: null,
    });
    
    expect(result.isEligible).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.eligibleUntil).toBeNull();
  });

  it('calculates eligible discount correctly on the exact final day', () => {
    const result = calculateEarlyPaymentDiscount({
      invoiceDate: baseInvoiceDate, // June 1st
      outstandingAmount: 1000,
      earlyPaymentDiscount: 2.5,
      earlyPaymentDiscountDays: 10,
      currentDate: new Date('2026-06-11T23:59:59'), // Exactly 10 days later
    });

    expect(result.isEligible).toBe(true);
    expect(result.discountAmount).toBe(25); // 2.5% of 1000
    expect(result.discountPercentage).toBe(2.5);
    expect(result.eligibleUntil).toEqual(new Date(baseInvoiceDate.getFullYear(), baseInvoiceDate.getMonth(), baseInvoiceDate.getDate() + 10));
  });

  it('calculates ineligible discount correctly on the day after', () => {
    const result = calculateEarlyPaymentDiscount({
      invoiceDate: baseInvoiceDate, // June 1st
      outstandingAmount: 1000,
      earlyPaymentDiscount: 2.5,
      earlyPaymentDiscountDays: 10,
      currentDate: new Date('2026-06-12T00:00:01'), // 11 days later
    });

    expect(result.isEligible).toBe(false);
    expect(result.discountAmount).toBe(25); // Still returns the amount, but sets isEligible false
  });

  it('handles string parsing correctly', () => {
    const result = calculateEarlyPaymentDiscount({
      invoiceDate: '2026-06-01T00:00:00',
      outstandingAmount: '500.50',
      earlyPaymentDiscount: '2',
      earlyPaymentDiscountDays: 14,
      currentDate: '2026-06-10T00:00:00',
    });

    expect(result.isEligible).toBe(true);
    // 2% of 500.50 = 10.01
    expect(result.discountAmount).toBe(10.01);
  });

  it('rounds safely for weird floating point amounts', () => {
    const result = calculateEarlyPaymentDiscount({
      invoiceDate: baseInvoiceDate,
      outstandingAmount: 10.55,
      earlyPaymentDiscount: 10, // 10%
      earlyPaymentDiscountDays: 5,
      currentDate: baseInvoiceDate,
    });

    // 10% of 10.55 is 1.055. Should round to 1.06 if we are standard Math.round
    expect(result.discountAmount).toBe(1.06); // 1.055 * 100 = 105.5 -> 106 / 100 = 1.06
  });
});
