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
    it('should call service.findAll with no params', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it('should parse page and limit from query strings', async () => {
      await controller.findAll('bolt', '3', '10');
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: 'bolt',
        page: 3,
        limit: 10,
      });
    });

    it('should pass search without pagination', async () => {
      await controller.findAll('fitting');
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: 'fitting',
        page: undefined,
        limit: undefined,
      });
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
