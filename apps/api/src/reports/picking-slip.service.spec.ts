import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PickingSlipService } from './picking-slip.service';
import { PickingSlipService } from './picking-slip.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

// ---------------------------------------------------------------------------
// Mock helpers (same pattern as other order service specs)
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest
      .fn()
      .mockReturnValue({ from: jest.fn().mockReturnValue(selectQb) }),
    _selectQb: selectQb,
  };
  return db;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ORDER_HEADER = {
  orderNumber: 'ORD-20260317-0001',
  customerName: 'Acme Corp',
  customerOrderNumber: 'PO-1234',
  createdOn: new Date('2026-03-17T10:00:00Z'),
};

const ORDER_LINES = [
  {
    salesOrderLineId: 'line-1',
    salesOrderId: 'order-001',
    lineNumber: 1,
    productId: 'PROD-A',
    productDescription: 'Widget Alpha',
    quantity: '10',
    quantityPicked: '3',
    pricePerUnit: '50.00',
    amount: '500.00',
  },
  {
    salesOrderLineId: 'line-2',
    salesOrderId: 'order-001',
    lineNumber: 2,
    productId: 'PROD-B',
    productDescription: 'Gadget Beta',
    quantity: '5',
    quantityPicked: '5', // fully picked
    pricePerUnit: '100.00',
    amount: '500.00',
  },
  {
    salesOrderLineId: 'line-3',
    salesOrderId: 'order-001',
    lineNumber: 3,
    productId: 'PROD-C',
    productDescription: 'Gizmo Gamma',
    quantity: '20',
    quantityPicked: '0',
    pricePerUnit: '10.00',
    amount: '200.00',
  },
];

const INVENTORY = [
  { productId: 'PROD-A', defaultBinNumber: 'A-01-03', quantityOnHand: '100' },
  { productId: 'PROD-B', defaultBinNumber: 'B-02-01', quantityOnHand: '50' },
  { productId: 'PROD-C', defaultBinNumber: 'C-05-02', quantityOnHand: '5' }, // less than ordered
];

const SUPPLIERS = [
  { productId: 'PROD-A', vendorName: 'Supplier One', isPreferred: true },
  { productId: 'PROD-C', vendorName: 'Supplier Three', isPreferred: true },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PickingSlipService', () => {
  let service: PickingSlipService;
  let mockDb: any;

  function mockSelectChain(responses: Record<number, any[]>) {
    let call = 0;
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        call++;
        const data = responses[call] ?? [];
        const qb = createMockQueryBuilder(data);
        qb.leftJoin = jest.fn().mockReturnValue(qb);
        qb.innerJoin = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PickingSlipService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<PickingSlipService>(PickingSlipService);
  });

  // =========================================================================
  // assembleData
  // =========================================================================

  describe('assembleData', () => {
    it('should throw NotFoundException for unknown order', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.assembleData('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for order with no lines', async () => {
      mockSelectChain({ 1: [ORDER_HEADER], 2: [] });
      await expect(service.assembleData('order-001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should assemble correct header data', async () => {
      mockSelectChain({
        1: [ORDER_HEADER],
        2: ORDER_LINES,
        3: INVENTORY,
        4: SUPPLIERS,
        5: INVENTORY,
      });

      const data = await service.assembleData('order-001');
      expect(data.header.orderNumber).toBe('ORD-20260317-0001');
      expect(data.header.customerName).toBe('Acme Corp');
      expect(data.header.customerOrderNumber).toBe('PO-1234');
    });

    it('should only include lines with qty to pick > 0 in picking lines', async () => {
      mockSelectChain({
        1: [ORDER_HEADER],
        2: ORDER_LINES,
        3: INVENTORY,
        4: SUPPLIERS,
        5: INVENTORY,
      });

      const data = await service.assembleData('order-001');

      // line-1: 10 - 3 = 7 to pick
      // line-2: 5 - 5 = 0, excluded
      // line-3: 20 - 0 = 20 to pick
      expect(data.pickingLines).toHaveLength(2);
      expect(data.pickingLines[0].productCode).toBe('PROD-A');
      expect(data.pickingLines[0].qtyToPick).toBe(7);
      expect(data.pickingLines[1].productCode).toBe('PROD-C');
      expect(data.pickingLines[1].qtyToPick).toBe(20);
    });

    it('should include bin numbers in picking lines', async () => {
      mockSelectChain({
        1: [ORDER_HEADER],
        2: ORDER_LINES,
        3: INVENTORY,
        4: SUPPLIERS,
        5: INVENTORY,
      });

      const data = await service.assembleData('order-001');
      expect(data.pickingLines[0].binNumber).toBe('A-01-03');
      expect(data.pickingLines[1].binNumber).toBe('C-05-02');
    });

    it('should identify back-order lines where ordered > on-hand', async () => {
      mockSelectChain({
        1: [ORDER_HEADER],
        2: ORDER_LINES,
        3: INVENTORY,
        4: SUPPLIERS,
        5: INVENTORY,
      });

      const data = await service.assembleData('order-001');

      // PROD-C: ordered 20, on-hand 5 → back-order 15
      expect(data.backOrderLines).toHaveLength(1);
      expect(data.backOrderLines[0].productCode).toBe('PROD-C');
      expect(data.backOrderLines[0].qtyToOrder).toBe(15);
      expect(data.backOrderLines[0].supplierName).toBe('Supplier Three');
    });

    it('should include generatedAt timestamp', async () => {
      mockSelectChain({
        1: [ORDER_HEADER],
        2: ORDER_LINES,
        3: INVENTORY,
        4: SUPPLIERS,
        5: INVENTORY,
      });

      const data = await service.assembleData('order-001');
      expect(data.generatedAt).toBeTruthy();
      expect(typeof data.generatedAt).toBe('string');
    });
  });
});
