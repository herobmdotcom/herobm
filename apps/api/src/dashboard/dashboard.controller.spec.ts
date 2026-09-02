import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockSummary = {
    customers: 17,
    products: 14896,
    orderLines: 5,
  };

  const mockSearchResults = {
    results: [
      {
        id: 'p1',
        type: 'product' as const,
        label: 'Widget',
        subtitle: 'PROD-001',
        href: '/products/p1',
      },
      {
        id: 'a1',
        type: 'customer' as const,
        label: 'Acme',
        subtitle: 'ACC-001',
        href: '/customers/a1',
      },
    ],
  };

  const mockTimelineResults = {
    events: [
      {
        eventId: 'e1',
        eventType: 'customer.created',
        entityId: 'c1',
        entityDisplay: 'Acme Corp',
        actor: 'admin',
        timestamp: new Date(),
      },
    ],
  };

  const mockService = {
    getSummary: jest.fn().mockResolvedValue(mockSummary),
    universalSearch: jest.fn().mockResolvedValue(mockSearchResults),
    getTimeline: jest.fn().mockResolvedValue(mockTimelineResults),
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
    it('should delegate to universalSearch without types if not provided', async () => {
      const result = await controller.search('widget');
      expect(result).toEqual(mockSearchResults);
      expect(mockService.universalSearch).toHaveBeenCalledWith(
        'widget',
        undefined,
      );
    });

    it('should parse types query param and delegate to universalSearch', async () => {
      const result = await controller.search('widget', 'product,customer');
      expect(result).toEqual(mockSearchResults);
      expect(mockService.universalSearch).toHaveBeenCalledWith('widget', [
        'product',
        'customer',
      ]);
    });
  });

  describe('getTimeline', () => {
    it('should parse types and limit and delegate to service', async () => {
      const result = await controller.getTimeline(
        'customer.created,sales_order.created',
        '25',
      );
      expect(result).toEqual(mockTimelineResults);
      expect(mockService.getTimeline).toHaveBeenCalledWith(
        ['customer.created', 'sales_order.created'],
        25,
      );
    });
  });
});
