import {
  isPickableBin,
  filterPickableBins,
  calculatePickableOnHand,
  calculateSuggestedRestockQuantity,
  isPickableBinSqlCondition,
} from './inventory-math.utils';

describe('Inventory Math Utilities', () => {
  describe('isPickableBin', () => {
    it('should return false if bin is unavailable', () => {
      expect(isPickableBin({ binType: 'storage', isUnavailable: true })).toBe(
        false,
      );
    });

    it('should return false if bin is bonded', () => {
      expect(
        isPickableBin({
          binType: 'storage',
          isUnavailable: false,
          isBonded: true,
        }),
      ).toBe(false);
      expect(
        isPickableBin({
          binType: 'pick',
          isBonded: true,
        }),
      ).toBe(false);
    });

    it('should return false if bin is consignment', () => {
      expect(
        isPickableBin({
          binType: 'storage',
          isUnavailable: false,
          isConsignment: true,
        }),
      ).toBe(false);
      expect(
        isPickableBin({
          binType: 'bulk',
          isConsignment: true,
        }),
      ).toBe(false);
    });

    it('should return false if multiple flags are set (bonded and consignment)', () => {
      expect(
        isPickableBin({
          binType: 'storage',
          isUnavailable: false,
          isBonded: true,
          isConsignment: true,
        }),
      ).toBe(false);
    });

    it('should return false if binType is null', () => {
      expect(isPickableBin({ binType: null, isUnavailable: false })).toBe(
        false,
      );
    });

    it('should return true for whitelisted bin types when not unavailable, not bonded, and not consignment', () => {
      expect(
        isPickableBin({
          binType: 'storage',
          isUnavailable: false,
          isBonded: false,
          isConsignment: false,
        }),
      ).toBe(true);
      expect(
        isPickableBin({
          binType: 'pick',
          isUnavailable: false,
          isBonded: null,
          isConsignment: null,
        }),
      ).toBe(true);
      expect(
        isPickableBin({
          binType: 'bulk',
          isUnavailable: false,
        }),
      ).toBe(true);
    });

    it('should return false for un-whitelisted bin types', () => {
      expect(isPickableBin({ binType: 'staging', isUnavailable: false })).toBe(
        false,
      );
      expect(isPickableBin({ binType: 'project', isUnavailable: false })).toBe(
        false,
      );
      expect(isPickableBin({ binType: 'wip', isUnavailable: false })).toBe(
        false,
      );
      expect(
        isPickableBin({ binType: 'quarantine', isUnavailable: false }),
      ).toBe(false);
      expect(
        isPickableBin({ binType: 'in_transit', isUnavailable: false }),
      ).toBe(false);
      expect(
        isPickableBin({ binType: 'unknown_type', isUnavailable: false }),
      ).toBe(false);
    });
  });

  describe('filterPickableBins', () => {
    it('should filter out non-pickable bins including unavailable, bonded, consignment, and non-whitelisted types', () => {
      const bins = [
        {
          binId: '1',
          binType: 'storage',
          isUnavailable: false,
          isBonded: false,
          isConsignment: false,
        },
        {
          binId: '2',
          binType: 'staging',
          isUnavailable: false,
          isBonded: false,
          isConsignment: false,
        },
        {
          binId: '3',
          binType: 'pick',
          isUnavailable: true,
          isBonded: false,
          isConsignment: false,
        },
        {
          binId: '4',
          binType: 'bulk',
          isUnavailable: false,
          isBonded: false,
          isConsignment: false,
        },
        {
          binId: '5',
          binType: 'storage',
          isUnavailable: false,
          isBonded: true,
          isConsignment: false,
        },
        {
          binId: '6',
          binType: 'pick',
          isUnavailable: false,
          isBonded: false,
          isConsignment: true,
        },
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

    it('should exclude quantities from bonded and consignment bins', () => {
      const bins = [
        {
          binType: 'storage',
          isUnavailable: false,
          isBonded: false,
          isConsignment: false,
          onHand: 10,
        },
        {
          binType: 'pick',
          isUnavailable: false,
          isBonded: true,
          isConsignment: false,
          onHand: 20,
        },
        {
          binType: 'bulk',
          isUnavailable: false,
          isBonded: false,
          isConsignment: true,
          onHand: 30,
        },
        { binType: 'storage', isUnavailable: false, onHand: 15 },
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

  describe('isPickableBinSqlCondition', () => {
    it('should generate SQL with storage, pick, bulk, is_unavailable, is_bonded, and is_consignment checks', () => {
      const condition = isPickableBinSqlCondition('b');
      // Drizzle SQL objects contain query chunks
      const sqlString = JSON.stringify(condition);
      expect(sqlString).toContain('bin_type IN');
      expect(sqlString).toContain('is_unavailable');
      expect(sqlString).toContain('is_bonded');
      expect(sqlString).toContain('is_consignment');
    });
  });

  describe('calculateSuggestedRestockQuantity', () => {
    it('should return 0 if projected stock (onHand + onOrder) meets or exceeds minQuantity', () => {
      // Exactly at minQuantity
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 5,
          onOrder: 5,
          minQuantity: 10,
          maxQuantity: 20,
        }),
      ).toBe(0);

      // Exceeds minQuantity with onOrder
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 2,
          onOrder: 15,
          minQuantity: 10,
          maxQuantity: 25,
        }),
      ).toBe(0);

      // Exceeds minQuantity with onHand alone
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 15,
          onOrder: 0,
          minQuantity: 10,
          maxQuantity: 30,
        }),
      ).toBe(0);
    });

    it('should calculate restock quantity to target maxQuantity when projected stock is below minQuantity', () => {
      // onHand: 2, onOrder: 3 => projected: 5 < 10 => suggested: 25 - 5 = 20
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 2,
          onOrder: 3,
          minQuantity: 10,
          maxQuantity: 25,
        }),
      ).toBe(20);

      // zero stock => suggested: 50 - 0 = 50
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 0,
          onOrder: 0,
          minQuantity: 10,
          maxQuantity: 50,
        }),
      ).toBe(50);
    });

    it('should calculate restock quantity to minQuantity when maxQuantity is null, undefined, or <= minQuantity', () => {
      // maxQuantity null => target is minQuantity (10 - 2 = 8)
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 2,
          onOrder: 0,
          minQuantity: 10,
          maxQuantity: null,
        }),
      ).toBe(8);

      // maxQuantity omitted/undefined => target is minQuantity (10 - 4 = 6)
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 3,
          onOrder: 1,
          minQuantity: 10,
        }),
      ).toBe(6);

      // maxQuantity <= minQuantity => target defaults to minQuantity
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 1,
          onOrder: 0,
          minQuantity: 10,
          maxQuantity: 8,
        }),
      ).toBe(9);
    });

    it('should round up suggested restock quantity to minPurchaseQty (MOQ) when calculated deficit is less than MOQ', () => {
      // Deficit is 10 - 6 = 4, but supplier MOQ is 12 => suggested quantity rounds up to 12
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 6,
          onOrder: 0,
          minQuantity: 10,
          maxQuantity: 10,
          minPurchaseQty: 12,
        }),
      ).toBe(12);

      // Deficit is 50 - 10 = 40, supplier MOQ is 20 => deficit (40) > MOQ (20), returns 40
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 10,
          onOrder: 0,
          minQuantity: 20,
          maxQuantity: 50,
          minPurchaseQty: 20,
        }),
      ).toBe(40);

      // Projected stock meets minQuantity (15 >= 10) => returns 0 regardless of MOQ
      expect(
        calculateSuggestedRestockQuantity({
          onHand: 15,
          onOrder: 0,
          minQuantity: 10,
          maxQuantity: 20,
          minPurchaseQty: 50,
        }),
      ).toBe(0);
    });
  });
});
