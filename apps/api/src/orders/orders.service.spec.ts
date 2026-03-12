import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrders = [
    { salesOrderLineId: 'SOL001', orderNumber: 'SO-1001', accountName: 'Acme Corp', productDescription: 'M8 Bolt', quantity: '10' },
    { salesOrderLineId: 'SOL002', orderNumber: 'SO-1002', accountName: 'Widget Inc', productDescription: 'M10 Nut', quantity: '25' },
  ];

  const mockQb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockDb = {
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue(mockQb) }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQb.then = jest.fn().mockImplementation((cb) => cb(mockOrders));

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
    });

    it('should apply search filter', async () => {
      await service.findAll({ search: 'acme' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should cap limit at 200', async () => {
      await service.findAll({ limit: 999 });
      expect(mockQb.limit).toHaveBeenCalledWith(200);
    });
  });

  describe('findOne', () => {
    it('should return a single order line', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb([mockOrders[0]]));
      const result = await service.findOne('SOL001');
      expect(result).toEqual(mockOrders[0]);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb([]));
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });
});
