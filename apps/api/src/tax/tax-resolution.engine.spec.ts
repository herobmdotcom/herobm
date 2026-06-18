import { TaxResolutionEngine } from './tax-resolution.engine';
import type { DrizzleDB } from '../drizzle/drizzle.module';

describe('TaxResolutionEngine', () => {
  let engine: TaxResolutionEngine;
  let mockDb: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    limit: jest.Mock;
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue([]),
    };
    engine = new TaxResolutionEngine(mockDb as unknown as DrizzleDB);
  });

  describe('Existing Overrides and Mappings', () => {
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

  describe('Hierarchical Resolution (resolveProductTaxHierarchy)', () => {
    it('Product level precedence (Sales)', async () => {
      mockDb.limit
        .mockResolvedValueOnce([
          { salesTaxCategoryId: 'prod-sales-tax', productGroupId: 'pg-1' },
        ]) // product query
        .mockResolvedValueOnce([]); // mappings query (no mappings)

      const result = await engine.resolveTaxCategory({
        isPurchase: false,
        isTaxRegistered: true,
        productId: 'prod-123',
      });
      expect(result).toBe('prod-sales-tax');
    });

    it('Product level precedence (Purchase)', async () => {
      mockDb.limit
        .mockResolvedValueOnce([
          {
            purchaseTaxCategoryId: 'prod-purchase-tax',
            productGroupId: 'pg-1',
          },
        ]) // product query
        .mockResolvedValueOnce([]); // mappings query (no mappings)

      const result = await engine.resolveTaxCategory({
        isPurchase: true,
        isTaxRegistered: true,
        productId: 'prod-123',
      });
      expect(result).toBe('prod-purchase-tax');
    });

    it('Product Group fallback (Sales)', async () => {
      mockDb.limit
        .mockResolvedValueOnce([
          { salesTaxCategoryId: null, productGroupId: 'pg-1' },
        ]) // product query (missing tax)
        .mockResolvedValueOnce([{ salesTaxCategoryId: 'group-sales-tax' }]) // productGroup query
        .mockResolvedValueOnce([]); // mappings query

      const result = await engine.resolveTaxCategory({
        isPurchase: false,
        isTaxRegistered: true,
        productId: 'prod-123',
      });
      expect(result).toBe('group-sales-tax');
    });

    it('App Settings fallback (Purchase)', async () => {
      mockDb.limit
        .mockResolvedValueOnce([
          { purchaseTaxCategoryId: null, productGroupId: 'pg-1' },
        ]) // product query (missing tax)
        .mockResolvedValueOnce([{ purchaseTaxCategoryId: null }]) // productGroup query (missing tax)
        .mockResolvedValueOnce([
          { defaultPurchaseTaxCategoryId: 'system-purchase-tax' },
        ]) // appSettings query
        .mockResolvedValueOnce([]); // mappings query

      const result = await engine.resolveTaxCategory({
        isPurchase: true,
        isTaxRegistered: true,
        productId: 'prod-123',
      });
      expect(result).toBe('system-purchase-tax');
    });

    it('Existing Rule Precedence over Hierarchy (Manual Override)', async () => {
      const result = await engine.resolveTaxCategory({
        isPurchase: false,
        isTaxRegistered: true,
        productId: 'prod-123',
        manualOverrideTaxCategoryId: 'cat-override',
      });
      // Should completely skip hierarchy if manual override is provided
      expect(result).toBe('cat-override');
      expect(mockDb.limit).not.toHaveBeenCalled();
    });
  });
});
