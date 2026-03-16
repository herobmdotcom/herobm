import { Test, TestingModule } from '@nestjs/testing';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

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
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue(selectQb) }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    transaction: jest.fn().mockImplementation(async (cb: any) => cb(createMockTx())),
    _selectQb: selectQb,
  };
  return db;
}

// Shared test data
const PICKING_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260316-0001',
  stateCode: 'picking',
  customerId: 'CUST-001',
};

const DRAFT_ORDER = {
  salesOrderId: 'order-002',
  orderNumber: 'ORD-20260316-0002',
  stateCode: 'draft',
  customerId: 'CUST-001',
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
        return qb;
      }),
    });
  }

  function mockTransaction(result: any) {
    const mockTx = createMockTx();
    const txQb = createMockQueryBuilder(Array.isArray(result) ? result : [result]);
    mockTx.update = jest.fn().mockReturnValue(txQb);
    mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    const mockShipmentService = {
      createShipment: jest.fn().mockResolvedValue({
        shipmentId: 'ship-new',
        shipmentNumber: 'SHP-20260316-0001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickingService,
        { provide: ShipmentService, useValue: mockShipmentService },
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
      });
      mockTransaction({ ...ORDER_LINE, quantityPicked: '5' });
    }

    it('should update quantity_picked on a picking order', async () => {
      setupPickLine('picking');
      const result = await service.pickLine('order-001', 'line-001', '5', 'admin');
      expect(result).toHaveProperty('quantityPicked', '5');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject pick on non-picking state order', async () => {
      setupPickLine('draft');
      await expect(
        service.pickLine('order-001', 'line-001', '5', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative quantity', async () => {
      setupPickLine('picking');
      await expect(
        service.pickLine('order-001', 'line-001', '-1', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject quantity exceeding ordered', async () => {
      setupPickLine('picking');
      await expect(
        service.pickLine('order-001', 'line-001', '15', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow setting quantity to 0 (unpick)', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [{ ...ORDER_LINE, quantityPicked: '5' }],
      });
      mockTransaction({ ...ORDER_LINE, quantityPicked: '0' });
      const result = await service.pickLine('order-001', 'line-001', '0', 'admin');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for unknown order', async () => {
      mockSelectChain({ 1: [] });
      await expect(
        service.pickLine('NONEXISTENT', 'line-001', '5', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // pickAllForLine
  // =========================================================================

  describe('pickAllForLine', () => {
    it('should set quantity_picked = quantity', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [ORDER_LINE],
      });
      mockTransaction({ ...ORDER_LINE, quantityPicked: '10' });
      const result = await service.pickAllForLine('order-001', 'line-001', 'admin');
      expect(result).toBeDefined();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject on non-picking order', async () => {
      mockSelectChain({ 1: [DRAFT_ORDER] });
      await expect(
        service.pickAllForLine('order-002', 'line-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // assertFullyPicked
  // =========================================================================

  describe('assertFullyPicked', () => {
    it('should pass when all lines fully picked', async () => {
      mockSelectChain({
        1: [
          { lineNumber: 1, quantity: '10', quantityPicked: '10' },
          { lineNumber: 2, quantity: '5', quantityPicked: '5' },
        ],
      });
      await expect(service.assertFullyPicked('order-001')).resolves.toBeUndefined();
    });

    it('should throw when lines not fully picked', async () => {
      mockSelectChain({
        1: [
          { lineNumber: 1, quantity: '10', quantityPicked: '10' },
          { lineNumber: 2, quantity: '5', quantityPicked: '3' },
        ],
      });
      await expect(service.assertFullyPicked('order-001')).rejects.toThrow(BadRequestException);
    });

    it('should include unpicked line details in error message', async () => {
      mockSelectChain({
        1: [{ lineNumber: 1, quantity: '10', quantityPicked: '7' }],
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
  // pickAllOrder
  // =========================================================================

  describe('pickAllOrder', () => {
    it('should pick all lines and create a shipment', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        // lines query
        2: [
          { salesOrderLineId: 'line-1', quantity: '10', quantityPicked: '0', lineNumber: 1 },
          { salesOrderLineId: 'line-2', quantity: '5', quantityPicked: '0', lineNumber: 2 },
        ],
        // getShippedPerLine queries:
        // shipments query
        3: [], 
      });

      mockTransaction({});
      
      const result = await service.pickAllOrder('order-001', 'admin');
      
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      const mockShipmentService: any = service['shipmentService'];
      expect(mockShipmentService.createShipment).toHaveBeenCalledWith(
        'order-001',
        {
          lines: [
            { salesOrderLineId: 'line-1', quantityShipped: '10' },
            { salesOrderLineId: 'line-2', quantityShipped: '5' },
          ],
        },
        'admin'
      );
      expect(result).toHaveProperty('shipmentNumber', 'SHP-20260316-0001');
    });

    it('should return a marker message if everything is already shipped', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        // lines query
        2: [
          { salesOrderLineId: 'line-1', quantity: '10', quantityPicked: '10', lineNumber: 1 },
        ],
        // shipments query -> returns 1 shipment
        3: [{ shipmentId: 'ship-001', salesOrderId: 'order-001', stateCode: 'dispatched' }],
        // lines query for shipment 1 -> all 10 shipped
        4: [{ shipmentLineId: 'shipline-1', shipmentId: 'ship-001', salesOrderLineId: 'line-1', quantityShipped: '10' }],
      });

      mockTransaction({});
      
      const mockShipmentService: any = service['shipmentService'];
      mockShipmentService.createShipment.mockClear();

      const result = await service.pickAllOrder('order-001', 'admin');
      
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockShipmentService.createShipment).not.toHaveBeenCalled();
      expect(result).toHaveProperty('message', 'All lines already shipped; no new shipment created.');
    });

    it('should reject if order is not in picking state', async () => {
      mockSelectChain({ 1: [DRAFT_ORDER] });
      await expect(service.pickAllOrder('order-002', 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should reject if order has no lines', async () => {
      mockSelectChain({
        1: [PICKING_ORDER],
        2: [], 
      });
      await expect(service.pickAllOrder('order-001', 'admin')).rejects.toThrow(BadRequestException);
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
          { salesOrderLineId: 'line-1', lineNumber: 1, productId: 'p1', productDescription: 'desc1', quantity: '10', quantityPicked: '10' },
          { salesOrderLineId: 'line-2', lineNumber: 2, productId: 'p2', productDescription: 'desc2', quantity: '5', quantityPicked: '2' },
        ],
        // getShippedPerLine: shipments
        3: [{ shipmentId: 'ship-1', salesOrderId: 'order-001', stateCode: 'dispatched' }],
        // getShippedPerLine: shipment lines for ship-1
        4: [{ shipmentLineId: 'sl-1', shipmentId: 'ship-1', salesOrderLineId: 'line-1', quantityShipped: '5' }],
      });

      const summary = await service.getPickingSummary('order-001');

      expect(summary.totalLines).toBe(2);
      expect(summary.fullyPickedLines).toBe(1);
      expect(summary.isFullyPicked).toBe(false);
      expect(summary.lines).toHaveLength(2);

      const line1 = summary.lines.find(l => l.salesOrderLineId === 'line-1')!;
      expect(line1.quantityPicked).toBe('10');
      expect(line1.remaining).toBe('0');
      expect(line1.quantityShipped).toBe('5');
      expect(line1.isFullyPicked).toBe(true);

      const line2 = summary.lines.find(l => l.salesOrderLineId === 'line-2')!;
      expect(line2.quantityPicked).toBe('2');
      expect(line2.remaining).toBe('3');
      expect(line2.quantityShipped).toBe('0');
      expect(line2.isFullyPicked).toBe(false);
    });
  });
});
