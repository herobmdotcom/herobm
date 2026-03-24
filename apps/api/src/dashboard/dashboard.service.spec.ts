import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('DashboardService', () => {
  let service: DashboardService;

  // Chain builder that supports .select().from().where().limit()
  const mockChain = (rows: any[] = [{ count: 42 }]) => {
    const chain = {
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
        // Also support direct .from() without .where() (getSummary path)
      }),
    };
    // For getSummary: select().from() returns promise directly
    chain.from.mockImplementation(() => {
      const whereObj = {
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
        limit: jest.fn().mockResolvedValue(rows),
        then: (resolve: any) => resolve(rows),
      };
      // Make it thenable for getSummary (no .where())
      return whereObj;
    });
    return chain;
  };

  const mockDb = {
    select: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: return { count: 42 } for getSummary
    mockDb.select.mockReturnValue(mockChain());

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getSummary', () => {
    it('should return counts for all entities', async () => {
      const result = await service.getSummary();
      expect(result).toHaveProperty('accounts', 42);
      expect(result).toHaveProperty('products', 42);
      expect(result).toHaveProperty('inventoryLevels', 42);
      expect(result).toHaveProperty('orderLines', 42);
    });
  });

  describe('universalSearch', () => {
    it('should return empty results for queries shorter than 2 chars', async () => {
      const result = await service.universalSearch('a');
      expect(result).toEqual({ results: [] });
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return empty results for empty string', async () => {
      const result = await service.universalSearch('');
      expect(result).toEqual({ results: [] });
    });

    it('should query all entity tables and return unified results', async () => {
      const productRow = { id: 'p1', label: 'Widget', subtitle: 'PROD-001' };
      const accountRow = { id: 'a1', label: 'Acme Corp', subtitle: 'ACC-001' };

      let callIndex = 0;
      mockDb.select.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return mockChain([productRow]);
        if (callIndex === 2) return mockChain([accountRow]);
        return mockChain([]);
      });

      const result = await service.universalSearch('wid');

      expect(result.results.length).toBe(2);
      expect(result.results[0]).toMatchObject({
        id: 'p1',
        type: 'product',
        label: 'Widget',
        href: '/products/p1',
      });
      expect(result.results[1]).toMatchObject({
        id: 'a1',
        type: 'account',
        label: 'Acme Corp',
        href: '/accounts/a1',
      });
    });

    it('should include correct href for each entity type', async () => {
      const rows = [{ id: 'so1', label: 'SO-001', subtitle: 'Test Order' }];

      let callIndex = 0;
      mockDb.select.mockImplementation(() => {
        callIndex++;
        // 3rd call = sales orders
        if (callIndex === 3) return mockChain(rows);
        return mockChain([]);
      });

      const result = await service.universalSearch('SO-001');

      const soResult = result.results.find((r) => r.type === 'sales_order');
      expect(soResult).toBeDefined();
      expect(soResult!.href).toBe('/sales-orders/so1');
    });
  });
});
