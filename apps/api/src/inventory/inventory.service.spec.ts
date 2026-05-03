import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../settings/app-config.service';
import { InventoryService } from './inventory.service';
import { UomService } from './uom.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('InventoryService', () => {
  let service: InventoryService;

  // =========================================================================
  // Read-only query mocks
  // =========================================================================

  const mockRows = [
    {
      inventoryLevelId: 'I001',
      productId: 'P1',
      productNumber: 'BOLT-M8',
      productName: 'M8 Hex Bolt',
      locationNo: 'MAIN',
      locationName: 'MAIN',
      quantityOnHand: '100',
      quantityCommitted: '0',
      quantityReserved: '0',
      quantityOnOrder: '0',
      quantityAvailable: 100,
    },
    {
      inventoryLevelId: 'I002',
      productId: 'P2',
      productNumber: 'NUT-M8',
      productName: 'M8 Hex Nut',
      locationNo: 'MAIN',
      locationName: 'MAIN',
      quantityOnHand: '200',
      quantityCommitted: '0',
      quantityReserved: '0',
      quantityOnOrder: '0',
      quantityAvailable: 200,
    },
  ];

  const mockBinRows = [
    {
      binContentsId: 'B001',
      binNumber: 'A-01-01',
      productNumber: 'BOLT-M8',
      productName: 'M8 Hex Bolt',
      actualQuantity: '50',
    },
  ];

  const mockQb = {
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockDb = {
    select: jest
      .fn()
      .mockReturnValue({ from: jest.fn().mockReturnValue(mockQb) }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQb.$dynamic.mockReturnValue(mockQb);
    mockQb.where.mockReturnValue(mockQb);
    mockQb.then = jest.fn().mockImplementation((cb) => cb(mockRows));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: DRIZZLE, useValue: mockDb },
        {
          provide: AppConfigService,
          useValue: { defaultFulfillmentLocationId: jest.fn() },
        },
        {
          provide: UomService,
          useValue: {
            calculateAbsoluteBaseQuantity: jest
              .fn()
              .mockImplementation(async (pid, lines) => {
                return lines.reduce(
                  (acc: number, l: any) => acc + l.quantity,
                  0,
                );
              }),
          },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // =========================================================================
  // Read-only queries (from modbm_core)
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated inventory levels', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 50);
    });

    it('should apply search filter', async () => {
      await service.findAll({ q: 'bolt' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should cap limit at 100000', async () => {
      await service.findAll({ limit: 200_000 });
      expect(mockQb.limit).toHaveBeenCalledWith(100_000);
    });

    it('should filter by locationNo', async () => {
      await service.findAll({ locationNo: 'LOC01' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should apply both search and locationNo filters', async () => {
      await service.findAll({ q: 'bolt', locationNo: 'LOC01' });
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
      await service.findBins({ q: 'A-01' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should filter by locationNo', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ locationNo: 'LOC02' });
      expect(mockQb.where).toHaveBeenCalled();
    });

    it('should apply both search and locationNo for bins', async () => {
      mockQb.then = jest.fn().mockImplementation((cb) => cb(mockBinRows));
      await service.findBins({ q: 'A-01', locationNo: 'LOC02' });
      // 1. combined and(searchTerm, locationNo)
      // 2. UOMs query
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
  // recordInventoryMovement (Ledger write path)
  // =========================================================================

  describe('recordInventoryMovement', () => {
    let mockTx: any;
    let insertedEntries: any[];
    let insertedLedger: any[];
    let insertedOutbox: any[];

    beforeEach(() => {
      insertedEntries = [];
      insertedLedger = [];
      insertedOutbox = [];

      mockTx = {
        select: jest.fn().mockImplementation(() => {
          return {
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([
                  {
                    bins: { binId: 'BIN-A', zoneId: 'Z-1' },
                    zones: { locationId: 'LOC-MAIN', zoneId: 'Z-1' },
                  },
                  {
                    bins: { binId: 'BIN-SHIP', zoneId: 'Z-2' },
                    zones: { locationId: 'LOC-MAIN', zoneId: 'Z-2' },
                  },
                ]),
              }),
            }),
          };
        }),
        insert: jest.fn().mockImplementation(() => {
          return {
            values: jest.fn().mockImplementation((payload: any) => {
              const chainObj: any = {};
              chainObj.onConflictDoUpdate = jest.fn().mockReturnValue(chainObj);
              chainObj.returning = jest.fn();
              chainObj.then = (cb: any) => cb([]);

              if (payload && payload.entryNumber !== undefined) {
                insertedEntries.push(payload);
                chainObj.returning.mockResolvedValue([
                  { entryId: 'entry-uuid-001' },
                ]);
              } else if (Array.isArray(payload)) {
                insertedLedger.push(payload);
              } else if (payload && payload.actualQuantity !== undefined) {
                // Bin contents cache
              } else if (payload && payload.eventType !== undefined) {
                insertedOutbox.push(payload);
              }
              return chainObj;
            }),
          };
        }),
      };
    });

    const baseLedgerParams = {
      entryNumber: 'TST-001',
      sourceType: 'SO_PICK',
      sourceId: 'order-123',
      memo: 'Test movement',
      userId: 'admin',
      lines: [
        { productId: 'P1', binId: 'BIN-A', quantity: -5 },
        { productId: 'P1', binId: 'BIN-SHIP', quantity: 5 },
      ],
    };

    it('should insert an entry header, ledger lines, and outbox event', async () => {
      await service.recordInventoryMovement(mockTx, baseLedgerParams);

      expect(mockTx.insert).toHaveBeenCalledTimes(4); // entry, ledger, and 2 bin updates

      // Header
      expect(insertedEntries).toHaveLength(1);
      expect(insertedEntries[0]).toMatchObject({
        entryNumber: 'TST-001',
        sourceType: 'SO_PICK',
        sourceId: 'order-123',
        memo: 'Test movement',
        createdBy: 'admin',
      });

      // Ledger lines
      expect(insertedLedger).toHaveLength(1);
      const ledgerPayload = insertedLedger[0];
      expect(ledgerPayload).toHaveLength(2);
      expect(ledgerPayload[0]).toMatchObject({
        entryId: 'entry-uuid-001',
        productId: 'P1',
        binId: 'BIN-A',
        quantity: '-5',
      });
      expect(ledgerPayload[1]).toMatchObject({
        entryId: 'entry-uuid-001',
        productId: 'P1',
        binId: 'BIN-SHIP',
        quantity: '5',
      });

      // Outbox event
      expect(emitEvent).toHaveBeenCalledWith(mockTx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: 'entry-uuid-001',
        eventType: EventType.STOCK_ADJUSTED,
        payload: {
          header: baseLedgerParams,
          lines: ledgerPayload,
        },
      });
    });

    it('should skip all inserts when lines array is empty', async () => {
      await service.recordInventoryMovement(mockTx, {
        ...baseLedgerParams,
        lines: [],
      });

      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('unique constraint violation');
      mockTx.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(dbError),
        }),
      });

      await expect(
        service.recordInventoryMovement(mockTx, baseLedgerParams),
      ).rejects.toThrow('unique constraint violation');
    });

    it('should convert quantity numbers to strings in ledger lines', async () => {
      await service.recordInventoryMovement(mockTx, {
        ...baseLedgerParams,
        lines: [
          {
            productId: 'P1',
            binId: 'BIN-A',
            quantity: 3.5,
          },
        ],
      });

      const ledgerPayload = insertedLedger[0];
      expect(ledgerPayload[0].quantity).toBe('3.5');
    });
  });
});
