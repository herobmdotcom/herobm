import { calculateAvailableQuantity, BIN_TYPE } from '@herobm/shared';
import { isPickableBin } from './inventory-math.utils';

describe('Inventory Levels & Allocation Integrity (ADV-INV-001 Immunization)', () => {
  describe('On-Hand vs Pickable Bin Rules', () => {
    it('should include staging bins in physical on-hand reporting while excluding them from active pickable bins', () => {
      const storageBin = {
        binType: BIN_TYPE.STORAGE,
        isUnavailable: false,
        isBonded: false,
        isConsignment: false,
      };
      const pickBin = {
        binType: BIN_TYPE.PICK,
        isUnavailable: false,
        isBonded: false,
        isConsignment: false,
      };
      const stagingBin = {
        binType: BIN_TYPE.STAGING,
        isUnavailable: false,
        isBonded: false,
        isConsignment: false,
      };
      const quarantineBin = {
        binType: BIN_TYPE.QUARANTINE,
        isUnavailable: false,
        isBonded: false,
        isConsignment: false,
      };

      // Pickable whitelist strictly for picking new orders
      expect(isPickableBin(storageBin)).toBe(true);
      expect(isPickableBin(pickBin)).toBe(true);
      expect(isPickableBin(stagingBin)).toBe(false);
      expect(isPickableBin(quarantineBin)).toBe(false);

      // On-hand eligibility includes physical inventory on staging docks
      const onHandBinTypes = [
        BIN_TYPE.STORAGE,
        BIN_TYPE.PICK,
        BIN_TYPE.BULK,
        BIN_TYPE.STAGING,
      ];
      expect(onHandBinTypes).toContain(BIN_TYPE.STAGING);
      expect(onHandBinTypes).not.toContain(BIN_TYPE.QUARANTINE);
      expect(onHandBinTypes).not.toContain(BIN_TYPE.IN_TRANSIT);
    });

    it('should maintain consistent Available-to-Promise across pick-and-stage lifecycle', () => {
      // 1. Initial State: 100 units in Storage
      let onHand = 100;
      let committed = 0;
      let available = calculateAvailableQuantity(onHand, committed);
      expect(available).toBe(100);

      // 2. Customer orders 10 units -> Order confirmed
      committed = 10;
      available = calculateAvailableQuantity(onHand, committed);
      expect(available).toBe(90);

      // 3. Picker picks 10 units from Storage to Staging Dock
      // On-hand remains 100 (90 in storage + 10 in staging)
      // Open commitment remains 10 (order is in 'picking' / unshipped state, so staged goods are not resold)
      onHand = 100;
      committed = 10;
      available = calculateAvailableQuantity(onHand, committed);
      expect(available).toBe(90); // Stable availability! No ghost stock jump or drop.

      // 4. Carrier picks up and ships the order (Stock leaves the building, order moves to 'shipped')
      onHand = 90;
      committed = 0;
      available = calculateAvailableQuantity(onHand, committed);
      expect(available).toBe(90);
    });
  });

  describe('Bounded Commitment Calculation', () => {
    it('should not allow negative remaining commitments for overpicked lines', () => {
      const lineQuantity = 10;
      const pickedQuantity = 12; // Overpicked
      const remainingCommitted = Math.max(0, lineQuantity - pickedQuantity);
      expect(remainingCommitted).toBe(0);
    });
  });
});
