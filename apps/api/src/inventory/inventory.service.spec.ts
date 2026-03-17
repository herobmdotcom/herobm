import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService, StockLine } from './inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('InventoryService', () => {
  let service: InventoryService;

  // =========================================================================
  // Read-only query mocks
  // =========================================================================

  const mockRows = [
    {
      inventoryLevelId: 'I001',
      productNumber: 'BOLT-M8',
      productName: 'M8 Hex Bolt',
      locationNo: '1',
      quantityOnHand: '100',
    },
    {
      inventoryLevelId: 'I002',
      productNumber: 'NUT-M8',
      productName: 'M8 Hex Nut',
      locationNo: '1',
      quantityOnHand: '200',
    },
  ];

  const mockBinRows = [
    {
      binContentsId: 'B001',
      binNumber: 'A-01-01',
      productNumber: 'BOLT-M8',
      productName: 'M8 Hex Bolt',
      actualQuantity: '50',
    },
  ];

  const mockQb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn(),
    then: jest.fn(),
  };

  const mockDb = {
    select: jest
      .fn()
      .mockReturnValue({ from: jest.fn().mockReturnValue(mockQb) }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQb.$dynamic.mockReturnValue(mockQb);
    mockQb.where.mockReturnValue(mockQb);
    mockQb.then = jest.fn().mockImplementation((cb) => cb(mockRows));

    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // =========================================================================
  // Read-only queries (from mart_inventory)
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated inventory levels', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 50);
    });

    it('should apply search filter', async () => {
      await service.findAll({ q: 'bolt' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should cap limit at 100000', async () => {
      await service.findAll({ limit: 200_000 });
      expect(mockQb.limit).toHaveBeenCalledWith(100_000);
    });

    it('should filter by locationNo', async () => {
      await service.findAll({ locationNo: 'LOC01' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should apply both search and locationNo filters', async () => {
      await service.findAll({ q: 'bolt', locationNo: 'LOC01' });
      expect(mockQb.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('findBins', () => {
    it('should return paginated bin contents', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      const result = await service.findBins();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
    });

    it('should apply search filter', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ q: 'A-01' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should filter by locationNo', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ locationNo: 'LOC02' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should apply both search and locationNo for bins', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ q: 'A-01', locationNo: 'LOC02' });
      expect(mockQb.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByProductIds', () => {
    it('should return inventory rows for given product IDs', async () => {
      const result = await service.findByProductIds(['P001', 'P002']);
      expect(result).toHaveProperty('data');
      expect(mockQb.where).toHaveBeenCalled();
      expect(mockQb.orderBy).toHaveBeenCalled();
    });

    it('should return empty data for empty product IDs array', async () => {
      const result = await service.findByProductIds([]);
      expect(result).toEqual({ data: [] });
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Stock mutation methods (write to modbm_core.inventory_levels)
  //
  // Strategy: spy on the private applyDelta method to verify:
  //   1. Which column(s) each public method targets
  //   2. The sign of the delta (+/-)
  //   3. The product ID and location passed
  //   4. Filtering logic (null productId, zero/negative qty)
  // =========================================================================

  describe('stock mutations', () => {
    let mockTx: any;
    /** Captured calls to applyDelta: [productId, locationNo, column, delta] */
    let deltaLog: Array<{
      productId: string;
      locationNo: string;
      column: string;
      delta: number;
    }>;
    let applyDeltaSpy: jest.SpyInstance;

    beforeEach(() => {
      deltaLog = [];
      mockTx = {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
      };

      // Spy on the private applyDelta to capture the exact column + delta
      applyDeltaSpy = jest
        .spyOn(service as any, 'applyDelta')
        .mockImplementation(
          async (
            _tx: any,
            productId: string,
            locationNo: string,
            column: string,
            delta: number,
          ) => {
            deltaLog.push({ productId, locationNo, column, delta });
          },
        );
    });

    afterEach(() => {
      applyDeltaSpy.mockRestore();
    });

    // ── commitStock ────────────────────────────────────────────────────────
    // Business rule: order confirmed → quantity_committed goes UP

    describe('commitStock', () => {
      it('should increase quantity_committed by the line quantity', async () => {
        await service.commitStock(mockTx, [
          { productId: 'P1', quantity: '10' },
        ]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_committed',
            delta: 10,
          },
        ]);
      });

      it('should NOT touch quantity_on_hand or quantity_on_order', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '5' }]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_on_hand');
        expect(columns).not.toContain('quantity_on_order');
      });

      it('should process each line independently', async () => {
        const lines: StockLine[] = [
          { productId: 'A', quantity: '3' },
          { productId: 'B', quantity: '7' },
        ];
        await service.commitStock(mockTx, lines);
        expect(deltaLog).toHaveLength(2);
        expect(deltaLog[0]).toMatchObject({ productId: 'A', delta: 3 });
        expect(deltaLog[1]).toMatchObject({ productId: 'B', delta: 7 });
      });

      it('should use MAIN as default location', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '1' }]);
        expect(deltaLog[0].locationNo).toBe('MAIN');
      });

      it('should use custom location when provided', async () => {
        await service.commitStock(
          mockTx,
          [{ productId: 'P1', quantity: '1' }],
          'WH-02',
        );
        expect(deltaLog[0].locationNo).toBe('WH-02');
      });

      it('should skip lines with null productId', async () => {
        await service.commitStock(mockTx, [
          { productId: null, quantity: '10' },
          { productId: 'P1', quantity: '5' },
        ]);
        expect(deltaLog).toHaveLength(1);
        expect(deltaLog[0].productId).toBe('P1');
      });

      it('should skip lines with zero quantity', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '0' }]);
        expect(deltaLog).toHaveLength(0);
      });

      it('should skip lines with negative quantity', async () => {
        await service.commitStock(mockTx, [
          { productId: 'P1', quantity: '-5' },
        ]);
        expect(deltaLog).toHaveLength(0);
      });

      it('should handle empty lines array', async () => {
        await service.commitStock(mockTx, []);
        expect(deltaLog).toHaveLength(0);
      });

      it('should handle fractional quantities', async () => {
        await service.commitStock(mockTx, [
          { productId: 'P1', quantity: '2.5' },
        ]);
        expect(deltaLog[0].delta).toBe(2.5);
      });
    });

    // ── releaseStock ───────────────────────────────────────────────────────
    // Business rule: order cancelled from committed → quantity_committed goes DOWN

    describe('releaseStock', () => {
      it('should decrease quantity_committed by the line quantity', async () => {
        await service.releaseStock(mockTx, [
          { productId: 'P1', quantity: '10' },
        ]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_committed',
            delta: -10,
          },
        ]);
      });

      it('should NOT touch quantity_on_hand or quantity_on_order', async () => {
        await service.releaseStock(mockTx, [
          { productId: 'P1', quantity: '5' },
        ]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_on_hand');
        expect(columns).not.toContain('quantity_on_order');
      });

      it('should skip null productIds', async () => {
        await service.releaseStock(mockTx, [
          { productId: null, quantity: '10' },
        ]);
        expect(deltaLog).toHaveLength(0);
      });
    });

    // ── deductStock ────────────────────────────────────────────────────────
    // Business rule: shipment dispatched → on-hand DOWN, committed DOWN

    describe('deductStock', () => {
      it('should decrease both quantity_on_hand and quantity_committed', async () => {
        await service.deductStock(mockTx, [{ productId: 'P1', quantity: '5' }]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_hand',
            delta: -5,
          },
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_committed',
            delta: -5,
          },
        ]);
      });

      it('should process multiple lines with 2 deltas per line', async () => {
        await service.deductStock(mockTx, [
          { productId: 'A', quantity: '3' },
          { productId: 'B', quantity: '7' },
        ]);
        expect(deltaLog).toHaveLength(4);
        // deductStock processes on_hand for ALL lines, then committed for ALL lines
        expect(deltaLog[0]).toMatchObject({
          productId: 'A',
          column: 'quantity_on_hand',
          delta: -3,
        });
        expect(deltaLog[1]).toMatchObject({
          productId: 'B',
          column: 'quantity_on_hand',
          delta: -7,
        });
        expect(deltaLog[2]).toMatchObject({
          productId: 'A',
          column: 'quantity_committed',
          delta: -3,
        });
        expect(deltaLog[3]).toMatchObject({
          productId: 'B',
          column: 'quantity_committed',
          delta: -7,
        });
      });

      it('should NOT touch quantity_on_order', async () => {
        await service.deductStock(mockTx, [{ productId: 'P1', quantity: '5' }]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_on_order');
      });
    });

    // ── restoreStock ───────────────────────────────────────────────────────
    // Business rule: shipment reversed → on-hand UP, committed UP

    describe('restoreStock', () => {
      it('should increase both quantity_on_hand and quantity_committed', async () => {
        await service.restoreStock(mockTx, [
          { productId: 'P1', quantity: '5' },
        ]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_hand',
            delta: 5,
          },
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_committed',
            delta: 5,
          },
        ]);
      });

      it('should handle empty lines', async () => {
        await service.restoreStock(mockTx, []);
        expect(deltaLog).toHaveLength(0);
      });
    });

    // ── returnStock ────────────────────────────────────────────────────────
    // Business rule: return processed → on-hand UP (only)

    describe('returnStock', () => {
      it('should increase quantity_on_hand only', async () => {
        await service.returnStock(mockTx, [{ productId: 'P1', quantity: '3' }]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_hand',
            delta: 3,
          },
        ]);
      });

      it('should NOT touch quantity_committed (returned stock is not committed)', async () => {
        await service.returnStock(mockTx, [{ productId: 'P1', quantity: '3' }]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_committed');
      });

      it('should NOT touch quantity_on_order', async () => {
        await service.returnStock(mockTx, [{ productId: 'P1', quantity: '3' }]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_on_order');
      });
    });

    // ── placeOnOrder ───────────────────────────────────────────────────────
    // Business rule: PO ordered → on-order UP

    describe('placeOnOrder', () => {
      it('should increase quantity_on_order only', async () => {
        await service.placeOnOrder(mockTx, [
          { productId: 'P1', quantity: '100' },
        ]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_order',
            delta: 100,
          },
        ]);
      });

      it('should NOT touch quantity_on_hand or quantity_committed', async () => {
        await service.placeOnOrder(mockTx, [
          { productId: 'P1', quantity: '100' },
        ]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_on_hand');
        expect(columns).not.toContain('quantity_committed');
      });
    });

    // ── cancelOnOrder ──────────────────────────────────────────────────────
    // Business rule: PO cancelled from ordered → on-order DOWN

    describe('cancelOnOrder', () => {
      it('should decrease quantity_on_order only', async () => {
        await service.cancelOnOrder(mockTx, [
          { productId: 'P1', quantity: '100' },
        ]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_order',
            delta: -100,
          },
        ]);
      });

      it('should NOT touch quantity_on_hand or quantity_committed', async () => {
        await service.cancelOnOrder(mockTx, [
          { productId: 'P1', quantity: '100' },
        ]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_on_hand');
        expect(columns).not.toContain('quantity_committed');
      });
    });

    // ── receiveStock ───────────────────────────────────────────────────────
    // Business rule: PO received → on-hand UP, on-order DOWN

    describe('receiveStock', () => {
      it('should increase quantity_on_hand and decrease quantity_on_order', async () => {
        await service.receiveStock(mockTx, [
          { productId: 'P1', quantity: '50' },
        ]);
        expect(deltaLog).toEqual([
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_hand',
            delta: 50,
          },
          {
            productId: 'P1',
            locationNo: 'MAIN',
            column: 'quantity_on_order',
            delta: -50,
          },
        ]);
      });

      it('should NOT touch quantity_committed', async () => {
        await service.receiveStock(mockTx, [
          { productId: 'P1', quantity: '50' },
        ]);
        const columns = deltaLog.map((d) => d.column);
        expect(columns).not.toContain('quantity_committed');
      });
    });

    // ── Symmetry tests ─────────────────────────────────────────────────────
    // Complementary operations must be exact inverses

    describe('symmetry', () => {
      it('commitStock and releaseStock are exact inverses', async () => {
        const lines: StockLine[] = [{ productId: 'P1', quantity: '10' }];

        await service.commitStock(mockTx, lines);
        const commitDeltas = [...deltaLog];
        deltaLog = [];

        await service.releaseStock(mockTx, lines);
        const releaseDeltas = [...deltaLog];

        // Same number of deltas
        expect(commitDeltas).toHaveLength(releaseDeltas.length);

        // Same columns, opposite signs
        for (let i = 0; i < commitDeltas.length; i++) {
          expect(commitDeltas[i].column).toBe(releaseDeltas[i].column);
          expect(commitDeltas[i].delta).toBe(-releaseDeltas[i].delta);
        }
      });

      it('deductStock and restoreStock are exact inverses', async () => {
        const lines: StockLine[] = [{ productId: 'P1', quantity: '5' }];

        await service.deductStock(mockTx, lines);
        const deductDeltas = [...deltaLog];
        deltaLog = [];

        await service.restoreStock(mockTx, lines);
        const restoreDeltas = [...deltaLog];

        expect(deductDeltas).toHaveLength(restoreDeltas.length);

        for (let i = 0; i < deductDeltas.length; i++) {
          expect(deductDeltas[i].column).toBe(restoreDeltas[i].column);
          expect(deductDeltas[i].delta).toBe(-restoreDeltas[i].delta);
        }
      });

      it('placeOnOrder and cancelOnOrder are exact inverses', async () => {
        const lines: StockLine[] = [{ productId: 'P1', quantity: '20' }];

        await service.placeOnOrder(mockTx, lines);
        const placeDeltas = [...deltaLog];
        deltaLog = [];

        await service.cancelOnOrder(mockTx, lines);
        const cancelDeltas = [...deltaLog];

        expect(placeDeltas).toHaveLength(cancelDeltas.length);

        for (let i = 0; i < placeDeltas.length; i++) {
          expect(placeDeltas[i].column).toBe(cancelDeltas[i].column);
          expect(placeDeltas[i].delta).toBe(-cancelDeltas[i].delta);
        }
      });

      it('full dispatch-then-reverse cycle leaves net zero deltas', async () => {
        const lines: StockLine[] = [
          { productId: 'A', quantity: '10' },
          { productId: 'B', quantity: '5' },
        ];

        await service.deductStock(mockTx, lines);
        await service.restoreStock(mockTx, lines);

        // Sum all deltas by (productId, column)
        const totals: Record<string, number> = {};
        for (const d of deltaLog) {
          const key = `${d.productId}:${d.column}`;
          totals[key] = (totals[key] || 0) + d.delta;
        }

        // Every combination should net to zero
        Object.values(totals).forEach((net) => expect(net).toBe(0));
      });

      it('full order lifecycle: confirm → dispatch → return restores on-hand', async () => {
        const lines: StockLine[] = [{ productId: 'P1', quantity: '10' }];

        // Step 1: Confirm order → commit stock
        await service.commitStock(mockTx, lines);
        // Step 2: Dispatch shipment → deduct on-hand + committed
        await service.deductStock(mockTx, lines);
        // Step 3: Return goods → restore on-hand
        await service.returnStock(mockTx, lines);

        // Sum deltas by column
        const totals: Record<string, number> = {};
        for (const d of deltaLog) {
          totals[d.column] = (totals[d.column] || 0) + d.delta;
        }

        // on_hand: -10 (deduct) + 10 (return) = 0
        expect(totals['quantity_on_hand']).toBe(0);
        // committed: +10 (commit) - 10 (deduct) = 0
        expect(totals['quantity_committed']).toBe(0);
      });
    });

    // ── Filtering and edge cases ────────────────────────────────────────────

    describe('filtering and edge cases', () => {
      it('should skip lines with empty string quantity (parsed as 0)', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '' }]);
        expect(deltaLog).toHaveLength(0);
      });

      it('should process valid lines and skip invalid ones in the same batch', async () => {
        await service.commitStock(mockTx, [
          { productId: null, quantity: '10' }, // skip: null productId
          { productId: 'P1', quantity: '0' }, // skip: zero qty
          { productId: 'P2', quantity: '-5' }, // skip: negative qty
          { productId: 'P3', quantity: '7' }, // ✓ valid
          { productId: 'P4', quantity: '3.5' }, // ✓ valid
        ]);
        expect(deltaLog).toHaveLength(2);
        expect(deltaLog[0]).toMatchObject({ productId: 'P3', delta: 7 });
        expect(deltaLog[1]).toMatchObject({ productId: 'P4', delta: 3.5 });
      });

      it('should handle very large quantities', async () => {
        await service.commitStock(mockTx, [
          { productId: 'P1', quantity: '999999' },
        ]);
        expect(deltaLog[0].delta).toBe(999999);
      });
    });
  });
});
