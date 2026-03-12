import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProducts = [
    {
      productId: 'P001',
      productNumber: 'BOLT-M8',
      name: 'M8 Hex Bolt',
      productGroupName: 'Fasteners',
      standardCost: '1.25',
      barcode: '9312000001',
      stateCode: 'Active',
    },
    {
      productId: 'P002',
      productNumber: 'NUT-M8',
      name: 'M8 Hex Nut',
      productGroupName: 'Fasteners',
      standardCost: '0.45',
      barcode: '9312000002',
      stateCode: 'Active',
    },
  ];

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn().mockReturnThis(),
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
    mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb(mockProducts));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 50);
    });

    it('should apply search filter', async () => {
      await service.findAll({ search: 'bolt' });
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('should cap limit at 200', async () => {
      await service.findAll({ limit: 999 });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(200);
    });
  });

  describe('findOne', () => {
    it('should return a single product', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb([mockProducts[0]]));
      const result = await service.findOne('P001');
      expect(result).toEqual(mockProducts[0]);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb([]));
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
