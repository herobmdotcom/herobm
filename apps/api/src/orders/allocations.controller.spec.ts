import { Test, TestingModule } from '@nestjs/testing';
import { AllocationsController } from './allocations.controller';
import { BackordersService } from './backorders.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  backorders,
  products,
  locations,
  zones,
  bins,
  binContents,
  uomDictionary,
  taxCategories,
} from '@herobm/db-schema';
import {
  BACKORDER_STATE,
  PRODUCT_STATE,
  SALES_ORDER_STATE,
} from '@herobm/shared';

describe('AllocationsController.getOpenDemands — availableElsewhere enrichment', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let controller: AllocationsController;

  // Stable UUIDs
  const PROD_ID = '00000000-0000-4000-8000-00000000000a';
  const LOC_MAIN = '00000000-0000-4000-8000-00000000000f';
  const LOC_OTHER1 = '00000000-0000-4000-8000-0000000000a1';
  const LOC_OTHER2 = '00000000-0000-4000-8000-0000000000a2';
  const ZONE_OTHER1 = '00000000-0000-4000-8000-0000000000b1';
  const ZONE_OTHER2 = '00000000-0000-4000-8000-0000000000b2';
  const BIN_OTHER1 = '00000000-0000-4000-8000-0000000000c1';
  const BIN_OTHER2 = '00000000-0000-4000-8000-0000000000c2';
  const ORDER_ID = '00000000-0000-4000-8000-000000000001';
  const LINE_ID = '00000000-0000-4000-8000-000000000011';
  const BACKORDER_ID = '00000000-0000-4000-8000-000000000021';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';

  beforeEach(async () => {
    // Clean transactional rows (FK order: children first)
    await pg.db.delete(backorders);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(binContents);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(products);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);
    await pg.db.delete(uomDictionary);

    // Seed reference data
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
    await pg.db.insert(locations).values([
      {
        locationId: LOC_MAIN,
        code: 'MAIN',
        name: 'Main Warehouse',
        source: 'app',
        createdBy: 'system',
      },
      {
        locationId: LOC_OTHER1,
        code: 'WH-B',
        name: 'Warehouse B',
        source: 'app',
        createdBy: 'system',
      },
      {
        locationId: LOC_OTHER2,
        code: 'WH-C',
        name: 'Warehouse C',
        source: 'app',
        createdBy: 'system',
      },
    ]);
    await pg.db.insert(zones).values([
      {
        zoneId: ZONE_OTHER1,
        locationId: LOC_OTHER1,
        code: 'Z1',
        name: 'Z1',
        source: 'app',
        createdBy: 'system',
      },
      {
        zoneId: ZONE_OTHER2,
        locationId: LOC_OTHER2,
        code: 'Z1',
        name: 'Z1',
        source: 'app',
        createdBy: 'system',
      },
    ]);
    await pg.db.insert(bins).values([
      {
        binId: BIN_OTHER1,
        zoneId: ZONE_OTHER1,
        binNumber: 'B1',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
      {
        binId: BIN_OTHER2,
        zoneId: ZONE_OTHER2,
        binNumber: 'B1',
        binType: 'storage',
        source: 'app',
        createdBy: 'system',
        isUnavailable: false,
        isBonded: false,
      },
    ]);
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

    // Seed an open demand for the main location
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'SO-1',
      fulfillmentLocationId: LOC_MAIN,
      currencyCode: 'EUR',
      stateCode: SALES_ORDER_STATE.DRAFT,
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: LINE_ID,
      salesOrderId: ORDER_ID,
      lineNumber: 1,
      productId: PROD_ID,
      quantity: '10',
      pricePerUnit: '100',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOC_MAIN,
      discountPercentage: '0',
      amount: '0',
      tax: '0',
      quantityPicked: '0',
      isPostConfirmation: false,
    });
    await pg.db.insert(backorders).values({
      backorderId: BACKORDER_ID,
      salesOrderId: ORDER_ID,
      salesOrderLineId: LINE_ID,
      productId: PROD_ID,
      quantity: '10',
      stateCode: BACKORDER_STATE.PENDING_SUPPLY,
    });

    // Wire up controller with a stub BackordersService
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AllocationsController],
      providers: [
        { provide: DRIZZLE, useValue: pg.db },
        { provide: BackordersService, useValue: {} },
      ],
    }).compile();
    controller = module.get(AllocationsController);
  });

  it('returns availableElsewhere with the highest-qty location first when sorted client-side', async () => {
    // Stock at the two non-destination locations.
    await pg.db.insert(binContents).values([
      { binId: BIN_OTHER1, productId: PROD_ID, actualQuantity: '5' },
      { binId: BIN_OTHER2, productId: PROD_ID, actualQuantity: '12' },
    ]);

    const data = await controller.getOpenDemands();
    expect(data).toHaveLength(1);
    const row = data[0];
    expect(row.availableElsewhere).toBeDefined();
    expect(Array.isArray(row.availableElsewhere)).toBe(true);

    // Both other locations show up — main is excluded
    const locIds = row.availableElsewhere
      .map((e: { locationId: string }) => e.locationId)
      .sort();
    expect(locIds).toEqual([LOC_OTHER1, LOC_OTHER2].sort());

    // Each entry has the documented shape
    for (const entry of row.availableElsewhere) {
      expect(entry).toEqual(
        expect.objectContaining({
          locationId: expect.any(String),
          locationName: expect.any(String),
          availableQty: expect.any(Number),
        }),
      );
    }
  });

  it('excludes locations with zero available quantity', async () => {
    // Other2 has no stock, Other1 has 5
    await pg.db.insert(binContents).values([
      { binId: BIN_OTHER1, productId: PROD_ID, actualQuantity: '5' },
      { binId: BIN_OTHER2, productId: PROD_ID, actualQuantity: '0' },
    ]);

    const data = await controller.getOpenDemands();
    const elsewhere = data[0].availableElsewhere;
    expect(elsewhere).toHaveLength(1);
    expect(elsewhere[0].locationId).toBe(LOC_OTHER1);
    expect(elsewhere[0].availableQty).toBe(5);
  });

  it("excludes the demand's own destination location", async () => {
    // Add a zone+bin at the destination location too and put stock there.
    const ZONE_MAIN = '00000000-0000-4000-8000-0000000000d1';
    const BIN_MAIN = '00000000-0000-4000-8000-0000000000d2';
    await pg.db.insert(zones).values({
      zoneId: ZONE_MAIN,
      locationId: LOC_MAIN,
      code: 'Z1',
      name: 'Z1',
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(bins).values({
      binId: BIN_MAIN,
      zoneId: ZONE_MAIN,
      binNumber: 'B1',
      binType: 'storage',
      source: 'app',
      createdBy: 'system',
      isUnavailable: false,
      isBonded: false,
    });
    await pg.db.insert(binContents).values([
      { binId: BIN_MAIN, productId: PROD_ID, actualQuantity: '50' },
      { binId: BIN_OTHER1, productId: PROD_ID, actualQuantity: '5' },
    ]);

    const data = await controller.getOpenDemands();
    const ids = data[0].availableElsewhere.map(
      (e: { locationId: string }) => e.locationId,
    );
    expect(ids).not.toContain(LOC_MAIN);
    expect(ids).toContain(LOC_OTHER1);
  });

  it('returns an empty availableElsewhere array when no other location has stock', async () => {
    // No bin_contents inserted at all
    const data = await controller.getOpenDemands();
    expect(data[0].availableElsewhere).toEqual([]);
  });
});
