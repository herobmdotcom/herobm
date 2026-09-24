import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { setupPgliteSuite } from '../../test-utils/pglite-suite';
import {
  products,
  locations,
  zones,
  bins,
  binContents,
  inventoryEntries,
  inventoryLedger,
  uomDictionary,
  stocktakes,
  stocktakeLines,
  stocktakeCounts,
} from '@herobm/db-schema';
import { STOCKTAKE_STATE, PRODUCT_STATE } from '@herobm/shared';
import { eq } from 'drizzle-orm';
import { StocktakesQueryService } from './stocktakes-query.service';
import { StocktakesWriteService } from './stocktakes-write.service';
import { StocktakesCountsWriteService } from './stocktakes-counts-write.service';
import { InventoryMovementService } from '../inventory-movement.service';
import { UomService } from '../uom.service';
import { GlService } from '../../gl/gl.service';
import { AppConfigService } from '../../settings/app-config.service';
import { WorkOrdersWriteService } from '../../manufacturing/work-orders-write.service';
import { BackordersService } from '../../orders/backorders.service';
import { ReturnsWriteService } from '../../orders/returns-write.service';
import { ProjectsInventoryService } from '../../projects/projects-inventory.service';

jest.mock('../../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('Stocktakes Services (Query & Write)', () => {
  const pg = setupPgliteSuite();
  let writeService: StocktakesWriteService;
  let queryService: StocktakesQueryService;
  let movementService: InventoryMovementService;

  const LOCATION_ID = '00000000-0000-4000-8000-000000000001';
  const ZONE_A_ID = '00000000-0000-4000-8000-000000000002';
  const ZONE_B_ID = '00000000-0000-4000-8000-000000000003';
  const BIN_A1_ID = '00000000-0000-4000-8000-000000000004';
  const BIN_B1_ID = '00000000-0000-4000-8000-000000000005';
  const PRODUCT_1_ID = '00000000-0000-4000-8000-000000000006';
  const PRODUCT_2_ID = '00000000-0000-4000-8000-000000000007';
  const PRODUCT_3_ID = '00000000-0000-4000-8000-000000000008';

  beforeEach(async () => {
    // Clear test-specific data
    await pg.db.delete(stocktakeCounts);
    await pg.db.delete(stocktakeLines);
    await pg.db.delete(stocktakes);
    await pg.db.delete(inventoryLedger);
    await pg.db.delete(inventoryEntries);
    await pg.db.delete(binContents);

    // Seed static reference data
    await pg.db
      .insert(uomDictionary)
      .values({
        uomCode: 'EA',
        description: 'Each',
        category: 'goods',
      })
      .onConflictDoNothing();

    await pg.db
      .insert(locations)
      .values({
        locationId: LOCATION_ID,
        code: 'STK-LOC',
        name: 'Stocktake Warehouse',
        source: 'app',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    await pg.db
      .insert(zones)
      .values([
        {
          zoneId: ZONE_A_ID,
          locationId: LOCATION_ID,
          code: 'ZONE-A',
          name: 'Zone A',
          source: 'app',
          createdBy: 'system',
        },
        {
          zoneId: ZONE_B_ID,
          locationId: LOCATION_ID,
          code: 'ZONE-B',
          name: 'Zone B',
          source: 'app',
          createdBy: 'system',
        },
      ])
      .onConflictDoNothing();

    await pg.db
      .insert(bins)
      .values([
        {
          binId: BIN_A1_ID,
          zoneId: ZONE_A_ID,
          binNumber: 'A-01-01',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
          isUnavailable: false,
          isBonded: false,
        },
        {
          binId: BIN_B1_ID,
          zoneId: ZONE_B_ID,
          binNumber: 'B-01-01',
          binType: 'storage',
          source: 'app',
          createdBy: 'system',
          isUnavailable: false,
          isBonded: false,
        },
      ])
      .onConflictDoNothing();

    await pg.db
      .insert(products)
      .values([
        {
          productId: PRODUCT_1_ID,
          productNumber: 'SKU-001',
          name: 'Standard Widget',
          baseUom: 'EA',
          productType: 'inventory',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
        {
          productId: PRODUCT_2_ID,
          productNumber: 'SKU-002',
          name: 'Deluxe Widget',
          baseUom: 'EA',
          productType: 'inventory',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
        {
          productId: PRODUCT_3_ID,
          productNumber: 'SKU-003',
          name: 'Unlisted Gadget',
          baseUom: 'EA',
          productType: 'inventory',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
      ])
      .onConflictDoNothing();

    // Populate bin contents
    await pg.db.insert(binContents).values([
      {
        binId: BIN_A1_ID,
        productId: PRODUCT_1_ID,
        actualQuantity: '10.0000',
      },
      {
        binId: BIN_B1_ID,
        productId: PRODUCT_2_ID,
        actualQuantity: '25.0000',
      },
    ]);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StocktakesWriteService,
        StocktakesCountsWriteService,
        StocktakesQueryService,
        InventoryMovementService,
        UomService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            getSystemSetting: jest.fn().mockResolvedValue(null),
            valuationMethod: jest.fn().mockReturnValue('weighted_average'),
            inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
            defaultFulfillmentLocationId: jest
              .fn()
              .mockReturnValue(LOCATION_ID),
          },
        },
        {
          provide: GlService,
          useValue: {
            postJournalEntry: jest
              .fn()
              .mockResolvedValue({ journalEntryId: 'je-1' }),
            getEffectiveControlAccount: jest.fn().mockResolvedValue('1200'),
          },
        },
        {
          provide: WorkOrdersWriteService,
          useValue: {
            checkAndReserveComponentsForPendingWorkOrders: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: BackordersService,
          useValue: {
            allocateStockToBackorders: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReturnsWriteService,
          useValue: {
            reserveStockForPendingClaims: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: ProjectsInventoryService,
          useValue: {
            recordProjectReturnCredit: jest.fn().mockResolvedValue(undefined),
            recordProjectStagingCharge: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    writeService = module.get<StocktakesWriteService>(StocktakesWriteService);
    queryService = module.get<StocktakesQueryService>(StocktakesQueryService);
    movementService = module.get<InventoryMovementService>(
      InventoryMovementService,
    );
  });

  describe('Stocktake Creation & Snapshotting', () => {
    it('creates a full stocktake snapshotting all bin contents in location', async () => {
      const created = await writeService.create(
        {
          name: 'Q3 Full Stocktake',
          locationId: LOCATION_ID,
          scopeType: 'full',
          isBlindCount: false,
          notes: 'Full quarterly audit',
        },
        'alice',
      );

      expect(created.stocktakeId).toBeDefined();
      expect(created.stocktakeNumber).toMatch(/^STK-\d{8}-\d{4}$/);
      expect(created.stateCode).toBe(STOCKTAKE_STATE.OPEN);
      expect(created.createdBy).toBe('alice');
      expect(created.openedBy).toBe('alice');
      expect(created.openedAt).toBeDefined();

      // Check snapshot lines
      const lines = await pg.db
        .select()
        .from(stocktakeLines)
        .where(eq(stocktakeLines.stocktakeId, created.stocktakeId));

      expect(lines).toHaveLength(2);
      const line1 = lines.find((l) => l.productId === PRODUCT_1_ID);
      const line2 = lines.find((l) => l.productId === PRODUCT_2_ID);

      expect(line1).toBeDefined();
      expect(parseFloat(line1!.expectedQuantity)).toBe(10);
      expect(line1!.countedQuantity).toBeNull();

      expect(line2).toBeDefined();
      expect(parseFloat(line2!.expectedQuantity)).toBe(25);
    });

    it('creates a zone-scoped stocktake snapshotting only matching zones', async () => {
      const created = await writeService.create(
        {
          name: 'Zone A Cycle Count',
          locationId: LOCATION_ID,
          scopeType: 'zone',
          zoneFilter: 'ZONE-A',
        },
        'bob',
      );

      const lines = await pg.db
        .select()
        .from(stocktakeLines)
        .where(eq(stocktakeLines.stocktakeId, created.stocktakeId));

      expect(lines).toHaveLength(1);
      expect(lines[0].productId).toBe(PRODUCT_1_ID);
      expect(lines[0].binId).toBe(BIN_A1_ID);
    });
  });

  describe('Lifecycle State Machine Transitions', () => {
    let stocktakeId: string;

    beforeEach(async () => {
      const created = await writeService.create(
        {
          name: 'Lifecycle Test',
          locationId: LOCATION_ID,
          scopeType: 'full',
        },
        'alice',
      );
      stocktakeId = created.stocktakeId;
    });

    it('transitions open -> review and records reviewedBy audit field', async () => {
      const reviewed = (await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.REVIEW },
        'charlie',
      )) as any;

      expect(reviewed.stateCode).toBe(STOCKTAKE_STATE.REVIEW);
      expect(reviewed.reviewedBy).toBe('charlie');
      expect(reviewed.reviewedAt).toBeDefined();
    });

    it('allows transition open -> draft and draft -> open', async () => {
      const drafted = (await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.DRAFT },
        'alice',
      )) as any;
      expect(drafted.stateCode).toBe(STOCKTAKE_STATE.DRAFT);

      const opened = (await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.OPEN },
        'bob',
      )) as any;
      expect(opened.stateCode).toBe(STOCKTAKE_STATE.OPEN);
      expect(opened.openedBy).toBe('alice');
    });

    it('allows reopening review -> open for recounting', async () => {
      await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.REVIEW },
        'charlie',
      );
      const reopened = (await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.OPEN },
        'dan',
      )) as any;

      expect(reopened.stateCode).toBe(STOCKTAKE_STATE.OPEN);
    });

    it('rejects invalid direct transition open -> submitted', async () => {
      await expect(
        writeService.changeState(
          stocktakeId,
          { stateCode: STOCKTAKE_STATE.SUBMITTED },
          'alice',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows cancellation from draft, open, or review', async () => {
      const cancelled = (await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.CANCELLED },
        'manager',
      )) as any;

      expect(cancelled.stateCode).toBe(STOCKTAKE_STATE.CANCELLED);
      expect(cancelled.cancelledBy).toBe('manager');
      expect(cancelled.cancelledAt).toBeDefined();
    });
  });

  describe('Multi-Counter Concurrent Counting', () => {
    let stocktakeId: string;

    beforeEach(async () => {
      const created = await writeService.create(
        {
          name: 'Concurrent Count Test',
          locationId: LOCATION_ID,
          scopeType: 'full',
        },
        'alice',
      );
      stocktakeId = created.stocktakeId;
    });

    it('records counts from multiple users in append-only log and updates aggregated lines', async () => {
      // Operator Alice counts 6 in Bin A
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '6',
          countMode: 'set',
        },
        'alice',
      );

      // Operator Bob counts additional 4 in Bin A with increment mode
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '4',
          countMode: 'increment',
        },
        'bob',
      );

      // Verify count log contains both entries
      const countEntries = await pg.db
        .select()
        .from(stocktakeCounts)
        .where(eq(stocktakeCounts.stocktakeId, stocktakeId));

      expect(countEntries).toHaveLength(2);
      expect(countEntries.map((c) => c.countedBy)).toEqual(
        expect.arrayContaining(['alice', 'bob']),
      );

      // Verify line is aggregated to 10
      const [line] = await pg.db
        .select()
        .from(stocktakeLines)
        .where(eq(stocktakeLines.stocktakeId, stocktakeId));

      expect(parseFloat(line.countedQuantity!)).toBe(10);
      expect(line.lastCountedBy).toBe('bob');
    });

    it('supports batch count recording from offline scanner sync', async () => {
      const updatedLines = await writeService.recordBatchCounts(
        stocktakeId,
        {
          counts: [
            {
              productId: PRODUCT_1_ID,
              binId: BIN_A1_ID,
              quantity: '10',
              countMode: 'set',
            },
            {
              productId: PRODUCT_2_ID,
              binId: BIN_B1_ID,
              quantity: '23',
              countMode: 'set',
            },
          ],
        },
        'scanner-user',
      );

      expect(updatedLines.results).toHaveLength(2);

      const lines = await pg.db
        .select()
        .from(stocktakeLines)
        .where(eq(stocktakeLines.stocktakeId, stocktakeId));

      const line1 = lines.find((l) => l.productId === PRODUCT_1_ID);
      const line2 = lines.find((l) => l.productId === PRODUCT_2_ID);

      expect(parseFloat(line1!.countedQuantity!)).toBe(10);
      expect(parseFloat(line2!.countedQuantity!)).toBe(23);
    });
  });

  describe('Adding Unlisted Products', () => {
    let stocktakeId: string;

    beforeEach(async () => {
      const created = await writeService.create(
        {
          name: 'Unlisted Test',
          locationId: LOCATION_ID,
          scopeType: 'zone',
          zoneFilter: 'ZONE-A',
        },
        'alice',
      );
      stocktakeId = created.stocktakeId;
    });

    it('adds an unlisted product line with isUnlisted flag', async () => {
      const newLine = await writeService.addUnlistedProduct(
        stocktakeId,
        {
          productId: PRODUCT_3_ID,
          binId: BIN_A1_ID,
          countedQuantity: '5',
          notes: 'Found in corner shelf',
        },
        'charlie',
      );

      expect(newLine.isUnlisted).toBe(true);
      expect(parseFloat(newLine.expectedQuantity)).toBe(0);
      expect(parseFloat(newLine.countedQuantity!)).toBe(5);
      expect(newLine.lastCountedBy).toBe('charlie');
    });
  });

  describe('Blind Count Security & Masking', () => {
    let stocktakeId: string;

    beforeEach(async () => {
      const created = await writeService.create(
        {
          name: 'Blind Count Audit',
          locationId: LOCATION_ID,
          scopeType: 'full',
          isBlindCount: true,
        },
        'auditor',
      );
      stocktakeId = created.stocktakeId;
    });

    it('masks expectedQuantity and varianceQuantity while open', async () => {
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '8',
        },
        'counter1',
      );

      const lines = await queryService.findLines(stocktakeId, {
        page: 1,
        limit: 10,
      });
      expect(lines.data[0].expectedQuantity).toBeNull();
      expect(lines.data[0].varianceQuantity).toBeNull();
      expect(parseFloat(lines.data[0].countedQuantity!)).toBe(8);
    });

    it('unmasks expectedQuantity and varianceQuantity once transitioned to review', async () => {
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '8',
        },
        'counter1',
      );
      await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.REVIEW },
        'supervisor',
      );

      const lines = await queryService.findLines(stocktakeId, {
        page: 1,
        limit: 10,
      });
      const line1 = lines.data.find((l) => l.productId === PRODUCT_1_ID);

      expect(line1!.expectedQuantity).toBe('10.0000');
      expect(line1!.varianceQuantity).toBe('-2');
      expect(line1!.status).toBe('shortage');

      // Verify header discrepancyLines is unmasked in review state
      const single = await queryService.findOne(stocktakeId);
      expect(single.discrepancyLines).toBe(1);
    });

    it('masks discrepancyLines in findOne and findAll while in open state', async () => {
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '8',
        },
        'counter1',
      );

      const single = await queryService.findOne(stocktakeId);
      expect(single.discrepancyLines).toBeNull();

      const all = await queryService.findAll({ page: 1, limit: 10 });
      const found = all.data.find((s) => s.stocktakeId === stocktakeId);
      expect(found?.discrepancyLines).toBeNull();
    });
  });

  describe('Reconciliation Submission & Inventory Adjustment', () => {
    let stocktakeId: string;

    beforeEach(async () => {
      const created = await writeService.create(
        {
          name: 'Year-End Stocktake',
          locationId: LOCATION_ID,
          scopeType: 'full',
        },
        'alice',
      );
      stocktakeId = created.stocktakeId;

      // Product 1: Expected 10, Counted 8 (Shortage of 2)
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '8',
        },
        'alice',
      );

      // Product 2: Expected 25, Counted 28 (Surplus of 3)
      await writeService.recordCount(
        stocktakeId,
        {
          productId: PRODUCT_2_ID,
          binId: BIN_B1_ID,
          quantity: '28',
        },
        'alice',
      );

      await writeService.changeState(
        stocktakeId,
        { stateCode: STOCKTAKE_STATE.REVIEW },
        'supervisor',
      );
    });

    it('submits reconciliation, records movement entries, and marks submitted', async () => {
      const res = await writeService.submitReconciliation(
        stocktakeId,
        { reason: 'Year-end physical count reconciliation' },
        'supervisor',
      );

      expect(res.success).toBe(true);
      expect(res.stateCode).toBe(STOCKTAKE_STATE.SUBMITTED);
      expect(res.reconciledCount).toBe(2);

      // Verify stocktake record is submitted
      const [stk] = await pg.db
        .select()
        .from(stocktakes)
        .where(eq(stocktakes.stocktakeId, stocktakeId));

      expect(stk.stateCode).toBe(STOCKTAKE_STATE.SUBMITTED);
      expect(stk.submittedBy).toBe('supervisor');
      expect(stk.submittedOn).toBeDefined();

      // Verify bin contents updated to match physical counts
      const [bin1] = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_A1_ID));
      expect(parseFloat(bin1.actualQuantity)).toBe(8);

      const [bin2] = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_B1_ID));
      expect(parseFloat(bin2.actualQuantity)).toBe(28);
    });

    it('rejects reconciliation submission if any lines remain uncounted', async () => {
      const newStk = await writeService.create(
        {
          name: 'Incomplete Count Test',
          locationId: LOCATION_ID,
          scopeType: 'full',
        },
        'alice',
      );

      // Only count Product 1; leave Product 2 uncounted
      await writeService.recordCount(
        newStk.stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '10',
        },
        'alice',
      );

      await writeService.changeState(
        newStk.stocktakeId,
        { stateCode: STOCKTAKE_STATE.REVIEW },
        'supervisor',
      );

      await expect(
        writeService.submitReconciliation(
          newStk.stocktakeId,
          { reason: 'Incomplete submit' },
          'supervisor',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks all items in a bin as empty (zero count) with markBinEmpty and allows submission', async () => {
      const newStk = await writeService.create(
        {
          name: 'Empty Bin Test',
          locationId: LOCATION_ID,
          scopeType: 'full',
        },
        'alice',
      );

      // Count Product 1
      await writeService.recordCount(
        newStk.stocktakeId,
        {
          productId: PRODUCT_1_ID,
          binId: BIN_A1_ID,
          quantity: '10',
        },
        'alice',
      );

      // Product 2 in BIN_B1 is empty; mark BIN_B1 as empty
      const markRes = await writeService.markBinEmpty(
        newStk.stocktakeId,
        BIN_B1_ID,
        'alice',
      );
      expect(markRes.success).toBe(true);
      expect(markRes.markedCount).toBe(1);

      // Verify line is now counted with 0
      const lines = await queryService.findLines(newStk.stocktakeId, {
        page: 1,
        limit: 10,
      });
      const line2 = lines.data.find((l) => l.productId === PRODUCT_2_ID);
      expect(parseFloat(line2!.countedQuantity!)).toBe(0);

      await writeService.changeState(
        newStk.stocktakeId,
        { stateCode: STOCKTAKE_STATE.REVIEW },
        'supervisor',
      );

      const res = await writeService.submitReconciliation(
        newStk.stocktakeId,
        { reason: 'All counted or zeroed' },
        'supervisor',
      );
      expect(res.success).toBe(true);
      expect(res.stateCode).toBe(STOCKTAKE_STATE.SUBMITTED);
    });

    it('prevents resubmission or modification once submitted', async () => {
      await writeService.submitReconciliation(
        stocktakeId,
        { reason: 'First submit' },
        'supervisor',
      );

      let submitError: any;
      try {
        await writeService.submitReconciliation(
          stocktakeId,
          { reason: 'Second submit' },
          'supervisor',
        );
      } catch (e) {
        submitError = e;
      }
      expect(submitError).toBeInstanceOf(ConflictException);

      let countError: any;
      try {
        await writeService.recordCount(
          stocktakeId,
          {
            productId: PRODUCT_1_ID,
            binId: BIN_A1_ID,
            quantity: '10',
          },
          'counter',
        );
      } catch (e) {
        countError = e;
      }
      expect(countError).toBeInstanceOf(BadRequestException);
    });
  });
});
