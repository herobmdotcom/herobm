import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
  productUoms,
  productComponents,
  projects,
  projectTasks,
  transferOrders,
  transferOrderLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  customers,
  suppliers,
  purchaseOrders,
  purchaseOrderLineItems,
  goodsReceived,
  goodsReceivedLines,
  salesOrders,
  salesOrderLineItems,
  salesOrderReturns,
  salesOrderReturnLines,
  productDefaultBins,
  productGroups,
  productSuppliers,
  organizations,
} from '@herobm/db-schema';
import {
  PRODUCT_STATE,
  PROJECT_STATE,
  PROJECT_TASK_STATE,
  PROJECT_BILLING_TYPE,
  CUSTOMER_STATE,
  SUPPLIER_STATE,
  PUTAWAY_STATUS,
  TRANSFER_ORDER_STATE,
  MATCH_STATUS,
  GOODS_RECEIVED_STATE,
  PURCHASE_ORDER_STATE,
  SALES_ORDER_STATE,
  RETURN_STATE,
  BIN_TYPE,
  ORGANIZATION_STATE,
} from '@herobm/shared';
import { and, eq, sql } from 'drizzle-orm';
import { InventoryMovementService } from './inventory-movement.service';
import { InventoryQueryService } from './inventory-query.service';
import { DemandQueryService } from './demand-query.service';
import { WorkOrdersWriteService } from '../manufacturing/work-orders-write.service';
import { BackordersService } from '../orders/backorders.service';
import { ReturnsWriteService } from '../orders/returns-write.service';
import { ProjectsInventoryService } from '../projects/projects-inventory.service';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('InventoryService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: InventoryMovementService;
  let queryService: InventoryQueryService;
  let demandQueryService: DemandQueryService;
  let returnsWriteService: ReturnsWriteService;
  let appConfig: AppConfigService;
  let mockReturnsWriteService!: {
    updateReturnLinePutawayStatus: jest.Mock;
  };
  let mockProjectsInventoryService: {
    recordProjectReturnCredit: jest.Mock;
    recordProjectStagingCharge: jest.Mock;
  };
  const PRODUCT_ID = '00000000-0000-4000-8000-00000000000a';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const ZONE_ID = '00000000-0000-4000-8000-00000000000c';
  const BIN_ID = '00000000-0000-4000-8000-00000000000b';

  beforeEach(async () => {
    // Seed static data
    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
      category: 'goods',
    });

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'Z1',
      name: 'Zone 1',
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'B-01-01',
      binType: 'storage',
      source: 'app',
      createdBy: 'system',
      isUnavailable: false,
      isBonded: false,
    });

    await pg.db.insert(products).values({
      productId: PRODUCT_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProjectsInventoryService = {
      recordProjectReturnCredit: jest.fn().mockResolvedValue(undefined),
      recordProjectStagingCharge: jest.fn().mockResolvedValue(undefined),
    };

    mockReturnsWriteService = {
      updateReturnLinePutawayStatus: jest
        .fn()
        .mockImplementation(async (tx, lineId, status) => {
          await tx
            .update(salesOrderReturnLines)
            .set({ putawayStatus: status })
            .where(eq(salesOrderReturnLines.returnLineId, lineId));
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryMovementService,
        InventoryQueryService,
        DemandQueryService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest
              .fn()
              .mockReturnValue(LOCATION_ID),
            allowNegativeInventory: jest.fn().mockReturnValue(false),
          },
        },
        UomService,
        {
          provide: GlService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(null),
            postJournalEntry: jest.fn(),
          },
        },
        {
          provide: WorkOrdersWriteService,
          useValue: {
            updatePutawayStatus: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BackordersService,
          useValue: {
            fulfillWorkOrderDemand: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReturnsWriteService,
          useValue: mockReturnsWriteService,
        },
        {
          provide: ProjectsInventoryService,
          useValue: mockProjectsInventoryService,
        },
      ],
    }).compile();

    service = module.get<InventoryMovementService>(InventoryMovementService);
    queryService = module.get<InventoryQueryService>(InventoryQueryService);
    demandQueryService = module.get<DemandQueryService>(DemandQueryService);
    returnsWriteService = module.get<ReturnsWriteService>(ReturnsWriteService);
    appConfig = module.get<AppConfigService>(AppConfigService);

    // Clean transactional data
    await pg.db.delete(transferOrderReceiptLines);
    await pg.db.delete(transferOrderReceipts);
    await pg.db.delete(transferOrders);
    await pg.db.delete(projectTasks);
    await pg.db.delete(projects);
    await pg.db.delete(customers);
    await pg.db.delete(inventoryLedger);
    await pg.db.delete(inventoryEntries);
    await pg.db.delete(binContents);
  });

  describe('recordInventoryMovement', () => {
    it('should insert an entry header, ledger lines, and update bin contents', async () => {
      const params = {
        entryNumber: 'MV-001',
        sourceType: 'TEST',
        sourceId: '00000000-0000-4000-8000-000000000e11',
        memo: 'Test movement',
        userId: 'admin',
        lines: [
          { productId: PRODUCT_ID, binId: BIN_ID, quantity: 10, uomCode: 'EA' },
        ],
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
      // Pre-seed bin contents with stock to satisfy stock guard when allowNegativeInventory is false
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '5',
      });

      const params = {
        entryNumber: 'MV-002',
        sourceType: 'PICK',
        sourceId: '00000000-0000-4000-8000-000000000e12',
        lines: [
          { productId: PRODUCT_ID, binId: BIN_ID, quantity: -5, uomCode: 'EA' },
        ],
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
      const TARGET_BIN_ID = '00000000-0000-4000-8000-000000000010';
      await pg.db.insert(bins).values({
        binId: TARGET_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'B-01-02',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
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
      const TARGET_BIN_ID = '00000000-0000-4000-8000-000000000011';
      await pg.db.insert(bins).values({
        binId: TARGET_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'QUARANTINE-1',
        binType: 'quarantine',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
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
      const entryId = '00000000-0000-4000-8000-0000000000e1';
      await pg.db.insert(inventoryEntries).values({
        entryId,
        entryNumber: 'E1',
        sourceType: 'INIT',
        entryDate: new Date(),
        isReversed: false,
        createdBy: 'system',
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

      const result = await queryService.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].productNumber).toBe('P1');
      expect(result.data[0].quantityAvailable).toBe(100);
    });
  });

  describe('findAllLocations', () => {
    it('omits availableQty when no productId is supplied', async () => {
      const result = await queryService.findAllLocations();
      expect(result.length).toBeGreaterThan(0);
      for (const loc of result) {
        expect((loc as { availableQty?: number }).availableQty).toBeUndefined();
      }
    });

    it('returns availableQty per location when productId is supplied', async () => {
      // Seed some stock so the inventory_levels view has rows
      const entryId = '00000000-0000-4000-8000-0000000000f1';
      await pg.db.insert(inventoryEntries).values({
        entryId,
        entryNumber: 'E-LOC-1',
        sourceType: 'INIT',
        entryDate: new Date(),
        isReversed: false,
        createdBy: 'system',
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

      const result = await queryService.findAllLocations(PRODUCT_ID);
      const main = (
        result as { locationId: string; availableQty?: number }[]
      ).find((l) => l.locationId === LOCATION_ID);
      expect(main).toBeDefined();
      expect(main!.availableQty).toBe(42);
    });

    it('returns 0 availableQty for locations with no stock of the product', async () => {
      const result = await queryService.findAllLocations(PRODUCT_ID);
      // The seeded LOCATION_ID has nothing in bin_contents for this product
      const main = (
        result as { locationId: string; availableQty?: number }[]
      ).find((l) => l.locationId === LOCATION_ID);
      expect(main).toBeDefined();
      expect(main!.availableQty).toBe(0);
    });
  });

  describe('UoM Ledger Boundary Validation & Fractions', () => {
    it('should reject transactions with an unregistered uomCode', async () => {
      const params = {
        entryNumber: 'MV-INVALID',
        sourceType: 'TEST',
        sourceId: '00000000-0000-4000-8000-000000000e11',
        memo: 'Test movement',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 10,
            uomCode: 'FAKE_UOM',
          },
        ],
      };

      await expect(
        pg.db.transaction(async (tx) => {
          await service.recordInventoryMovement(
            tx as unknown as Parameters<
              typeof service.recordInventoryMovement
            >[0],
            params,
          );
        }),
      ).rejects.toThrow(); // Should fail foreign key constraint or explicit check
    });

    it('should accurately process and calculate available quantity for fractional composite UoMs', async () => {
      // 1. Register BOX (10 EA)
      await pg.db
        .insert(uomDictionary)
        .values({
          uomCode: 'BOX',
          description: 'Box of 10',
          category: 'goods',
        })
        .onConflictDoNothing();

      const FRAC_PROD_ID = '00000000-0000-4000-8000-000000000022';

      await pg.db.insert(products).values({
        productId: FRAC_PROD_ID,
        productNumber: 'FRAC-01',
        name: 'Fractional Product',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await pg.db.insert(productUoms).values({
        productId: FRAC_PROD_ID,
        uomCode: 'BOX',
        ratio: '10',
      });

      // 2. Record movement of 1.5 BOX
      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(tx as any, {
          entryNumber: 'MV-FRAC-1',
          sourceType: 'MANUAL',
          sourceId: '00000000-0000-4000-8000-000000000001',
          userId: 'admin',
          lines: [
            {
              productId: FRAC_PROD_ID,
              binId: BIN_ID,
              quantity: 1.5,
              uomCode: 'BOX',
            },
          ],
        });
      });

      // 3. Assert base quantity in ledger is exactly 15
      const ledgerEntries = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.productId, FRAC_PROD_ID));

      expect(ledgerEntries).toHaveLength(1);
      expect(Number(ledgerEntries[0].quantity)).toBe(15);

      // Also verify available quantity
      const locs = await queryService.findAllLocations(FRAC_PROD_ID);
      const mainLoc = locs.find((l: any) => l.locationId === LOCATION_ID);
      expect(mainLoc!.availableQty).toBe(15);
    });
  });

  describe('findBinsByLocation', () => {
    it('should return all bins for a given location', async () => {
      const bins = await queryService.findBinsByLocation(LOCATION_ID);
      expect(bins).toHaveLength(7); // 1 manual bin + 6 auto-generated handling bins
      const manualBin = bins.find((b) => b.binId === BIN_ID);
      expect(manualBin).toBeDefined();
      expect(manualBin!.zoneCode).toEqual('Z1');
    });

    it('should filter by binType', async () => {
      // Test matching binType
      const matchingBins = await queryService.findBinsByLocation(
        LOCATION_ID,
        'storage',
      );
      expect(matchingBins).toHaveLength(1);

      // Test non-matching binType
      const emptyBins = await queryService.findBinsByLocation(
        LOCATION_ID,
        'pick',
      );
      expect(emptyBins).toHaveLength(0);
    });

    it('should filter by zoneCode', async () => {
      // Test matching zoneCode
      const matchingBins = await queryService.findBinsByLocation(
        LOCATION_ID,
        undefined,
        'Z1',
      );
      expect(matchingBins).toHaveLength(1);

      // Test non-matching zoneCode
      const emptyBins = await queryService.findBinsByLocation(
        LOCATION_ID,
        undefined,
        'Z2',
      );
      expect(emptyBins).toHaveLength(0);
    });

    it('should filter by both binType and zoneCode', async () => {
      const bins = await queryService.findBinsByLocation(
        LOCATION_ID,
        'storage',
        'Z1',
      );
      expect(bins).toHaveLength(1);
    });
  });

  describe('findBins', () => {
    it('should return all bins (including empty bins) by default for Bin Contents view', async () => {
      const res = await queryService.findBins({});
      expect(res.data.length).toBeGreaterThan(0);
    });

    it('should exclude empty bins when hasStock=true is specified', async () => {
      const res = await queryService.findBins({ hasStock: true });
      for (const row of res.data) {
        expect(row.productId).toBeTruthy();
        expect(row.productNumber).not.toBe('');
        expect(Number(row.actualQuantity)).toBeGreaterThan(0);
      }
    });

    it('should return empty list when filtering binType with hasStock=true when no active stock exists', async () => {
      const res = await queryService.findBins({
        binType: 'quarantine',
        hasStock: true,
      });
      expect(res.data).toHaveLength(0);
    });
  });

  describe('findByProductIds (Kit Buildable & Availability)', () => {
    it('should calculate kit buildable quantity based on component quantity requirement', async () => {
      const COMP_ID = '00000000-0000-4000-8000-000000000099';
      const KIT_ID = '00000000-0000-4000-8000-000000000088';

      // 1. Create Child Component
      await pg.db.insert(products).values({
        productId: COMP_ID,
        productNumber: 'COMP-1',
        name: 'Component Bolt',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      // 2. Create Non-Stock Kit Parent
      await pg.db.insert(products).values({
        productId: KIT_ID,
        productNumber: 'KIT-1',
        name: 'Assembly Kit',
        baseUom: 'EA',
        productType: 'non-stock',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'kit',
        createdBy: 'system',
      });

      // 3. Link Kit Component: 2 bolts per 1 kit
      await pg.db.insert(productComponents).values({
        parentProductId: KIT_ID,
        childProductId: COMP_ID,
        quantity: '2',
        parentQuantity: '1',
      });

      // 4. Seed 10 bolts in bin
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: COMP_ID,
        actualQuantity: '10',
      });

      // 5. Query kit inventory
      const res = await queryService.findByProductIds([KIT_ID]);
      expect(res.data).toHaveLength(1);
      const kitRow = res.data[0];
      expect(kitRow.productId).toBe(KIT_ID);
      // 10 bolts / 2 bolts per kit = 5 buildable kits
      expect(kitRow.quantityOnHand).toBe('5');
      expect(kitRow.quantityAvailable).toBe(5);
    });
  });

  describe('Negative Inventory Guard & Validation', () => {
    it('should reject stock reduction when allowNegativeInventory is false and requested qty exceeds available stock', async () => {
      (appConfig.allowNegativeInventory as jest.Mock).mockReturnValue(false);

      // Seed bin with 10 units
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '10',
      });

      // Attempt to decrement 15 units
      await expect(
        pg.db.transaction(async (tx) => {
          await service.recordInventoryMovement(tx, {
            entryNumber: 'TEST-OVERDRAW-1',
            sourceType: 'TEST',
            lines: [
              {
                binId: BIN_ID,
                productId: PRODUCT_ID,
                quantity: -15,
                uomCode: 'EA',
              },
            ],
          });
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow stock reduction when stock is sufficient and allowNegativeInventory is false', async () => {
      (appConfig.allowNegativeInventory as jest.Mock).mockReturnValue(false);

      // Seed bin with 10 units
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '10',
      });

      // Decrement 6 units
      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(tx, {
          entryNumber: 'TEST-VALID-DEC',
          sourceType: 'TEST',
          lines: [
            {
              binId: BIN_ID,
              productId: PRODUCT_ID,
              quantity: -6,
              uomCode: 'EA',
            },
          ],
        });
      });

      const [stock] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, BIN_ID),
            eq(binContents.productId, PRODUCT_ID),
          ),
        );
      expect(Number(stock.actualQuantity)).toBe(4);
    });

    it('should allow stock reduction past zero when allowNegativeInventory is true', async () => {
      (appConfig.allowNegativeInventory as jest.Mock).mockReturnValue(true);

      // Seed bin with 5 units
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '5',
      });

      // Decrement 15 units (balance goes to -10)
      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(tx, {
          entryNumber: 'TEST-ALLOW-NEG',
          sourceType: 'TEST',
          lines: [
            {
              binId: BIN_ID,
              productId: PRODUCT_ID,
              quantity: -15,
              uomCode: 'EA',
            },
          ],
        });
      });

      const ledgerLines = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.productId, PRODUCT_ID));
      expect(ledgerLines.length).toBe(1);
      expect(Number(ledgerLines[0].quantity)).toBe(-15);
    });
  });

  /*
    const CUSTOMER_ID = '00000000-0000-4000-8000-000000000099';
    const PROJECT_ID = '00000000-0000-4000-8000-000000000098';
    const TASK_ID = '00000000-0000-4000-8000-000000000097';
    const STAGING_BIN_ID = '00000000-0000-4000-8000-000000000096';
    const TO_ID = '00000000-0000-4000-8000-000000000095';
    const TO_LINE_ID = '00000000-0000-4000-8000-000000000092';
    const RECEIPT_ID = '00000000-0000-4000-8000-000000000094';
    const RECEIPT_LINE_ID = '00000000-0000-4000-8000-000000000093';

    beforeEach(async () => {
      await pg.db.insert(bins).values({
        binId: STAGING_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'STAGING-PRJ-01',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
      });

      await pg.db
        .insert(customers)
        .values({
          customerId: CUSTOMER_ID,
          customerNumber: 'CUST-009',
          currencyCode: 'AUD',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();

      await pg.db.insert(projects).values({
        projectId: PROJECT_ID,
        projectNumber: 'PRJ-2026-PUTAWAY',
        name: 'Putaway Test Project',
        customerId: CUSTOMER_ID,
        currencyCode: 'AUD',
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        wipMethod: PROJECT_WIP_METHOD.PERCENTAGE_OF_COMPLETION,
        stateCode: PROJECT_STATE.ACTIVE,
        stage: 'Planning',
        stagingLocationId: LOCATION_ID,
        stagingBinId: STAGING_BIN_ID,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(projectTasks).values({
        projectTaskId: TASK_ID,
        projectId: PROJECT_ID,
        taskCode: '1.0',
        name: 'Task 1',
        stateCode: PROJECT_TASK_STATE.NOT_STARTED,
        isMilestone: false,
        isBillable: true,
        source: 'app',
        createdBy: 'system',
      });
    });

    it('should return project metadata on pending putaway lines for transfer order receipts', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1001',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: true,
        stateCode: 'received',
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '8',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1001',
        transferOrderId: TO_ID,
        destinationLocationId: LOCATION_ID,
        stateCode: 'received',
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: STAGING_BIN_ID,
        quantity: '8',
        putawayStatus: 'pending_putaway',
      });

      const pending = await queryService.getPendingPutaway(LOCATION_ID);
      const line = pending.find((p) => p.id === RECEIPT_LINE_ID);

      expect(line).toBeDefined();
      expect(line?.sourceType).toBe('transfer_receipt');
      expect(line?.projectId).toBe(PROJECT_ID);
      expect(line?.projectNumber).toBe('PRJ-2026-PUTAWAY');
      expect(line?.projectName).toBe('Putaway Test Project');
      expect(line?.projectStagingBinId).toBe(STAGING_BIN_ID);
      expect(line?.projectStagingBinNumber).toBe('STAGING-PRJ-01');
      expect(line?.isProjectReturn).toBe(true);
    });

    it('should pre-select project staging bin in getPutawayContext when staging materials for project', async () => {
      const context = await queryService.getPutawayContext(
        PRODUCT_ID,
        LOCATION_ID,
        PROJECT_ID,
        false,
      );
    });

    it('should allow stock reduction when stock is sufficient and allowNegativeInventory is false', async () => {
      (appConfig.allowNegativeInventory as jest.Mock).mockReturnValue(false);

      // Seed bin with 10 units
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '10',
      });

      // Decrement 6 units
      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(tx, {
          entryNumber: 'TEST-VALID-DEC',
          sourceType: 'TEST',
          lines: [
            {
              binId: BIN_ID,
              productId: PRODUCT_ID,
              quantity: -6,
              uomCode: 'EA',
            },
          ],
        });
      });

      const [stock] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, BIN_ID),
            eq(binContents.productId, PRODUCT_ID),
          ),
        );
      expect(Number(stock.actualQuantity)).toBe(4);
    });

    it('should allow stock reduction past zero when allowNegativeInventory is true', async () => {
      (appConfig.allowNegativeInventory as jest.Mock).mockReturnValue(true);

      // Seed bin with 5 units
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '5',
      });

      // Decrement 15 units (balance goes to -10)
      await pg.db.transaction(async (tx) => {
        await service.recordInventoryMovement(tx, {
          entryNumber: 'TEST-ALLOW-NEG',
          sourceType: 'TEST',
          lines: [
            {
              binId: BIN_ID,
              productId: PRODUCT_ID,
              quantity: -15,
              uomCode: 'EA',
            },
          ],
        });
      });

      const ledgerLines = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.productId, PRODUCT_ID));
      expect(ledgerLines.length).toBe(1);
      expect(Number(ledgerLines[0].quantity)).toBe(-15);
    });
  }); */

  describe('Project Putaway & Transfer Staging / Returns', () => {
    const CUSTOMER_ID = '00000000-0000-4000-8000-000000000099';
    const PROJECT_ID = '00000000-0000-4000-8000-000000000098';
    const TASK_ID = '00000000-0000-4000-8000-000000000097';
    const STAGING_BIN_ID = '00000000-0000-4000-8000-000000000096';
    const TO_ID = '00000000-0000-4000-8000-000000000095';
    const TO_LINE_ID = '00000000-0000-4000-8000-000000000092';
    const RECEIPT_ID = '00000000-0000-4000-8000-000000000094';
    const RECEIPT_LINE_ID = '00000000-0000-4000-8000-000000000093';

    beforeEach(async () => {
      await pg.db.insert(bins).values({
        binId: STAGING_BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'STAGING-PRJ-01',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
      });

      await pg.db
        .insert(customers)
        .values({
          customerId: CUSTOMER_ID,
          customerNumber: 'CUST-009',
          currencyCode: 'AUD',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();

      await pg.db.insert(projects).values({
        projectId: PROJECT_ID,
        projectNumber: 'PRJ-2026-PUTAWAY',
        name: 'Putaway Test Project',
        customerId: CUSTOMER_ID,
        currencyCode: 'AUD',
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        stateCode: PROJECT_STATE.ACTIVE,
        stage: 'Planning',
        stagingLocationId: LOCATION_ID,
        stagingBinId: STAGING_BIN_ID,
        createdBy: 'system',
      });

      await pg.db.insert(projectTasks).values({
        projectTaskId: TASK_ID,
        projectId: PROJECT_ID,
        taskCode: '1.0',
        name: 'Task 1',
        stateCode: PROJECT_TASK_STATE.NOT_STARTED,
        isMilestone: false,
        isBillable: true,
        createdBy: 'system',
      });
    });

    it('should return project metadata on pending putaway lines for transfer order receipts', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1001',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: true,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '8',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1001',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: STAGING_BIN_ID,
        quantity: '8',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const pending = await queryService.getPendingPutaway(LOCATION_ID);
      const line = pending.find((p) => p.id === RECEIPT_LINE_ID);

      expect(line).toBeDefined();
      expect(line?.sourceType).toBe('transfer_receipt');
      expect(line?.projectId).toBe(PROJECT_ID);
      expect(line?.projectNumber).toBe('PRJ-2026-PUTAWAY');
      expect(line?.projectName).toBe('Putaway Test Project');
      expect(line?.projectStagingBinId).toBe(STAGING_BIN_ID);
      expect(line?.isProjectReturn).toBe(true);
    });

    it('should pre-select project staging bin in getPutawayContext when staging materials for project', async () => {
      const context = await queryService.getPutawayContext(
        PRODUCT_ID,
        LOCATION_ID,
        PROJECT_ID,
        false,
      );

      expect(context.primaryBinId).toBe(STAGING_BIN_ID);
      expect(context.primaryBinNumber).toBe('STAGING-PRJ-01');
    });

    it('should trigger recordProjectReturnCredit when putting away a project return transfer receipt line', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1002',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: true,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '5',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1002',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: BIN_ID,
        quantity: '5',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const autoBins = await pg.db.select().from(bins);
      const recvBinId = autoBins.find(
        (b) => b.binNumber === 'RECEIVING',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-TO-RECV',
        sourceType: 'MANUAL',
        sourceId: '00000000-0000-4000-8000-000000000099',
        memo: 'Init receiving stock',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: recvBinId,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: RECEIPT_LINE_ID,
              sourceType: 'transfer_receipt',
              destinationBinId: BIN_ID,
              quantity: '5',
            },
          ],
        },
        'warehouse_user',
      );

      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          projectId: PROJECT_ID,
          productId: PRODUCT_ID,
          quantity: 5,
          actor: 'warehouse_user',
        }),
      );
    });

    it('should trigger recordProjectStagingCharge when putting away an inbound project transfer receipt line', async () => {
      const INBOUND_TO_ID = '00000000-0000-4000-8000-000000000088';
      const INBOUND_TO_LINE_ID = '00000000-0000-4000-8000-000000000089';
      const INBOUND_REC_ID = '00000000-0000-4000-8000-00000000008a';
      const INBOUND_REC_LINE_ID = '00000000-0000-4000-8000-00000000008b';

      await pg.db.insert(transferOrders).values({
        transferOrderId: INBOUND_TO_ID,
        orderNumber: 'TRF-1003',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: INBOUND_TO_LINE_ID,
        transferOrderId: INBOUND_TO_ID,
        productId: PRODUCT_ID,
        quantity: '8',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: INBOUND_REC_ID,
        receiptNumber: 'REC-TRF-1003',
        transferOrderId: INBOUND_TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: INBOUND_REC_LINE_ID,
        receiptId: INBOUND_REC_ID,
        transferOrderLineId: INBOUND_TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: STAGING_BIN_ID,
        quantity: '8',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const autoBins = await pg.db.select().from(bins);
      const recvBinId = autoBins.find(
        (b) => b.binNumber === 'RECEIVING',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-TO-INBOUND-RECV',
        sourceType: 'MANUAL',
        sourceId: '00000000-0000-4000-8000-000000000098',
        memo: 'Init receiving stock for inbound transfer',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: recvBinId,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: INBOUND_REC_LINE_ID,
              sourceType: 'transfer_receipt',
              destinationBinId: STAGING_BIN_ID,
              quantity: '8',
            },
          ],
        },
        'warehouse_user',
      );

      expect(
        mockProjectsInventoryService.recordProjectStagingCharge,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockProjectsInventoryService.recordProjectStagingCharge,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          projectId: PROJECT_ID,
          productId: PRODUCT_ID,
          quantity: 8,
          actor: 'warehouse_user',
        }),
      );
    });

    it('should reject putaway of project return transfer receipt line into project staging bin', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1003',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: true,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '5',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1003',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: BIN_ID,
        quantity: '5',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      await expect(
        service.putaway(
          {
            putaways: [
              {
                lineId: RECEIPT_LINE_ID,
                sourceType: 'transfer_receipt',
                destinationBinId: STAGING_BIN_ID,
                quantity: '5',
              },
            ],
          },
          'warehouse_user',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow putaway of project stock transfer receipt line into project staging bin', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1004',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '5',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1004',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: STAGING_BIN_ID,
        quantity: '5',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const autoBins = await pg.db.select().from(bins);
      const recvBinId = autoBins.find(
        (b) => b.binNumber === 'RECEIVING',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-TO-RECV-4',
        sourceType: 'MANUAL',
        sourceId: '00000000-0000-4000-8000-000000000099',
        memo: 'Init receiving stock',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: recvBinId,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: RECEIPT_LINE_ID,
              sourceType: 'transfer_receipt',
              destinationBinId: STAGING_BIN_ID,
              quantity: '5',
            },
          ],
        },
        'warehouse_user',
      );

      const [updatedLine] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptLineId, RECEIPT_LINE_ID));
      expect(updatedLine.putawayStatus).toBe(PUTAWAY_STATUS.COMPLETED);
      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).not.toHaveBeenCalled();
    });

    it('should reject putaway of project stock transfer receipt line into general warehouse storage bin', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1005',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '5',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1005',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: STAGING_BIN_ID,
        quantity: '5',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      await expect(
        service.putaway(
          {
            putaways: [
              {
                lineId: RECEIPT_LINE_ID,
                sourceType: 'transfer_receipt',
                destinationBinId: BIN_ID,
                quantity: '5',
              },
            ],
          },
          'warehouse_user',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow putaway of project stock transfer receipt line into quarantine bin', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1006',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        projectId: PROJECT_ID,
        projectTaskId: TASK_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '5',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1006',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: STAGING_BIN_ID,
        quantity: '5',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const autoBins = await pg.db.select().from(bins);
      const recvBinId = autoBins.find(
        (b) => b.binNumber === 'RECEIVING',
      )!.binId;
      const quaranBinId = autoBins.find(
        (b) => b.binNumber === 'QUARANTINE',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-TO-RECV-6',
        sourceType: 'MANUAL',
        sourceId: '00000000-0000-4000-8000-000000000099',
        memo: 'Init receiving stock',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: recvBinId,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: RECEIPT_LINE_ID,
              sourceType: 'transfer_receipt',
              destinationBinId: quaranBinId,
              quantity: '5',
            },
          ],
        },
        'warehouse_user',
      );

      const [updatedLine] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptLineId, RECEIPT_LINE_ID));
      expect(updatedLine.putawayStatus).toBe(PUTAWAY_STATUS.QUARANTINED);
      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).not.toHaveBeenCalled();
    });

    it('should allow putaway of standard transfer receipt line into warehouse storage bin', async () => {
      await pg.db.insert(transferOrders).values({
        transferOrderId: TO_ID,
        orderNumber: 'TRF-1007',
        sourceLocationId: LOCATION_ID,
        destinationLocationId: LOCATION_ID,
        isProjectReturn: false,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(transferOrderLines).values({
        transferOrderLineId: TO_LINE_ID,
        transferOrderId: TO_ID,
        productId: PRODUCT_ID,
        quantity: '5',
      });

      await pg.db.insert(transferOrderReceipts).values({
        receiptId: RECEIPT_ID,
        receiptNumber: 'REC-TRF-1007',
        transferOrderId: TO_ID,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: 'system',
      });

      await pg.db.insert(transferOrderReceiptLines).values({
        receiptLineId: RECEIPT_LINE_ID,
        receiptId: RECEIPT_ID,
        transferOrderLineId: TO_LINE_ID,
        productId: PRODUCT_ID,
        binId: BIN_ID,
        quantity: '5',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const autoBins = await pg.db.select().from(bins);
      const recvBinId = autoBins.find(
        (b) => b.binNumber === 'RECEIVING',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-TO-RECV-7',
        sourceType: 'MANUAL',
        sourceId: '00000000-0000-4000-8000-000000000099',
        memo: 'Init receiving stock',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: recvBinId,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: RECEIPT_LINE_ID,
              sourceType: 'transfer_receipt',
              destinationBinId: BIN_ID,
              quantity: '5',
            },
          ],
        },
        'warehouse_user',
      );

      const [updatedLine] = await pg.db
        .select()
        .from(transferOrderReceiptLines)
        .where(eq(transferOrderReceiptLines.receiptLineId, RECEIPT_LINE_ID));
      expect(updatedLine.putawayStatus).toBe(PUTAWAY_STATUS.COMPLETED);
      expect(
        mockProjectsInventoryService.recordProjectReturnCredit,
      ).not.toHaveBeenCalled();
    });

    it('should putaway goods receipt line from RECEIVING system bin to storage bin (ADV-200)', async () => {
      const VENDOR_ID = '00000000-0000-4000-8000-000000000070';
      const PO_ID = '00000000-0000-4000-8000-000000000071';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000072';
      const GR_ID = '00000000-0000-4000-8000-000000000073';
      const GR_LINE_ID = '00000000-0000-4000-8000-000000000074';

      await pg.db.insert(suppliers).values({
        vendorId: VENDOR_ID,
        vendorNumber: 'V-ADV200-1',
        currencyCode: 'USD',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-ADV200-1',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'USD',
        exchangeRate: '1',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrderLineItems).values({
        purchaseOrderLineId: PO_LINE_ID,
        purchaseOrderId: PO_ID,
        lineNumber: 1,
        productId: PRODUCT_ID,
        quantity: '10',
        pricePerUnit: '10.00',
        amount: '100.00',
        unitOfMeasure: 'EA',
      });

      await pg.db.insert(goodsReceived).values({
        goodsReceivedId: GR_ID,
        receiptNumber: 'RCV-ADV200-1',
        vendorId: VENDOR_ID,
        locationId: LOCATION_ID,
        stateCode: GOODS_RECEIVED_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedLineId: GR_LINE_ID,
        goodsReceivedId: GR_ID,
        productId: PRODUCT_ID,
        quantityReceived: '10',
        unitCost: '10.00',
        matchStatus: MATCH_STATUS.MATCHED,
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
        purchaseOrderId: PO_ID,
        purchaseOrderLineId: PO_LINE_ID,
      });

      const autoBins = await pg.db.select().from(bins);
      const recvBinId = autoBins.find(
        (b) => b.binNumber === 'RECEIVING',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-GR-RECV-ADV200',
        sourceType: 'PO_RECEIPT',
        sourceId: PO_ID,
        memo: 'Init GR stock in RECEIVING',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: recvBinId,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: GR_LINE_ID,
              sourceType: 'goods_receipt',
              destinationBinId: BIN_ID,
              quantity: '10',
            },
          ],
        },
        'dock_user',
      );

      const [updatedGrLine] = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedLineId, GR_LINE_ID));
      expect(updatedGrLine.putawayStatus).toBe(PUTAWAY_STATUS.COMPLETED);

      const [destCache] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, BIN_ID),
            eq(binContents.productId, PRODUCT_ID),
          ),
        );
      expect(Number(destCache.actualQuantity)).toBe(10);
    });

    it('should putaway quarantined goods receipt line from QUARANTINE system bin to storage bin (ADV-200)', async () => {
      const VENDOR_ID = '00000000-0000-4000-8000-000000000079';
      const PO_ID = '00000000-0000-4000-8000-000000000075';
      const PO_LINE_ID = '00000000-0000-4000-8000-000000000076';
      const GR_ID = '00000000-0000-4000-8000-000000000077';
      const GR_LINE_ID = '00000000-0000-4000-8000-000000000078';

      await pg.db.insert(suppliers).values({
        vendorId: VENDOR_ID,
        vendorNumber: 'V-ADV200-2',
        currencyCode: 'USD',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-ADV200-2',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'USD',
        exchangeRate: '1',
        stateCode: PURCHASE_ORDER_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(purchaseOrderLineItems).values({
        purchaseOrderLineId: PO_LINE_ID,
        purchaseOrderId: PO_ID,
        lineNumber: 1,
        productId: PRODUCT_ID,
        quantity: '4',
        pricePerUnit: '25.00',
        amount: '100.00',
        unitOfMeasure: 'EA',
      });

      await pg.db.insert(goodsReceived).values({
        goodsReceivedId: GR_ID,
        receiptNumber: 'RCV-ADV200-2',
        vendorId: VENDOR_ID,
        locationId: LOCATION_ID,
        stateCode: GOODS_RECEIVED_STATE.RECEIVED,
        createdBy: 'system',
      });

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedLineId: GR_LINE_ID,
        goodsReceivedId: GR_ID,
        productId: PRODUCT_ID,
        quantityReceived: '4',
        unitCost: '25.00',
        matchStatus: MATCH_STATUS.MATCHED,
        putawayStatus: PUTAWAY_STATUS.QUARANTINED,
        purchaseOrderId: PO_ID,
        purchaseOrderLineId: PO_LINE_ID,
      });

      const autoBins = await pg.db.select().from(bins);
      const quaranBinId = autoBins.find(
        (b) => b.binNumber === 'QUARANTINE',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-GR-QUARAN-ADV200',
        sourceType: 'PO_RECEIPT',
        sourceId: PO_ID,
        memo: 'Init GR stock in QUARANTINE',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: quaranBinId,
            quantity: 4,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: GR_LINE_ID,
              sourceType: 'goods_receipt',
              destinationBinId: BIN_ID,
              quantity: '4',
            },
          ],
        },
        'qc_inspector',
      );

      const [updatedGrLine] = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedLineId, GR_LINE_ID));
      expect(updatedGrLine.putawayStatus).toBe(PUTAWAY_STATUS.COMPLETED);
    });

    it('should putaway sales return line from CUSTOMER_RETURNS system bin to storage bin (ADV-200)', async () => {
      const SO_ID = '00000000-0000-4000-8000-000000000081';
      const SO_LINE_ID = '00000000-0000-4000-8000-000000000082';
      const RET_ID = '00000000-0000-4000-8000-000000000083';
      const RET_LINE_ID = '00000000-0000-4000-8000-000000000084';
      const CUST_ID = '00000000-0000-4000-8000-000000000085';

      await pg.db.insert(customers).values({
        customerId: CUST_ID,
        customerNumber: 'CUST-ADV200-1',
        currencyCode: 'USD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrders).values({
        salesOrderId: SO_ID,
        orderNumber: 'SO-ADV200-1',
        customerId: CUST_ID,
        currencyCode: 'USD',
        exchangeRate: '1',
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        baseTotalAmount: '50.00',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: SO_LINE_ID,
        salesOrderId: SO_ID,
        lineNumber: 1,
        productId: PRODUCT_ID,
        quantity: '2',
        pricePerUnit: '25.00',
        amount: '50.00',
        unitOfMeasure: 'EA',
      });

      await pg.db.insert(salesOrderReturns).values({
        returnId: RET_ID,
        returnNumber: 'RET-ADV200-1',
        salesOrderId: SO_ID,
        stateCode: RETURN_STATE.RECEIVED,
        locationId: LOCATION_ID,
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderReturnLines).values({
        returnLineId: RET_LINE_ID,
        returnId: RET_ID,
        salesOrderLineId: SO_LINE_ID,
        quantityReturned: '2',
        quantityReceived: '2',
        resolution: 'refund',
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const autoBins = await pg.db.select().from(bins);
      const custRetBinId = autoBins.find(
        (b) => b.binNumber === 'CUSTOMER_RETURNS',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-RET-ADV200',
        sourceType: 'SO_RETURN',
        sourceId: RET_ID,
        memo: 'Init SO return in CUSTOMER_RETURNS',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: custRetBinId,
            quantity: 2,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: RET_LINE_ID,
              sourceType: 'sales_return',
              destinationBinId: BIN_ID,
              quantity: '2',
            },
          ],
        },
        'dock_user',
      );

      /* eslint-disable @typescript-eslint/unbound-method -- Jest mock assertion */
      expect(
        returnsWriteService.updateReturnLinePutawayStatus,
      ).toHaveBeenCalledWith(
        expect.anything(),
        RET_LINE_ID,
        PUTAWAY_STATUS.COMPLETED,
        undefined,
        'dock_user',
      );
      /* eslint-enable @typescript-eslint/unbound-method */

      const [destCache1] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, BIN_ID),
            eq(binContents.productId, PRODUCT_ID),
          ),
        );
      expect(Number(destCache1.actualQuantity)).toBe(2);
    });

    it('should putaway quarantined sales return line from QUARANTINE system bin to storage bin (ADV-200)', async () => {
      const SO_ID = '00000000-0000-4000-8000-000000000086';
      const SO_LINE_ID = '00000000-0000-4000-8000-000000000087';
      const RET_ID = '00000000-0000-4000-8000-000000000088';
      const RET_LINE_ID = '00000000-0000-4000-8000-000000000089';
      const CUST_ID = '00000000-0000-4000-8000-00000000008a';

      await pg.db.insert(customers).values({
        customerId: CUST_ID,
        customerNumber: 'CUST-ADV200-2',
        currencyCode: 'USD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrders).values({
        salesOrderId: SO_ID,
        orderNumber: 'SO-ADV200-2',
        customerId: CUST_ID,
        currencyCode: 'USD',
        exchangeRate: '1',
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        baseTotalAmount: '75.00',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: SO_LINE_ID,
        salesOrderId: SO_ID,
        lineNumber: 1,
        productId: PRODUCT_ID,
        quantity: '3',
        pricePerUnit: '25.00',
        amount: '75.00',
        unitOfMeasure: 'EA',
      });

      await pg.db.insert(salesOrderReturns).values({
        returnId: RET_ID,
        returnNumber: 'RET-ADV200-2',
        salesOrderId: SO_ID,
        stateCode: RETURN_STATE.RECEIVED,
        locationId: LOCATION_ID,
        createdBy: 'system',
      });

      await pg.db.insert(salesOrderReturnLines).values({
        returnLineId: RET_LINE_ID,
        returnId: RET_ID,
        salesOrderLineId: SO_LINE_ID,
        quantityReturned: '3',
        quantityReceived: '3',
        resolution: 'refund',
        putawayStatus: PUTAWAY_STATUS.QUARANTINED,
      });

      const autoBins = await pg.db.select().from(bins);
      const quaranBinId = autoBins.find(
        (b) => b.binNumber === 'QUARANTINE',
      )!.binId;

      await service['recordInventoryMovement'](pg.db, {
        entryNumber: 'INIT-RET-QUARAN-ADV200',
        sourceType: 'SO_RETURN',
        sourceId: RET_ID,
        memo: 'Init quarantined SO return in QUARANTINE',
        userId: 'admin',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: quaranBinId,
            quantity: 3,
            uomCode: 'EA',
          },
        ],
      });

      await service.putaway(
        {
          putaways: [
            {
              lineId: RET_LINE_ID,
              sourceType: 'sales_return',
              destinationBinId: BIN_ID,
              quantity: '3',
            },
          ],
        },
        'qc_inspector',
      );

      /* eslint-disable @typescript-eslint/unbound-method -- Jest mock assertion */
      expect(
        mockReturnsWriteService.updateReturnLinePutawayStatus,
      ).toHaveBeenCalledWith(
        expect.anything(),
        RET_LINE_ID,
        PUTAWAY_STATUS.COMPLETED,
        undefined,
        'qc_inspector',
      );
      /* eslint-enable @typescript-eslint/unbound-method */

      const [destCache2] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, BIN_ID),
            eq(binContents.productId, PRODUCT_ID),
          ),
        );
      expect(Number(destCache2.actualQuantity)).toBe(3);
    });
  });

  describe('getRestockList', () => {
    it('should return items below minQuantity with suggested restock quantities and summary', async () => {
      // 1. Setup product with default bin configuration: min=20, max=50
      await pg.db.insert(productDefaultBins).values({
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        binId: BIN_ID,
        isPrimaryPerLocation: true,
        minQuantity: '20',
        maxQuantity: '50',
      });

      // 2. Setup preferred supplier for cost calculation
      const ORG_ID = '00000000-0000-4000-8000-000000000054';
      const VENDOR_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(organizations).values({
        organizationId: ORG_ID,
        name: 'Apex Supplier',
        stateCode: ORGANIZATION_STATE.ACTIVE,
        isTaxRegistered: false,
      });

      await pg.db.insert(suppliers).values({
        vendorId: VENDOR_ID,
        organizationId: ORG_ID,
        vendorNumber: 'V-100',
        stateCode: SUPPLIER_STATE.ACTIVE,
        currencyCode: 'USD',
        isPurchasingBlocked: false,
        isPaymentBlocked: false,
        source: 'app',
        createdBy: 'system',
      });

      await pg.db.insert(productSuppliers).values({
        productId: PRODUCT_ID,
        vendorId: VENDOR_ID,
        isPreferred: true,
        costPrice: '12.50',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });

      // 3. Current stock on hand is 5 (which is below min 20)
      await pg.db.insert(binContents).values({
        binId: BIN_ID,
        productId: PRODUCT_ID,
        actualQuantity: '5',
      });

      const res = await demandQueryService.getRestockList({
        locationId: LOCATION_ID,
      });

      expect(res.data).toHaveLength(1);
      const item = res.data[0];
      expect(item.productId).toBe(PRODUCT_ID);
      expect(item.productNumber).toBe('P1');
      expect(item.minQuantity).toBe(20);
      expect(item.maxQuantity).toBe(50);
      expect(item.quantityOnHand).toBe(5);
      // suggestedRestockQty: 50 - 5 = 45
      expect(item.suggestedRestockQty).toBe(45);
      expect(item.vendorId).toBe(VENDOR_ID);
      expect(item.vendorName).toBe('Apex Supplier');
      expect(item.costPrice).toBe(12.5);

      // Summary
      expect(res.summary.totalItems).toBe(1);
      expect(res.summary.totalSuggestedUnits).toBe(45);
      expect(res.summary.totalEstimatedCost).toBe(45 * 12.5);
    });

    it('should filter restock list by location and search query', async () => {
      const res = await demandQueryService.getRestockList({
        q: 'NonExistentProductQuery123',
      });
      expect(res.data).toHaveLength(0);
      expect(res.summary.totalItems).toBe(0);
    });
  });

  describe('getStockMovementReport', () => {
    it('should accurately compute opening stock, period movements, net movement, and closing balance', async () => {
      const today = new Date();
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const periodStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const periodEnd = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // tomorrow

      // 1. Opening balance movement (before periodStart)
      const opEntryId = '00000000-0000-4000-8000-0000000000d1';
      await pg.db.insert(inventoryEntries).values({
        entryId: opEntryId,
        entryNumber: 'MV-OP-1',
        sourceType: 'PO_RECEIPT',
        entryDate: pastDate,
        isReversed: false,
        createdBy: 'system',
      });
      await pg.db.insert(inventoryLedger).values({
        entryId: opEntryId,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        binId: BIN_ID,
        zoneId: ZONE_ID,
        quantity: '50',
      });

      // 2. In-period stock out (e.g. Sales Order shipment: -15)
      const periodEntryId = '00000000-0000-4000-8000-0000000000d2';
      await pg.db.insert(inventoryEntries).values({
        entryId: periodEntryId,
        entryNumber: 'MV-SO-1',
        sourceType: 'SO_SHIPMENT',
        entryDate: today,
        isReversed: false,
        createdBy: 'user1',
      });
      await pg.db.insert(inventoryLedger).values({
        entryId: periodEntryId,
        productId: PRODUCT_ID,
        locationId: LOCATION_ID,
        binId: BIN_ID,
        zoneId: ZONE_ID,
        quantity: '-15',
      });

      const report = await demandQueryService.getStockMovementReport({
        startDate: periodStart.toISOString().slice(0, 10),
        endDate: periodEnd.toISOString().slice(0, 10),
        locationId: LOCATION_ID,
      });

      expect(report.data).toHaveLength(1);
      const productRow = report.data[0];
      expect(productRow.productId).toBe(PRODUCT_ID);
      expect(productRow.openingQuantity).toBe(50);
      expect(productRow.stockIn).toBe(0);
      expect(productRow.stockOut).toBe(15);
      expect(productRow.netMovement).toBe(-15);
      expect(productRow.closingQuantity).toBe(35);
      expect(productRow.breakdown.soShipments).toBe(15);

      // Detailed ledger lines
      expect(report.movements).toHaveLength(1);
      expect(report.movements[0].entryNumber).toBe('MV-SO-1');
      expect(report.movements[0].sourceType).toBe('SO_SHIPMENT');
      expect(report.movements[0].quantity).toBe(-15);

      // Summary
      expect(report.summary.totalProducts).toBe(1);
      expect(report.summary.totalOpening).toBe(50);
      expect(report.summary.totalIn).toBe(0);
      expect(report.summary.totalOut).toBe(15);
      expect(report.summary.totalNet).toBe(-15);
      expect(report.summary.totalClosing).toBe(35);
    });
  });
});
