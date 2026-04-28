import { convertAmount, MissingExchangeRateError } from './currency';

describe('currency conversion', () => {
  const rates = new Map<string, number>([
    ['USD', 1.10],
    ['GBP', 0.85],
  ]);

  it('should return the same amount if from and to currencies are the same', () => {
    expect(convertAmount(100, 'EUR', 'EUR', 'EUR', rates)).toBe(100);
    expect(convertAmount(100, 'USD', 'USD', 'EUR', rates)).toBe(100);
  });

  it('should convert from baseCurrencyCode to another currency', () => {
    // 100 EUR * 1.10 = 110 USD
    expect(convertAmount(100, 'EUR', 'USD', 'EUR', rates)).toBe(110);
    // 100 EUR * 0.85 = 85 GBP
    expect(convertAmount(100, 'EUR', 'GBP', 'EUR', rates)).toBe(85);
  });

  it('should convert from another currency to baseCurrencyCode', () => {
    // 110 USD / 1.10 = 100 EUR
    expect(convertAmount(110, 'USD', 'EUR', 'EUR', rates)).toBe(100);
    // 85 GBP / 0.85 = 100 EUR
    expect(convertAmount(85, 'GBP', 'EUR', 'EUR', rates)).toBe(100);
  });

  it('should convert between two non-base currencies', () => {
    // 100 USD -> EUR (100 / 1.10 = 90.909...) -> GBP (90.909... * 0.85 = 77.2727...)
    // 100 / 1.10 * 0.85 = 77.27
    expect(convertAmount(100, 'USD', 'GBP', 'EUR', rates)).toBe(77.27);
  });

  it('should throw MissingExchangeRateError if a rate is missing', () => {
    expect(() => convertAmount(100, 'EUR', 'JPY', 'EUR', rates)).toThrow(MissingExchangeRateError);
    expect(() => convertAmount(100, 'JPY', 'EUR', 'EUR', rates)).toThrow(MissingExchangeRateError);
    expect(() => convertAmount(100, 'USD', 'JPY', 'EUR', rates)).toThrow(MissingExchangeRateError);
  });

  it('should handle string rates correctly', () => {
    const stringRates = new Map<string, string>([
      ['USD', '1.10'],
      ['GBP', '0.85'],
    ]);
    expect(convertAmount(100, 'EUR', 'USD', 'EUR', stringRates)).toBe(110);
  });

  it('should handle rounding based on currency decimals', () => {
    // JPY has 0 decimals
    // 100 EUR * 140.556 = 14055.6 -> rounded to 14056
    const ratesWithJpy = new Map<string, number>([['JPY', 140.556]]);
    expect(convertAmount(100, 'EUR', 'JPY', 'EUR', ratesWithJpy)).toBe(14056);
  });
});
