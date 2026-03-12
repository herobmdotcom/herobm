import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockResolvedValue([{ count: 42 }]),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.select.mockReturnValue({
      from: jest.fn().mockResolvedValue([{ count: 42 }]),
    });

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
});
