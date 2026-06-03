import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedService } from './goods-received.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import { BackordersService } from '../orders/backorders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import {
  suppliers,
  locations,
  products,
  purchaseOrders,
  purchaseOrderLineItems,
  goodsReceived,
  goodsReceivedLines,
  zones,
  bins,
  uomDictionary,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import {
  PURCHASE_ORDER_STATE,
  MATCH_STATUS,
  PUTAWAY_STATUS,
} from '@modbm/shared';

jest.mock('../purchase-orders/purchase-order-lifecycle-rules', () => ({
  evaluatePOLifecycleRules: jest.fn().mockResolvedValue([]),
}));

describe('GoodsReceivedService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GoodsReceivedService;
  let mockInventoryService: any;
  let mockGlService: any;
  let mockAppConfig: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000001';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const ZONE_ID = '00000000-0000-0000-0000-00000000000c';
  const BIN_ID = '00000000-0000-0000-0000-00000000000b';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';

  beforeEach(async () => {
    // Seed static data
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });
    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });
  });

  beforeEach(async () => {
    mockInventoryService = {
      recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
    };
    mockGlService = {
      postJournalEntry: jest.fn().mockResolvedValue({ success: true }),
    };
    mockAppConfig = {
      valuationMethod: () => 'WAC',
      inventoryAccountingMode: () => 'perpetual',
      defaultInventoryAccountId: () => 'inv-acc',
      defaultGrniAccountId: () => 'grni-acc',
      defaultCogsAccountId: () => 'cogs-acc',
      defaultShrinkageAccountId: () => 'shrink-acc',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceivedService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfig },
        {
          provide: BackordersService,
          useValue: { changeBackorderState: jest.fn() },
        },
        {
          provide: PurchaseOrdersService,
          useValue: {
            updateReceivedQuantities: jest.fn(),
            changePurchaseOrderState: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GoodsReceivedService>(GoodsReceivedService);

    // Clean tables in order
    await pg.db.delete(goodsReceivedLines);
    await pg.db.delete(goodsReceived);
    await pg.db.delete(purchaseOrderLineItems);
    await pg.db.delete(purchaseOrders);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(products);
    await pg.db.delete(locations);
    await pg.db.delete(suppliers);
  });

  async function seedBasics() {
    await pg.db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      vendorNumber: 'V1',
      name: 'Supplier 1',
      currencyCode: 'EUR',
      address1Country: 'AU',
    });
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
    });
    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      standardCost: '10',
    });
    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'RECV',
      name: 'Receiving Zone',
    });
    await pg.db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'RECEIVING',
      binType: 'receiving',
    });
  }

  describe('create', () => {
    it('should throw NotFoundException when supplier does not exist', async () => {
      await expect(
        service.create(
          {
            vendorId: VENDOR_ID,
            locationId: LOCATION_ID,
            lines: [{ productId: PROD_ID, quantityReceived: '5' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set match_status to "matched" when exactly one open PO line exists', async () => {
      await seedBasics();

      const PO_ID = '00000000-0000-0000-0000-000000000001';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.ORDERED,
      });
      await pg.db.insert(purchaseOrderLineItems).values({
        purchaseOrderId: PO_ID,
        productId: PROD_ID,
        lineNumber: 1,
        quantity: '20',
        quantityReceived: '0',
        pricePerUnit: '10',
        taxCategoryId: TAX_CAT_ID,
      });

      const result = await service.create(
        {
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
          lines: [{ productId: PROD_ID, quantityReceived: '5' }],
        },
        'admin',
      );

      const lines = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedId, result.goodsReceivedId));
      expect(lines).toHaveLength(1);
      expect(lines[0].matchStatus).toBe(MATCH_STATUS.MATCHED);
      expect(lines[0].quantityReceived).toBe('5');
    });

    it('should set match_status to "ambiguous" when multiple open PO lines exist', async () => {
      await seedBasics();

      const PO1_ID = '00000000-0000-0000-0000-000000000001';
      const PO2_ID = '00000000-0000-0000-0000-000000000002';

      await pg.db.insert(purchaseOrders).values([
        {
          purchaseOrderId: PO1_ID,
          orderNumber: 'PO-1',
          vendorId: VENDOR_ID,
          deliveryLocationId: LOCATION_ID,
          currencyCode: 'EUR',
          stateCode: PURCHASE_ORDER_STATE.ORDERED,
        },
        {
          purchaseOrderId: PO2_ID,
          orderNumber: 'PO-2',
          vendorId: VENDOR_ID,
          deliveryLocationId: LOCATION_ID,
          currencyCode: 'EUR',
          stateCode: PURCHASE_ORDER_STATE.ORDERED,
        },
      ]);
      await pg.db.insert(purchaseOrderLineItems).values([
        {
          purchaseOrderId: PO1_ID,
          productId: PROD_ID,
          lineNumber: 1,
          quantity: '10',
          quantityReceived: '0',
          pricePerUnit: '10',
          taxCategoryId: TAX_CAT_ID,
        },
        {
          purchaseOrderId: PO2_ID,
          productId: PROD_ID,
          lineNumber: 1,
          quantity: '10',
          quantityReceived: '0',
          pricePerUnit: '10',
          taxCategoryId: TAX_CAT_ID,
        },
      ]);

      const result = await service.create(
        {
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
          lines: [{ productId: PROD_ID, quantityReceived: '5' }],
        },
        'admin',
      );

      const [line] = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedId, result.goodsReceivedId));
      expect(line.matchStatus).toBe(MATCH_STATUS.AMBIGUOUS);
    });

    it('should set match_status to "unmatched" when no open PO lines exist', async () => {
      await seedBasics();

      const result = await service.create(
        {
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
          lines: [{ productId: PROD_ID, quantityReceived: '5' }],
        },
        'admin',
      );

      const [line] = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedId, result.goodsReceivedId));
      expect(line.matchStatus).toBe(MATCH_STATUS.UNMATCHED);
    });
  });

  describe('findOne', () => {
    it('should return a receipt with lines', async () => {
      await seedBasics();
      const [gr] = await pg.db
        .insert(goodsReceived)
        .values({
          receiptNumber: 'GR-001',
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
        })
        .returning();

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedId: gr.goodsReceivedId,
        productId: PROD_ID,
        quantityReceived: '10',
      });

      const result = await service.findOne(gr.goodsReceivedId);
      expect(result.receiptNumber).toBe('GR-001');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productNumber).toBe('P1');
    });

    it('should throw NotFoundException when receipt does not exist', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolve preserves quarantined status (ADV-086)', () => {
    it('should keep quarantined status when matching a quarantined line', async () => {
      await seedBasics();

      // Seed quarantine infrastructure
      const QUAR_ZONE_ID = '00000000-0000-0000-0000-0000000000d0';
      const QUAR_BIN_ID = '00000000-0000-0000-0000-0000000000d1';
      await pg.db.insert(zones).values({
        zoneId: QUAR_ZONE_ID,
        locationId: LOCATION_ID,
        code: 'QUAR',
        name: 'Quarantine Zone',
      });
      await pg.db.insert(bins).values({
        binId: QUAR_BIN_ID,
        zoneId: QUAR_ZONE_ID,
        binNumber: 'QUARANTINE',
        binType: 'quarantine',
      });

      const PO_ID = '00000000-0000-0000-0000-000000000061';
      const PO_LINE_ID = '00000000-0000-0000-0000-000000000062';
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-R1',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: PURCHASE_ORDER_STATE.ORDERED,
      });
      await pg.db.insert(purchaseOrderLineItems).values({
        purchaseOrderLineId: PO_LINE_ID,
        purchaseOrderId: PO_ID,
        productId: PROD_ID,
        lineNumber: 1,
        quantity: '100',
        quantityReceived: '0',
        pricePerUnit: '10',
        taxCategoryId: TAX_CAT_ID,
      });

      // Create a quarantined, unmatched line
      const [gr] = await pg.db
        .insert(goodsReceived)
        .values({
          receiptNumber: 'GR-R1',
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
        })
        .returning();
      const [line] = await pg.db
        .insert(goodsReceivedLines)
        .values({
          goodsReceivedId: gr.goodsReceivedId,
          productId: PROD_ID,
          quantityReceived: '50',
          matchStatus: MATCH_STATUS.AMBIGUOUS,
          putawayStatus: PUTAWAY_STATUS.QUARANTINED,
        })
        .returning();

      // Match it to a PO — status should remain quarantined
      await service.resolveAllocation(
        line.goodsReceivedLineId,
        PO_LINE_ID,
        'admin',
      );

      const [dbLine] = await pg.db
        .select()
        .from(goodsReceivedLines)
        .where(
          eq(goodsReceivedLines.goodsReceivedLineId, line.goodsReceivedLineId),
        );

      expect(dbLine.matchStatus).toBe(MATCH_STATUS.MATCHED);
      expect(dbLine.putawayStatus).toBe(PUTAWAY_STATUS.QUARANTINED);
    });
  });
});
