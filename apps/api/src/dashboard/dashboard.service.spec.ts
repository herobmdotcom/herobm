import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  CUSTOMER_STATE,
  PRODUCT_STATE,
  SALES_ORDER_STATE,
  ACTOR_STATE,
  SUPPLIER_STATE,
} from '@herobm/shared';
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
  actors,
} from '@herobm/db-schema';
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
      CREATE OR REPLACE VIEW herobm_core.dashboard_timeline AS
      SELECT 
        event_id,
        entity_type,
        entity_id,
        event_type,
        entity_display_name,
        payload,
        actor,
        created_on
      FROM herobm_core.system_events;
    `);

    // Create a shared location for tests
    const [loc] = await pg.db
      .insert(locations)
      .values({
        name: 'Test Warehouse',
        code: 'WH1',
        source: 'app',
        createdBy: 'system',
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
      const actorId = '00000000-0000-4000-8000-000000000005';
      await pg.db.insert(actors).values({
        stateCode: ACTOR_STATE.ACTIVE,
        actorId,
        name: 'Test Customer',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      });
      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId,
          customerNumber: 'ACC1',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      await pg.db.insert(products).values({
        name: 'Test Product',
        productNumber: 'PROD1',
        productType: 'inventory',
        baseUom: 'EA',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      const [so] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'SO1',
          name: 'Order 1',
          customerId: acc.customerId,
          fulfillmentLocationId: testLocationId,
          currencyCode: 'USD',
          stateCode: SALES_ORDER_STATE.DRAFT,
          baseTotalAmount: '0',
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      await pg.db.insert(salesOrderLineItems).values({
        salesOrderId: so.salesOrderId,
        lineNumber: 1,
        quantity: '10',
        pricePerUnit: '100',
        fulfillmentLocationId: testLocationId,
        taxCategoryId: testTaxCategoryId,
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
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
        .values({
          name: 'Widget Alpha',
          productNumber: 'WA-01',
          productType: 'inventory',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        })
        .returning();
      const actorId2 = '00000000-0000-4000-8000-000000000006';
      await pg.db.insert(actors).values({
        stateCode: ACTOR_STATE.ACTIVE,
        actorId: actorId2,
        name: 'Alpha Corp',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      });
      const [a] = await pg.db
        .insert(customers)
        .values({
          actorId: actorId2,
          customerNumber: 'AC-01',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
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
      const actorId3 = '00000000-0000-4000-8000-000000000007';
      await pg.db.insert(actors).values({
        stateCode: ACTOR_STATE.ACTIVE,
        actorId: actorId3,
        name: 'Search Acc',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      });
      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId: actorId3,
          customerNumber: 'SA1',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
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
          stateCode: SALES_ORDER_STATE.DRAFT,
          baseTotalAmount: '0',
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const result = await service.universalSearch('SO-999');

      const soResult = result.results.find((r) => r.type === 'sales_order');
      expect(soResult).toBeDefined();
      expect(soResult!.href).toBe(`/sales-orders/${so.salesOrderId}`);
    });

    it('should filter search results based on selected types', async () => {
      const [p] = await pg.db
        .insert(products)
        .values({
          name: 'Widget Filter',
          productNumber: 'WF-01',
          productType: 'inventory',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        })
        .returning();

      const actorIdFilter = '00000000-0000-4000-8000-000000000088';
      await pg.db.insert(actors).values({
        stateCode: ACTOR_STATE.ACTIVE,
        actorId: actorIdFilter,
        name: 'Widget Supplier',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      });

      await pg.db.insert(suppliers).values({
        stateCode: SUPPLIER_STATE.ACTIVE,
        isPurchasingBlocked: false,
        actorId: actorIdFilter,
        vendorNumber: 'SUP-01',
        currencyCode: 'USD',
        source: 'app',
        createdBy: 'system',
      });

      // When searching for 'Widget' with only 'product' enabled
      const prodOnlyResult = await service.universalSearch('Widget', [
        'product',
      ]);
      expect(prodOnlyResult.results.length).toBe(1);
      expect(prodOnlyResult.results[0].type).toBe('product');
      expect(prodOnlyResult.results[0].id).toBe(p.productId);

      // When searching for 'Widget' with only 'supplier' enabled
      const supOnlyResult = await service.universalSearch('Widget', [
        'supplier',
      ]);
      expect(supOnlyResult.results.length).toBe(1);
      expect(supOnlyResult.results[0].type).toBe('supplier');
      expect(supOnlyResult.results[0].label).toBe('Widget Supplier');
    });

    it('should query default 8 entities when types is undefined or empty', async () => {
      const [p] = await pg.db
        .insert(products)
        .values({
          name: 'Default SKU',
          productNumber: 'DSKU-01',
          productType: 'inventory',
          baseUom: 'EA',
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        })
        .returning();

      const result = await service.universalSearch('Default');
      expect(result.results.length).toBe(1);
      expect(result.results[0].id).toBe(p.productId);
      expect(result.results[0].type).toBe('product');
    });
  });

  describe('getTimeline', () => {
    it('should return chronological events from system_events', async () => {
      const customerId = '00000000-0000-4000-8000-00000000000a';
      const actorId4 = '00000000-0000-4000-8000-000000000008';
      await pg.db.insert(actors).values({
        stateCode: ACTOR_STATE.ACTIVE,
        actorId: actorId4,
        name: 'Timeline Customer',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      });
      await pg.db.insert(customers).values({
        customerId,
        actorId: actorId4,
        customerNumber: 'TACC',
        currencyCode: 'USD',
        stateCode: CUSTOMER_STATE.DRAFT,
        source: 'app',
        createdBy: 'system',
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

    it('should handle mapped event types like general_ledger.entry_posted and warehouse.receipt_created', async () => {
      const eventId1 = '00000000-0000-4000-8000-000000000010';
      await pg.db.insert(systemEvents).values({
        eventId: eventId1,
        entityType: 'system',
        entityId: eventId1,
        entityDisplayName: 'GL Batch 1',
        eventType: 'gl_posted',
        actor: 'finance_user',
        createdOn: new Date(),
      });

      const result = await service.getTimeline(['general_ledger.entry_posted']);
      expect(result.events.length).toBe(1);
      expect(result.events[0].eventType).toBe('general_ledger.entry_posted');
      expect(result.events[0].entityDisplay).toBe('GL Batch 1');
    });
  });
});
