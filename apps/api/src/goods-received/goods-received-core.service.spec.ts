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
  actors,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  MATCH_STATUS,
  PUTAWAY_STATUS,
  GOODS_RECEIVED_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
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
    const actorId = '00000000-0000-4000-8000-000000000005';
    await pg.db
      .insert(actors)
      .values({
        stateCode: ACTOR_STATE.ACTIVE,
        actorId,
        name: 'Supplier 1',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      })
      .onConflictDoNothing();

    await pg.db
      .insert(suppliers)
      .values({
        vendorId: VENDOR_ID,
        actorId,
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

    it('should throw NotFoundException when receipt does not exist', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
