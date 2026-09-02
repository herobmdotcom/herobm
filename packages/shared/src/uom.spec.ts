import { formatCompositeQuantity, calculateUomPriceAdjustment, ProductUom } from './uom';

describe('UOM Utilities', () => {
  describe('formatCompositeQuantity', () => {
    it('should format simple quantities correctly', () => {
      const uoms: ProductUom[] = [
        { uomCode: 'BOX', ratio: 25 },
        { uomCode: 'PALLET', ratio: 500 }
      ];
      
      expect(formatCompositeQuantity(127, uoms, 'EA')).toBe('5 BOX, 2 EA');
      expect(formatCompositeQuantity(25, uoms, 'EA')).toBe('1 BOX');
      expect(formatCompositeQuantity(525, uoms, 'EA')).toBe('1 PALLET, 1 BOX');
      expect(formatCompositeQuantity(1001, uoms, 'EA')).toBe('2 PALLET, 1 EA');
    });

    it('should fall back to base UOM if no breakdown exists', () => {
      expect(formatCompositeQuantity(5, [], 'EA')).toBe('5 EA');
      expect(formatCompositeQuantity(10, null, 'KG')).toBe('10 KG');
    });

    it('should handle decimal remainders correctly', () => {
      const uoms: ProductUom[] = [{ uomCode: 'BOX', ratio: 25 }];
      // 27.5 total -> 1 BOX (25) + 2.5 EA
      expect(formatCompositeQuantity(27.5, uoms, 'EA')).toBe('1 BOX, 2.5 EA');
      
      // Floating point check: 1.3333333333
      expect(formatCompositeQuantity(26.3333333333, uoms, 'EA')).toBe('1 BOX, 1.3333 EA');
    });

    it('should handle zero or null inputs gracefully', () => {
      expect(formatCompositeQuantity(null, [], 'EA')).toBe('0');
      expect(formatCompositeQuantity(undefined, [], 'EA')).toBe('0');
      expect(formatCompositeQuantity(0, [], 'EA')).toBe('0 EA');
    });

    it('should handle string numeric inputs gracefully', () => {
      const uoms: ProductUom[] = [{ uomCode: 'BOX', ratio: '25' }];
      expect(formatCompositeQuantity('52', uoms, 'EA')).toBe('2 BOX, 2 EA');
    });

    it('should sort correctly even if uoms are out of order', () => {
      const uoms: ProductUom[] = [
        { uomCode: 'BOX', ratio: 25 },
        { uomCode: 'PALLET', ratio: 500 },
        { uomCode: 'CARTON', ratio: 100 }
      ];
      expect(formatCompositeQuantity(626, uoms, 'EA')).toBe('1 PALLET, 1 CARTON, 1 BOX, 1 EA');
    });
  });

  describe('calculateUomPriceAdjustment', () => {
    it('should calculate new price correctly based on ratio shifts', () => {
      // 10 per EA (ratio 1) -> BOX (ratio 25) should be 250
      expect(calculateUomPriceAdjustment(10, 1, 25)).toBe(250);
      
      // 50 per BOX (ratio 25) -> EA (ratio 1) should be 2
      expect(calculateUomPriceAdjustment(50, 25, 1)).toBe(2);
      
      // 250 per CARTON (ratio 100) -> BOX (ratio 25) should be 62.5
      expect(calculateUomPriceAdjustment(250, 100, 25)).toBe(62.5);
    });

    it('should handle string inputs safely', () => {
      expect(calculateUomPriceAdjustment('10', 1, 25)).toBe(250);
    });

    it('should safely return zero on zero price or missing inputs', () => {
      expect(calculateUomPriceAdjustment(0, 1, 25)).toBe(0);
      expect(calculateUomPriceAdjustment('', 1, 25)).toBe(0);
      expect(calculateUomPriceAdjustment(null as any, 1, 25)).toBe(0);
    });

    it('should safely return zero to prevent division by zero if old ratio is 0', () => {
      expect(calculateUomPriceAdjustment(100, 0, 25)).toBe(0);
    });
  });
});
