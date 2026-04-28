import { Test, TestingModule } from '@nestjs/testing';
import { TaxCategoriesController } from './tax-categories.controller';
import { TaxCategoriesService } from './tax-categories.service';

describe('TaxCategoriesController', () => {
  let controller: TaxCategoriesController;

  const mockCategories = [
    {
      taxCategoryId: 'uuid-tax-1',
      code: 'GST',
      title: 'GST 10%',
      type: 'tax_applies',
      rate: '10',
      isDefault: true,
    },
    {
      taxCategoryId: 'uuid-tax-2',
      code: 'EXE',
      title: 'Exempt',
      type: 'exempt',
      rate: '0',
      isDefault: false,
    },
  ];

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockCategories),
    getById: jest.fn().mockResolvedValue(mockCategories[0]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxCategoriesController],
      providers: [{ provide: TaxCategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get<TaxCategoriesController>(TaxCategoriesController);
  });

  describe('findAll', () => {
    it('should return all tax categories', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockCategories);
      expect(mockService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a single tax category by ID', async () => {
      const result = await controller.findOne('uuid-tax-1');
      expect(result).toEqual(mockCategories[0]);
      expect(mockService.getById).toHaveBeenCalledWith('uuid-tax-1');
    });
  });
});
