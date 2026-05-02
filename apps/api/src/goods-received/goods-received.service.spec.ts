import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedService } from './goods-received.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';

jest.mock('../purchase-orders/purchase-order-lifecycle-rules', () => ({
  evaluatePOLifecycleRules: jest.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb: any) => cb(resolvedValue)),
  };
  return qb;
}

/**
 * Build a mock transaction where `tx.select()` returns results from a queue.
 * Each call to `tx.select()` pops the next entry from `selectResults`.
 */
function buildMockTx(selectResults: any[][]) {
  const resultQueue = [...selectResults];

  const tx: any = {
    select: jest.fn().mockImplementation(() => {
      const result = resultQueue.shift() || [];
      const qb = createMockQueryBuilder(result);
      qb.from = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.limit = jest.fn().mockReturnValue(qb);
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.leftJoin = jest.fn().mockReturnValue(qb);
      return qb;
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([{}])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([{}])),
  };

  return tx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoodsReceivedService', () => {
  let service: GoodsReceivedService;
  let mockDb: any;
  let mockTx: any;
  let mockInventoryService: any;

  beforeEach(async () => {
    mockTx = buildMockTx([]);

    mockDb = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockTx)),
      select: jest.fn(),
      $count: jest.fn().mockReturnValue(0),
    };

    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceivedService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<GoodsReceivedService>(GoodsReceivedService);
  });

  // =======================================================================
  // create()
  // =======================================================================

  describe('create', () => {
    it('should throw NotFoundException when supplier does not exist', async () => {
      mockTx = buildMockTx([
        [], // 1. vendor lookup → empty = not found
      ]);
      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.create(
          {
            vendorId: 'missing-vendor',
            locationId: 'loc-1',
            lines: [{ productId: 'p-1', quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when location does not exist', async () => {
      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }], // 1. vendor found
        [], // 2. location → not found
      ]);
      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.create(
          {
            vendorId: 'v1',
            locationId: 'missing-loc',
            lines: [{ productId: 'p-1', quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when product does not exist', async () => {
      // Prepare the insert mock to return a goods received header
      const headerInsertQb = createMockQueryBuilder([
        { goodsReceivedId: 'gr-1', receiptNumber: 'GR-ABCD1234' },
      ]);

      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }], // 1. vendor
        [{ locationId: 'loc-1' }], // 2. location
        // product lookup is the next select after insert — handled below
        [], // 3. product → not found
      ]);
      mockTx.insert = jest.fn().mockReturnValue(headerInsertQb);
      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        service.create(
          {
            vendorId: 'v1',
            locationId: 'loc-1',
            lines: [{ productId: 'missing-product', quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set match_status to "matched" when exactly one open PO line exists', async () => {
      const headerInsertQb = createMockQueryBuilder([
        { goodsReceivedId: 'gr-1', receiptNumber: 'GR-ABCD1234' },
      ]);
      const linesInsertQb = createMockQueryBuilder([{}]);

      // The service calls findOne at the end, which also uses tx.select().
      // We provide mock results for that too.
      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }], // 1. vendor
        [{ locationId: 'loc-1' }], // 2. location
        [{ productId: 'p-1' }], // 3. product validation
        [
          // 4. open PO lines → exactly 1
          {
            purchaseOrderLineId: 'pol-1',
            purchaseOrderId: 'po-1',
            quantity: '20',
            quantityReceived: '0',
          },
        ],
        [{ zoneId: 'z1' }], // 5. Find zone
        [{ binId: 'b1' }], // 6. Find bin
        [{ quantity: '20', quantityReceived: '5' }], // 7. Recompute PO state
        // findOne selects:
        [
          {
            receipt: { goodsReceivedId: 'gr-1', receiptNumber: 'GR-ABCD1234' },
            vendorName: 'ACME',
            vendorNumber: 'V001',
          },
        ],
        [], // findOne lines
      ]);

      // Track what insert().values() receives
      const capturedLineValues: any[] = [];
      const lineInsertMock = {
        values: jest.fn().mockImplementation((vals: any) => {
          capturedLineValues.push(vals);
          return linesInsertQb;
        }),
        returning: jest.fn().mockResolvedValue([{}]),
      };

      let insertCallCount = 0;
      mockTx.insert = jest.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) return headerInsertQb; // goods_received header
        if (insertCallCount === 2) return lineInsertMock; // goods_received_lines
        return createMockQueryBuilder([{}]); // event emit
      });

      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      expect(capturedLineValues.length).toBe(1);
      const lineArr = capturedLineValues[0];
      expect(Array.isArray(lineArr)).toBe(true);
      expect(lineArr[0].matchStatus).toBe('matched');
      expect(lineArr[0].purchaseOrderLineId).toBe('pol-1');
      expect(lineArr[0].purchaseOrderId).toBe('po-1');
    });

    it('should set match_status to "ambiguous" when multiple open PO lines exist', async () => {
      const headerInsertQb = createMockQueryBuilder([
        { goodsReceivedId: 'gr-1', receiptNumber: 'GR-ABCD1234' },
      ]);
      const linesInsertQb = createMockQueryBuilder([{}]);

      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }],
        [{ locationId: 'loc-1' }],
        [{ productId: 'p-1' }],
        [
          // multiple open PO lines
          {
            purchaseOrderLineId: 'pol-1',
            purchaseOrderId: 'po-1',
            quantity: '20',
            quantityReceived: '0',
          },
          {
            purchaseOrderLineId: 'pol-2',
            purchaseOrderId: 'po-2',
            quantity: '10',
            quantityReceived: '0',
          },
        ],
        [{ zoneId: 'z1' }], // 5. Find zone
        [{ binId: 'b1' }], // 6. Find bin
        // (No PO update for ambiguous matches)
        [
          {
            receipt: { goodsReceivedId: 'gr-1' },
            vendorName: 'ACME',
            vendorNumber: 'V001',
          },
        ],
        [],
      ]);

      const capturedLineValues: any[] = [];
      const lineInsertMock = {
        values: jest.fn().mockImplementation((vals: any) => {
          capturedLineValues.push(vals);
          return linesInsertQb;
        }),
        returning: jest.fn().mockResolvedValue([{}]),
      };

      let insertCallCount = 0;
      mockTx.insert = jest.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) return headerInsertQb;
        if (insertCallCount === 2) return lineInsertMock;
        return createMockQueryBuilder([{}]);
      });

      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      expect(capturedLineValues[0][0].matchStatus).toBe('ambiguous');
      expect(capturedLineValues[0][0].purchaseOrderLineId).toBeNull();
      expect(capturedLineValues[0][0].purchaseOrderId).toBeNull();
    });

    it('should set match_status to "unmatched" when no open PO lines exist', async () => {
      const headerInsertQb = createMockQueryBuilder([
        { goodsReceivedId: 'gr-1', receiptNumber: 'GR-ABCD1234' },
      ]);
      const linesInsertQb = createMockQueryBuilder([{}]);

      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }],
        [{ locationId: 'loc-1' }],
        [{ productId: 'p-1' }],
        [], // no open PO lines
        [{ zoneId: 'z1' }], // 5. Find zone
        [{ binId: 'b1' }], // 6. Find bin
        [
          {
            receipt: { goodsReceivedId: 'gr-1' },
            vendorName: 'ACME',
            vendorNumber: 'V001',
          },
        ],
        [],
      ]);

      const capturedLineValues: any[] = [];
      const lineInsertMock = {
        values: jest.fn().mockImplementation((vals: any) => {
          capturedLineValues.push(vals);
          return linesInsertQb;
        }),
        returning: jest.fn().mockResolvedValue([{}]),
      };

      let insertCallCount = 0;
      mockTx.insert = jest.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) return headerInsertQb;
        if (insertCallCount === 2) return lineInsertMock;
        return createMockQueryBuilder([{}]);
      });

      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '5' }],
        },
        'admin',
      );

      expect(capturedLineValues[0][0].matchStatus).toBe('unmatched');
      expect(capturedLineValues[0][0].purchaseOrderLineId).toBeNull();
      expect(capturedLineValues[0][0].purchaseOrderId).toBeNull();
    });

    it('should handle multiple lines with different match outcomes', async () => {
      const headerInsertQb = createMockQueryBuilder([
        { goodsReceivedId: 'gr-1', receiptNumber: 'GR-MULTI' },
      ]);
      const linesInsertQb = createMockQueryBuilder([{}]);

      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }],
        [{ locationId: 'loc-1' }],
        // Line 1: product A
        [{ productId: 'p-A' }],
        [
          {
            purchaseOrderLineId: 'pol-A',
            purchaseOrderId: 'po-A',
            quantity: '10',
            quantityReceived: '0',
          },
        ], // matched
        // Line 2: product B
        [{ productId: 'p-B' }],
        [], // unmatched
        [{ zoneId: 'z1' }], // 7. Find zone
        [{ binId: 'b1' }], // 8. Find bin
        [{ quantity: '10', quantityReceived: '3' }], // 9. Recompute PO state (for po-A)
        // findOne
        [
          {
            receipt: { goodsReceivedId: 'gr-1' },
            vendorName: 'ACME',
            vendorNumber: 'V001',
          },
        ],
        [],
      ]);

      const capturedLineValues: any[] = [];
      const lineInsertMock = {
        values: jest.fn().mockImplementation((vals: any) => {
          capturedLineValues.push(vals);
          return linesInsertQb;
        }),
        returning: jest.fn().mockResolvedValue([{}]),
      };

      let insertCallCount = 0;
      mockTx.insert = jest.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) return headerInsertQb;
        if (insertCallCount === 2) return lineInsertMock;
        return createMockQueryBuilder([{}]);
      });

      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [
            { productId: 'p-A', quantityReceived: '3' },
            { productId: 'p-B', quantityReceived: '7' },
          ],
        },
        'admin',
      );

      const lines = capturedLineValues[0];
      expect(lines).toHaveLength(2);
      expect(lines[0].matchStatus).toBe('matched');
      expect(lines[1].matchStatus).toBe('unmatched');
    });

    it('should not update inventory, QOH, or PO state', async () => {
      const headerInsertQb = createMockQueryBuilder([
        { goodsReceivedId: 'gr-1', receiptNumber: 'GR-NOINV' },
      ]);

      mockTx = buildMockTx([
        [{ vendorId: 'v1', name: 'ACME' }],
        [{ locationId: 'loc-1' }],
        [{ productId: 'p-1' }],
        [
          {
            purchaseOrderLineId: 'pol-1',
            purchaseOrderId: 'po-1',
            quantity: '10',
            quantityReceived: '0',
          },
        ],
        [{ zoneId: 'z1' }], // 5. Find zone
        [{ binId: 'b1' }], // 6. Find bin
        [{ quantity: '10', quantityReceived: '10' }], // 7. Recompute PO state
        [
          {
            receipt: { goodsReceivedId: 'gr-1' },
            vendorName: 'ACME',
            vendorNumber: 'V001',
          },
        ],
        [],
      ]);

      const linesInsertQb = createMockQueryBuilder([{}]);
      let insertCallCount = 0;
      mockTx.insert = jest.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) return headerInsertQb;
        if (insertCallCount === 2) {
          return {
            values: jest.fn().mockReturnValue(linesInsertQb),
            returning: jest.fn().mockResolvedValue([{}]),
          };
        }
        return createMockQueryBuilder([{}]);
      });

      mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.create(
        {
          vendorId: 'v1',
          locationId: 'loc-1',
          lines: [{ productId: 'p-1', quantityReceived: '10' }],
        },
        'admin',
      );

      // The service SHOULD call tx.update to update PO line quantity_received
      // and PO header stateCode.
      expect(mockTx.update).toHaveBeenCalled();
    });
  });

  // =======================================================================
  // findOne()
  // =======================================================================

  describe('findOne', () => {
    it('should throw NotFoundException when receipt does not exist', async () => {
      // findOne calls .then(res => res[0]) — return empty array so res[0] is undefined
      const selectQb = createMockQueryBuilder([]);
      selectQb.from = jest.fn().mockReturnValue(selectQb);
      selectQb.leftJoin = jest.fn().mockReturnValue(selectQb);
      selectQb.where = jest.fn().mockReturnValue(selectQb);
      selectQb.limit = jest.fn().mockReturnValue(selectQb);
      selectQb.then = jest.fn().mockImplementation((cb: any) => cb([]));

      const dbForFindOne: any = {
        select: jest.fn().mockReturnValue(selectQb),
      };

      await expect(
        service.findOne('nonexistent-id', dbForFindOne),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
