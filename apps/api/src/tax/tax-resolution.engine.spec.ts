import { TaxResolutionEngine } from './tax-resolution.engine';

describe('TaxResolutionEngine', () => {
  let engine: TaxResolutionEngine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue([]),
    };
    engine = new TaxResolutionEngine(mockDb);
  });

  it('1. Manual override takes highest precedence', async () => {
    const result = await engine.resolveTaxCategory({
      isPurchase: true,
      isTaxRegistered: true,
      partyTaxPositionId: 'pos-123',
      productDefaultTaxCategoryId: 'cat-default',
      manualOverrideTaxCategoryId: 'cat-override',
    });
    expect(result).toBe('cat-override');
  });

  it('2. Unregistered supplier on purchase falls back to exempt', async () => {
    mockDb.limit.mockResolvedValueOnce([{ taxCategoryId: 'cat-exempt' }]);

    const result = await engine.resolveTaxCategory({
      isPurchase: true,
      isTaxRegistered: false,
      partyTaxPositionId: 'pos-123',
      productDefaultTaxCategoryId: 'cat-default',
    });
    expect(result).toBe('cat-exempt');
  });

  it('3. Tax mapping returns destination category', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { destinationTaxCategoryId: 'cat-mapped' },
    ]);

    const result = await engine.resolveTaxCategory({
      isPurchase: false,
      isTaxRegistered: true,
      partyTaxPositionId: 'pos-123',
      productDefaultTaxCategoryId: 'cat-default',
    });
    expect(result).toBe('cat-mapped');
  });

  it('4. Fallback to product default', async () => {
    // No mappings found
    mockDb.limit.mockResolvedValueOnce([]);

    const result = await engine.resolveTaxCategory({
      isPurchase: false,
      isTaxRegistered: true,
      partyTaxPositionId: 'pos-123',
      productDefaultTaxCategoryId: 'cat-default',
    });
    expect(result).toBe('cat-default');
  });
});
