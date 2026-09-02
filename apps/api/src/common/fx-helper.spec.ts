import { getExchangeRateForCurrency } from './fx-helper';

describe('FX Helper (getExchangeRateForCurrency)', () => {
  let dbMock: any;
  let selectMock: jest.Mock;
  let fromMock: jest.Mock;
  let whereMock: jest.Mock;
  let orderByMock: jest.Mock;
  let limitMock: jest.Mock;

  beforeEach(() => {
    limitMock = jest.fn();
    orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
    whereMock = jest
      .fn()
      .mockReturnValue({ orderBy: orderByMock, limit: limitMock });
    fromMock = jest
      .fn()
      .mockReturnValue({ where: whereMock, limit: limitMock });
    selectMock = jest.fn().mockReturnValue({ from: fromMock });

    dbMock = {
      select: selectMock,
    };
  });

  it('should return rate 1.0 when currencyCode equals baseCurrency', async () => {
    // Mock Base Currency fetch
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'USD' }]);

    const result = await getExchangeRateForCurrency(dbMock, 'USD', new Date());
    expect(result).toEqual({ rate: 1.0, baseCurrency: 'USD' });
  });

  it('should return the direct buyRate when currency differs from base', async () => {
    // Mock Base Currency fetch (Base = USD)
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'USD' }]);

    // Mock From Rate fetch (Currency = GBP, direct rate = 1.375)
    limitMock.mockResolvedValueOnce([
      { currencyCode: 'GBP', buyRate: '1.375' },
    ]);

    const result = await getExchangeRateForCurrency(dbMock, 'GBP', new Date());
    expect(result).toEqual({ rate: 1.375, baseCurrency: 'USD' });
  });

  it('should throw an error when no rate is found for the requested currency', async () => {
    // Mock Base Currency fetch (Base = USD)
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'USD' }]);

    // Mock From Rate fetch (returns empty array)
    limitMock.mockResolvedValueOnce([]);

    await expect(
      getExchangeRateForCurrency(dbMock, 'GBP', new Date('2026-06-20')),
    ).rejects.toThrow(
      "No exchange rate found for currency 'GBP' on or before 2026-06-20",
    );
  });

  it('should handle high-precision float calculations accurately', async () => {
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'AUD' }]);
    // Mock highly specific precision float
    limitMock.mockResolvedValueOnce([
      { currencyCode: 'USD', buyRate: '1.2345678912' },
    ]);

    const result = await getExchangeRateForCurrency(dbMock, 'USD', new Date());
    expect(result.rate).toBeCloseTo(1.2345678912, 10);
    expect(result.baseCurrency).toEqual('AUD');
  });

  it('should handle repeating decimals and edge cases accurately', async () => {
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'AUD' }]);
    limitMock.mockResolvedValueOnce([
      { currencyCode: 'JPY', buyRate: '0.333333333333' },
    ]);

    const result = await getExchangeRateForCurrency(dbMock, 'JPY', new Date());
    expect(result.rate).toBeCloseTo(0.333333333333, 10);
  });
});
