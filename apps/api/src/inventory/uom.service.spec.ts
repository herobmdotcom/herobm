import { Test, TestingModule } from '@nestjs/testing';
import { UomService } from './uom.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { products, productUoms } from '../drizzle/modbm-core-schema';

describe('UomService', () => {
  let service: UomService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UomService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<UomService>(UomService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateAbsoluteBaseQuantity', () => {
    it('returns 0 if lines are empty', async () => {
      const result = await service.calculateAbsoluteBaseQuantity('prod1', []);
      expect(result).toBe(0);
    });

    it('throws NotFoundException if product is missing', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // No product found
      await expect(
        service.calculateAbsoluteBaseQuantity('prod1', [{ quantity: 1 }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('calculates correctly using baseUom and standard ratios', async () => {
      // Mock product fetch pointing to baseUom 'EA'
      const mockUomFetch = jest.fn().mockResolvedValue([
        { uomCode: 'BOX', ratio: '10' },
        { uomCode: 'VPE025', ratio: '25' },
      ]);

      mockDb.where = jest.fn().mockImplementation((condition) => {
        return {
          limit: jest
            .fn()
            .mockResolvedValue([{ productId: 'prod1', baseUom: 'EA' }]),
          then: (resolve: any, reject: any) => {
            return mockUomFetch().then(resolve, reject);
          },
        };
      });

      // Composite payload
      const lines = [
        { uomCode: 'BOX', quantity: 2 }, // 20
        { uomCode: 'VPE025', quantity: 5 }, // 125
        { uomCode: 'EA', quantity: 7 }, // 7
        { quantity: 1 }, // 1 (defaults to base uom 'EA')
      ];

      const result = await service.calculateAbsoluteBaseQuantity(
        'prod1',
        lines,
        mockDb,
      );

      expect(result).toBe(20 + 125 + 7 + 1); // 153
    });

    it('throws exact Error message for unmapped UOMs', async () => {
      mockDb.where = jest.fn().mockImplementation((condition) => {
        return {
          limit: jest
            .fn()
            .mockResolvedValue([{ productId: 'prod1', baseUom: 'EA' }]),
          then: (resolve: any, reject: any) => {
            return Promise.resolve([]).then(resolve, reject);
          },
        };
      });

      await expect(
        service.calculateAbsoluteBaseQuantity(
          'prod1',
          [{ uomCode: 'UNKNOWN', quantity: 1 }],
          mockDb,
        ),
      ).rejects.toThrow("UOM 'UNKNOWN' is not configured for product prod1.");
    });
  });
});
