import Decimal from 'decimal.js';
import { toDecimal, roundCurrency } from '../pricing';

describe('Decimal & JSON API Serialization Boundary Invariants (Unit)', () => {
  it('demonstrates standard string representation of Decimal for API payloads', () => {
    const amount = new Decimal('1234.567');
    const roundedNum = roundCurrency(amount);
    expect(roundedNum).toBe(1234.57);

    const payload = {
      orderId: 'so-1001',
      totalAmount: amount.toFixed(2),
      subtotal: new Decimal('1000.00').toFixed(2),
      taxAmount: new Decimal('234.567').toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    };

    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual({
      orderId: 'so-1001',
      totalAmount: '1234.57',
      subtotal: '1000.00',
      taxAmount: '234.57',
    });

    // Deserialization on client back to Decimal
    const clientTotal = toDecimal(parsed.totalAmount);
    expect(clientTotal.toFixed(2)).toBe('1234.57');
  });

  it('ensures Decimal.toFixed(2) produces clean string values without internal {s, e, d} leakage', () => {
    const dec = new Decimal('99.99');
    const formatted = dec.toFixed(2);
    expect(typeof formatted).toBe('string');
    expect(formatted).toBe('99.99');

    const json = JSON.stringify({ price: formatted });
    expect(json).toBe('{"price":"99.99"}');
  });

  it('guarantees round-trip equality when serializing and parsing financial decimals across API boundaries', () => {
    const originalValues = ['0.00', '0.01', '100.50', '999999.99', '12.3456'];
    for (const val of originalValues) {
      const dec = toDecimal(val);
      const apiPayload = { amount: dec.toString() };
      const wireData = JSON.stringify(apiPayload);
      const received = JSON.parse(wireData);
      const reconstructed = toDecimal(received.amount);
      expect(reconstructed.equals(dec)).toBe(true);
    }
  });
});
