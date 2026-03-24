import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockRows = [
    {
      id: 'uuid-001',
      orderNumber: 'ORD-20260312-0001',
      name: 'Test Order',
      customerName: 'Acme Corp',
      customerOrderNumber: 'PO-123',
      stateCode: 'draft',
      source: 'app',
      createdBy: 'admin',
      createdOn: new Date('2026-03-12'),
      currencyCode: 'EUR',
    },
  ];

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

    let selectCallCount = 0;
    const countQb = createMockQb([{ count: 1 }]);
    const dataQb = createMockQb(mockRows);
    const totalsQb = createMockQb([
      { salesOrderId: 'uuid-001', total: '250.00' },
    ]);

    mockDb = {
      select: jest.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1)
          return { from: jest.fn().mockReturnValue(countQb) };
        if (selectCallCount === 2)
          return { from: jest.fn().mockReturnValue(dataQb) };
        return { from: jest.fn().mockReturnValue(totalsQb) };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('total', 1);
      expect(result.data.length).toBe(1);
      expect(result.data[0]).toHaveProperty('totalPrice', '250.00');
    });

    it('should apply search filter', async () => {
      const qb = createMockQb([{ count: 0 }]);
      const dataQb = createMockQb([]);
      mockDb.select = jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue(qb),
      }));

      await service.findAll({ q: 'acme' });
      expect(qb.where).toHaveBeenCalled();
    });

    it('should cap limit at 100000', async () => {
      const result = await service.findAll({ limit: 200_000 });
      expect(result.limit).toBe(100_000);
    });
  });
});
