import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';

// ---------------------------------------------------------------------------
// Mock helpers
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
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx(selectResponses?: any[][]): any {
  let selectCall = 0;
  return {
    select: jest.fn().mockImplementation(() => {
      const resp = selectResponses ? selectResponses[selectCall++] || [] : [];
      return createMockQueryBuilder(resp);
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest
      .fn()
      .mockReturnValue({ from: jest.fn().mockReturnValue(selectQb) }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    transaction: jest
      .fn()
      .mockImplementation(async (cb: any) => cb(createMockTx())),
    _selectQb: selectQb,
  };
  return db;
}

// Shared test data
const PICKING_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260316-0001',
  stateCode: 'picking',
  customerId: 'c0000000-0000-0000-0000-000000000001',
};

const DRAFT_ORDER = {
  salesOrderId: 'order-002',
  orderNumber: 'ORD-20260316-0002',
  stateCode: 'draft',
  customerId: 'c0000000-0000-0000-0000-000000000001',
};

const ORDER_LINE = {
  salesOrderLineId: 'line-001',
  salesOrderId: 'order-001',
  lineNumber: 1,
  productId: 'PROD-001',
  productDescription: 'Widget A',
  quantity: '10',
  quantityPicked: '0',
  pricePerUnit: '50.00',
  amount: '500.00',
  fulfillmentLocationId: 'MAIN',
};

describe('PickingService', () => {
  let service: PickingService;
  let mockDb: any;

  function mockSelectChain(responses: Record<number, any[]>) {
    let call = 0;
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        call++;
        const data = responses[call] ?? [];
        const qb = createMockQueryBuilder(data);
        qb.innerJoin = jest.fn().mockReturnValue(qb);
        qb.leftJoin = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  function mockTransaction(result: any, selectResponses: any[][] = []) {
    const mockTx = createMockTx(selectResponses);
    const txQb = createMockQueryBuilder(
      Array.isArray(result) ? result : [result],
    );
    mockTx.update = jest.fn().mockReturnValue(txQb);
    mockDb.transaction = jest
      .fn()
      .mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  let mockInventoryService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    mockInventoryService = {
      recordInventoryMovement: jest.fn(),
    };

    const mockShipmentService = {
      createShipment: jest.fn().mockResolvedValue({
        shipmentId: 'ship-new',
        shipmentNumber: 'SHP-20260316-0001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest.fn().mockReturnValue('MAIN'),
          },
        },
        PickingService,
        { provide: ShipmentService, useValue: mockShipmentService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<PickingService>(PickingService);
  });

  // =========================================================================
  // pickLine
  // =========================================================================

  describe('pickLine', () => {
    function setupPickLine(orderState: string) {
      mockSelectChain({
        1: [{ ...PICKING_ORDER, stateCode: orderState }],
        2: [ORDER_LINE],
        3: [{ sum: 0 }], // currentPickSum query
        4: [{ binId: 'ship-bin' }], // SHIPPING bin lookup
        5: [{ ...PICKING_ORDER, stateCode: orderState }], // findOrder in evaluateLifecycleRules
        6: [], // findOrderLine inside rules (or any other queries in rules)
      });
      // The transaction callback calls tx.insert().values().returning()
      // which needs to return a pick record with pickId
      const mockTx = createMockTx([[{ ...PICKING_ORDER, stateCode: orderState }]]);
      const pickRecord = {
        pickId: 'new-pick-001',
        salesOrderId: 'order-001',
        salesOrderLineId: 'line-001',
        productId: 'PROD-001',
        binId: 'bin-1',
        quantity: '5',
        stateCode: 'picked',
      };
      mockTx.insert = jest
        .fn()
        .mockReturnValue(createMockQueryBuilder([pickRecord]));
      mockTx.update = jest.fn().mockReturnValue(createMockQueryBuilder([]));
      mockDb.transaction = jest
        .fn()
        .mockImplementation(async (cb: any) => cb(mockTx));
    }

    it('should update quantity_picked on a picking order', async () => {
      setupPickLine('picking');
      const result = await service.pickLine(
        'order-001',
        'line-001',
        'bin-1',
        '5',
        'admin',
      );
      expect(result).toHaveProperty('pickId', 'new-pick-001');
      expect(result).toHaveProperty('quantity', '5');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject pick on non-picking state order', async () => {
      setupPickLine('draft');
      await expect(
        service.pickLine('order-001', 'line-001', 'bin-1', '5', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative quantity', async () => {
      setupPickLine('picking');
      await expect(
        service.pickLine('order-001', 'line-001', 'bin-1', '-1', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject quantity exceeding ordered', async () => {
      setupPickLine('picking');
      await expect(
        service.pickLine('order-001', 'line-001', 'bin-1', '15', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown order', async () => {
      mockSelectChain({ 1: [] });
      await expect(
        service.pickLine('NONEXISTENT', 'line-001', 'bin-1', '5', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // assertFullyPicked
  // =========================================================================

  describe('assertFullyPicked', () => {
    it('should pass when all lines fully picked', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [
          {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            quantity: '10',
            quantityPicked: '10',
            productId: 'p1',
          },
          {
            salesOrderLineId: 'line-2',
            lineNumber: 2,
            quantity: '5',
            quantityPicked: '5',
            productId: 'p2',
          },
        ],
        3: [],
        4: [],
        5: [
          { salesOrderLineId: 'line-1', quantity: '10', stateCode: 'picked' },
          { salesOrderLineId: 'line-2', quantity: '5', stateCode: 'picked' },
        ],
      });
      await expect(
        service.assertFullyPicked('order-001'),
      ).resolves.toBeUndefined();
    });

    it('should throw when lines not fully picked', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [
          {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            quantity: '10',
            quantityPicked: '10',
            productId: 'p1',
          },
          {
            salesOrderLineId: 'line-2',
            lineNumber: 2,
            quantity: '5',
            quantityPicked: '3',
            productId: 'p2',
          },
        ],
        3: [],
        4: [],
        5: [
          { salesOrderLineId: 'line-1', quantity: '10', stateCode: 'picked' },
          { salesOrderLineId: 'line-2', quantity: '3', stateCode: 'picked' },
        ],
      });
      await expect(service.assertFullyPicked('order-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include unpicked line details in error message', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [
          {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            quantity: '10',
            quantityPicked: '7',
            productId: 'p1',
          },
        ],
        3: [],
        4: [],
        5: [{ salesOrderLineId: 'line-1', quantity: '7', stateCode: 'picked' }],
      });
      try {
        await service.assertFullyPicked('order-001');
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('line 1');
        expect(e.message).toContain('picked 7 of 10');
      }
    });
  });

  // =========================================================================
  // getPickingSummary
  // =========================================================================

  describe('getPickingSummary', () => {
    it('should calculate picking summary and shipped quantities', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [
          {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            productId: 'p1',
            productDescription: 'desc1',
            quantity: '10',
            quantityPicked: '10',
            productNumber: 'PN-1',
          },
          {
            salesOrderLineId: 'line-2',
            lineNumber: 2,
            productId: 'p2',
            productDescription: 'desc2',
            quantity: '5',
            quantityPicked: '2',
            productNumber: 'PN-2',
          },
        ],
        // getCommittedPerLine: shipments
        3: [
          {
            shipmentId: 'ship-1',
            salesOrderId: 'order-001',
            stateCode: 'dispatched',
          },
        ],
        // getCommittedPerLine: shipment lines for ship-1
        4: [
          {
            shipmentLineId: 'sl-1',
            shipmentId: 'ship-1',
            salesOrderLineId: 'line-1',
            quantityShipped: '5',
          },
        ],
        // bins joined with inventoryLevels
        5: [],
        // salesOrderPicks
        6: [
          {
            pickId: 'pick-1',
            salesOrderLineId: 'line-1',
            quantity: '10',
            stateCode: 'picked',
          },
          {
            pickId: 'pick-2',
            salesOrderLineId: 'line-2',
            quantity: '2',
            stateCode: 'picked',
          },
        ],
      });

      const summary = await service.getPickingSummary('order-001');

      expect(summary.totalLines).toBe(2);
      expect(summary.fullyPickedLines).toBe(1);
      expect(summary.isFullyPicked).toBe(false);
      expect(summary.lines).toHaveLength(2);

      const line1 = summary.lines.find((l) => l.salesOrderLineId === 'line-1')!;
      expect(line1.quantityPicked).toBe('10');
      expect(line1.remaining).toBe('0');
      expect(line1.quantityShipped).toBe('5');
      expect(line1.isFullyPicked).toBe(true);

      const line2 = summary.lines.find((l) => l.salesOrderLineId === 'line-2')!;
      expect(line2.quantityPicked).toBe('2');
      expect(line2.remaining).toBe('3');
      expect(line2.quantityShipped).toBe('0');
      expect(line2.isFullyPicked).toBe(false);
    });
  });
});
