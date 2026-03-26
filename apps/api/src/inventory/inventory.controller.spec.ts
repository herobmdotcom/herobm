import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;

  const mockResult = {
    data: [{ inventoryLevelId: 'INV001', productName: 'Widget' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockBinsResult = {
    data: [{ binContentsId: 'BIN001', binNumber: 'A1' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockLocationsResult = {
    data: [
      {
        locationId: 'LOC001',
        code: 'SIN',
        name: 'Singapore',
        zones: [
          {
            zoneId: 'Z001',
            code: 'MAIN',
            name: 'Main Zone',
            bins: [{ binId: 'B001', binNumber: 'SHIPPING' }],
          },
        ],
      },
    ],
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockResult),
    findBins: jest.fn().mockResolvedValue(mockBinsResult),
    findAllLocations: jest.fn().mockResolvedValue(mockLocationsResult),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: mockService }],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  describe('findAll', () => {
    it('should call service.findAll with no params', async () => {
      const result = await controller.findAll({});
      expect(result).toEqual(mockResult);
      // Controller spreads query + locationNo → service receives { ...query, locationNo: undefined }
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({}),
      );
    });

    it('should pass all query parameters plus locationNo', async () => {
      const query = { q: 'widget', page: 2, limit: 25 };
      await controller.findAll(query, 'LOC01');
      expect(mockService.findAll).toHaveBeenCalledWith({
        q: 'widget',
        page: 2,
        limit: 25,
        locationNo: 'LOC01',
      });
    });

    it('should pass locationNo filter without pagination', async () => {
      await controller.findAll({}, 'LOC02');
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ locationNo: 'LOC02' }),
      );
    });
  });

  describe('findBins', () => {
    it('should call service.findBins with no params', async () => {
      const result = await controller.findBins({});
      expect(result).toEqual(mockBinsResult);
      expect(mockService.findBins).toHaveBeenCalledWith(
        expect.objectContaining({}),
      );
    });

    it('should pass all query parameters for bins', async () => {
      const query = { q: 'bolt', page: 1, limit: 10 };
      await controller.findBins(query, 'LOC01');
      expect(mockService.findBins).toHaveBeenCalledWith({
        q: 'bolt',
        page: 1,
        limit: 10,
        locationNo: 'LOC01',
      });
    });
  });

  describe('findAllLocations', () => {
    it('should return the full topography hierarchy', async () => {
      const result = await controller.findAllLocations();
      expect(result).toEqual(mockLocationsResult);
      expect(mockService.findAllLocations).toHaveBeenCalledTimes(1);
    });

    it('should return nested zones and bins', async () => {
      const result = await controller.findAllLocations();
      expect(result.data[0].zones).toHaveLength(1);
      expect(result.data[0].zones[0].bins).toHaveLength(1);
      expect(result.data[0].zones[0].bins[0].binNumber).toBe('SHIPPING');
    });
  });
});
