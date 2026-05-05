import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { createMemoryDb } from '../../test/utils/memory-db';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import {
  accounts,
  products,
  salesOrderLineItems,
  salesOrders,
  suppliers,
  purchaseOrders,
  systemEvents,
  locations,
  uomDictionary,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { sql } from 'drizzle-orm';

describe('DashboardService', () => {
  let service: DashboardService;
  let db: PgliteDatabase<any>;
  let client: any;
  let testLocationId: string;
  let testTaxCategoryId: string;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
    client = mem.client;

    // Ensure the view exists since it's an .existing() view in Drizzle
    // and might be missing from migrations if it was created manually.
    await db.execute(sql`
      CREATE OR REPLACE VIEW modbm_core.dashboard_timeline AS
      SELECT 
        event_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        actor,
        created_on
      FROM modbm_core.system_events;
    `);

    // Create a shared location for tests
    const [loc] = await db
      .insert(locations)
      .values({
        name: 'Test Warehouse',
        code: 'WH1',
      })
      .returning();
    testLocationId = loc.locationId;

    // Seed UOM dictionary
    await db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    }).onConflictDoNothing();

    // Seed Tax Category
    const [tc] = await db.insert(taxCategories).values({
      code: 'STD',
      title: 'Standard Tax',
      type: 'tax_applies',
      rate: '15',
    }).returning();
    testTaxCategoryId = tc.taxCategoryId;
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    // Clean tables in reverse order of FKs
    await db.delete(systemEvents);
    await db.delete(salesOrderLineItems);
    await db.delete(salesOrders);
    await db.delete(purchaseOrders);
    await db.delete(accounts);
    await db.delete(products);
    await db.delete(suppliers);
  });

  describe('getSummary', () => {
    it('should return counts for all entities', async () => {
      const [acc] = await db.insert(accounts).values({
        name: 'Test Account',
        accountNumber: 'ACC1',
        currencyCode: 'USD',
      }).returning();
      
      await db.insert(products).values({
        name: 'Test Product',
        productNumber: 'PROD1',
      });
      
      const [so] = await db
        .insert(salesOrders)
        .values({
          orderNumber: 'SO1',
          name: 'Order 1',
          customerId: acc.accountId,
          fulfillmentLocationId: testLocationId,
          currencyCode: 'USD',
        })
        .returning();

      await db.insert(salesOrderLineItems).values({
        salesOrderId: so.salesOrderId,
        lineNumber: 1,
        quantity: '10',
        pricePerUnit: '100',
        fulfillmentLocationId: testLocationId,
        taxCategoryId: testTaxCategoryId,
      });

      const result = await service.getSummary();
      expect(result.accounts).toBe(1);
      expect(result.products).toBe(1);
      expect(result.orderLines).toBe(1);
    });
  });

  describe('universalSearch', () => {
    it('should return empty results for queries shorter than 2 chars', async () => {
      const result = await service.universalSearch('a');
      expect(result.results).toEqual([]);
    });

    it('should query all entity tables and return unified results', async () => {
      const [p] = await db
        .insert(products)
        .values({ name: 'Widget Alpha', productNumber: 'WA-01' })
        .returning();
      const [a] = await db
        .insert(accounts)
        .values({
          name: 'Alpha Corp',
          accountNumber: 'AC-01',
          currencyCode: 'USD',
        })
        .returning();

      const result = await service.universalSearch('Alpha');

      expect(result.results.length).toBe(2);
      expect(result.results).toContainEqual(
        expect.objectContaining({
          id: p.productId,
          type: 'product',
          label: 'Widget Alpha',
        }),
      );
      expect(result.results).toContainEqual(
        expect.objectContaining({
          id: a.accountId,
          type: 'account',
          label: 'Alpha Corp',
        }),
      );
    });

    it('should return correct href for each entity type', async () => {
      const [acc] = await db.insert(accounts).values({
        name: 'Search Acc',
        accountNumber: 'SA1',
        currencyCode: 'USD',
      }).returning();

      const [so] = await db
        .insert(salesOrders)
        .values({ 
          orderNumber: 'SO-999', 
          name: 'Special Order',
          customerId: acc.accountId,
          fulfillmentLocationId: testLocationId,
          currencyCode: 'USD',
        })
        .returning();

      const result = await service.universalSearch('SO-999');

      const soResult = result.results.find((r) => r.type === 'sales_order');
      expect(soResult).toBeDefined();
      expect(soResult!.href).toBe(`/sales-orders/${so.salesOrderId}`);
    });
  });


  describe('getTimeline', () => {
    it('should return chronological events from system_events', async () => {
      const accountId = '00000000-0000-0000-0000-00000000000a';
      await db.insert(accounts).values({
        accountId,
        name: 'Timeline Account',
        accountNumber: 'TACC',
        currencyCode: 'USD',
      });

      await db.insert(systemEvents).values({
        aggregateType: 'account',
        aggregateId: accountId,
        eventType: 'created',
        actor: 'system',
        createdOn: new Date(),
      });

      const result = await service.getTimeline(['account_created']);
      expect(result.events.length).toBe(1);
      expect(result.events[0]).toMatchObject({
        eventType: 'account_created',
        entityDisplay: 'Timeline Account',
        actor: 'system',
      });
    });

    it('should return empty if no types provided', async () => {
      const result = await service.getTimeline([]);
      expect(result.events).toEqual([]);
    });
  });
});
