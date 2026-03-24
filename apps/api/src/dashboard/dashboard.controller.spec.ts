import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockSummary = {
    accounts: 17,
    products: 14896,
    inventoryLevels: 500,
    orderLines: 5,
  };

  const mockSearchResults = {
    results: [
      {
        id: 'p1',
        type: 'product',
        label: 'Widget',
        subtitle: 'PROD-001',
        href: '/products/p1',
      },
      {
        id: 'a1',
        type: 'account',
        label: 'Acme',
        subtitle: 'ACC-001',
        href: '/accounts/a1',
      },
    ],
  };

  const mockService = {
    getSummary: jest.fn().mockResolvedValue(mockSummary),
    universalSearch: jest.fn().mockResolvedValue(mockSearchResults),
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

  describe('search', () => {
    it('should delegate to universalSearch and return results', async () => {
      const result = await controller.search('widget');
      expect(result).toEqual(mockSearchResults);
      expect(mockService.universalSearch).toHaveBeenCalledWith('widget');
    });
  });
});
