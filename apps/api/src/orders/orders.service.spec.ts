import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  salesOrders,
  salesOrderLineItems,
  customers,
  locations,
  taxCategories,
  products,
  uomDictionary,
  actors,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
} from '@herobm/shared';

describe('OrdersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OrdersService;

  const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001';
  const ORDER_ID = '00000000-0000-4000-8000-000000000002';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';

  beforeEach(async () => {
    // Seed data
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

    const [act] = await pg.db
      .insert(actors)
      .values({
        stateCode: ACTOR_STATE.ACTIVE,
        name: 'Acme Corp',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      })
      .returning();

    await pg.db.insert(customers).values({
      actorId: act.actorId,
      customerId: ACCOUNT_ID,
      customerNumber: 'ACC001',
      currencyCode: 'EUR',
      stateCode: CUSTOMER_STATE.DRAFT,
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
      productType: 'inventory',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'app',
      structureType: 'standard',
      createdBy: 'system',
    });

    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-20260312-0001',
      name: 'Test Order',
      customerId: ACCOUNT_ID,
      customerOrderNumber: 'PO-123',
      stateCode: SALES_ORDER_STATE.DRAFT,
      source: 'app',
      createdBy: 'admin',
      createdOn: new Date('2026-03-12'),
      currencyCode: 'EUR',
      fulfillmentLocationId: LOCATION_ID,
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
    });

    await pg.db.insert(salesOrderLineItems).values({
      salesOrderId: ORDER_ID,
      lineNumber: 1,
      productId: PROD_ID,
      quantity: '1',
      pricePerUnit: '250.00',
      totalAmount: '250.00',
      tax: '0.00',
      amount: '250.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_ID,
      discountPercentage: '0',
      quantityPicked: '0',
      isPostConfirmation: false,
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: DataSourcesRegistry, useValue: { register: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('total', 1);
      expect(result.data.length).toBe(1);
      expect(result.data[0]).toHaveProperty('totalPrice', '250.00');
    });

    it('should apply search filter', async () => {
      const result = await service.findAll({ q: 'acme' });
      expect(result.total).toBe(1);

      const noResult = await service.findAll({ q: 'nonexistent' });
      expect(noResult.total).toBe(0);
    });

    it('should cap limit at 100000', async () => {
      const result = await service.findAll({ limit: 200_000 });
      expect(result.limit).toBe(100_000);
    });
  });

  describe('getSalesPerformanceByCustomer', () => {
    it('should properly resolve customer name with actor, fallback to customerNumber, and fallback to Unknown', async () => {
      // 1. Customer without actor
      const NO_ACTOR_CUST_ID = '00000000-0000-4000-8000-000000000003';
      await pg.db.insert(customers).values({
        customerId: NO_ACTOR_CUST_ID,
        customerNumber: 'ACC_NO_ACTOR',
        currencyCode: 'EUR',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
        actorId: null,
      });

      // Order for standard customer with actor
      const ORDER_1 = '00000000-0000-4000-8000-000000000011';
      await pg.db.insert(salesOrders).values({
        salesOrderId: ORDER_1,
        orderNumber: 'SO-001',
        customerId: ACCOUNT_ID,
        stateCode: SALES_ORDER_STATE.INVOICED,
        source: 'app',
        createdBy: 'admin',
        createdOn: new Date('2026-08-20T10:00:00Z'),
        currencyCode: 'EUR',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '100',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
      });
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: ORDER_1,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '1',
        pricePerUnit: '100.00',
        totalAmount: '100.00',
        tax: '0.00',
        amount: '100.00',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
        discountPercentage: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      // Order for customer without actor
      const ORDER_2 = '00000000-0000-4000-8000-000000000012';
      await pg.db.insert(salesOrders).values({
        salesOrderId: ORDER_2,
        orderNumber: 'SO-002',
        customerId: NO_ACTOR_CUST_ID,
        stateCode: SALES_ORDER_STATE.INVOICED,
        source: 'app',
        createdBy: 'admin',
        createdOn: new Date('2026-08-21T14:30:00Z'),
        currencyCode: 'EUR',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '200',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
      });
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: ORDER_2,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '2',
        pricePerUnit: '100.00',
        totalAmount: '200.00',
        tax: '0.00',
        amount: '200.00',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
        discountPercentage: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      // Order without customer (unassigned / null customerId)
      const ORDER_3 = '00000000-0000-4000-8000-000000000013';
      await pg.db.insert(salesOrders).values({
        salesOrderId: ORDER_3,
        orderNumber: 'SO-003',
        customerId: null,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        source: 'app',
        createdBy: 'admin',
        createdOn: new Date('2026-08-21T18:00:00Z'),
        currencyCode: 'EUR',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '50',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
      });
      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: ORDER_3,
        lineNumber: 1,
        productId: PROD_ID,
        quantity: '1',
        pricePerUnit: '50.00',
        totalAmount: '50.00',
        tax: '0.00',
        amount: '50.00',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
        discountPercentage: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      });

      // Run report for 2026-08-19 to 2026-08-21 (testing daytime inclusive filtering on toDate)
      const report: any[] = await service.getSalesPerformanceByCustomer({
        fromDate: '2026-08-19',
        toDate: '2026-08-21',
      });

      expect(report.length).toBe(3);

      const acmeRow = report.find((r: any) => r.customerId === ACCOUNT_ID);
      expect(acmeRow).toBeDefined();
      expect(acmeRow?.customerName).toBe('Acme Corp');
      expect(acmeRow?.orderCount).toBe(1);
      expect(acmeRow?.totalSales).toBe(100);

      const fallbackRow = report.find(
        (r: any) => r.customerId === NO_ACTOR_CUST_ID,
      );
      expect(fallbackRow).toBeDefined();
      expect(fallbackRow?.customerName).toBe('ACC_NO_ACTOR');
      expect(fallbackRow?.orderCount).toBe(1);
      expect(fallbackRow?.totalSales).toBe(200);

      const unassignedRow = report.find((r: any) => r.customerId === null);
      expect(unassignedRow).toBeDefined();
      expect(unassignedRow?.customerName).toBe('Unknown');
      expect(unassignedRow?.orderCount).toBe(1);
      expect(unassignedRow?.totalSales).toBe(50);
    });
  });
});
