import {
  isPickableBin,
  filterPickableBins,
  calculatePickableOnHand,
} from './inventory-math.utils';

describe('Inventory Math Utilities', () => {
  describe('isPickableBin', () => {
    it('should return false if bin is unavailable', () => {
      expect(isPickableBin({ binType: 'storage', isUnavailable: true })).toBe(
        false,
      );
    });

    it('should return false if binType is null', () => {
      expect(isPickableBin({ binType: null, isUnavailable: false })).toBe(
        false,
      );
    });

    it('should return true for whitelisted bin types', () => {
      expect(isPickableBin({ binType: 'storage', isUnavailable: false })).toBe(
        true,
      );
      expect(isPickableBin({ binType: 'pick', isUnavailable: false })).toBe(
        true,
      );
      expect(isPickableBin({ binType: 'bulk', isUnavailable: false })).toBe(
        true,
      );
    });

    it('should return false for un-whitelisted bin types', () => {
      expect(isPickableBin({ binType: 'staging', isUnavailable: false })).toBe(
        false,
      );
      expect(
        isPickableBin({ binType: 'quarantine', isUnavailable: false }),
      ).toBe(false);
      expect(
        isPickableBin({ binType: 'unknown_type', isUnavailable: false }),
      ).toBe(false);
    });
  });

  describe('filterPickableBins', () => {
    it('should filter out non-pickable bins', () => {
      const bins = [
        { binId: '1', binType: 'storage', isUnavailable: false },
        { binId: '2', binType: 'staging', isUnavailable: false },
        { binId: '3', binType: 'pick', isUnavailable: true },
        { binId: '4', binType: 'bulk', isUnavailable: false },
      ];

      const result = filterPickableBins(bins);
      expect(result.length).toBe(2);
      expect(result.map((b) => b.binId)).toEqual(['1', '4']);
    });
  });

  describe('calculatePickableOnHand', () => {
    it('should calculate sum correctly using onHand', () => {
      const bins = [
        { binType: 'storage', isUnavailable: false, onHand: 10 },
        { binType: 'staging', isUnavailable: false, onHand: 20 },
        { binType: 'pick', isUnavailable: false, onHand: '15' },
      ];

      expect(calculatePickableOnHand(bins)).toBe(25);
    });

    it('should calculate sum correctly using quantity', () => {
      const bins = [
        { binType: 'storage', isUnavailable: false, quantity: 10 },
        { binType: 'pick', isUnavailable: false, quantity: '15.5' },
      ];

      expect(calculatePickableOnHand(bins)).toBe(25.5);
    });

    it('should calculate sum correctly using actualQuantity', () => {
      const bins = [
        { binType: 'storage', isUnavailable: false, actualQuantity: 10 },
        { binType: 'pick', isUnavailable: false, actualQuantity: '15' },
      ];

      expect(calculatePickableOnHand(bins)).toBe(25);
    });

    it('should handle null and undefined quantities safely', () => {
      const bins = [
        { binType: 'storage', isUnavailable: false, onHand: null },
        { binType: 'pick', isUnavailable: false, onHand: undefined },
        { binType: 'bulk', isUnavailable: false, onHand: 5 },
      ];

      expect(calculatePickableOnHand(bins)).toBe(5);
    });
  });
});
