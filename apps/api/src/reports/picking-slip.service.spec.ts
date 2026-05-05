import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PickingSlipService } from './picking-slip.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { createMemoryDb } from '../../test/utils/memory-db';
import {
  salesOrders,
  salesOrderLineItems,
  accounts as coreAccounts,
  products as coreProducts,
  uomDictionary,
  locations,
  taxCategories,
  zones,
  bins,
  binContents,
} from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';

describe('PickingSlipService', () => {
  let service: PickingSlipService;
  let db: PgliteDatabase<any>;

  const ORDER_ID = '00000000-0000-0000-0000-000000000001';
  const CUSTOMER_ID = '00000000-0000-0000-0000-000000000002';
  const PROD_A_ID = '00000000-0000-0000-0000-00000000000a';
  const PROD_B_ID = '00000000-0000-0000-0000-00000000000b';
  const PROD_C_ID = '00000000-0000-0000-0000-00000000000c';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const ZONE_ID = '00000000-0000-0000-0000-00000000000e';
  const BIN_ID = '00000000-0000-0000-0000-00000000000d';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LINE_1_ID = '00000000-0000-0000-0000-000000000011';
  const LINE_2_ID = '00000000-0000-0000-0000-000000000012';
  const LINE_3_ID = '00000000-0000-0000-0000-000000000013';

  beforeEach(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    // Seed UOM
    await db
      .insert(uomDictionary)
      .values({ uomCode: 'EA', description: 'Each' });

    // Seed Tax Category
    await db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    // Seed Location, Zone, Bin
    await db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
    });
    await db.insert(zones).values({
      zoneId: ZONE_ID,
      locationId: LOCATION_ID,
      code: 'Z1',
      name: 'Zone 1',
    });
    await db.insert(bins).values({
      binId: BIN_ID,
      zoneId: ZONE_ID,
      binNumber: 'B1', // Fixed field name
      binType: 'storage',
    });

    // Seed Customer
    await db.insert(coreAccounts).values({
      accountId: CUSTOMER_ID,
      accountNumber: 'CUST01',
      name: 'Acme Corp',
      currencyCode: 'AUD',
      stateCode: 'active',
      source: 'app',
    });

    // Seed Products
    await db.insert(coreProducts).values([
      {
        productId: PROD_A_ID,
        productNumber: 'PROD-A',
        name: 'Widget Alpha',
        baseUom: 'EA',
      },
      {
        productId: PROD_B_ID,
        productNumber: 'PROD-B',
        name: 'Gadget Beta',
        baseUom: 'EA',
      },
      {
        productId: PROD_C_ID,
        productNumber: 'PROD-C',
        name: 'Gizmo Gamma',
        baseUom: 'EA',
      },
    ]);

    // Seed Order
    await db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-20260317-0001',
      customerId: CUSTOMER_ID,
      customerOrderNumber: 'PO-1234',
      stateCode: 'confirmed',
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_ID,
    });

    // Seed Order Lines
    await db.insert(salesOrderLineItems).values([
      {
        salesOrderLineId: LINE_1_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PROD_A_ID,
        quantity: '10',
        quantityPicked: '3',
        pricePerUnit: '50.00',
        productDescription: 'Widget Alpha',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
      {
        salesOrderLineId: LINE_2_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 2,
        productId: PROD_B_ID,
        quantity: '5',
        quantityPicked: '5',
        pricePerUnit: '100.00',
        productDescription: 'Gadget Beta',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
      {
        salesOrderLineId: LINE_3_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 3,
        productId: PROD_C_ID,
        quantity: '20',
        quantityPicked: '0',
        pricePerUnit: '10.00',
        productDescription: 'Gizmo Gamma',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
    ]);

    // Seed Inventory (via binContents since inventory_levels is a view)
    await db.insert(binContents).values([
      { binId: BIN_ID, productId: PROD_A_ID, actualQuantity: '100' },
      { binId: BIN_ID, productId: PROD_B_ID, actualQuantity: '50' },
      { binId: BIN_ID, productId: PROD_C_ID, actualQuantity: '5' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PickingSlipService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<PickingSlipService>(PickingSlipService);
  });

  describe('assembleData', () => {
    it('should throw NotFoundException for unknown order', async () => {
      await expect(
        service.assembleData('00000000-0000-0000-0000-ffffffffffff'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assemble correct header data', async () => {
      const data = await service.assembleData(ORDER_ID);
      expect(data.header.orderNumber).toBe('ORD-20260317-0001');
      expect(data.header.customerName).toBe('Acme Corp');
      expect(data.header.customerOrderNumber).toBe('PO-1234');
    });

    it('should only include lines with qty to pick > 0 in picking lines', async () => {
      const data = await service.assembleData(ORDER_ID);
      expect(data.pickingLines).toHaveLength(2);
      expect(
        data.pickingLines.find((l) => l.productCode === 'PROD-A')?.qtyToPick,
      ).toBe(7);
      expect(
        data.pickingLines.find((l) => l.productCode === 'PROD-C')?.qtyToPick,
      ).toBe(20);
    });

    it('should identify back-order lines where ordered > on-hand', async () => {
      const data = await service.assembleData(ORDER_ID);
      expect(data.backOrderLines).toHaveLength(1);
      expect(
        data.backOrderLines[0].productCode === 'PROD-C' ||
          data.backOrderLines[0].productCode === PROD_C_ID,
      ).toBe(true);
      expect(data.backOrderLines[0].qtyToOrder).toBe(15);
    });
  });
});
