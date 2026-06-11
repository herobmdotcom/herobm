import { Test, TestingModule } from '@nestjs/testing';
import { BackordersService } from './backorders.service';
import type { InventoryGap } from '@modbm/shared';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  backorders,
  products,
  locations,
  uomDictionary,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';

describe('BackordersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: BackordersService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inventoryService: any;

  const ORDER_ID = '00000000-0000-0000-0000-000000000001';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LINE_ID = '00000000-0000-0000-0000-000000000011';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(backorders);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(products);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);
    await pg.db.delete(uomDictionary);

    // Seed infrastructure
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
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    inventoryService = {
      findByProductIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackordersService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryService, useValue: inventoryService },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: () => 'EUR' },
        },
      ],
    }).compile();

    service = module.get<BackordersService>(BackordersService);
  });

  async function seedBasicOrder() {
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      fulfillmentLocationId: LOCATION_ID,
      currencyCode: 'EUR',
    });
  }

  describe('evaluateGaps', () => {
    it('should return empty if no valid product lines exist', async () => {
      await seedBasicOrder();
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: LINE_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: null,
        quantity: '10',
        pricePerUnit: '0',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      });

      const gaps = await service.evaluateGaps(ORDER_ID);
      expect(gaps).toEqual([]);
      expect(inventoryService.findByProductIds).not.toHaveBeenCalled();
    });

    it('should calculate gaps correctly based on ordered vs available quantity', async () => {
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'P1',
        baseUom: 'EA',
      });
      await seedBasicOrder();
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: LINE_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '10',
        pricePerUnit: '50',
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
      });

      inventoryService.findByProductIds.mockResolvedValue({
        data: [
          { productId: PROD_ID, locationId: LOCATION_ID, quantityAvailable: 3 }, // Short 7
        ],
      });

      const gaps = await service.evaluateGaps(ORDER_ID);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].productId).toBe(PROD_ID);
      expect(gaps[0].shortage).toBe(7);
    });
  });

  describe('generateDemand', () => {
    it('should create demand for gaps in backorders table', async () => {
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'P1',
        baseUom: 'EA',
      });
      await seedBasicOrder();
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: LINE_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '10',
        pricePerUnit: '50',
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
      });

      const gaps: InventoryGap[] = [
        {
          salesOrderLineId: LINE_ID,
          productId: PROD_ID,
          productDescription: 'Prod 1',
          orderedQuantity: 10,
          availableQuantity: 0,
          shortage: 10,
          locationId: LOCATION_ID,
        },
      ];

      await service.generateDemand(ORDER_ID, gaps, 'test-user', pg.db);

      const res = await pg.db
        .select()
        .from(backorders)
        .where(eq(backorders.salesOrderLineId, LINE_ID));
      expect(res).toHaveLength(1);
      expect(res[0].quantity).toBe('10');
    });
  });
});
