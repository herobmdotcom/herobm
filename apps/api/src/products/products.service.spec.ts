import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProducts = [
    {
      productId: '11111111-1111-1111-1111-111111111111',
      productNumber: 'BOLT-M8',
      name: 'M8 Hex Bolt',
      productGroupName: 'Fasteners',
      standardCost: '1.25',
      barcode: '9312000001',
      stateCode: 'active',
      source: 'abm',
    },
    {
      productId: '22222222-2222-2222-2222-222222222222',
      productNumber: 'NUT-M8',
      name: 'M8 Hex Nut',
      productGroupName: 'Fasteners',
      standardCost: '0.45',
      barcode: '9312000002',
      stateCode: 'active',
      source: 'app',
    },
  ];

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn(),
    then: jest.fn().mockImplementation((cb) => cb(mockProducts)),
    [Symbol.asyncIterator]: jest.fn(),
  };

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQueryBuilder.$dynamic.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    // Default: findAll returns products, count query returns [{count: 2}]
    let callCount = 0;
    mockQueryBuilder.then = jest.fn().mockImplementation((cb) => {
      callCount++;
      // First call = data query, second call = count query
      if (callCount % 2 === 0) return cb([{ count: 2 }]);
      return cb(mockProducts);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    it('should return paginated products with total count', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 50);
      expect(result).toHaveProperty('total');
    });

    it('should apply search filter when q is provided', async () => {
      await service.findAll({ q: 'bolt' });
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('should cap limit at 100000', async () => {
      const result = await service.findAll({ limit: 200_000 });
      expect(result.limit).toBe(100_000);
    });
  });

  describe('findOne', () => {
    it('should return a single product with events', async () => {
      // First call returns product, second returns events
      let call = 0;
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => {
        call++;
        if (call === 1) return cb([mockProducts[0]]);
        return cb([]); // no events
      });
      const result = await service.findOne(
        '11111111-1111-1111-1111-111111111111',
      );
      expect(result.productNumber).toBe('BOLT-M8');
      expect(result.events).toEqual([]);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb([]));
      await expect(
        service.findOne('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
