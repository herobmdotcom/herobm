import {
  WeightedAverageStrategy,
  StandardCostStrategy,
  getValuationStrategy,
} from './valuation';

describe('Valuation Strategies - ADV-215 Valuation & Reversal Invariants', () => {
  describe('WeightedAverageStrategy', () => {
    const strategy = new WeightedAverageStrategy();

    it('calculates COGS based on current weighted average cost', () => {
      const product = {
        productId: 'prod-1',
        standardCost: '10.00',
        weightedAverageCost: '12.50',
      };
      expect(strategy.getCogs(product, 4)).toBe('50.00'); // 4 * 12.50
    });

    it('recalculates new WAC and inventory value added on goods receipt', () => {
      // 100 units @ $10.00 existing + 200 units @ $50.00 receipt
      // Total value = 1000 + 10000 = 11000 across 300 units => $36.6667
      const product = {
        productId: 'prod-1',
        standardCost: '10.00',
        weightedAverageCost: '10.0000',
      };
      const result = strategy.onGoodsReceipt(product, 100, 200, '50.00');

      expect(result.newWeightedAverageCost).toBe('36.6667');
      expect(result.inventoryValueAdded).toBe('10000.00');
      expect(result.purchasePriceVariance).toBe('0.00');
    });

    it('reverts WAC on goods receipt reversal when remaining stock > 0', () => {
      // Current state: 300 units on hand @ WAC $36.6667 (Value = $11,000.01)
      // Cancelling receipt of 200 units @ $50.00 (Value = $10,000.00)
      // Remaining stock = 100 units with value $1,000.01 => WAC $10.0001
      const product = {
        productId: 'prod-1',
        standardCost: '10.00',
        weightedAverageCost: '36.6667',
      };
      const result = strategy.onGoodsReceiptReversal(
        product,
        300,
        200,
        '50.00',
      );

      expect(result.newWeightedAverageCost).toBe('10.0001');
    });

    it('falls back to standard cost when remaining stock reaches 0 upon receipt cancellation', () => {
      // Current state: 200 units on hand @ WAC $50.00 (entire stock came from this single receipt)
      // Cancelling all 200 units @ $50.00 => Remaining stock = 0
      // Must fallback to standardCost ($15.00)
      const product = {
        productId: 'prod-1',
        standardCost: '15.00',
        weightedAverageCost: '50.0000',
      };
      const result = strategy.onGoodsReceiptReversal(
        product,
        200,
        200,
        '50.00',
      );

      expect(result.newWeightedAverageCost).toBe('15.0000');
    });
  });

  describe('StandardCostStrategy', () => {
    const strategy = new StandardCostStrategy();

    it('calculates COGS based on standard cost', () => {
      const product = {
        productId: 'prod-2',
        standardCost: '20.00',
        weightedAverageCost: '18.00',
      };
      expect(strategy.getCogs(product, 3)).toBe('60.00');
    });

    it('calculates PPV and keeps WAC unchanged on goods receipt', () => {
      const product = {
        productId: 'prod-2',
        standardCost: '20.00',
        weightedAverageCost: '20.00',
      };
      const result = strategy.onGoodsReceipt(product, 50, 10, '25.00');

      expect(result.newWeightedAverageCost).toBe('20.00');
      expect(result.inventoryValueAdded).toBe('200.00'); // 10 * 20.00 std
      expect(result.purchasePriceVariance).toBe('50.00'); // 10 * (25 - 20)
    });

    it('leaves WAC unchanged on goods receipt reversal', () => {
      const product = {
        productId: 'prod-2',
        standardCost: '20.00',
        weightedAverageCost: '20.00',
      };
      const result = strategy.onGoodsReceiptReversal(product, 60, 10, '25.00');

      expect(result.newWeightedAverageCost).toBe('20.00');
    });
  });

  describe('getValuationStrategy', () => {
    it('returns StandardCostStrategy for "standard"', () => {
      expect(getValuationStrategy('standard')).toBeInstanceOf(
        StandardCostStrategy,
      );
      expect(getValuationStrategy('STANDARD')).toBeInstanceOf(
        StandardCostStrategy,
      );
    });

    it('returns WeightedAverageStrategy for "weighted_average" or undefined', () => {
      expect(getValuationStrategy('weighted_average')).toBeInstanceOf(
        WeightedAverageStrategy,
      );
      expect(getValuationStrategy(undefined)).toBeInstanceOf(
        WeightedAverageStrategy,
      );
    });
  });
});
