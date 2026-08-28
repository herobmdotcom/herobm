import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsWriteService } from './products-write.service';

import { StorageService } from '../common/storage/storage.service';
import { ThrottlerGuard } from '@nestjs/throttler';

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
    getCostSummary: jest.fn(),
  };

  const mockWriteService = {
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockStorageService = {
    resolveFilePath: jest.fn(),
    saveProductImage: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockService },
        { provide: ProductsWriteService, useValue: mockWriteService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

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

  describe('getCostSummary', () => {
    it('should call service.getCostSummary with the ID', async () => {
      const mockCostSummary = {
        productId: 'P001',
        standardCost: '12.50',
        weightedAverageCost: '11.80',
        listPrice: '20.00',
        tradePrice: '16.00',
        preferredSupplierCost: '10.50',
        preferredSupplierDiscount: '5.00',
        preferredSupplierVendorId: 'V001',
        preferredSupplierName: 'Acme Supply',
        preferredSupplierVendorNumber: 'VEN-001',
        lastPurchasePrice: '11.00',
        lastPurchaseDate: '2026-08-01T00:00:00.000Z',
        lastPurchaseOrderNumber: 'PO-001',
        lastPurchaseVendorName: 'Acme Supply',
        lastPurchaseOrderId: 'PO-ID-1',
      };
      mockService.getCostSummary.mockResolvedValue(mockCostSummary);
      const result = await controller.getCostSummary('P001');
      expect(result).toEqual(mockCostSummary);
      expect(mockService.getCostSummary).toHaveBeenCalledWith('P001');
    });
  });
});
