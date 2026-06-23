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

  it('should calculate the cross rate correctly when both currency and base have rates', async () => {
    // Mock Base Currency fetch (Base = USD)
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'USD' }]);

    // Mock From Rate fetch (Currency = GBP, rate against EUR = 0.8)
    limitMock.mockResolvedValueOnce([{ currencyCode: 'GBP', buyRate: '0.8' }]);

    // Mock Base Rate fetch (Currency = USD, rate against EUR = 1.1)
    limitMock.mockResolvedValueOnce([{ currencyCode: 'USD', buyRate: '1.1' }]);

    // Expected rate: 1.1 / 0.8 = 1.375
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

  it('should throw an error when no rate is found for the base currency', async () => {
    // Mock Base Currency fetch (Base = USD)
    limitMock.mockResolvedValueOnce([{ baseCurrency: 'USD' }]);

    // Mock From Rate fetch
    limitMock.mockResolvedValueOnce([{ currencyCode: 'GBP', buyRate: '0.8' }]);

    // Mock Base Rate fetch (returns empty array)
    limitMock.mockResolvedValueOnce([]);

    await expect(
      getExchangeRateForCurrency(dbMock, 'GBP', new Date('2026-06-20')),
    ).rejects.toThrow(
      "No exchange rate found for base currency 'USD' on or before 2026-06-20",
    );
  });
});
