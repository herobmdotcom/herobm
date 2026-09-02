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
  productGroups,
  uomDictionary,
  actors,
  salesInvoices,
  salesInvoiceLines,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  SALES_ORDER_STATE,
  SALES_INVOICE_STATE,
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

    it('should filter by month to date (mtd)', async () => {
      const recentOrderId = '00000000-0000-4000-8000-000000000099';
      await pg.db.insert(salesOrders).values({
        salesOrderId: recentOrderId,
        orderNumber: 'ORD-MTD-0001',
        name: 'MTD Test Order',
        customerId: ACCOUNT_ID,
        customerOrderNumber: 'PO-MTD',
        stateCode: SALES_ORDER_STATE.DRAFT,
        source: 'app',
        createdBy: 'admin',
        createdOn: new Date(),
        currencyCode: 'EUR',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '0',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
      });

      const result = await service.findAll({ days: 'mtd' });
      expect(result.data.some((o) => o.id === recentOrderId)).toBe(true);
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

  describe('getSalesInvoicesTrend', () => {
    it('should correctly aggregate invoice counts and totals, exclude drafts/cancelled, and support drill-downs', async () => {
      const GROUP_ID = '00000000-0000-4000-8000-000000000088';
      await pg.db.insert(productGroups).values({
        productGroupId: GROUP_ID,
        name: 'Electronics',
        groupCode: 'ELEC',
      });

      const PROD_2 = '00000000-0000-4000-8000-000000000089';
      await pg.db.insert(products).values({
        productId: PROD_2,
        productNumber: 'PROD-ELEC-02',
        name: 'Gadget Plus',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
        productType: 'inventory',
        structureType: 'standard',
        source: 'app',
        createdBy: 'system',
        salesTaxCategoryId: TAX_CAT_ID,
        productGroupId: GROUP_ID,
      });

      // Update base product to group
      await pg.db
        .update(products)
        .set({ productGroupId: GROUP_ID })
        .where(eq(products.productId, PROD_ID));

      const ORDER_INV = '00000000-0000-4000-8000-000000000051';
      await pg.db.insert(salesOrders).values({
        salesOrderId: ORDER_INV,
        orderNumber: 'SO-INV-001',
        customerId: ACCOUNT_ID,
        stateCode: SALES_ORDER_STATE.INVOICED,
        source: 'app',
        createdBy: 'admin',
        createdOn: new Date('2026-08-20T10:00:00Z'),
        currencyCode: 'EUR',
        fulfillmentLocationId: LOCATION_ID,
        baseTotalAmount: '400',
        exchangeRate: '1',
        discrepanciesAcknowledged: false,
      });

      const SOL_1 = '00000000-0000-4000-8000-000000000061';
      const SOL_2 = '00000000-0000-4000-8000-000000000062';
      await pg.db.insert(salesOrderLineItems).values([
        {
          salesOrderLineId: SOL_1,
          salesOrderId: ORDER_INV,
          lineNumber: 1,
          productId: PROD_ID,
          quantity: '1',
          pricePerUnit: '150.00',
          totalAmount: '150.00',
          tax: '0.00',
          amount: '150.00',
          taxCategoryId: TAX_CAT_ID,
          fulfillmentLocationId: LOCATION_ID,
          discountPercentage: '0',
          quantityPicked: '0',
          isPostConfirmation: false,
        },
        {
          salesOrderLineId: SOL_2,
          salesOrderId: ORDER_INV,
          lineNumber: 2,
          productId: PROD_2,
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
        },
      ]);

      const INV_1 = '00000000-0000-4000-8000-000000000071';
      const INV_2 = '00000000-0000-4000-8000-000000000072';
      const INV_DRAFT = '00000000-0000-4000-8000-000000000073';
      const INV_CANCELLED = '00000000-0000-4000-8000-000000000074';

      await pg.db.insert(salesInvoices).values([
        {
          invoiceId: INV_1,
          invoiceNumber: 'INV-20260820-0001',
          salesOrderId: ORDER_INV,
          customerId: ACCOUNT_ID,
          stateCode: SALES_INVOICE_STATE.INVOICED,
          invoiceDate: new Date('2026-08-20T10:00:00Z'),
          totalAmount: '350.00',
          outstandingAmount: '350.00',
          currencyCode: 'EUR',
          exchangeRate: '1',
        },
        {
          invoiceId: INV_2,
          invoiceNumber: 'INV-20260821-0001',
          salesOrderId: ORDER_INV,
          customerId: ACCOUNT_ID,
          stateCode: SALES_INVOICE_STATE.PAID,
          invoiceDate: new Date('2026-08-21T14:00:00Z'),
          totalAmount: '150.00',
          outstandingAmount: '0.00',
          currencyCode: 'EUR',
          exchangeRate: '1',
        },
        {
          invoiceId: INV_DRAFT,
          invoiceNumber: 'INV-20260820-DRAFT',
          salesOrderId: ORDER_INV,
          customerId: ACCOUNT_ID,
          stateCode: SALES_INVOICE_STATE.DRAFT,
          invoiceDate: new Date('2026-08-20T10:00:00Z'),
          totalAmount: '999.00',
          outstandingAmount: '999.00',
          currencyCode: 'EUR',
          exchangeRate: '1',
        },
        {
          invoiceId: INV_CANCELLED,
          invoiceNumber: 'INV-20260820-CANCEL',
          salesOrderId: ORDER_INV,
          customerId: ACCOUNT_ID,
          stateCode: SALES_INVOICE_STATE.CANCELLED,
          invoiceDate: new Date('2026-08-20T10:00:00Z'),
          totalAmount: '888.00',
          outstandingAmount: '0.00',
          currencyCode: 'EUR',
          exchangeRate: '1',
        },
      ]);

      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceLineId: '00000000-0000-4000-8000-000000000091',
          invoiceId: INV_1,
          salesOrderLineId: SOL_1,
          quantityInvoiced: '1',
          pricePerUnit: '150.00',
          amount: '150.00',
        },
        {
          invoiceLineId: '00000000-0000-4000-8000-000000000092',
          invoiceId: INV_1,
          salesOrderLineId: SOL_2,
          quantityInvoiced: '2',
          pricePerUnit: '100.00',
          amount: '200.00',
        },
        {
          invoiceLineId: '00000000-0000-4000-8000-000000000093',
          invoiceId: INV_2,
          salesOrderLineId: SOL_1,
          quantityInvoiced: '1',
          pricePerUnit: '150.00',
          amount: '150.00',
        },
        {
          invoiceLineId: '00000000-0000-4000-8000-000000000094',
          invoiceId: INV_DRAFT,
          salesOrderLineId: SOL_1,
          quantityInvoiced: '1',
          pricePerUnit: '999.00',
          amount: '999.00',
        },
      ]);

      // 1. Basic period trend query (day granularity)
      const trendResult: any[] = await service.getSalesInvoicesTrend({
        fromDate: '2026-08-19',
        toDate: '2026-08-22',
      });

      expect(trendResult.length).toBe(2);
      const day1 = trendResult.find((r: any) => r.period === '2026-08-20');
      expect(day1).toBeDefined();
      expect(day1.invoiceCount).toBe(1);
      expect(day1.totalInvoiced).toBe(350);

      const day2 = trendResult.find((r: any) => r.period === '2026-08-21');
      expect(day2).toBeDefined();
      expect(day2.invoiceCount).toBe(1);
      expect(day2.totalInvoiced).toBe(150);

      // 2. Product drill-down
      const productResult: any[] = await service.getSalesInvoicesTrend({
        fromDate: '2026-08-19',
        toDate: '2026-08-22',
        drillDown: 'product',
      });

      const prod1Rows = productResult.filter(
        (r: any) => r.productName === 'Product 1',
      );
      const prod2Rows = productResult.filter(
        (r: any) => r.productName === 'Gadget Plus',
      );
      expect(prod1Rows.length).toBeGreaterThan(0);
      expect(prod2Rows.length).toBeGreaterThan(0);

      // 3. Product group drill-down
      const groupResult: any[] = await service.getSalesInvoicesTrend({
        fromDate: '2026-08-19',
        toDate: '2026-08-22',
        drillDown: 'product-group',
      });
      expect(
        groupResult.some((r: any) => r.productGroupName === 'Electronics'),
      ).toBe(true);

      // 4. Customer drill-down
      const customerResult: any[] = await service.getSalesInvoicesTrend({
        fromDate: '2026-08-19',
        toDate: '2026-08-22',
        drillDown: 'customer',
      });
      expect(
        customerResult.some((r: any) => r.customerName === 'Acme Corp'),
      ).toBe(true);
    });
  });
});
