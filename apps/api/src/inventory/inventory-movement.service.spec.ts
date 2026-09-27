import { Test, TestingModule } from '@nestjs/testing';
import { InventoryMovementService } from './inventory-movement.service';
import { InventoryQueryService } from './inventory-query.service';
import { UomService } from './uom.service';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { WorkOrdersWriteService } from '../manufacturing/work-orders-write.service';
import { BackordersService } from '../orders/backorders.service';
import { ReturnsWriteService } from '../orders/returns-write.service';
import { ProjectsInventoryService } from '../projects/projects-inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  products,
  productUoms,
  uomDictionary,
  locations,
  zones,
  bins,
  inventoryEntries,
  inventoryLedger,
  binContents,
} from '@herobm/db-schema';
import { PRODUCT_STATE, BIN_TYPE } from '@herobm/shared';
import { eq } from 'drizzle-orm';

describe('InventoryMovementService - ADV-INV-002 Immutability & Valuation', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: InventoryMovementService;
  let queryService: InventoryQueryService;

  const LOCATION_ID = '00000000-0000-4000-8000-000000000001';
  const ZONE_ID = '00000000-0000-4000-8000-000000000002';
  const BIN_ID = '00000000-0000-4000-8000-000000000003';
  const BIN_SHIPPING_ID = '00000000-0000-4000-8000-000000000004';
  const PRODUCT_ID = '00000000-0000-4000-8000-000000000005';

  beforeEach(async () => {
    // Seed standard UOMs
    await pg.db.insert(uomDictionary).values([
      { uomCode: 'EA', description: 'Each', category: 'goods' },
      { uomCode: 'BOX', description: 'Box of 10', category: 'goods' },
      { uomCode: 'PALLET', description: 'Pallet of 100', category: 'goods' },
    ]);

    // Seed location, zone, and bins
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'SYD',
      name: 'Sydney Warehouse',
      source: 'app',
    });

    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'STORAGE',
      name: 'Main Storage Zone',
      source: 'app',
    });

    await pg.db.insert(bins).values([
      {
        binId: BIN_ID,
        zoneId: ZONE_ID,
        binNumber: 'A-01-01',
        binType: 'storage',
        source: 'app',
      },
      {
        binId: BIN_SHIPPING_ID,
        zoneId: ZONE_ID,
        binNumber: 'SHIPPING',
        binType: 'staging',
        source: 'app',
      },
    ]);

    // Seed product
    await pg.db.insert(products).values({
      productId: PRODUCT_ID,
      productNumber: 'SKU-001',
      name: 'Industrial Widget',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      standardCost: '15.00',
      weightedAverageCost: '12.50',
      source: 'app',
      structureType: 'standard',
    });

    await pg.db.insert(productUoms).values([
      { productId: PRODUCT_ID, uomCode: 'BOX', ratio: '10' },
      { productId: PRODUCT_ID, uomCode: 'PALLET', ratio: '100' },
    ]);
  });

  beforeEach(async () => {
    const mockAppConfig = {
      allowNegativeInventory: () => true,
      valuationMethod: () => 'weighted_average',
      inventoryAccountingMode: () => 'perpetual',
      defaultInventoryAccountId: () => '00000000-0000-4000-8000-000000000010',
      defaultGrniAccountId: () => '00000000-0000-4000-8000-000000000011',
      defaultCogsAccountId: () => '00000000-0000-4000-8000-000000000012',
      defaultShrinkageAccountId: () => '00000000-0000-4000-8000-000000000013',
      defaultPpvAccountId: () => '00000000-0000-4000-8000-000000000014',
    };

    const mockGlService = {
      postJournalEntry: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryMovementService,
        InventoryQueryService,
        UomService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: AppConfigService, useValue: mockAppConfig },
        { provide: GlService, useValue: mockGlService },
        { provide: WorkOrdersWriteService, useValue: {} },
        { provide: BackordersService, useValue: {} },
        { provide: ReturnsWriteService, useValue: {} },
        { provide: ProjectsInventoryService, useValue: {} },
      ],
    }).compile();

    service = module.get<InventoryMovementService>(InventoryMovementService);
    queryService = module.get<InventoryQueryService>(InventoryQueryService);
  });

  describe('recordInventoryMovement - ADV-INV-002 Snapshot Persistence', () => {
    it('persists explicit unitCost, totalValue, uomId, and originalQuantity on goods receipt', async () => {
      const result = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'GRN-2026-0001',
        sourceType: 'PO_RECEIPT',
        userId: 'admin',
        memo: 'PO Receipt 5 Boxes @ $120.00/Box ($12.00/EA)',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 5,
            uomCode: 'BOX',
            unitCost: '12.0000',
            originalQuantity: 5,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result?.entryId).toBeDefined();

      const ledgerLines = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, result!.entryId));

      expect(ledgerLines.length).toBe(1);
      const line = ledgerLines[0];

      // 5 BOX = 50 EA
      expect(Number(line.quantity)).toBe(50);
      expect(Number(line.originalQuantity)).toBe(5);
      expect(line.uomId).toBe('BOX');
      expect(Number(line.unitCost)).toBe(12.0);
      expect(Number(line.totalValue)).toBe(600.0); // 50 EA * 12.00
    });

    it('defaults unitCost from product weightedAverageCost and calculates totalValue automatically', async () => {
      const result = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'DSP-2026-0001',
        sourceType: 'SO_SHIPMENT',
        userId: 'warehouse_lead',
        memo: 'Outbound dispatch 2 Boxes',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_SHIPPING_ID,
            quantity: -2,
            uomCode: 'BOX',
          },
        ],
      });

      expect(result).toBeDefined();

      const ledgerLines = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, result!.entryId));

      expect(ledgerLines.length).toBe(1);
      const line = ledgerLines[0];

      // -2 BOX = -20 EA
      expect(Number(line.quantity)).toBe(-20);
      expect(Number(line.originalQuantity)).toBe(-2);
      expect(line.uomId).toBe('BOX');
      // Product WAC is 12.50
      expect(Number(line.unitCost)).toBe(12.5);
      expect(Number(line.totalValue)).toBe(-250.0); // -20 * 12.50
    });

    it('records balanced internal bin transfers with net zero quantity and net zero total value', async () => {
      const result = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'TRF-2026-0001',
        sourceType: 'TRANSFER',
        userId: 'operator_1',
        memo: 'Relocate 10 EA from A-01-01 to SHIPPING staging',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: -10,
            uomCode: 'EA',
          },
          {
            productId: PRODUCT_ID,
            binId: BIN_SHIPPING_ID,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      expect(result).toBeDefined();

      const ledgerLines = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, result!.entryId));

      expect(ledgerLines.length).toBe(2);

      const netQuantity = ledgerLines.reduce(
        (sum, l) => sum + Number(l.quantity),
        0,
      );
      const netTotalValue = ledgerLines.reduce(
        (sum, l) => sum + Number(l.totalValue),
        0,
      );

      expect(netQuantity).toBe(0);
      expect(netTotalValue).toBe(0);
    });

    it('preserves historical valuation and unit cost even when product master costs subsequently mutate (ADV-INV-002 Core Invariant)', async () => {
      // 1. Record movement at historical unit cost of $10.00
      const movement1 = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'GRN-HIST-001',
        sourceType: 'PO_RECEIPT',
        userId: 'admin',
        memo: 'Historical Receipt 10 EA @ $10.00',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 10,
            uomCode: 'EA',
            unitCost: '10.0000',
          },
        ],
      });

      // 2. Later, product costs mutate massively in product master (e.g., inflation or revaluation to $999.00)
      await pg.db
        .update(products)
        .set({
          weightedAverageCost: '999.0000',
          standardCost: '888.0000',
        })
        .where(eq(products.productId, PRODUCT_ID));

      // 3. Record movement at new cost
      const movement2 = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'GRN-HIST-002',
        sourceType: 'PO_RECEIPT',
        userId: 'admin',
        memo: 'New Receipt 10 EA @ default (now $999.00)',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      // 4. Verify historical movement 1 is 100% immutable and unaffected
      const lines1 = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, movement1!.entryId));

      expect(lines1.length).toBe(1);
      expect(Number(lines1[0].unitCost)).toBe(10.0);
      expect(Number(lines1[0].totalValue)).toBe(100.0);

      // Verify movement 2 captured the point-in-time cost at $999.00
      const lines2 = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, movement2!.entryId));

      expect(lines2.length).toBe(1);
      expect(Number(lines2[0].unitCost)).toBe(999.0);
      expect(Number(lines2[0].totalValue)).toBe(9990.0);
    });

    it('records full UOM packaging conversion context allowing unambiguous auditability', async () => {
      // 3 PALLETS of 100 EA each = 300 EA, total value $4,500 ($15/EA, $1500/PALLET)
      const result = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'GRN-PALLET-001',
        sourceType: 'PO_RECEIPT',
        userId: 'receiver_1',
        memo: 'Received 3 Full Pallets',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 3,
            uomCode: 'PALLET',
            unitCost: '15.0000',
            originalQuantity: 3,
          },
        ],
      });

      const [line] = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, result!.entryId));

      expect(line.uomId).toBe('PALLET');
      expect(Number(line.originalQuantity)).toBe(3);
      expect(Number(line.quantity)).toBe(300); // 3 * 100
      expect(Number(line.unitCost)).toBe(15.0);
      expect(Number(line.totalValue)).toBe(4500.0); // 300 * 15.00
    });

    it('InventoryQueryService exposes unitCost, totalValue, uomId, and originalQuantity in getLedger and getEntryDetails', async () => {
      const movement = await service.recordInventoryMovement(pg.db, {
        entryNumber: 'GRN-QUERY-001',
        sourceType: 'PO_RECEIPT',
        userId: 'auditor',
        memo: 'Audit Test Movement',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 4,
            uomCode: 'BOX',
            unitCost: '14.5000',
            originalQuantity: 4,
          },
        ],
      });

      // 1. Test getEntryDetails
      const entryDetails = await queryService.getEntryDetails(
        movement!.entryId,
      );

      expect(entryDetails).toBeDefined();
      expect(entryDetails.entryId).toBe(movement!.entryId);
      expect(entryDetails.lines.length).toBe(1);

      const detailLine = entryDetails.lines[0];
      expect(Number(detailLine.change)).toBe(40);
      expect(Number(detailLine.originalQuantity)).toBe(4);
      expect(detailLine.uomId).toBe('BOX');
      expect(Number(detailLine.unitCost)).toBe(14.5);
      expect(Number(detailLine.totalValue)).toBe(580.0); // 40 EA * 14.50

      // 2. Test getLedger
      const ledgerResult = await queryService.getLedger(30);
      const row = ledgerResult.data.find(
        (r) => r.entryId === movement!.entryId,
      );

      expect(row).toBeDefined();
      expect(Number(row!.change)).toBe(40);
      expect(Number(row!.originalQuantity)).toBe(4);
      expect(row!.uomId).toBe('BOX');
      expect(Number(row!.unitCost)).toBe(14.5);
      expect(Number(row!.totalValue)).toBe(580.0);
    });

    it('cleans up exact zero quantity entries from bin_contents while preserving negative balances when permitted', async () => {
      // 1. Initial stock in bin: 10 units
      await service.recordInventoryMovement(pg.db, {
        entryNumber: 'GRN-CLEAN-001',
        sourceType: 'PO_RECEIPT',
        userId: 'receiver',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: 10,
            uomCode: 'EA',
          },
        ],
      });

      let [content] = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_ID));
      expect(content).toBeDefined();
      expect(Number(content.actualQuantity)).toBe(10);

      // 2. Consume exactly 10 units -> bin drops to 0 -> row must be deleted from cache
      await service.recordInventoryMovement(pg.db, {
        entryNumber: 'MV-CLEAN-002',
        sourceType: 'SO_PICK',
        userId: 'picker',
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: -10,
            uomCode: 'EA',
          },
        ],
      });

      [content] = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_ID));
      expect(content).toBeUndefined();

      // 3. Issue -5 units when allowNegativeInventory: true -> bin content row must exist with -5
      await service.recordInventoryMovement(pg.db, {
        entryNumber: 'MV-CLEAN-003',
        sourceType: 'SO_PICK',
        userId: 'picker',
        allowNegativeInventory: true,
        lines: [
          {
            productId: PRODUCT_ID,
            binId: BIN_ID,
            quantity: -5,
            uomCode: 'EA',
          },
        ],
      });

      [content] = await pg.db
        .select()
        .from(binContents)
        .where(eq(binContents.binId, BIN_ID));
      expect(content).toBeDefined();
      expect(Number(content.actualQuantity)).toBe(-5);
    });
  });
});
