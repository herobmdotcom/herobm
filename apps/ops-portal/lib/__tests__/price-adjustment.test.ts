import {
  applyPercentChange,
  computeBaseUnitCost,
  computeCostDeltaPercent,
  computeMarginPercent,
  computeMarkupPercent,
  formatPriceString,
  recalculateMaintainingMargin,
  roundPrice,
} from '../price-adjustment';

describe('price-adjustment utilities', () => {
  describe('computeBaseUnitCost', () => {
    it('divides invoice unit cost by UOM ratio', () => {
      expect(computeBaseUnitCost(24, 12)).toBe(2);
      expect(computeBaseUnitCost(15.5, 1)).toBe(15.5);
    });

    it('falls back to ratio 1 for invalid or non-positive ratios', () => {
      expect(computeBaseUnitCost(10, 0)).toBe(10);
      expect(computeBaseUnitCost(10, -5)).toBe(10);
      expect(computeBaseUnitCost(10, Number.NaN)).toBe(10);
    });

    it('returns 0 for negative or invalid invoice cost', () => {
      expect(computeBaseUnitCost(-5, 2)).toBe(0);
      expect(computeBaseUnitCost(Number.NaN, 2)).toBe(0);
    });
  });

  describe('computeCostDeltaPercent', () => {
    it('calculates positive and negative percentage changes', () => {
      expect(computeCostDeltaPercent(10, 12)).toBeCloseTo(20, 5);
      expect(computeCostDeltaPercent(20, 15)).toBeCloseTo(-25, 5);
    });

    it('returns null when previous cost is missing or <= 0', () => {
      expect(computeCostDeltaPercent(null, 12)).toBeNull();
      expect(computeCostDeltaPercent(0, 12)).toBeNull();
      expect(computeCostDeltaPercent(-5, 12)).toBeNull();
    });
  });

  describe('computeMarginPercent & computeMarkupPercent', () => {
    it('calculates gross margin and markup correctly', () => {
      // Cost 60, Sell 100 => Margin 40%, Markup 66.67%
      expect(computeMarginPercent(100, 60)).toBeCloseTo(40, 5);
      expect(computeMarkupPercent(100, 60)).toBeCloseTo(66.6667, 3);
    });

    it('handles negative margin when cost exceeds sell price', () => {
      expect(computeMarginPercent(80, 100)).toBeCloseTo(-25, 5);
    });

    it('returns null for zero denominators', () => {
      expect(computeMarginPercent(0, 50)).toBeNull();
      expect(computeMarkupPercent(100, 0)).toBeNull();
    });
  });

  describe('recalculateMaintainingMargin', () => {
    it('preserves gross margin when cost increases', () => {
      // Old: cost 10, sell 20 (50% margin). New cost 12 => sell 24 (50% margin)
      expect(recalculateMaintainingMargin(20, 10, 12)).toBe(24);
    });

    it('returns null when old sell price <= old cost or inputs invalid', () => {
      expect(recalculateMaintainingMargin(10, 10, 12)).toBeNull();
      expect(recalculateMaintainingMargin(8, 10, 12)).toBeNull();
      expect(recalculateMaintainingMargin(20, 0, 12)).toBeNull();
    });
  });

  describe('applyPercentChange', () => {
    it('applies percentage increase and rounds to 2 decimals', () => {
      expect(applyPercentChange(100, 8.5)).toBe(108.5);
      expect(applyPercentChange(19.99, 10)).toBe(21.99);
    });
  });

  describe('roundPrice', () => {
    it('supports none, nearest_0_05, end_95, end_99, and nearest_1', () => {
      expect(roundPrice(12.34, 'none')).toBe(12.34);
      expect(roundPrice(12.33, 'nearest_0_05')).toBe(12.35);
      expect(roundPrice(10.6, 'end_95')).toBe(10.95);
      expect(roundPrice(10.1, 'end_95')).toBe(9.95);
      expect(roundPrice(10.6, 'end_99')).toBe(10.99);
      expect(roundPrice(10.1, 'end_99')).toBe(9.99);
      expect(roundPrice(12.49, 'nearest_1')).toBe(12);
      expect(roundPrice(12.5, 'nearest_1')).toBe(13);
    });

    it('clamps end_95 and end_99 for small positive values', () => {
      expect(roundPrice(0.4, 'end_95')).toBe(0.95);
      expect(roundPrice(0.4, 'end_99')).toBe(0.99);
    });
  });

  describe('formatPriceString', () => {
    it('formats numbers to 2 decimal places', () => {
      expect(formatPriceString(12.5)).toBe('12.50');
      expect(formatPriceString(Number.NaN)).toBe('0.00');
    });
  });
});
