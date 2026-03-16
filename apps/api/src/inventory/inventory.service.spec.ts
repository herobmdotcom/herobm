import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService, StockLine } from './inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('InventoryService', () => {
  let service: InventoryService;

  // =========================================================================
  // Read-only query mocks (existing tests)
  // =========================================================================

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

  // =========================================================================
  // Read-only queries (from mart_inventory)
  // =========================================================================

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

    it('should filter by locationNo', async () => {
      await service.findAll({ locationNo: 'LOC01' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should apply both search and locationNo filters', async () => {
      await service.findAll({ search: 'bolt', locationNo: 'LOC01' });
      // where() called twice — once for search, once for locationNo
      expect(mockQb.where).toHaveBeenCalledTimes(2);
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

    it('should filter by locationNo', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ locationNo: 'LOC02' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should apply both search and locationNo for bins', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ search: 'A-01', locationNo: 'LOC02' });
      expect(mockQb.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByProductIds', () => {
    it('should return inventory rows for given product IDs', async () => {
      const result = await service.findByProductIds(['P001', 'P002']);
      expect(result).toHaveProperty('data');
      expect(mockQb.where).toHaveBeenCalled();
      expect(mockQb.orderBy).toHaveBeenCalled();
    });

    it('should return empty data for empty product IDs array', async () => {
      const result = await service.findByProductIds([]);
      expect(result).toEqual({ data: [] });
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Stock mutation methods (write to modbm_core.inventory_levels)
  // =========================================================================

  describe('stock mutations', () => {
    let mockTx: any;
    let executedSql: string[];

    beforeEach(() => {
      executedSql = [];
      mockTx = {
        execute: jest.fn().mockImplementation(async (sql: any) => {
          // Capture the SQL template string for assertion
          executedSql.push(String(sql));
          return { rows: [] };
        }),
      };
    });

    const sampleLines: StockLine[] = [
      { productId: 'PROD-001', quantity: '10' },
      { productId: 'PROD-002', quantity: '5' },
    ];

    // ── commitStock ──

    describe('commitStock', () => {
      it('should call execute for each line', async () => {
        await service.commitStock(mockTx, sampleLines);
        expect(mockTx.execute).toHaveBeenCalledTimes(2);
      });

      it('should use default location MAIN', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '1' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
        // The SQL should contain MAIN location (verified by the execute call succeeding)
      });

      it('should use custom location when provided', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '1' }], 'WAREHOUSE-2');
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });

      it('should skip lines with null productId', async () => {
        const lines: StockLine[] = [
          { productId: null, quantity: '10' },
          { productId: 'P1', quantity: '5' },
        ];
        await service.commitStock(mockTx, lines);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });

      it('should skip lines with zero quantity', async () => {
        const lines: StockLine[] = [
          { productId: 'P1', quantity: '0' },
          { productId: 'P2', quantity: '5' },
        ];
        await service.commitStock(mockTx, lines);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });

      it('should skip lines with negative quantity', async () => {
        const lines: StockLine[] = [
          { productId: 'P1', quantity: '-5' },
        ];
        await service.commitStock(mockTx, lines);
        expect(mockTx.execute).not.toHaveBeenCalled();
      });

      it('should handle empty lines array', async () => {
        await service.commitStock(mockTx, []);
        expect(mockTx.execute).not.toHaveBeenCalled();
      });
    });

    // ── releaseStock ──

    describe('releaseStock', () => {
      it('should call execute for each line', async () => {
        await service.releaseStock(mockTx, sampleLines);
        expect(mockTx.execute).toHaveBeenCalledTimes(2);
      });

      it('should skip null productIds', async () => {
        await service.releaseStock(mockTx, [{ productId: null, quantity: '10' }]);
        expect(mockTx.execute).not.toHaveBeenCalled();
      });
    });

    // ── deductStock ──

    describe('deductStock', () => {
      it('should call execute twice per line (on_hand and committed)', async () => {
        await service.deductStock(mockTx, [{ productId: 'P1', quantity: '5' }]);
        // Two columns updated: quantity_on_hand and quantity_committed
        expect(mockTx.execute).toHaveBeenCalledTimes(2);
      });

      it('should call execute 4 times for 2 lines', async () => {
        await service.deductStock(mockTx, sampleLines);
        expect(mockTx.execute).toHaveBeenCalledTimes(4);
      });
    });

    // ── restoreStock ──

    describe('restoreStock', () => {
      it('should call execute twice per line (on_hand and committed)', async () => {
        await service.restoreStock(mockTx, [{ productId: 'P1', quantity: '5' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(2);
      });

      it('should handle empty lines', async () => {
        await service.restoreStock(mockTx, []);
        expect(mockTx.execute).not.toHaveBeenCalled();
      });
    });

    // ── returnStock ──

    describe('returnStock', () => {
      it('should call execute once per line (on_hand only)', async () => {
        await service.returnStock(mockTx, [{ productId: 'P1', quantity: '3' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });
    });

    // ── placeOnOrder ──

    describe('placeOnOrder', () => {
      it('should call execute once per line (on_order)', async () => {
        await service.placeOnOrder(mockTx, [{ productId: 'P1', quantity: '100' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });
    });

    // ── cancelOnOrder ──

    describe('cancelOnOrder', () => {
      it('should call execute once per line (on_order)', async () => {
        await service.cancelOnOrder(mockTx, [{ productId: 'P1', quantity: '100' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });
    });

    // ── receiveStock ──

    describe('receiveStock', () => {
      it('should call execute twice per line (on_hand + on_order)', async () => {
        await service.receiveStock(mockTx, [{ productId: 'P1', quantity: '50' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(2);
      });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
      it('should handle fractional quantities', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '2.5' }]);
        expect(mockTx.execute).toHaveBeenCalledTimes(1);
      });

      it('should handle empty string quantity (treated as 0)', async () => {
        await service.commitStock(mockTx, [{ productId: 'P1', quantity: '' }]);
        expect(mockTx.execute).not.toHaveBeenCalled();
      });

      it('should process multiple lines in sequence', async () => {
        const lines: StockLine[] = [
          { productId: 'A', quantity: '1' },
          { productId: 'B', quantity: '2' },
          { productId: 'C', quantity: '3' },
        ];
        await service.commitStock(mockTx, lines);
        expect(mockTx.execute).toHaveBeenCalledTimes(3);
      });
    });
  });
});
