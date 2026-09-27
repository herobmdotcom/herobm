import Decimal from 'decimal.js';
import { toDecimal, roundCurrency, eqMoney } from '../pricing';

describe('Drizzle Numeric Coercion Invariants (Unit)', () => {
  it('demonstrates float precision failure on Drizzle numeric string arithmetic vs Decimal precision', () => {
    // Drizzle returns numeric columns as strings:
    const dbRateStr = '0.29';
    const dbQtyStr = '100';

    // Native JS string-coercion float arithmetic failure:
    // 0.29 * 100 in JS float math produces 28.999999999999996
    const floatResult = Number(dbRateStr) * Number(dbQtyStr);
    expect(floatResult).not.toBe(29);
    expect(floatResult.toString()).toBe('28.999999999999996');

    // Decimal exact arithmetic:
    const decimalResult = toDecimal(dbRateStr).times(toDecimal(dbQtyStr));

    expect(decimalResult.toNumber()).toBe(29);
    expect(roundCurrency(decimalResult)).toBe(29);
    expect(eqMoney(decimalResult, 29)).toBe(true);
  });

  it('demonstrates string concatenation bug when adding without Decimal conversion', () => {
    const dbSubtotalStr = '100.00';
    const dbFreightStr = '15.50';

    // Native binary addition on strings concatenates instead of adding!
    const naiveSum = dbSubtotalStr + dbFreightStr;
    expect(naiveSum).toBe('100.0015.50');

    // With Decimal:
    const safeSum = toDecimal(dbSubtotalStr).plus(toDecimal(dbFreightStr));
    expect(safeSum.toNumber()).toBe(115.5);
    expect(roundCurrency(safeSum)).toBe(115.5);
  });

  it('handles cumulative aggregation across multi-line Drizzle rows without drift', () => {
    const lines = [
      { unitPrice: '19.99', quantity: '3', taxAmount: '5.997' },
      { unitPrice: '4.95', quantity: '7', taxAmount: '3.465' },
      { unitPrice: '0.07', quantity: '1000', taxAmount: '7.00' },
    ];

    let totalDecimal = new Decimal(0);
    for (const line of lines) {
      const lineNet = toDecimal(line.unitPrice).times(toDecimal(line.quantity));
      const lineGross = lineNet.plus(toDecimal(line.taxAmount));
      totalDecimal = totalDecimal.plus(lineGross);
    }

    expect(roundCurrency(totalDecimal)).toBe(181.08);
  });
});
