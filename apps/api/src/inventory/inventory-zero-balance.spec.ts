import Decimal from 'decimal.js';
import {
  WeightedAverageStrategy,
  StandardCostStrategy,
  ProductCostData,
} from './valuation';

describe('Inventory Fractional UOM & Zero-Balance Residual Absorption (Unit)', () => {
  describe('WeightedAverageStrategy', () => {
    const strategy = new WeightedAverageStrategy();

    it('absorbs residual rounding fraction into final depletion COGS when inventory drops to zero', () => {
      // Scenario: 3 items received for $10.00 total ($3.333333... per item)
      const product: ProductCostData = {
        productId: 'prod-123',
        standardCost: '3.33',
        weightedAverageCost: '3.3333',
      };

      // Step 1: Ship 1 item out of 3. Total inventory value was $10.00.
      let qoh = 3;
      let inventoryVal = new Decimal('10.00');

      const cogs1 = strategy.getCogs(product, 1, qoh, inventoryVal);
      expect(cogs1).toBe('3.33');
      qoh -= 1; // 2 left
      inventoryVal = inventoryVal.minus(new Decimal(cogs1)); // 6.67 left

      // Step 2: Ship 1 item out of 2.
      const cogs2 = strategy.getCogs(product, 1, qoh, inventoryVal);
      expect(cogs2).toBe('3.33');
      qoh -= 1; // 1 left
      inventoryVal = inventoryVal.minus(new Decimal(cogs2)); // 3.34 left

      // Step 3: Ship the final item (QOH becomes 0).
      // Without residual absorption, standard formula would return 1 * 3.3333 = 3.33, leaving $0.01 phantom inventory.
      // With residual absorption, final depletion must absorb the remaining $3.34 so remaining value is 0.00.
      const cogs3 = strategy.getCogs(product, 1, qoh, inventoryVal);
      expect(cogs3).toBe('3.34');
      qoh -= 1; // 0 left
      inventoryVal = inventoryVal.minus(new Decimal(cogs3)); // 0.00 left

      expect(inventoryVal.isZero()).toBe(true);
      const totalCogs = new Decimal(cogs1).plus(cogs2).plus(cogs3);
      expect(totalCogs.toFixed(2)).toBe('10.00');
    });

    it('absorbs fractional UOM depletion residues to ensure zero phantom balance on bulk/liquid split', () => {
      // Scenario: 1 Drum (100 Litres) received for $100.00 total.
      const product: ProductCostData = {
        productId: 'bulk-oil',
        standardCost: '1.00',
        weightedAverageCost: '1.0000',
      };

      // 3 fractional dispenses: 33.33L, 33.33L, and final 33.34L
      let qoh = 100;
      let inventoryVal = new Decimal('100.00');

      const cogs1 = strategy.getCogs(product, 33.33, qoh, inventoryVal);
      qoh -= 33.33;
      inventoryVal = inventoryVal.minus(new Decimal(cogs1));

      const cogs2 = strategy.getCogs(product, 33.33, qoh, inventoryVal);
      qoh -= 33.33;
      inventoryVal = inventoryVal.minus(new Decimal(cogs2));

      // Final fractional depletion (33.34 remaining)
      const cogs3 = strategy.getCogs(product, 33.34, qoh, inventoryVal);
      inventoryVal = inventoryVal.minus(new Decimal(cogs3));

      expect(inventoryVal.isZero()).toBe(true);
      const totalCogs = new Decimal(cogs1).plus(cogs2).plus(cogs3);
      expect(totalCogs.toFixed(2)).toBe('100.00');
    });

    it('handles zero quantity or over-depletion without negative phantom valuation', () => {
      const product: ProductCostData = {
        productId: 'prod-456',
        standardCost: '5.00',
        weightedAverageCost: '5.0000',
      };

      expect(strategy.getCogs(product, 0, 10, 50)).toBe('0.00');
      // Depleting 15 when 10 on hand ($50 total value) absorbs full existing value
      expect(strategy.getCogs(product, 15, 10, 50)).toBe('50.00');
    });

    it('correctly resets WAC on full goods receipt reversal', () => {
      const product: ProductCostData = {
        productId: 'prod-789',
        standardCost: '12.00',
        weightedAverageCost: '14.5000',
      };

      // Reversing all remaining quantity (10 units cancelled out of 10 on hand)
      const result = strategy.onGoodsReceiptReversal(product, 10, 10, '14.50');
      expect(result.newWeightedAverageCost).toBe('12.0000');
    });
  });

  describe('StandardCostStrategy', () => {
    const strategy = new StandardCostStrategy();

    it('calculates COGS using exact standard cost decimal precision', () => {
      const product: ProductCostData = {
        productId: 'std-prod',
        standardCost: '19.99',
        weightedAverageCost: '0.0000',
      };

      expect(strategy.getCogs(product, 3)).toBe('59.97');
      expect(strategy.getCogs(product, 0.5)).toBe('10.00'); // 19.99 * 0.5 = 9.995 -> 10.00 HALF_UP
    });
  });
});
