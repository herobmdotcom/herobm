import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockSummary = {
    totalAccounts: 17,
    totalProducts: 14896,
    totalInventoryValue: 123456.78,
    recentOrders: 5,
  };

  const mockService = {
    getSummary: jest.fn().mockResolvedValue(mockSummary),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  describe('getSummary', () => {
    it('should return dashboard summary from service', async () => {
      const result = await controller.getSummary();
      expect(result).toEqual(mockSummary);
      expect(mockService.getSummary).toHaveBeenCalledTimes(1);
    });
  });
});
