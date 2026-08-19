import { Test, TestingModule } from '@nestjs/testing';
import { BackordersService } from './backorders.service';
import type { InventoryGap } from '@herobm/shared';
import {
  SALES_ORDER_STATE,
  PRODUCT_STATE,
  BACKORDER_STATE,
} from '@herobm/shared';
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
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { InventoryQueryService } from '../inventory/inventory-query.service';

describe('BackordersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: BackordersService;
  let inventoryQueryService: any;
  let inventoryMovementService: InventoryMovementService;
  const ORDER_ID = '00000000-0000-4000-8000-000000000001';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LINE_ID = '00000000-0000-4000-8000-000000000011';

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
      source: 'app',
      createdBy: 'system',
    });

    inventoryQueryService = {
      findByProductIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackordersService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: InventoryQueryService, useValue: inventoryQueryService },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: () => 'EUR' },
        },
        { provide: InventoryMovementService, useValue: inventoryQueryService },
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
      stateCode: SALES_ORDER_STATE.DRAFT,
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'app',
      createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      const gaps = await service.evaluateGaps(ORDER_ID);
      expect(gaps).toEqual([]);
      expect(inventoryQueryService.findByProductIds).not.toHaveBeenCalled();
    });

    it('should calculate gaps correctly based on ordered vs available quantity', async () => {
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'P1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      inventoryQueryService.findByProductIds.mockResolvedValue({
        data: [
          { productId: PROD_ID, locationId: LOCATION_ID, quantityAvailable: 3 }, // Short 7
        ],
      });

      const gaps = await service.evaluateGaps(ORDER_ID);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].productId).toBe(PROD_ID);
      expect(gaps[0].shortage).toBe(7);
    });

    it('should return empty gaps when stock is fully available', async () => {
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'P1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });
      await seedBasicOrder();
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderLineId: LINE_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '5',
        pricePerUnit: '50',
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      inventoryQueryService.findByProductIds.mockResolvedValue({
        data: [
          {
            productId: PROD_ID,
            locationId: LOCATION_ID,
            quantityAvailable: 10,
          },
        ],
      });

      const gaps = await service.evaluateGaps(ORDER_ID);
      expect(gaps).toHaveLength(0);
    });

    it('should sequentially deduct available stock when multiple lines order the same product', async () => {
      const LINE_ID_2 = '00000000-0000-4000-8000-000000000012';
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'P1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });
      await seedBasicOrder();
      await pg.db.insert(salesOrderLineItems).values([
        {
          salesOrderLineId: LINE_ID,
          salesOrderId: ORDER_ID,
          lineNumber: 1,
          productId: PROD_ID,
          quantity: '6',
          pricePerUnit: '50',
          fulfillmentLocationId: LOCATION_ID,
          taxCategoryId: TAX_CAT_ID,
          discountPercentage: '0',
          amount: '0',
          tax: '0',
          quantityPicked: '0',
          isPostConfirmation: false,
        },
        {
          salesOrderLineId: LINE_ID_2,
          salesOrderId: ORDER_ID,
          lineNumber: 2,
          productId: PROD_ID,
          quantity: '6',
          pricePerUnit: '50',
          fulfillmentLocationId: LOCATION_ID,
          taxCategoryId: TAX_CAT_ID,
          discountPercentage: '0',
          amount: '0',
          tax: '0',
          quantityPicked: '0',
          isPostConfirmation: false,
        },
      ]);

      inventoryQueryService.findByProductIds.mockResolvedValue({
        data: [
          {
            productId: PROD_ID,
            locationId: LOCATION_ID,
            quantityAvailable: 10,
          },
        ],
      });

      const gaps = await service.evaluateGaps(ORDER_ID);
      // Line 1 uses 6 of 10 -> 4 remaining. Line 2 requests 6 -> shortage of 2.
      expect(gaps).toHaveLength(1);
      expect(gaps[0].salesOrderLineId).toBe(LINE_ID_2);
      expect(gaps[0].orderedQuantity).toBe(6);
      expect(gaps[0].availableQuantity).toBe(4);
      expect(gaps[0].shortage).toBe(2);
    });
  });

  describe('generateDemand', () => {
    it('should create demand for gaps in backorders table', async () => {
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'P1',
        name: 'P1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
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

  describe('resolveOpenDemands', () => {
    it('should generate Draft Work Orders for stock kit demands', async () => {
      await pg.db.insert(products).values({
        productId: PROD_ID,
        productNumber: 'KIT1',
        name: 'KIT1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'kit',
        createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      // Insert open demand
      await pg.db.insert(backorders).values({
        backorderId: '00000000-0000-4000-8000-000000000022',
        salesOrderId: ORDER_ID,
        salesOrderLineId: LINE_ID,
        productId: PROD_ID,
        quantity: '10',
        stateCode: BACKORDER_STATE.PENDING_SUPPLY,
      });

      await service.resolveOpenDemands('test-user');

      // Verify work order created
      const { workOrders, backorders: backordersTable } =
        await import('@herobm/db-schema');
      const wos = await pg.db
        .select()
        .from(workOrders)
        .where(eq(workOrders.productId, PROD_ID));
      expect(wos).toHaveLength(1);
      expect(wos[0].targetQuantity).toBe('10');
      expect(wos[0].createdBy).toBe('test-user');

      const res = await pg.db
        .select()
        .from(backordersTable)
        .where(eq(backordersTable.salesOrderLineId, LINE_ID));
      expect(res[0].workOrderId).toBe(wos[0].workOrderId);
      expect(res[0].stateCode).toBe(BACKORDER_STATE.AWAITING_RECEIPT);
    });
  });
});
