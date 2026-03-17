import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockAbmRows = [
    {
      id: 'SOL001',
      orderNumber: 'SO-1001',
      name: 'Acme Corp',
      customerOrderNumber: 'PO-123',
      stateCode: 'legacy',
      source: 'abm',
      createdBy: '',
      createdOn: '2026-01-01T00:00:00.000Z',
      totalPrice: '1500.00',
    },
  ];

  const mockAppRows = [
    {
      id: 'uuid-001',
      orderNumber: 'ORD-20260312-0001',
      name: 'Test Order',
      customerOrderNumber: '',
      stateCode: 'draft',
      source: 'app',
      createdBy: 'admin',
      createdOn: new Date('2026-03-12'),
      totalPrice: '250.00',
    },
  ];

  // Build a chainable mock query builder
  function createMockQb(resolvedValue: any[] = []) {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      $dynamic: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
    };
    return qb;
  }

  let mockDb: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const abmQb = createMockQb(mockAbmRows);
    const appQb = createMockQb(mockAppRows);
    const findOneQb = createMockQb([]);

    let selectCallCount = 0;
    // totals aggregation query returns per-order totals
    const totalsQb = createMockQb([
      { salesOrderId: 'uuid-001', total: '250.00' },
    ]);
    mockDb = {
      selectDistinctOn: jest.fn().mockReturnValue(abmQb),
      select: jest.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First select() call is the app orders query in findAll
          return { from: jest.fn().mockReturnValue(appQb) };
        }
        if (selectCallCount === 2) {
          // Second select() call is the line totals aggregation
          return { from: jest.fn().mockReturnValue(totalsQb) };
        }
        // Subsequent select() calls are findOne
        return { from: jest.fn().mockReturnValue(findOneQb) };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('findAll', () => {
    it('should return merged, paginated orders', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('total');
      // Should contain both app and ABM rows
      expect(result.data.length).toBe(2);
      // totalPrice should be present
      expect(result.data[0]).toHaveProperty('totalPrice');
      expect(result.data[1]).toHaveProperty('totalPrice');
    });

    it('should apply search filter to both queries', async () => {
      const abmQb = createMockQb([]);
      const appQb = createMockQb([]);
      mockDb.selectDistinctOn = jest.fn().mockReturnValue(abmQb);
      mockDb.select = jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(appQb) });

      await service.findAll({ q: 'acme' });
      expect(abmQb.where).toHaveBeenCalled();
      expect(appQb.where).toHaveBeenCalled();
    });

    it('should cap limit at 200', async () => {
      const result = await service.findAll({ limit: 999 });
      expect(result.limit).toBe(200);
    });
  });

  describe('findOne', () => {
    it('should return a single order line', async () => {
      const singleQb = createMockQb([mockAbmRows[0]]);
      mockDb.select = jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(singleQb) });

      const result = await service.findOne('SOL001');
      expect(result).toEqual(mockAbmRows[0]);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      const emptyQb = createMockQb([]);
      mockDb.select = jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(emptyQb) });

      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAbmOrder', () => {
    const mockAbmLines = [
      {
        salesOrderLineId: 'SOL001',
        documentNumber: 'SO-1001',
        accountName: 'Acme Corp',
        accountId: 'C001',
        customerOrderNumber: 'PO-123',
        documentDate: '2026-01-15',
        lineNumber: 1,
        productId: 'P001',
        productDescription: 'M8 Bolt',
        quantity: '10',
        pricePerUnit: '5.00',
        discountPercentage: '0',
        amount: '50.00',
        tax: '5.00',
        totalAmount: '55.00',
        unitOfMeasure: 'EA',
      },
      {
        salesOrderLineId: 'SOL002',
        documentNumber: 'SO-1001',
        accountName: 'Acme Corp',
        accountId: 'C001',
        customerOrderNumber: 'PO-123',
        documentDate: '2026-01-15',
        lineNumber: 2,
        productId: 'P002',
        productDescription: 'M8 Nut',
        quantity: '20',
        pricePerUnit: '2.00',
        discountPercentage: '0',
        amount: '40.00',
        tax: '4.00',
        totalAmount: '44.00',
        unitOfMeasure: 'EA',
      },
    ];

    it('should return a unified order shape with mapped lines', async () => {
      const linesQb = createMockQb(mockAbmLines);
      mockDb.select = jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(linesQb) });

      const result = await service.findAbmOrder('SO-1001');
      expect(result.orderNumber).toBe('SO-1001');
      expect(result.name).toBe('Acme Corp');
      expect(result.customerId).toBe('C001');
      expect(result.stateCode).toBe('legacy');
      expect(result.source).toBe('abm');
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0]).toHaveProperty('productId', 'P001');
      expect(result.lines[1]).toHaveProperty('productId', 'P002');
    });

    it('should throw NotFoundException for unknown document number', async () => {
      const emptyQb = createMockQb([]);
      mockDb.select = jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(emptyQb) });

      await expect(service.findAbmOrder('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
