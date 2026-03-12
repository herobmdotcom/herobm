import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockRows = [
    { inventoryLevelId: 'I001', productNumber: 'BOLT-M8', productName: 'M8 Hex Bolt', locationNo: '1', quantityOnHand: '100' },
    { inventoryLevelId: 'I002', productNumber: 'NUT-M8', productName: 'M8 Hex Nut', locationNo: '1', quantityOnHand: '200' },
  ];

  const mockBinRows = [
    { binContentsId: 'B001', binNumber: 'A-01-01', productNumber: 'BOLT-M8', productName: 'M8 Hex Bolt', actualQuantity: '50' },
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
    mockQb.then = jest.fn().mockImplementation((cb) => cb(mockRows));

    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('findAll', () => {
    it('should return paginated inventory levels', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 50);
    });

    it('should apply search filter', async () => {
      await service.findAll({ search: 'bolt' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should cap limit at 200', async () => {
      await service.findAll({ limit: 500 });
      expect(mockQb.limit).toHaveBeenCalledWith(200);
    });
  });

  describe('findBins', () => {
    it('should return paginated bin contents', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      const result = await service.findBins();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
    });

    it('should apply search filter', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ search: 'A-01' });
      expect(mockQb.where).toHaveBeenCalled();
    });
  });
});
