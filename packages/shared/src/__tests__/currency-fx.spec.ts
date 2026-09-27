import { Decimal } from 'decimal.js';
import { convertAmount, convertAmountDecimal } from '../currency';

describe('Foreign Exchange (FX) Precision & Base Triangulation', () => {
  const rates = new Map<string, string | number>([
    ['EUR', '1.00000000'], // Base currency
    ['USD', '1.08500000'], // 1 EUR = 1.0850 USD
    ['GBP', '0.85400000'], // 1 EUR = 0.8540 GBP
    ['JPY', '162.35000000'], // 1 EUR = 162.35 JPY (0 decimals)
  ]);

  it('should convert from Base to Foreign currency with exact decimal precision', () => {
    // 100 EUR -> USD at 1.0850 = 108.50 USD
    const converted = convertAmount(100, 'EUR', 'USD', 'EUR', rates);
    expect(converted).toBe(108.5);

    const convertedDec = convertAmountDecimal(100, 'EUR', 'USD', 'EUR', rates);
    expect(convertedDec.toFixed(2)).toBe('108.50');
  });

  it('should convert from Foreign to Base currency without precision drift', () => {
    // 108.50 USD -> EUR at 1.0850 = 100.00 EUR
    const convertedDec = convertAmountDecimal('108.50', 'USD', 'EUR', 'EUR', rates);
    expect(convertedDec.toFixed(2)).toBe('100.00');
  });

  it('should perform cross-currency triangulation (USD -> EUR -> GBP) without intermediate rounding loss', () => {
    // 1,000 USD -> EUR (1000 / 1.0850 = 921.658986175...)
    // 921.658986175... EUR -> GBP (* 0.8540 = 787.0967741935...)
    // Final rounded to 2 decimals: 787.10 GBP
    const result = convertAmountDecimal('1000.00', 'USD', 'GBP', 'EUR', rates);
    expect(result.toFixed(2)).toBe('787.10');
  });

  it('should respect zero-decimal currencies (like JPY)', () => {
    // 100 EUR -> JPY at 162.35 = 16235 JPY
    const result = convertAmountDecimal('100.00', 'EUR', 'JPY', 'EUR', rates);
    expect(result.toFixed(0)).toBe('16235');
  });

  it('should throw MissingExchangeRateError if a required rate is missing', () => {
    expect(() => {
      convertAmountDecimal('100.00', 'EUR', 'AUD', 'EUR', rates);
    }).toThrow(/Missing exchange rate for currency: AUD/);
  });
});
