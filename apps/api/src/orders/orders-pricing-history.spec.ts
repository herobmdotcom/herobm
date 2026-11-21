import {
  customers,
  locations,
  organizations,
  products,
  salesOrderLineItems,
  salesOrders,
  taxCategories,
  uomDictionary,
} from '@herobm/db-schema';
import {
  CUSTOMER_STATE,
  ORGANIZATION_STATE,
  PRODUCT_STATE,
  SALES_ORDER_STATE,
} from '@herobm/shared';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { OrdersQueryService } from './orders-query.service';

describe('OrdersQueryService - getProductPricingHistory', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OrdersQueryService;

  const CUST_A_ID = '00000000-0000-4000-8000-000000000001';
  const ORG_A_ID = '00000000-0000-4000-8000-000000000011';
  const CUST_B_ID = '00000000-0000-4000-8000-000000000002';
  const ORG_B_ID = '00000000-0000-4000-8000-000000000012';

  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';

  const ORDER_1_ID = '00000000-0000-4000-8000-000000000101'; // Cust A, oldest
  const ORDER_2_ID = '00000000-0000-4000-8000-000000000102'; // Cust B, newest
  const ORDER_3_ID = '00000000-0000-4000-8000-000000000103'; // Cust A, mid
  const ORDER_4_ID = '00000000-0000-4000-8000-000000000104'; // Cust A, cancelled

  beforeEach(async () => {
    service = new (OrdersQueryService as any)(pg.db);

    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each', category: 'goods' });

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

    await pg.db.insert(organizations).values([
      {
        organizationId: ORG_A_ID,
        name: 'Acme Corp',
        stateCode: ORGANIZATION_STATE.ACTIVE,
        isTaxRegistered: true,
      },
      {
        organizationId: ORG_B_ID,
        name: 'Beta LLC',
        stateCode: ORGANIZATION_STATE.ACTIVE,
        isTaxRegistered: true,
      },
    ]);

    await pg.db.insert(customers).values([
      {
        customerId: CUST_A_ID,
        customerNumber: 'CUST-001',
        organizationId: ORG_A_ID,
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        isOnCreditHold: false,
        source: 'app',
      },
      {
        customerId: CUST_B_ID,
        customerNumber: 'CUST-002',
        organizationId: ORG_B_ID,
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        isOnCreditHold: false,
        source: 'app',
      },
    ]);

    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'WDG-001',
      name: 'Widget Standard',
      productType: 'inventory',
      structureType: 'standard',
      source: 'app',
      stateCode: PRODUCT_STATE.ACTIVE,
      baseUom: 'EA',
      createdBy: 'system',
    });

    // Seed sales orders
    await pg.db.insert(salesOrders).values([
      {
        salesOrderId: ORDER_1_ID,
        orderNumber: 'SO-101',
        name: 'Order 101',
        customerId: CUST_A_ID,
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        currencyCode: 'AUD',
        exchangeRate: '1.0',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdOn: new Date('2026-01-01T10:00:00Z'),
      },
      {
        salesOrderId: ORDER_2_ID,
        orderNumber: 'SO-102',
        name: 'Order 102',
        customerId: CUST_B_ID,
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        currencyCode: 'AUD',
        exchangeRate: '1.0',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdOn: new Date('2026-01-05T10:00:00Z'),
      },
      {
        salesOrderId: ORDER_3_ID,
        orderNumber: 'SO-103',
        name: 'Order 103',
        customerId: CUST_A_ID,
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.DRAFT,
        currencyCode: 'AUD',
        exchangeRate: '1.0',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdOn: new Date('2026-01-03T10:00:00Z'),
      },
      {
        salesOrderId: ORDER_4_ID,
        orderNumber: 'SO-104',
        name: 'Order 104',
        customerId: CUST_A_ID,
        fulfillmentLocationId: LOCATION_ID,
        stateCode: SALES_ORDER_STATE.CANCELLED,
        currencyCode: 'AUD',
        exchangeRate: '1.0',
        discrepanciesAcknowledged: false,
        source: 'app',
        createdOn: new Date('2026-01-04T10:00:00Z'),
      },
    ]);

    // Seed lines
    await pg.db.insert(salesOrderLineItems).values([
      {
        salesOrderId: ORDER_1_ID,
        lineNumber: 1,
        lineType: 'Product',
        productId: PROD_ID,
        quantity: '10',
        pricePerUnit: '50.00',
        totalAmount: '500.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
      {
        salesOrderId: ORDER_2_ID,
        lineNumber: 1,
        lineType: 'Product',
        productId: PROD_ID,
        quantity: '5',
        pricePerUnit: '60.00',
        totalAmount: '300.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
      {
        salesOrderId: ORDER_3_ID,
        lineNumber: 1,
        lineType: 'Product',
        productId: PROD_ID,
        quantity: '20',
        pricePerUnit: '45.00',
        totalAmount: '900.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
      {
        salesOrderId: ORDER_4_ID,
        lineNumber: 1,
        lineType: 'Product',
        productId: PROD_ID,
        quantity: '100',
        pricePerUnit: '10.00',
        totalAmount: '1000.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
    ]);
  });

  it('ranks current customer orders first, then by date descending', async () => {
    const result = await service.getProductPricingHistory({
      productId: PROD_ID,
      customerId: CUST_A_ID,
    });

    expect(result.total).toBe(3); // ORDER_4 is cancelled, so excluded
    expect(result.data).toHaveLength(3);

    // Order 3 (Cust A, 2026-01-03)
    expect(result.data[0].orderNumber).toBe('SO-103');
    expect(result.data[0].isCurrentCustomer).toBe(true);
    expect(result.data[0].pricePerUnit).toBe('45.00');
    expect(result.data[0].quantity).toBe('20');
    expect(result.data[0].customerName).toBe('Acme Corp');

    // Order 1 (Cust A, 2026-01-01)
    expect(result.data[1].orderNumber).toBe('SO-101');
    expect(result.data[1].isCurrentCustomer).toBe(true);
    expect(result.data[1].pricePerUnit).toBe('50.00');

    // Order 2 (Cust B, 2026-01-05 - newer date, but different customer)
    expect(result.data[2].orderNumber).toBe('SO-102');
    expect(result.data[2].isCurrentCustomer).toBe(false);
    expect(result.data[2].pricePerUnit).toBe('60.00');
    expect(result.data[2].customerName).toBe('Beta LLC');
  });

  it('orders purely by date descending when customerId is omitted', async () => {
    const result = await service.getProductPricingHistory({
      productId: PROD_ID,
    });

    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
    // SO-102 is newest (2026-01-05), then SO-103 (2026-01-03), then SO-101 (2026-01-01)
    expect(result.data[0].orderNumber).toBe('SO-102');
    expect(result.data[0].isCurrentCustomer).toBe(false);
    expect(result.data[1].orderNumber).toBe('SO-103');
    expect(result.data[1].isCurrentCustomer).toBe(false);
    expect(result.data[2].orderNumber).toBe('SO-101');
    expect(result.data[2].isCurrentCustomer).toBe(false);
  });

  it('excludes the specified order ID', async () => {
    const result = await service.getProductPricingHistory({
      productId: PROD_ID,
      customerId: CUST_A_ID,
      excludeOrderId: ORDER_3_ID,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((d) => d.orderNumber)).toEqual(['SO-101', 'SO-102']);
  });

  it('filters to customer-only when customerOnly is true', async () => {
    const result = await service.getProductPricingHistory({
      productId: PROD_ID,
      customerId: CUST_A_ID,
      customerOnly: true,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((d) => d.orderNumber)).toEqual(['SO-103', 'SO-101']);
    expect(result.data.every((d) => d.isCurrentCustomer)).toBe(true);
  });

  it('paginates results according to limit and page', async () => {
    const page1 = await service.getProductPricingHistory({
      productId: PROD_ID,
      customerId: CUST_A_ID,
      page: 1,
      limit: 2,
    });

    expect(page1.total).toBe(3);
    expect(page1.data).toHaveLength(2);
    expect(page1.data[0].orderNumber).toBe('SO-103');
    expect(page1.data[1].orderNumber).toBe('SO-101');

    const page2 = await service.getProductPricingHistory({
      productId: PROD_ID,
      customerId: CUST_A_ID,
      page: 2,
      limit: 2,
    });

    expect(page2.total).toBe(3);
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].orderNumber).toBe('SO-102');
  });
});
