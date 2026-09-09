import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedCoreService } from './goods-received-core.service';
import { NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  suppliers,
  locations,
  products,
  goodsReceived,
  goodsReceivedLines,
  uomDictionary,
  taxCategories,
  organizations,
  warehouseEvents,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  MATCH_STATUS,
  PUTAWAY_STATUS,
  GOODS_RECEIVED_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  ORGANIZATION_STATE,
} from '@herobm/shared';

describe('GoodsReceivedCoreService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GoodsReceivedCoreService;

  const VENDOR_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';

  beforeEach(async () => {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceivedCoreService,
        { provide: DRIZZLE, useValue: pg.db },
      ],
    }).compile();

    service = module.get<GoodsReceivedCoreService>(GoodsReceivedCoreService);

    // Clean tables in order
    await pg.db.delete(goodsReceivedLines);
    await pg.db.delete(goodsReceived);
    await pg.db.delete(products);
    await pg.db.delete(locations);
    await pg.db.delete(suppliers);
  });

  async function seedBasics() {
    const organizationId = '00000000-0000-4000-8000-000000000005';
    await pg.db
      .insert(organizations)
      .values({
        stateCode: ORGANIZATION_STATE.ACTIVE,
        organizationId,
        name: 'Supplier 1',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      })
      .onConflictDoNothing();

    await pg.db
      .insert(suppliers)
      .values({
        vendorId: VENDOR_ID,
        organizationId,
        vendorNumber: 'V1',
        currencyCode: 'EUR',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
      })
      .onConflictDoNothing();
    await pg.db
      .insert(locations)
      .values({
        locationId: LOCATION_ID,
        code: 'MAIN',
        name: 'Main',
        source: 'app',
      })
      .onConflictDoNothing();
    await pg.db
      .insert(products)
      .values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'Product 1',
        baseUom: 'EA',
        standardCost: '10',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
      })
      .onConflictDoNothing();
  }

  describe('findOne', () => {
    it('should return a receipt with lines', async () => {
      await seedBasics();
      const [gr] = await pg.db
        .insert(goodsReceived)
        .values({
          receiptNumber: 'GR-001',
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
          stateCode: GOODS_RECEIVED_STATE.RECEIVED,
        })
        .returning();

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedId: gr.goodsReceivedId,
        productId: PROD_ID,
        quantityReceived: '10',
        matchStatus: MATCH_STATUS.UNMATCHED,
        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
      });

      const result = await service.findOne(gr.goodsReceivedId);
      expect(result.receiptNumber).toBe('GR-001');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productNumber).toBe('P1');
    });

    it('should aggregate timeline events from header, line putaway, and matching', async () => {
      await seedBasics();
      const [gr] = await pg.db
        .insert(goodsReceived)
        .values({
          receiptNumber: 'GR-100',
          vendorId: VENDOR_ID,
          locationId: LOCATION_ID,
          stateCode: GOODS_RECEIVED_STATE.RECEIVED,
        })
        .returning();

      const [line] = await pg.db
        .insert(goodsReceivedLines)
        .values({
          goodsReceivedId: gr.goodsReceivedId,
          productId: PROD_ID,
          quantityReceived: '10',
          matchStatus: MATCH_STATUS.MATCHED,
          putawayStatus: PUTAWAY_STATUS.COMPLETED,
        })
        .returning();

      // 1. Header creation event in warehouseEvents
      await pg.db.insert(warehouseEvents).values({
        entityType: 'warehouse',
        entityId: gr.goodsReceivedId,
        eventType: 'receipt_created',
        entityDisplayName: 'GR-100',
        payload: {
          goodsReceivedId: gr.goodsReceivedId,
          receiptNumber: 'GR-100',
        },
        actor: 'operator1',
        createdOn: new Date('2026-09-01T10:00:00Z'),
      });

      // 2. Line-level putaway event in warehouseEvents (entityId = lineId)
      await pg.db.insert(warehouseEvents).values({
        entityType: 'warehouse',
        entityId: line.goodsReceivedLineId,
        eventType: 'putaway_completed',
        entityDisplayName: 'GR-100',
        payload: {
          lineId: line.goodsReceivedLineId,
          goodsReceivedId: gr.goodsReceivedId,
          receiptNumber: 'GR-100',
          quantityPutaway: '10',
        },
        actor: 'forklift_driver',
        createdOn: new Date('2026-09-01T11:00:00Z'),
      });

      // 3. Matching event in warehouseEvents
      await pg.db.insert(warehouseEvents).values({
        entityType: 'goods_received',
        entityId: gr.goodsReceivedId,
        eventType: 'receipt_matched',
        entityDisplayName: 'GR-100',
        payload: {
          goodsReceivedId: gr.goodsReceivedId,
          goodsReceivedLineId: line.goodsReceivedLineId,
          allocatedQuantity: '10',
        },
        actor: 'buyer',
        createdOn: new Date('2026-09-01T10:30:00Z'),
      });

      const result = await service.findOne(gr.goodsReceivedId);
      expect(result.events).toHaveLength(3);

      // Verify events are sorted chronologically descending
      expect(result.events[0].eventType).toBe('putaway_completed');
      expect(result.events[0].actor).toBe('forklift_driver');
      expect(result.events[1].eventType).toBe('receipt_matched');
      expect(result.events[2].eventType).toBe('receipt_created');
    });

    it('should throw NotFoundException when receipt does not exist', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
