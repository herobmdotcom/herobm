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
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { SALES_ORDER_STATE } from '@modbm/shared';

describe('OrdersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OrdersService;

  const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';
  const ORDER_ID = '00000000-0000-0000-0000-000000000002';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const PROD_ID = '00000000-0000-0000-0000-00000000000a';

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
    });

    await pg.db.insert(customers).values({
      customerId: ACCOUNT_ID,
      customerNumber: 'ACC001',
      name: 'Acme Corp',
      currencyCode: 'EUR',
      address1Country: 'AU',
    });

    await pg.db.insert(products).values({
      productId: PROD_ID,
      productNumber: 'P1',
      name: 'Product 1',
      baseUom: 'EA',
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
});
