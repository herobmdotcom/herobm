import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PickingSlipService } from './picking-slip.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  customers as coreAccounts,
  products as coreProducts,
  uomDictionary,
  locations,
  taxCategories,
  zones,
  bins,
  binContents,
  salesOrderPicks,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  actors,
} from '../drizzle/herobm-core-schema';
import {
  SALES_ORDER_STATE,
  TRANSFER_ORDER_STATE,
  CUSTOMER_STATE,
} from '@herobm/shared';

describe('PickingSlipService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PickingSlipService;

  const ORDER_ID = '00000000-0000-4000-8000-000000000001';
  const TRANSFER_ID = '00000000-0000-4000-8000-000000000002';
  const CUSTOMER_ID = '00000000-0000-4000-8000-000000000003';
  const PROD_A_ID = '00000000-0000-4000-8000-00000000000a';
  const PROD_B_ID = '00000000-0000-4000-8000-00000000000b';
  const LOCATION_SRC_ID = '00000000-0000-4000-8000-00000000000f';
  const LOCATION_DEST_ID = '00000000-0000-4000-8000-000000000008';
  const ZONE_ID = '00000000-0000-4000-8000-00000000000e';
  const BIN_ID = '00000000-0000-4000-8000-00000000000d';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(transferOrderPicks);
    await pg.db.delete(transferOrderLines);
    await pg.db.delete(transferOrders);
    await pg.db.delete(salesOrderPicks);
    await pg.db.delete(binContents);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(coreProducts);
    await pg.db.delete(coreAccounts);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);
    await pg.db.delete(uomDictionary);

    // Seed UOM
    await pg.db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });

    // Seed Tax Category
    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    // Seed Locations
    await pg.db.insert(locations).values([
      { locationId: LOCATION_SRC_ID, code: 'SRC', name: 'Source Warehouse' },
      {
        locationId: LOCATION_DEST_ID,
        code: 'DEST',
        name: 'Destination Warehouse',
      },
    ]);
    await pg.db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_SRC_ID,
      code: 'Z1',
      name: 'Zone 1',
    });
    await pg.db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'B1',
      binType: 'storage',
    });

    // Seed Customer Actor
    const customerActorId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    await pg.db.insert(actors).values({
      actorId: customerActorId,
      name: 'Acme Corp',
      headquartersAddressLine1: 'AU',
    });

    await pg.db.insert(coreAccounts).values({
      customerId: CUSTOMER_ID,
      actorId: customerActorId,
      customerNumber: 'CUST01',
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'app',
    });

    // Seed Products
    await pg.db.insert(coreProducts).values([
      {
        productId: PROD_A_ID,
        productNumber: 'PROD-A',
        name: 'Widget Alpha',
        baseUom: 'EA',
        productType: 'inventory',
      },
      {
        productId: PROD_B_ID,
        productNumber: 'PROD-B',
        name: 'Gadget Beta',
        baseUom: 'EA',
        productType: 'inventory',
      },
    ]);

    // Seed Sales Order
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      customerId: CUSTOMER_ID,
      customerOrderNumber: 'PO-123',
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_SRC_ID,
    });
    await pg.db.insert(salesOrderLineItems).values({
      salesOrderLineId: '00000000-0000-4000-8000-000000000011',
      salesOrderId: ORDER_ID,
      lineNumber: 1,
      productId: PROD_A_ID,
      quantity: '10',
      pricePerUnit: '50.00',
      taxCategoryId: TAX_CAT_ID,
      fulfillmentLocationId: LOCATION_SRC_ID,
    });

    // Seed Transfer Order
    await pg.db.insert(transferOrders).values({
      transferOrderId: TRANSFER_ID,
      orderNumber: 'TRF-001',
      sourceLocationId: LOCATION_SRC_ID,
      destinationLocationId: LOCATION_DEST_ID,
      stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
    });
    await pg.db.insert(transferOrderLines).values({
      transferOrderLineId: '00000000-0000-4000-8000-000000000012',
      transferOrderId: TRANSFER_ID,
      productId: PROD_B_ID,
      quantity: '5',
    });

    // Seed Inventory
    await pg.db.insert(binContents).values([
      { binId: BIN_ID, productId: PROD_A_ID, actualQuantity: '100' },
      { binId: BIN_ID, productId: PROD_B_ID, actualQuantity: '100' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PickingSlipService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<PickingSlipService>(PickingSlipService);
  });

  describe('assembleData', () => {
    it('should handle Sales Orders correctly', async () => {
      const data = await service.assembleData(ORDER_ID);
      expect(data.header.orderNumber).toBe('ORD-001');
      expect(data.header.customerName).toBe('Acme Corp');
      expect(data.header.locationName).toBe('Source Warehouse');
      expect(data.pickingLines).toHaveLength(1);
      expect(data.pickingLines[0].productCode).toBe('PROD-A');
    });

    it('should handle Transfer Orders correctly', async () => {
      const data = await service.assembleData(TRANSFER_ID);
      expect(data.header.orderNumber).toBe('TRF-001');
      expect(data.header.customerName).toBe('Destination Warehouse');
      expect(data.header.locationName).toBe('Source Warehouse');
      expect(data.pickingLines).toHaveLength(1);
      expect(data.pickingLines[0].productCode).toBe('PROD-B');
    });

    it('should throw NotFoundException for unknown ID', async () => {
      await expect(
        service.assembleData('00000000-0000-4000-8000-ffffffffffff'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
