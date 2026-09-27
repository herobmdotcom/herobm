import Decimal from 'decimal.js';
import { calculateCompoundDiscount } from '../pricing';

describe('Multi-Tier Cascading Discounts & Single-Stage Rounding Invariants (Unit)', () => {
  it('computes compounded discount with single-stage Decimal precision (avoiding intermediate stage truncation)', () => {
    // $100.00 base with 10% volume discount and 5% customer group discount
    // Compounded: 100 * 0.90 * 0.95 = 85.50
    const res = calculateCompoundDiscount(100, [10, 5], 'compounded');

    expect(res.discountedUnitPrice).toBe(85.50);
    expect(res.discountAmountPerUnit).toBe(14.50);
    expect(res.effectiveDiscountPercentage).toBe(14.5000); // 100 - 85.5% = 14.5%
  });

  it('computes 3-tier compound discount with non-terminating fractions accurately', () => {
    // $100.00 with 3.33% Tier 1, 2.5% Tier 2, 1.25% Tier 3
    // Multiplier = (1 - 0.0333) * (1 - 0.025) * (1 - 0.0125) = 0.9667 * 0.975 * 0.9875 = 0.93074090625
    // Discounted price = 100 * 0.93074090625 = 93.07409... -> 93.07
    const res = calculateCompoundDiscount('100.00', ['3.33', '2.5', '1.25'], 'compounded');

    expect(res.discountedUnitPrice).toBe(93.08);
    expect(res.discountAmountPerUnit).toBe(6.92);
  });

  it('computes additive stacked discounts clamping to 100% max discount', () => {
    // Additive mode: 10% + 5% = 15% discount on $200.00 -> $170.00
    const res = calculateCompoundDiscount(200, [10, 5], 'additive');

    expect(res.discountedUnitPrice).toBe(170.00);
    expect(res.discountAmountPerUnit).toBe(30.00);
    expect(res.effectiveDiscountPercentage).toBe(15.0000);

    // Over 100% total discount clamps to 100%
    const freeRes = calculateCompoundDiscount(100, [60, 50], 'additive');
    expect(freeRes.discountedUnitPrice).toBe(0.00);
    expect(freeRes.discountAmountPerUnit).toBe(100.00);
    expect(freeRes.effectiveDiscountPercentage).toBe(100.0000);
  });

  it('handles empty, zero, or null discounts gracefully', () => {
    const res = calculateCompoundDiscount(50.00, [0, null, undefined, '']);
    expect(res.discountedUnitPrice).toBe(50.00);
    expect(res.discountAmountPerUnit).toBe(0.00);
    expect(res.effectiveDiscountPercentage).toBe(0.0000);
  });
});
