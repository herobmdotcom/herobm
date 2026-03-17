import { Test, TestingModule } from '@nestjs/testing';
import { GstCategoriesController } from './gst-categories.controller';
import { GstCategoriesService } from './gst-categories.service';

describe('GstCategoriesController', () => {
  let controller: GstCategoriesController;

  const mockCategories = [
    {
      gstCategoryId: 'uuid-gst-1',
      code: 'GST',
      title: 'GST 10%',
      type: 'gst_applies',
      rate: '10',
      isDefault: true,
    },
    {
      gstCategoryId: 'uuid-gst-2',
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
      controllers: [GstCategoriesController],
      providers: [{ provide: GstCategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get<GstCategoriesController>(GstCategoriesController);
  });

  describe('findAll', () => {
    it('should return all GST categories', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockCategories);
      expect(mockService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a single GST category by ID', async () => {
      const result = await controller.findOne('uuid-gst-1');
      expect(result).toEqual(mockCategories[0]);
      expect(mockService.getById).toHaveBeenCalledWith('uuid-gst-1');
    });
  });
});
