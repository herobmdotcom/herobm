import Decimal from 'decimal.js';
import { computeLinePrice, computeOrderTotals } from '../pricing';

describe('Tax-Inclusive vs Tax-Exclusive Line Extraction Invariants (Unit)', () => {
  it('extracts net and tax from tax-inclusive price guaranteeing exact gross parity (Net + Tax === Gross)', () => {
    // $10.00 gross at 20% VAT
    const result = computeLinePrice({
      quantity: 1,
      pricePerUnit: 10.00,
      taxRate: 20,
      isTaxInclusive: true,
    });

    // Net = 10 / 1.20 = 8.3333... -> 8.33
    expect(result.amount).toBe(8.33);
    // Tax = 10.00 - 8.33 = 1.67
    expect(result.tax).toBe(1.67);
    // Total Amount = 10.00 exactly
    expect(result.totalAmount).toBe(10.00);

    const sum = new Decimal(result.amount).plus(result.tax);
    expect(sum.toNumber()).toBe(result.totalAmount);
  });

  it('handles multi-line tax-inclusive order totals without penny drift', () => {
    // 3 lines of $10.00 gross at 20% VAT -> total gross must be $30.00 exactly
    const line1 = computeLinePrice({
      quantity: 1,
      pricePerUnit: 10.00,
      taxRate: 20,
      isTaxInclusive: true,
    });
    const line2 = computeLinePrice({
      quantity: 1,
      pricePerUnit: 10.00,
      taxRate: 20,
      isTaxInclusive: true,
    });
    const line3 = computeLinePrice({
      quantity: 1,
      pricePerUnit: 10.00,
      taxRate: 20,
      isTaxInclusive: true,
    });

    const orderTotals = computeOrderTotals([line1, line2, line3]);

    expect(orderTotals.subtotal).toBe(24.99);
    expect(orderTotals.totalTax).toBe(5.01);
    expect(orderTotals.totalAmount).toBe(30.00);
  });

  it('correctly calculates tax-inclusive price with discount applied', () => {
    // 1 item of $100.00 gross with 10% discount -> $90.00 gross at 10% GST
    const result = computeLinePrice({
      quantity: 1,
      pricePerUnit: 100.00,
      discountPercentage: 10,
      taxRate: 10,
      isTaxInclusive: true,
    });

    // Gross = $90.00
    // Net = 90 / 1.10 = 81.8181... -> 81.82
    expect(result.amount).toBe(81.82);
    // Tax = 90.00 - 81.82 = 8.18
    expect(result.tax).toBe(8.18);
    expect(result.totalAmount).toBe(90.00);
  });

  it('preserves existing tax-exclusive behavior when isTaxInclusive is false or omitted', () => {
    const result = computeLinePrice({
      quantity: 2,
      pricePerUnit: 50.00,
      taxRate: 10,
    });

    // Net = 100.00
    expect(result.amount).toBe(100.00);
    // Tax = 100 * 0.10 = 10.00
    expect(result.tax).toBe(10.00);
    // Gross = 110.00
    expect(result.totalAmount).toBe(110.00);
  });
});
