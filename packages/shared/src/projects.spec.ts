import {
  calculateProjectStagingAvailableQuantity,
  calculateProjectMaterialsSummary,
  ProjectStagingInventoryInput,
  ProjectTransferOrderInput,
  ProjectLedgerEntryInput,
} from './projects';
import { TRANSFER_ORDER_STATE } from './state-machines';

describe('Project Materials & Staging Calculations (Shared)', () => {
  describe('calculateProjectStagingAvailableQuantity', () => {
    it('calculates available quantity as physical staged stock minus open returning stock', () => {
      // 10 physical in staging bin, 3 open returning awaiting dispatch -> 7 available
      const available = calculateProjectStagingAvailableQuantity(10, 3);
      expect(available).toBe(7);
    });

    it('clamps available quantity to 0 when returning exceeds staged', () => {
      const available = calculateProjectStagingAvailableQuantity(5, 7);
      expect(available).toBe(0);
    });

    it('handles numeric strings gracefully', () => {
      const available = calculateProjectStagingAvailableQuantity(
        '15' as unknown as number,
        '4' as unknown as number,
      );
      expect(available).toBe(11);
    });
  });

  describe('calculateProjectMaterialsSummary', () => {
    const p1 = 'prod-001';
    const p2 = 'prod-002';

    it('populates physical staged stock directly from bin contents', () => {
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: 'SKU-1', productName: 'Timber', actualQuantity: '10' },
        { productId: p2, productNumber: 'SKU-2', productName: 'Steel', actualQuantity: '5' },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, [], []);
      expect(summary).toHaveLength(2);

      const item1 = summary.find((s) => s.productId === p1);
      expect(item1).toBeDefined();
      expect(item1?.stagedQty).toBe(10);
      expect(item1?.arrivingQty).toBe(0);
      expect(item1?.returningQty).toBe(0);
      expect(item1?.consumedQty).toBe(0);
      expect(item1?.returnedQty).toBe(0);
      expect(item1?.availableQty).toBe(10);
    });

    it('tracks inbound transfer orders as arriving without prematurely making them available', () => {
      // Transfer order is SHIPPED (in-transit), not yet put away into staging bin
      const transfers: ProjectTransferOrderInput[] = [
        {
          transferOrderId: 'to-inbound-1',
          stateCode: TRANSFER_ORDER_STATE.SHIPPED,
          isProjectReturn: false,
          lines: [
            { productId: p1, productNumber: 'SKU-1', productDescription: 'Timber', quantity: '20' },
          ],
        },
      ];

      // Staging bin is currently empty
      const summary = calculateProjectMaterialsSummary([], transfers, []);
      expect(summary).toHaveLength(1);

      const item1 = summary[0];
      expect(item1.stagedQty).toBe(0);
      expect(item1.arrivingQty).toBe(20);
      expect(item1.returningQty).toBe(0);
      expect(item1.availableQty).toBe(0); // Cannot consume in-transit stock!
    });

    it('accounts for partial putaway on inbound transfer orders', () => {
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: 'SKU-1', productName: 'Timber', actualQuantity: '10' },
      ];
      const transfers: ProjectTransferOrderInput[] = [
        {
          transferOrderId: 'to-inbound-1',
          stateCode: TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED,
          isProjectReturn: false,
          lines: [
            {
              productId: p1,
              productNumber: 'SKU-1',
              productDescription: 'Timber',
              quantity: '25',
              quantityPutaway: '10', // 10 landed in bin, 15 still arriving
            },
          ],
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, transfers, []);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(10);
      expect(item1?.arrivingQty).toBe(15);
      expect(item1?.availableQty).toBe(10);
    });

    it('deducts open return transfer orders (CONFIRMED/PICKING) from available stock as returningQty', () => {
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: 'SKU-1', productName: 'Timber', actualQuantity: '12' },
      ];
      const transfers: ProjectTransferOrderInput[] = [
        {
          transferOrderId: 'to-return-1',
          stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
          isProjectReturn: true,
          lines: [{ productId: p1, productNumber: 'SKU-1', productDescription: 'Timber', quantity: '3' }],
        },
        {
          transferOrderId: 'to-return-2',
          stateCode: TRANSFER_ORDER_STATE.PICKING,
          isProjectReturn: true,
          lines: [{ productId: p1, productNumber: 'SKU-1', productDescription: 'Timber', quantity: '2' }],
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, transfers, []);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(12);
      expect(item1?.returningQty).toBe(5); // 3 + 2 committed in bin awaiting dispatch
      expect(item1?.availableQty).toBe(7); // 12 - 5 available
    });

    it('does not double-deduct returningQty once return order is SHIPPED (dispatched from bin)', () => {
      // 8 units left in bin after 4 units were shipped out on return TO
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: 'SKU-1', productName: 'Timber', actualQuantity: '8' },
      ];
      const transfers: ProjectTransferOrderInput[] = [
        {
          transferOrderId: 'to-return-dispatched',
          stateCode: TRANSFER_ORDER_STATE.SHIPPED, // Already physically deducted from bin
          isProjectReturn: true,
          lines: [{ productId: p1, productNumber: 'SKU-1', productDescription: 'Timber', quantity: '4' }],
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, transfers, []);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(8);
      expect(item1?.returningQty).toBe(0); // Not sitting in bin anymore
      expect(item1?.availableQty).toBe(8);
    });

    it('ignores cancelled transfer orders', () => {
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: 'SKU-1', productName: 'Timber', actualQuantity: '10' },
      ];
      const transfers: ProjectTransferOrderInput[] = [
        {
          transferOrderId: 'to-inbound-cancelled',
          stateCode: TRANSFER_ORDER_STATE.CANCELLED,
          isProjectReturn: false,
          lines: [{ productId: p1, productNumber: 'SKU-1', productDescription: 'Timber', quantity: '10' }],
        },
        {
          transferOrderId: 'to-return-cancelled',
          stateCode: TRANSFER_ORDER_STATE.CANCELLED,
          isProjectReturn: true,
          lines: [{ productId: p1, productNumber: 'SKU-1', productDescription: 'Timber', quantity: '4' }],
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, transfers, []);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(10);
      expect(item1?.arrivingQty).toBe(0);
      expect(item1?.returningQty).toBe(0);
      expect(item1?.availableQty).toBe(10);
    });

    it('tracks task consumption and subledger return credits accurately', () => {
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: 'SKU-1', productName: 'Timber', actualQuantity: '12' },
      ];
      const ledgerEntries: ProjectLedgerEntryInput[] = [
        {
          entryType: 'usage',
          lineType: 'item',
          sourceType: 'inventory_issue',
          productId: p1,
          description: 'Consumed on Task 1',
          quantity: '8',
          totalCostBase: '80.00',
        },
        {
          entryType: 'usage',
          lineType: 'item',
          sourceType: 'inventory_issue',
          productId: p1,
          description: 'Returned credit from putaway',
          quantity: '-2', // Negative usage = return credit
          totalCostBase: '-20.00',
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, [], ledgerEntries);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(12);
      expect(item1?.consumedQty).toBe(8);
      expect(item1?.returnedQty).toBe(2);
      expect(item1?.availableQty).toBe(12);
      expect(item1?.totalCost).toBe(60); // 80 - 20
    });

    it('tracks Staging-at-Cost creation and partial return accurately without negative cost', () => {
      // 5 staged @ $20.79 = $103.95, 2 returned @ $20.79 = -$41.58 -> 3 remaining in staging bin
      const stagedStock: ProjectStagingInventoryInput[] = [
        { productId: p1, productNumber: '215520', productName: 'Seal', actualQuantity: '3' },
      ];
      const ledgerEntries: ProjectLedgerEntryInput[] = [
        {
          entryType: 'usage',
          lineType: 'item',
          sourceType: 'inventory_issue',
          productId: p1,
          description: 'Staged 5x Seal (Ref: Transfer Staging Putaway)',
          quantity: '5',
          totalCostBase: '103.95',
        },
        {
          entryType: 'usage',
          lineType: 'item',
          sourceType: 'inventory_issue',
          productId: p1,
          description: 'Returned 2x Seal (Ref: Transfer Return Putaway)',
          quantity: '-2',
          totalCostBase: '-41.58',
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, [], ledgerEntries);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(3);
      expect(item1?.consumedQty).toBe(0);
      expect(item1?.returnedQty).toBe(2);
      expect(item1?.availableQty).toBe(3);
      expect(Number(item1?.totalCost.toFixed(2))).toBe(62.37); // Net cost for 3 units
    });

    it('validates complete reverse net out to $0.00 when all staged items are returned', () => {
      // 5 staged, all 5 returned -> 0 physical in staging bin, net cost = $0.00
      const stagedStock: ProjectStagingInventoryInput[] = [];
      const ledgerEntries: ProjectLedgerEntryInput[] = [
        {
          entryType: 'usage',
          lineType: 'item',
          sourceType: 'inventory_issue',
          productId: p1,
          description: 'Staged 5x Seal (Ref: Transfer Staging Putaway)',
          quantity: '5',
          totalCostBase: '103.95',
        },
        {
          entryType: 'usage',
          lineType: 'item',
          sourceType: 'inventory_issue',
          productId: p1,
          description: 'Returned 5x Seal (Ref: Transfer Return Putaway)',
          quantity: '-5',
          totalCostBase: '-103.95',
        },
      ];

      const summary = calculateProjectMaterialsSummary(stagedStock, [], ledgerEntries);
      const item1 = summary.find((s) => s.productId === p1);

      expect(item1?.stagedQty).toBe(0);
      expect(item1?.consumedQty).toBe(0);
      expect(item1?.returnedQty).toBe(5);
      expect(item1?.availableQty).toBe(0);
      expect(Number(item1?.totalCost.toFixed(2))).toBe(0.00); // Perfectly nets out to 0
    });

    it('handles empty staged stock, transfers, and ledger inputs safely', () => {
      const summary = calculateProjectMaterialsSummary([], [], []);
      expect(summary).toEqual([]);
    });
  });
});
