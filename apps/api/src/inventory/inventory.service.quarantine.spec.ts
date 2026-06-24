import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { AppConfigService } from '../settings/app-config.service';
import { UomService } from './uom.service';
import { GlService } from '../gl/gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  locations,
  zones,
  bins,
  products,
  suppliers,
  goodsReceived,
  goodsReceivedLines,
  inventoryLedger,
  inventoryEntries,
  uomDictionary,
} from '../drizzle/herobm-core-schema';
import { PUTAWAY_STATUS } from '@herobm/shared';
import { eq } from 'drizzle-orm';
import { BadRequestException } from '@nestjs/common';

describe('InventoryService - Quarantine', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: InventoryService;

  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const ZONE_ID = '00000000-0000-4000-8000-00000000000c';
  let RECV_BIN_ID = '00000000-0000-4000-8000-00000000000b';
  let QUAR_BIN_ID = '00000000-0000-4000-8000-000000000010';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const GR_ID = '00000000-0000-4000-8000-000000000021';
  const GR_LINE_ID = '00000000-0000-4000-8000-000000000022';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            inventoryAccountingMode: () => 'periodic',
            valuationMethod: () => 'WAC',
          },
        },
        {
          provide: UomService,
          useValue: {
            calculateAbsoluteBaseQuantity: jest
              .fn()
              .mockImplementation(async (id, qtys) => Number(qtys[0].quantity)),
          },
        },
        { provide: GlService, useValue: {} },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);

    await pg.db.delete(inventoryLedger);
    await pg.db.delete(goodsReceivedLines);
    await pg.db.delete(goodsReceived);
    await pg.db.delete(products);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(locations);

    await pg.db
      .insert(locations)
      .values({ locationId: LOCATION_ID, code: 'MAIN', name: 'Main' });

    // The locations trigger automatically scaffolds system bins. Let's fetch them.
    const autoBins = await pg.db.select().from(bins);
    RECV_BIN_ID = autoBins.find((b) => b.binNumber === 'RECEIVING')!.binId;

    // Manually insert QUARANTINE bin since it was removed from auto-scaffolding
    QUAR_BIN_ID = '00000000-0000-4000-8000-000000000010';
    await pg.db.insert(bins).values({
      binId: QUAR_BIN_ID,
      zoneId: autoBins[0].zoneId,
      binNumber: 'QUARANTINE',
      binType: 'quarantine',
      isUnavailable: true,
      source: 'system',
    });
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      productType: 'inventory',
    });

    // Seed initial stock in receiving bin via a manual entry
    // testing internal protected method
    await service['recordInventoryMovement'](pg.db, {
      entryNumber: 'INIT',
      sourceType: 'MANUAL',
      sourceId: '00000000-0000-4000-8000-000000000099',
      memo: 'Init',
      userId: 'admin',
      lines: [
        {
          productId: PROD_ID,
          binId: RECV_BIN_ID,
          quantity: 100,
          uomCode: 'EA',
        },
      ],
    });
  });

  describe('Storage-based Move', () => {
    it('should move stock into quarantine', async () => {
      await service.quarantineStock(
        {
          productId: PROD_ID,
          sourceBinId: RECV_BIN_ID,
          targetBinId: QUAR_BIN_ID,
          quantity: '10',
        },
        'admin',
      );

      // Verify ledger
      const entry = await pg.db
        .select()
        .from(inventoryEntries)
        .where(
          eq(
            inventoryEntries.entryNumber,
            `QUAR-BIN-${RECV_BIN_ID.substring(0, 4)}`,
          ),
        );
      const ledger = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, entry[0].entryId));
      expect(ledger.length).toBe(2);
      expect(
        Number(ledger.find((l) => l.binId === RECV_BIN_ID)?.quantity),
      ).toBe(-10);
      expect(
        Number(ledger.find((l) => l.binId === QUAR_BIN_ID)?.quantity),
      ).toBe(10);
    });

    it('should move stock out of quarantine', async () => {
      // First move in
      await service.quarantineStock(
        {
          productId: PROD_ID,
          sourceBinId: RECV_BIN_ID,
          targetBinId: QUAR_BIN_ID,
          quantity: '20',
        },
        'admin',
      );

      // Move out
      await service.quarantineStock(
        {
          productId: PROD_ID,
          sourceBinId: QUAR_BIN_ID,
          targetBinId: RECV_BIN_ID,
          quantity: '15',
        },
        'admin',
      );

      const entry = await pg.db
        .select()
        .from(inventoryEntries)
        .where(
          eq(
            inventoryEntries.entryNumber,
            `UNQUAR-BIN-${QUAR_BIN_ID.substring(0, 4)}`,
          ),
        );
      const ledger = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, entry[0].entryId));
      expect(ledger.length).toBe(2);
      expect(
        Number(ledger.find((l) => l.binId === QUAR_BIN_ID)?.quantity),
      ).toBe(-15);
      expect(
        Number(ledger.find((l) => l.binId === RECV_BIN_ID)?.quantity),
      ).toBe(15);
    });

    it('should fail if moving more than available', async () => {
      await expect(
        service.quarantineStock(
          {
            productId: PROD_ID,
            sourceBinId: RECV_BIN_ID,
            quantity: '150', // Only 100 available
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Line-based Move (Auto-resolve)', () => {
    beforeEach(async () => {
      await pg.db.insert(suppliers).values({
        vendorId: '00000000-0000-4000-8000-000000000098',
        name: 'Test Vendor',
        vendorNumber: 'V1',
        currencyCode: 'EUR',
        address1Country: 'DE',
      });
      await pg.db.insert(goodsReceived).values({
        goodsReceivedId: GR_ID,
        locationId: LOCATION_ID,
        receiptNumber: 'GR-1',
        vendorId: '00000000-0000-4000-8000-000000000098',
      });
      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedLineId: GR_LINE_ID,
        goodsReceivedId: GR_ID,
        productId: PROD_ID,
        quantityReceived: '50',
        putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
      });
    });

    it('should quarantine a line and update its putawayStatus', async () => {
      const res = await service.quarantineStock(
        { lineId: GR_LINE_ID, sourceType: 'goods_receipt' },
        'admin',
      );

      expect(res.putawayStatus).toBe(PUTAWAY_STATUS.QUARANTINED);

      const line = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedLineId, GR_LINE_ID));
      expect(line[0].putawayStatus).toBe(PUTAWAY_STATUS.QUARANTINED);

      const entry = await pg.db
        .select()
        .from(inventoryEntries)
        .where(eq(inventoryEntries.entryNumber, 'QUAR-LINE-0000'));
      const ledger = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, entry[0].entryId));
      expect(
        Number(ledger.find((l) => l.binId === RECV_BIN_ID)?.quantity),
      ).toBe(-50);
      expect(
        Number(ledger.find((l) => l.binId === QUAR_BIN_ID)?.quantity),
      ).toBe(50);
    });

    it('should un-quarantine a line and update its putawayStatus', async () => {
      await service.quarantineStock(
        { lineId: GR_LINE_ID, sourceType: 'goods_receipt' },
        'admin',
      );

      const res = await service.quarantineStock(
        { lineId: GR_LINE_ID, sourceType: 'goods_receipt' },
        'admin',
      );

      expect(res.putawayStatus).toBe(PUTAWAY_STATUS.PENDING_PUTAWAY);

      const entry = await pg.db
        .select()
        .from(inventoryEntries)
        .where(eq(inventoryEntries.entryNumber, 'UNQUAR-LINE-0000'));
      const ledger = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.entryId, entry[0].entryId));
      expect(
        Number(ledger.find((l) => l.binId === QUAR_BIN_ID)?.quantity),
      ).toBe(-50);
      expect(
        Number(ledger.find((l) => l.binId === RECV_BIN_ID)?.quantity),
      ).toBe(50);
    });
  });
});
