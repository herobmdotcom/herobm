import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { UomService } from './uom.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import { emitEvent } from '../common/emit-event';
import { EventType } from '../common/event-types';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  products,
  locations,
  zones,
  bins,
  inventoryEntries,
  inventoryLedger,
  binContents,
  uomDictionary,
} from '../drizzle/herobm-core-schema';
import { eq, sql } from 'drizzle-orm';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('InventoryService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: InventoryService;

  const PRODUCT_ID = '00000000-0000-0000-0000-00000000000a';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const ZONE_ID = '00000000-0000-0000-0000-00000000000c';
  const BIN_ID = '00000000-0000-0000-0000-00000000000b';

  beforeEach(async () => {
    // Seed static data
    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    });

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'Z1',
      name: 'Zone 1',
    });

    await pg.db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'B-01-01',
    });

    await pg.db.insert(products).values({
      productId: PRODUCT_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest
              .fn()
              .mockReturnValue(LOCATION_ID),
          },
        },
        {
          provide: UomService,
          useValue: {
            calculateAbsoluteBaseQuantity: jest
              .fn()
              .mockImplementation(async (pid, lines) => {
                return lines.reduce(
                  (acc: number, l: { quantity?: number }) =>
                    acc + (l.quantity || 0),
                  0,
                );
              }),
          },
        },
        {
          provide: GlService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(null),
            postJournalEntry: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);

    // Clean transactional data
    await pg.db.delete(inventoryLedger);
    await pg.db.delete(inventoryEntries);
    await pg.db.delete(binContents);
  });

  describe('recordInventoryMovement', () => {
    it('should insert an entry header, ledger lines, and update bin contents', async () => {
      const params = {
        entryNumber: 'MV-001',
        sourceType: 'TEST',
        sourceId: '00000000-0000-0000-0000-000000000e11',
        memo: 'Test movement',
        userId: 'admin',
        lines: [{ productId: PRODUCT_ID, binId: BIN_ID, quantity: 10 }],
      };

      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(
          tx as unknown as Parameters<
            typeof service.recordInventoryMovement
          >[0],
          params,
        );
      });

      // Verify header
      const entries = await pg.db
        .select()
        .from(inventoryEntries)
        .where(eq(inventoryEntries.entryNumber, 'MV-001'));
      expect(entries).toHaveLength(1);
      expect(entries[0].sourceType).toBe('TEST');

      // Verify ledger
      const ledger = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, entries[0].entryId));
      expect(ledger).toHaveLength(1);
      expect(ledger[0].quantity).toBe('10');

      // Verify bin contents (cache)
      const bins_data = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_ID));
      expect(bins_data).toHaveLength(1);
      expect(bins_data[0].actualQuantity).toBe('10');

      // Verify event emission
      expect(emitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: 'inventory_ledger',
          eventType: 'entry_posted',
        }),
      );
    });

    it('should correctly handle negative quantities (picks)', async () => {
      const params = {
        entryNumber: 'MV-002',
        sourceType: 'PICK',
        sourceId: '00000000-0000-0000-0000-000000000e12',
        lines: [{ productId: PRODUCT_ID, binId: BIN_ID, quantity: -5 }],
      };

      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(
          tx as unknown as Parameters<
            typeof service.recordInventoryMovement
          >[0],
          params,
        );
      });

      const bins_data = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_ID));
      expect(bins_data).toHaveLength(0);
    });
  });

  describe('moveStock', () => {
    it('should emit stock_moved and entry_posted events', async () => {
      // Seed target bin
      const TARGET_BIN_ID = '00000000-0000-0000-0000-000000000010';
      await pg.db.insert(bins).values({
        binId: TARGET_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'B-01-02',
      });

      // Seed initial stock
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '100',
      });

      const params = {
        lines: [
          {
            productId: PRODUCT_ID,
            sourceBinId: BIN_ID,
            targetBinId: TARGET_BIN_ID,
            quantity: '10',
          },
        ],
        reason: 'Consolidation',
      };

      await service.moveStock(
        params as unknown as Parameters<typeof service.moveStock>[0],
        'admin',
      );

      // Verify emitEvent called at least twice (one for ledger, one for warehouse)
      expect(emitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: 'warehouse',
          eventType: 'stock_moved',
        }),
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: 'inventory_ledger',
          eventType: 'entry_posted',
        }),
      );

      // Check cache updated
      const sourceBin = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_ID));
      expect(sourceBin[0].actualQuantity).toBe('90');

      const targetBin = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, TARGET_BIN_ID));
      expect(targetBin[0].actualQuantity).toBe('10');
    });
  });

  describe('quarantineMove', () => {
    it('should emit stock_moved and entry_posted events', async () => {
      // Seed target bin
      const TARGET_BIN_ID = '00000000-0000-0000-0000-000000000011';
      await pg.db.insert(bins).values({
        binId: TARGET_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'QUARANTINE-1',
        binType: 'quarantine',
      });

      // Seed initial stock
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '100',
      });

      await service.quarantineStock(
        {
          productId: PRODUCT_ID,
          sourceBinId: BIN_ID,
          targetBinId: TARGET_BIN_ID,
          quantity: '5',
          reason: 'Damaged',
        },
        'admin',
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: 'warehouse',
          eventType: 'stock_moved',
        }),
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityType: 'inventory_ledger',
          eventType: 'entry_posted',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated inventory levels', async () => {
      // Seed some ledger data to have non-zero stock
      const entryId = '00000000-0000-0000-0000-0000000000e1';
      await pg.db.insert(inventoryEntries).values({
        entryId,
        entryNumber: 'E1',
        sourceType: 'INIT',
        entryDate: new Date(),
      });
      await pg.db.insert(inventoryLedger).values({
        entryId,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        binId: BIN_ID,
        zoneId: ZONE_ID,
        quantity: '100',
      });
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '100',
      });

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].productNumber).toBe('P1');
      expect(result.data[0].quantityAvailable).toBe(100);
    });
  });

  describe('findAllLocations', () => {
    it('omits availableQty when no productId is supplied', async () => {
      const result = await service.findAllLocations();
      expect(result.length).toBeGreaterThan(0);
      for (const loc of result) {
        expect((loc as { availableQty?: number }).availableQty).toBeUndefined();
      }
    });

    it('returns availableQty per location when productId is supplied', async () => {
      // Seed some stock so the inventory_levels view has rows
      const entryId = '00000000-0000-0000-0000-0000000000f1';
      await pg.db.insert(inventoryEntries).values({
        entryId,
        entryNumber: 'E-LOC-1',
        sourceType: 'INIT',
        entryDate: new Date(),
      });
      await pg.db.insert(inventoryLedger).values({
        entryId,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        binId: BIN_ID,
        zoneId: ZONE_ID,
        quantity: '42',
      });
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '42',
      });

      const result = await service.findAllLocations(PRODUCT_ID);
      const main = (
        result as { locationId: string; availableQty?: number }[]
      ).find((l) => l.locationId === LOCATION_ID);
      expect(main).toBeDefined();
      expect(main!.availableQty).toBe(42);
    });

    it('returns 0 availableQty for locations with no stock of the product', async () => {
      const result = await service.findAllLocations(PRODUCT_ID);
      // The seeded LOCATION_ID has nothing in bin_contents for this product
      const main = (
        result as { locationId: string; availableQty?: number }[]
      ).find((l) => l.locationId === LOCATION_ID);
      expect(main).toBeDefined();
      expect(main!.availableQty).toBe(0);
    });
  });
});
