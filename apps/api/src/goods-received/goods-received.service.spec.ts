import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedService } from './goods-received.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { createMemoryDb } from '../../test/utils/memory-db';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
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

jest.mock('../purchase-orders/purchase-order-lifecycle-rules', () => ({
  evaluatePOLifecycleRules: jest.fn().mockResolvedValue([]),
}));

describe('GoodsReceivedService', () => {
  let service: GoodsReceivedService;
  let db: PgliteDatabase<any>;
  let mockInventoryService: any;
  let mockGlService: any;
  let mockAppConfig: any;

  const VENDOR_ID = '00000000-0000-0000-0000-000000000001';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const ZONE_ID = '00000000-0000-0000-0000-00000000000c';
  const BIN_ID = '00000000-0000-0000-0000-00000000000b';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    // Seed static data
    await db.insert(uomDictionary).values({ uomCode: 'EA', description: 'Each' });
    await db.insert(taxCategories).values({
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
        { provide: DRIZZLE, useValue: db },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: GlService, useValue: mockGlService },
        { provide: AppConfigService, useValue: mockAppConfig },
      ],
    }).compile();

    service = module.get<GoodsReceivedService>(GoodsReceivedService);

    // Clean tables in order
    await db.delete(goodsReceivedLines);
    await db.delete(goodsReceived);
    await db.delete(purchaseOrderLineItems);
    await db.delete(purchaseOrders);
    await db.delete(bins);
    await db.delete(zones);
    await db.delete(products);
    await db.delete(locations);
    await db.delete(suppliers);
  });

  async function seedBasics() {
    await db.insert(suppliers).values({
      vendorId: VENDOR_ID,
      vendorNumber: 'V1',
      name: 'Supplier 1',
      currencyCode: 'EUR',
    });
    await db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
    });
    await db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      standardCost: '10',
    });
    await db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'RECV',
      name: 'Receiving Zone',
    });
    await db.insert(bins).values({
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
      await db.insert(purchaseOrders).values({
        purchaseOrderId: PO_ID,
        orderNumber: 'PO-001',
        vendorId: VENDOR_ID,
        deliveryLocationId: LOCATION_ID,
        currencyCode: 'EUR',
        stateCode: 'ordered',
      });
      await db.insert(purchaseOrderLineItems).values({
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

      const lines = await db.select().from(goodsReceivedLines).where(eq(goodsReceivedLines.goodsReceivedId, result.goodsReceivedId));
      expect(lines).toHaveLength(1);
      expect(lines[0].matchStatus).toBe('matched');
      expect(lines[0].quantityReceived).toBe('5');
    });

    it('should set match_status to "ambiguous" when multiple open PO lines exist', async () => {
      await seedBasics();

      const PO1_ID = '00000000-0000-0000-0000-000000000001';
      const PO2_ID = '00000000-0000-0000-0000-000000000002';
      
      await db.insert(purchaseOrders).values([
        { purchaseOrderId: PO1_ID, orderNumber: 'PO-1', vendorId: VENDOR_ID, deliveryLocationId: LOCATION_ID, currencyCode: 'EUR', stateCode: 'ordered' },
        { purchaseOrderId: PO2_ID, orderNumber: 'PO-2', vendorId: VENDOR_ID, deliveryLocationId: LOCATION_ID, currencyCode: 'EUR', stateCode: 'ordered' },
      ]);
      await db.insert(purchaseOrderLineItems).values([
        { purchaseOrderId: PO1_ID, productId: PROD_ID, lineNumber: 1, quantity: '10', quantityReceived: '0', pricePerUnit: '10', taxCategoryId: TAX_CAT_ID },
        { purchaseOrderId: PO2_ID, productId: PROD_ID, lineNumber: 1, quantity: '10', quantityReceived: '0', pricePerUnit: '10', taxCategoryId: TAX_CAT_ID },
      ]);

      const result = await service.create(
        {
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
          lines: [{ productId: PROD_ID, quantityReceived: '5' }],
        },
        'admin',
      );

      const [line] = await db.select().from(goodsReceivedLines).where(eq(goodsReceivedLines.goodsReceivedId, result.goodsReceivedId));
      expect(line.matchStatus).toBe('ambiguous');
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

      const [line] = await db.select().from(goodsReceivedLines).where(eq(goodsReceivedLines.goodsReceivedId, result.goodsReceivedId));
      expect(line.matchStatus).toBe('unmatched');
    });
  });

  describe('findOne', () => {
    it('should return a receipt with lines', async () => {
      await seedBasics();
      const [gr] = await db.insert(goodsReceived).values({
        receiptNumber: 'GR-001',
        vendorId: VENDOR_ID,
        locationId: LOCATION_ID,
      }).returning();
      
      await db.insert(goodsReceivedLines).values({
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
      await expect(service.findOne('00000000-0000-0000-0000-000000000999'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
