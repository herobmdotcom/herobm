import Decimal from 'decimal.js';
import { isCreditLimitExceeded } from '../pricing';
import { convertAmountDecimal } from '../currency';

describe('Credit Limit Boundary & Multi-Currency Evaluation Invariants (Unit)', () => {
  it('does not trigger false credit lockouts on exact limit boundary ($50,000.00 === $50,000.00)', () => {
    const limit = '50000.00';
    const outstanding = '50000.00';

    expect(isCreditLimitExceeded(outstanding, limit)).toBe(false);
  });

  it('absorbs IEEE-754 sub-penny float artifacts ($50,000.00000000001) without false lockout', () => {
    const limit = '50000.00';
    // Simulating floating point arithmetic residue
    const floatDrift = new Decimal('50000.00').plus('0.0000000000001');

    expect(isCreditLimitExceeded(floatDrift, limit)).toBe(false);
  });

  it('correctly triggers lockout when balance genuinely exceeds limit by >= $0.01', () => {
    const limit = '50000.00';
    const outstanding = '50000.01';

    expect(isCreditLimitExceeded(outstanding, limit)).toBe(true);
  });

  it('handles multi-currency conversion to base currency before evaluating limit', () => {
    // Customer has €10,000 EUR in open invoices
    // Spot rate: 1 EUR = 1.0850 USD -> Amount in USD = $10,850.00 USD
    const foreignAmount = '10000.00';
    const rates = new Map<string, string | number>([
      ['EUR', '1.00000000'],
      ['USD', '1.08500000'],
    ]);
    const baseAmount = convertAmountDecimal(
      foreignAmount,
      'EUR',
      'USD',
      'EUR',
      rates,
    );
    expect(baseAmount.toFixed(2)).toBe('10850.00');

    // Case A: Credit limit is $11,000.00 USD -> within limit
    expect(isCreditLimitExceeded(baseAmount, '11000.00')).toBe(false);

    // Case B: Credit limit is $10,850.00 USD -> exact match, not exceeded
    expect(isCreditLimitExceeded(baseAmount, '10850.00')).toBe(false);

    // Case C: Credit limit is $10,000.00 USD -> exceeded!
    expect(isCreditLimitExceeded(baseAmount, '10000.00')).toBe(true);
  });

  it('treats null, undefined, or empty credit limits as unlimited (no block)', () => {
    expect(isCreditLimitExceeded('999999.99', null)).toBe(false);
    expect(isCreditLimitExceeded('999999.99', undefined)).toBe(false);
    expect(isCreditLimitExceeded('999999.99', '')).toBe(false);
  });

  it('correctly blocks any positive balance when credit limit is explicitly set to 0.00', () => {
    expect(isCreditLimitExceeded('10.00', '0.00')).toBe(true);
    expect(isCreditLimitExceeded('0.00', '0.00')).toBe(false);
  });
});
