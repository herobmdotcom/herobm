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
import { asc, eq } from 'drizzle-orm';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { OrderLinesService } from './order-lines.service';
import { OrdersCoreService } from './orders-core.service';
import { OrdersQueryService } from './orders-query.service';

describe('OrderLinesService - insertAtLineNumber & reorderLines', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OrderLinesService;

  const ORG_ID = '00000000-0000-4000-8000-000000000201';
  const CUST_ID = '00000000-0000-4000-8000-000000000202';
  const LOC_ID = '00000000-0000-4000-8000-000000000203';
  const TAX_ID = '00000000-0000-4000-8000-000000000204';
  const PROD_A = '00000000-0000-4000-8000-000000000211';
  const PROD_B = '00000000-0000-4000-8000-000000000212';
  const PROD_C = '00000000-0000-4000-8000-000000000213';
  const PROD_D = '00000000-0000-4000-8000-000000000214';
  const ORDER_ID = '00000000-0000-4000-8000-000000000220';

  const LINE_1 = '00000000-0000-4000-8000-000000000231';
  const LINE_2 = '00000000-0000-4000-8000-000000000232';
  const LINE_3 = '00000000-0000-4000-8000-000000000233';

  beforeEach(async () => {
    const queryService = new (OrdersQueryService as any)(pg.db);
    const productsMock = {
      findOne: jest.fn().mockResolvedValue({
        productId: PROD_D,
        productNumber: 'SKU-D',
        name: 'Item D',
        stateCode: PRODUCT_STATE.ACTIVE,
        structureType: 'standard',
        productType: 'inventory',
      }),
    };
    const coreService = new (OrdersCoreService as any)(
      pg.db,
      {
        findDefault: jest
          .fn()
          .mockResolvedValue({ taxCategoryId: TAX_ID, rate: '0.1' }),
        findOne: jest
          .fn()
          .mockResolvedValue({ taxCategoryId: TAX_ID, rate: '0.1' }),
        getById: jest
          .fn()
          .mockResolvedValue({ taxCategoryId: TAX_ID, rate: '0.1' }),
      },
      {
        resolve: jest.fn().mockResolvedValue({
          taxCategoryId: TAX_ID,
          rate: 0.1,
          taxProvider: 'internal',
        }),
        resolveTaxCategory: jest.fn().mockResolvedValue(TAX_ID),
      },
      {},
      {
        findOne: jest.fn().mockResolvedValue({
          customerId: CUST_ID,
          billingAddressCountry: 'AU',
          defaultDiscount: '0',
        }),
      },
      {},
      productsMock,
      {},
      {
        getAppConfig: jest.fn().mockResolvedValue({}),
        taxProviderMappings: jest.fn().mockReturnValue({}),
        getAppSettingsRaw: jest.fn().mockReturnValue({}),
      },
    );

    service = new (OrderLinesService as any)(
      pg.db,
      {
        findDefault: jest
          .fn()
          .mockResolvedValue({ taxCategoryId: TAX_ID, rate: '0.1' }),
        findOne: jest
          .fn()
          .mockResolvedValue({ taxCategoryId: TAX_ID, rate: '0.1' }),
        getById: jest
          .fn()
          .mockResolvedValue({ taxCategoryId: TAX_ID, rate: '0.1' }),
      },
      {
        resolve: jest.fn().mockResolvedValue({
          taxCategoryId: TAX_ID,
          rate: 0.1,
          taxProvider: 'internal',
        }),
        resolveTaxCategory: jest.fn().mockResolvedValue(TAX_ID),
      },
      {},
      {},
      {},
      {},
      {},
      { getAppConfig: jest.fn().mockResolvedValue({}) },
      {},
      {},
      {},
      {},
      coreService,
      queryService,
    );

    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each', category: 'goods' });

    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    await pg.db.insert(locations).values({
      locationId: LOC_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(organizations).values({
      organizationId: ORG_ID,
      name: 'Test Org',
      stateCode: ORGANIZATION_STATE.ACTIVE,
      isTaxRegistered: true,
    });

    await pg.db.insert(customers).values({
      customerId: CUST_ID,
      customerNumber: 'CUST-100',
      organizationId: ORG_ID,
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      isOnCreditHold: false,
      source: 'app',
    });

    await pg.db.insert(products).values([
      {
        productId: PROD_A,
        productNumber: 'SKU-A',
        name: 'Item A',
        stateCode: PRODUCT_STATE.ACTIVE,
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        source: 'app',
      },
      {
        productId: PROD_B,
        productNumber: 'SKU-B',
        name: 'Item B',
        stateCode: PRODUCT_STATE.ACTIVE,
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        source: 'app',
      },
      {
        productId: PROD_C,
        productNumber: 'SKU-C',
        name: 'Item C',
        stateCode: PRODUCT_STATE.ACTIVE,
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        source: 'app',
      },
      {
        productId: PROD_D,
        productNumber: 'SKU-D',
        name: 'Item D',
        stateCode: PRODUCT_STATE.ACTIVE,
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        source: 'app',
      },
    ]);

    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-INSERT-1',
      customerId: CUST_ID,
      currencyCode: 'AUD',
      exchangeRate: '1.0',
      discrepanciesAcknowledged: false,
      stateCode: SALES_ORDER_STATE.DRAFT,
      fulfillmentLocationId: LOC_ID,
      source: 'app',
    });

    await pg.db.insert(salesOrderLineItems).values([
      {
        salesOrderLineId: LINE_1,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PROD_A,
        productDescription: 'Item A',
        quantity: '1',
        pricePerUnit: '10.00',
        discountPercentage: '0',
        amount: '10.00',
        tax: '1.00',
        totalAmount: '11.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_ID,
      },
      {
        salesOrderLineId: LINE_2,
        salesOrderId: ORDER_ID,
        lineNumber: 2,
        productId: PROD_B,
        productDescription: 'Item B',
        quantity: '2',
        pricePerUnit: '20.00',
        discountPercentage: '0',
        amount: '40.00',
        tax: '4.00',
        totalAmount: '44.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_ID,
      },
      {
        salesOrderLineId: LINE_3,
        salesOrderId: ORDER_ID,
        lineNumber: 3,
        productId: PROD_C,
        productDescription: 'Item C',
        quantity: '3',
        pricePerUnit: '30.00',
        discountPercentage: '0',
        amount: '90.00',
        tax: '9.00',
        totalAmount: '99.00',
        unitOfMeasure: 'EA',
        taxCategoryId: TAX_ID,
      },
    ]);
  });

  it('inserts a new line at a specified lineNumber and shifts subsequent lines down', async () => {
    const inserted = await service.addLine(
      ORDER_ID,
      {
        productId: PROD_D,
        productDescription: 'Item D',
        quantity: '5',
        pricePerUnit: '15.00',
        unitOfMeasure: 'EA',
        insertAtLineNumber: 2,
      },
      'tester',
    );

    expect(inserted?.lineNumber).toBe(2);

    const rows = await pg.db
      .select({
        id: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
        desc: salesOrderLineItems.productDescription,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, ORDER_ID))
      .orderBy(asc(salesOrderLineItems.lineNumber));

    expect(rows.map((r) => [r.lineNumber, r.desc])).toEqual([
      [1, 'Item A'],
      [2, 'Item D'],
      [3, 'Item B'],
      [4, 'Item C'],
    ]);
  });

  it('reorders existing draft lines cleanly without unique_so_line_number collisions', async () => {
    await service.reorderLines(ORDER_ID, [LINE_3, LINE_1, LINE_2], 'tester');

    const rows = await pg.db
      .select({
        id: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, ORDER_ID))
      .orderBy(asc(salesOrderLineItems.lineNumber));

    expect(rows.map((r) => [r.lineNumber, r.id])).toEqual([
      [1, LINE_3],
      [2, LINE_1],
      [3, LINE_2],
    ]);
  });

  it('rejects reordering on a non-draft sales order', async () => {
    await pg.db
      .update(salesOrders)
      .set({ stateCode: SALES_ORDER_STATE.CONFIRMED })
      .where(eq(salesOrders.salesOrderId, ORDER_ID));

    await expect(
      service.reorderLines(ORDER_ID, [LINE_3, LINE_1, LINE_2], 'tester'),
    ).rejects.toThrow(/non-draft/i);
  });
});
