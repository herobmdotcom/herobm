import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockResult = {
    data: [{ productId: 'P001', name: 'Widget' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockResult),
    findOne: jest.fn().mockResolvedValue({ productId: 'P001', name: 'Widget' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  describe('findAll', () => {
    it('should call service.findAll with empty query', async () => {
      const result = await controller.findAll({});
      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith({});
    });

    it('should pass through PaginationQuery object', async () => {
      const query = { q: 'bolt', page: 3, limit: 10 };
      await controller.findAll(query);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass search without pagination', async () => {
      const query = { q: 'fitting' };
      await controller.findAll(query);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the ID', async () => {
      const result = await controller.findOne('P001');
      expect(result).toEqual({ productId: 'P001', name: 'Widget' });
      expect(mockService.findOne).toHaveBeenCalledWith('P001');
    });
  });
});
