import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShippingDocketService } from './shipping-docket.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderShipments,
  salesOrderShipmentLines,
  customers as coreAccounts,
  products as coreProducts,
  uomDictionary,
  locations,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import {
  SALES_ORDER_STATE,
  SHIPMENT_STATE,
  CUSTOMER_STATE,
} from '@modbm/shared';

describe('ShippingDocketService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ShippingDocketService;

  const SHIPMENT_ID = '00000000-0000-0000-0000-000000000001';
  const ORDER_ID = '00000000-0000-0000-0000-000000000002';
  const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
  const PROD_A_ID = '00000000-0000-0000-0000-00000000000a';
  const PROD_B_ID = '00000000-0000-0000-0000-00000000000b';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LINE_1_ID = '00000000-0000-0000-0000-000000000011';
  const LINE_2_ID = '00000000-0000-0000-0000-000000000012';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(salesOrderShipmentLines);
    await pg.db.delete(salesOrderShipments);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(coreProducts);
    await pg.db.delete(coreAccounts);
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

    // Seed Location
    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main Warehouse',
    });

    // Seed Customer
    await pg.db.insert(coreAccounts).values({
      customerId: CUSTOMER_ID,
      customerNumber: 'CUST01',
      name: 'Acme Corp',
      address1Line1: '123 Fake St',
      address1City: 'Springfield',
      address1StateOrProvince: 'QLD',
      address1PostalCode: '4000',
      address1Country: 'Australia',
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
      },
      {
        productId: PROD_B_ID,
        productNumber: 'PROD-B',
        name: 'Gadget Beta',
        baseUom: 'EA',
      },
    ]);

    // Seed Order
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      customerId: CUSTOMER_ID,
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_ID,
    });

    // Seed Order Lines
    await pg.db.insert(salesOrderLineItems).values([
      {
        salesOrderLineId: LINE_1_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        productId: PROD_A_ID,
        quantity: '10',
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
        pricePerUnit: '100.00',
        productDescription: 'Gadget Beta',
        taxCategoryId: TAX_CAT_ID,
        fulfillmentLocationId: LOCATION_ID,
      },
    ]);

    // Seed Shipment
    await pg.db.insert(salesOrderShipments).values({
      shipmentId: SHIPMENT_ID,
      shipmentNumber: 'SHIP-001',
      salesOrderId: ORDER_ID,
      trackingNumber: 'TRACK123',
      notes: 'Fragile items',
      stateCode: SHIPMENT_STATE.DISPATCHED,
    });

    // Seed Shipment Lines
    await pg.db.insert(salesOrderShipmentLines).values([
      {
        shipmentId: SHIPMENT_ID,
        salesOrderLineId: LINE_1_ID,
        quantityShipped: '3',
      },
      {
        shipmentId: SHIPMENT_ID,
        salesOrderLineId: LINE_2_ID,
        quantityShipped: '5',
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShippingDocketService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ShippingDocketService>(ShippingDocketService);
  });

  describe('assembleData', () => {
    it('should throw NotFoundException for unknown shipment', async () => {
      await expect(
        service.assembleData('00000000-0000-0000-0000-ffffffffffff'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assemble correct header data', async () => {
      const data = await service.assembleData(SHIPMENT_ID);
      expect(data.header.shipmentNumber).toBe('SHIP-001');
      expect(data.header.orderNumber).toBe('ORD-001');
      expect(data.header.customerName).toBe('Acme Corp');
      expect(data.header.trackingNumber).toBe('TRACK123');
      expect(data.header.notes).toBe('Fragile items');
      expect(data.header.customerAddress).toContain('123 Fake St');
      expect(data.header.customerAddress).toContain('Springfield');
    });

    it('should assemble correct line data', async () => {
      const data = await service.assembleData(SHIPMENT_ID);
      expect(data.lines).toHaveLength(2);

      const lineA = data.lines.find((l) => l.productCode === 'PROD-A');
      expect(lineA?.quantityShipped).toBe(3);
      expect(lineA?.description).toBe('Widget Alpha');

      const lineB = data.lines.find((l) => l.productCode === 'PROD-B');
      expect(lineB?.quantityShipped).toBe(5);
      expect(lineB?.description).toBe('Gadget Beta');
    });
  });
});
