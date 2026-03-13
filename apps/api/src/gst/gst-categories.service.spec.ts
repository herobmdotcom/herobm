import { Test, TestingModule } from '@nestjs/testing';
import { GstCategoriesService } from './gst-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('GstCategoriesService', () => {
  let service: GstCategoriesService;

  const mockCategories = [
    { gstCategoryId: 'uuid-gst-1', code: 'GST', title: 'GST 10%', type: 'gst_applies', rate: '10', isDefault: true },
    { gstCategoryId: 'uuid-gst-2', code: 'EXE', title: 'Exempt', type: 'exempt', rate: '0', isDefault: false },
    { gstCategoryId: 'uuid-gst-3', code: 'ZRO', title: 'Zero Rated', type: 'zero_rated', rate: '0', isDefault: false },
  ];

  // Chainable mock that supports select().from(...).where(...).limit(...)
  function createChainableQb(resolvedValue: any[]) {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
    };
    return qb;
  }

  let mockDb: any;
  let currentQb: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    currentQb = createChainableQb(mockCategories);

    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(currentQb),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GstCategoriesService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<GstCategoriesService>(GstCategoriesService);
  });

  // Helper to reconfigure the mock for a specific resolved value
  function mockReturns(value: any[]) {
    const qb = createChainableQb(value);
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(qb),
    });
  }

  describe('findAll', () => {
    it('should return all GST categories', async () => {
      // findAll does select().from() — no where/limit
      const result = await service.findAll();
      expect(result).toEqual(mockCategories);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return a category by ID', async () => {
      mockReturns([mockCategories[0]]);
      const result = await service.getById('uuid-gst-1');
      expect(result).toEqual(mockCategories[0]);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockReturns([]);
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDefault', () => {
    it('should return the default category', async () => {
      mockReturns([mockCategories[0]]);
      const result = await service.getDefault();
      expect(result).toEqual(mockCategories[0]);
    });

    it('should throw NotFoundException when no default configured', async () => {
      mockReturns([]);
      await expect(service.getDefault()).rejects.toThrow(NotFoundException);
      mockReturns([]);
      await expect(service.getDefault()).rejects.toThrow('No default GST category configured');
    });
  });

  describe('getByCode', () => {
    it('should return a category by code', async () => {
      mockReturns([mockCategories[1]]);
      const result = await service.getByCode('EXE');
      expect(result).toEqual(mockCategories[1]);
    });

    it('should throw NotFoundException for unknown code', async () => {
      mockReturns([]);
      await expect(service.getByCode('INVALID')).rejects.toThrow(NotFoundException);
      mockReturns([]);
      await expect(service.getByCode('INVALID')).rejects.toThrow("GST category code 'INVALID' not found");
    });
  });
});
