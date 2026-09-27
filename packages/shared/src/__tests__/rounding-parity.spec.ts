import { Decimal } from 'decimal.js';
import {
  roundMoney,
  roundRate,
  toFinancialDecimal,
  formatMoneyString,
} from '../pricing';

describe('Rounding Strategy & PostgreSQL Parity (Decimal.ROUND_HALF_UP)', () => {
  it('should demonstrate failure of native JS Math.round and correctness of roundMoney on midpoints', () => {
    // In IEEE-754 binary floating point, 1.005 * 100 === 100.49999999999999
    const nativeJsValue = Math.round(1.005 * 100) / 100;
    // Native JS gives 1 instead of 1.01
    expect(nativeJsValue).toBe(1);

    // Canonical roundMoney must correctly produce 1.01
    const canonicalValue = roundMoney('1.005', 2);
    expect(canonicalValue.toNumber()).toBe(1.01);
    expect(formatMoneyString('1.005', 2)).toBe('1.01');
  });

  it('should match PostgreSQL ROUND(numeric, 2) half-up behavior across standard test cases', () => {
    const testCases: Array<[string, string]> = [
      ['4.555', '4.56'],
      ['4.554', '4.55'],
      ['4.556', '4.56'],
      ['0.005', '0.01'],
      ['0.0049', '0.00'],
      ['100.495', '100.50'],
      ['1234.5678', '1234.57'],
      ['99.995', '100.00'],
      ['-4.555', '-4.56'],
    ];

    for (const [input, expected] of testCases) {
      const rounded = roundMoney(input, 2);
      expect(rounded.toFixed(2)).toBe(expected);
      expect(formatMoneyString(input, 2)).toBe(expected);
    }
  });

  it('roundRate should support high-precision rates (up to 8 decimal places)', () => {
    const rate = roundRate('1.085043219', 8);
    expect(rate.toFixed(8)).toBe('1.08504322');
  });

  it('toFinancialDecimal should safely parse number, string, Decimal, or null/undefined', () => {
    expect(toFinancialDecimal(12.34).toFixed(2)).toBe('12.34');
    expect(toFinancialDecimal('56.78').toFixed(2)).toBe('56.78');
    expect(toFinancialDecimal(new Decimal(90)).toFixed(2)).toBe('90.00');
    expect(toFinancialDecimal(null).toFixed(2)).toBe('0.00');
    expect(toFinancialDecimal(undefined).toFixed(2)).toBe('0.00');
    expect(toFinancialDecimal('invalid').toFixed(2)).toBe('0.00');
  });
});
