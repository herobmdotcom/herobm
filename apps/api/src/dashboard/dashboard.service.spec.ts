import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  customers,
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
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: DashboardService;
  let testLocationId: string;
  let testTaxCategoryId: string;

  beforeEach(async () => {
    // Ensure the view exists since it's an .existing() view in Drizzle
    // and might be missing from migrations if it was created manually.
    await pg.db.execute(sql`
      CREATE OR REPLACE VIEW modbm_core.dashboard_timeline AS
      SELECT 
        event_id,
        entity_type,
        entity_id,
        event_type,
        entity_display_name,
        payload,
        actor,
        created_on
      FROM modbm_core.system_events;
    `);

    // Create a shared location for tests
    const [loc] = await pg.db
      .insert(locations)
      .values({
        name: 'Test Warehouse',
        code: 'WH1',
      })
      .returning();
    testLocationId = loc.locationId;

    // Seed UOM dictionary
    await pg.db
      .insert(uomDictionary)
      .values({
        uomCode: 'EA',
        description: 'Each',
      })
      .onConflictDoNothing();

    // Seed Tax Category
    const [tc] = await pg.db
      .insert(taxCategories)
      .values({
        code: 'STD',
        title: 'Standard Tax',
        type: 'tax_applies',
        rate: '15',
      })
      .returning();
    testTaxCategoryId = tc.taxCategoryId;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    // Clean tables in reverse order of FKs
    await pg.db.delete(systemEvents);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(purchaseOrders);
    await pg.db.delete(customers);
    await pg.db.delete(products);
    await pg.db.delete(suppliers);
  });

  describe('getSummary', () => {
    it('should return counts for all entities', async () => {
      const [acc] = await pg.db
        .insert(customers)
        .values({
          name: 'Test Customer',
          customerNumber: 'ACC1',
          currencyCode: 'USD',
          address1Country: 'AU',
        })
        .returning();

      await pg.db.insert(products).values({
        name: 'Test Product',
        productNumber: 'PROD1',
      });

      const [so] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'SO1',
          name: 'Order 1',
          customerId: acc.customerId,
          fulfillmentLocationId: testLocationId,
          currencyCode: 'USD',
        })
        .returning();

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: so.salesOrderId,
        lineNumber: 1,
        quantity: '10',
        pricePerUnit: '100',
        fulfillmentLocationId: testLocationId,
        taxCategoryId: testTaxCategoryId,
      });

      const result = await service.getSummary();
      expect(result.customers).toBe(1);
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
      const [p] = await pg.db
        .insert(products)
        .values({ name: 'Widget Alpha', productNumber: 'WA-01' })
        .returning();
      const [a] = await pg.db
        .insert(customers)
        .values({
          name: 'Alpha Corp',
          customerNumber: 'AC-01',
          currencyCode: 'USD',
          address1Country: 'AU',
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
          id: a.customerId,
          type: 'customer',
          label: 'Alpha Corp',
        }),
      );
    });

    it('should return correct href for each entity type', async () => {
      const [acc] = await pg.db
        .insert(customers)
        .values({
          name: 'Search Acc',
          customerNumber: 'SA1',
          currencyCode: 'USD',
          address1Country: 'AU',
        })
        .returning();

      const [so] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'SO-999',
          name: 'Special Order',
          customerId: acc.customerId,
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
      const customerId = '00000000-0000-0000-0000-00000000000a';
      await pg.db.insert(customers).values({
        customerId,
        name: 'Timeline Customer',
        customerNumber: 'TACC',
        currencyCode: 'USD',
        address1Country: 'AU',
      });

      await pg.db.insert(systemEvents).values({
        entityType: 'customer',
        entityId: customerId,
        entityDisplayName: 'Timeline Customer',
        eventType: 'created',
        actor: 'system',
        createdOn: new Date(),
      });

      const result = await service.getTimeline(['customer.created']);
      expect(result.events.length).toBe(1);
      expect(result.events[0]).toMatchObject({
        eventType: 'customer.created',
        entityDisplay: 'Timeline Customer',
        actor: 'system',
      });
    });

    it('should return empty if no types provided', async () => {
      const result = await service.getTimeline([]);
      expect(result.events).toEqual([]);
    });
  });
});
