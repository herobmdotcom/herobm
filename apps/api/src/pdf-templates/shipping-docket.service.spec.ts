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
  actors,
  transferOrders,
  transferOrderLines,
  transferOrderShipments,
  transferOrderShipmentLines,
} from '@herobm/db-schema';
import {
  SALES_ORDER_STATE,
  SHIPMENT_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
  TRANSFER_ORDER_STATE,
} from '@herobm/shared';

describe('ShippingDocketService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ShippingDocketService;

  const SHIPMENT_ID = '00000000-0000-4000-8000-000000000001';
  const ORDER_ID = '00000000-0000-4000-8000-000000000002';
  const CUSTOMER_ID = '00000000-0000-4000-8000-000000000003';
  const PROD_A_ID = '00000000-0000-4000-8000-00000000000a';
  const PROD_B_ID = '00000000-0000-4000-8000-00000000000b';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const LOCATION_DEST_ID = '00000000-0000-4000-8000-00000000000e';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LINE_1_ID = '00000000-0000-4000-8000-000000000011';
  const LINE_2_ID = '00000000-0000-4000-8000-000000000012';

  const TRANSFER_ORDER_ID = '00000000-0000-4000-8000-000000000020';
  const TRANSFER_SHIPMENT_ID = '00000000-0000-4000-8000-000000000021';
  const TRANSFER_LINE_ID = '00000000-0000-4000-8000-000000000022';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(transferOrderShipmentLines);
    await pg.db.delete(transferOrderShipments);
    await pg.db.delete(transferOrderLines);
    await pg.db.delete(transferOrders);
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

    // Seed Locations
    await pg.db.insert(locations).values([
      {
        locationId: LOCATION_ID,
        code: 'MAIN',
        name: 'Main Warehouse',
        addressLine1: '100 Logistics Way',
        city: 'Brisbane',
        stateOrProvince: 'QLD',
        postalCode: '4000',
        country: 'Australia',
        source: 'app',
        createdBy: 'system',
      },
      {
        locationId: LOCATION_DEST_ID,
        code: 'BRANCH',
        name: 'Branch Warehouse',
        addressLine1: '200 Commercial Rd',
        city: 'Sydney',
        stateOrProvince: 'NSW',
        postalCode: '2000',
        country: 'Australia',
        source: 'app',
        createdBy: 'system',
      },
    ]);

    // Seed Customer Actor
    const customerActorId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    await pg.db.insert(actors).values({
      stateCode: ACTOR_STATE.ACTIVE,
      actorId: customerActorId,
      name: 'Acme Corp',
      headquartersAddressLine1:
        '123 Fake St, Springfield, QLD, 4000, Australia',
      isTaxRegistered: false,
    });

    await pg.db.insert(coreAccounts).values({
      customerId: CUSTOMER_ID,
      actorId: customerActorId,
      customerNumber: 'CUST01',
      currencyCode: 'AUD',
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'app',
      createdBy: 'system',
    });

    // Seed Products
    await pg.db.insert(coreProducts).values([
      {
        productId: PROD_A_ID,
        productNumber: 'PROD-A',
        name: 'Widget Alpha',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      },
      {
        productId: PROD_B_ID,
        productNumber: 'PROD-B',
        name: 'Gadget Beta',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      },
    ]);

    // Seed Order
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      customerId: CUSTOMER_ID,
      customerOrderNumber: 'PO-9988',
      stateCode: SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'AUD',
      fulfillmentLocationId: LOCATION_ID,
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      deliveryName: 'Jane Doe',
      deliveryCompanyName: 'Acme Receiving',
      deliveryPhone: '0412345678',
      deliveryAddressLine1: '456 Delivery Lane',
      deliveryCity: 'Brisbane',
      deliveryState: 'QLD',
      deliveryPostalCode: '4001',
      deliveryCountry: 'Australia',
      shippingNotes: 'Leave at front desk',
      source: 'app',
      createdBy: 'system',
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
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
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
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
      createdBy: 'system',
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

    // Seed Transfer Order & Shipment
    await pg.db.insert(transferOrders).values({
      transferOrderId: TRANSFER_ORDER_ID,
      orderNumber: 'TO-100',
      sourceLocationId: LOCATION_ID,
      destinationLocationId: LOCATION_DEST_ID,
      stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
      shippingNotes: 'Urgent branch transfer',
      createdBy: 'system',
    });

    await pg.db.insert(transferOrderLines).values({
      transferOrderLineId: TRANSFER_LINE_ID,
      transferOrderId: TRANSFER_ORDER_ID,
      productId: PROD_A_ID,
      quantity: '4',
      quantityShipped: '4',
      quantityReceived: '0',
    });

    await pg.db.insert(transferOrderShipments).values({
      shipmentId: TRANSFER_SHIPMENT_ID,
      shipmentNumber: 'TSH-001',
      transferOrderId: TRANSFER_ORDER_ID,
      trackingNumber: 'TRK-TO-1',
      stateCode: SHIPMENT_STATE.DISPATCHED,
      shippedBy: 'system',
    });

    await pg.db.insert(transferOrderShipmentLines).values({
      shipmentId: TRANSFER_SHIPMENT_ID,
      transferOrderLineId: TRANSFER_LINE_ID,
      productId: PROD_A_ID,
      quantity: '4',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShippingDocketService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ShippingDocketService>(ShippingDocketService);
  });

  describe('assembleData', () => {
    it('should throw NotFoundException for unknown shipment', async () => {
      await expect(
        service.assembleData('00000000-0000-4000-8000-ffffffffffff'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assemble correct header and delivery data for sales order shipment', async () => {
      const data = await service.assembleData(SHIPMENT_ID);
      expect(data.header.shipmentNumber).toBe('SHIP-001');
      expect(data.header.orderNumber).toBe('ORD-001');
      expect(data.header.customerName).toBe('Acme Corp');
      expect(data.header.customerOrderNumber).toBe('PO-9988');
      expect(data.header.trackingNumber).toBe('TRACK123');
      expect(data.header.notes).toBe('Fragile items');
      expect(data.header.deliveryName).toBe('Jane Doe');
      expect(data.header.deliveryCompanyName).toBe('Acme Receiving');
      expect(data.header.deliveryPhone).toBe('0412345678');
      expect(data.header.deliveryAddressLine1).toBe('456 Delivery Lane');
      expect(data.header.deliveryCity).toBe('Brisbane');
      expect(data.header.shippingNotes).toBe('Leave at front desk');
      expect(data.header.customerAddress).toContain('456 Delivery Lane');
      expect(data.header.customerAddress).toContain('Brisbane');
      expect(data.totalQuantity).toBe(8);
      expect(data.totalLines).toBe(2);
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

    it('should assemble correct data for transfer order shipment', async () => {
      const data = await service.assembleData(TRANSFER_SHIPMENT_ID);
      expect(data.header.shipmentNumber).toBe('TSH-001');
      expect(data.header.orderNumber).toBe('TO-100');
      expect(data.header.customerName).toBe('Branch Warehouse');
      expect(data.header.trackingNumber).toBe('TRK-TO-1');
      expect(data.header.deliveryAddressLine1).toBe('200 Commercial Rd');
      expect(data.header.deliveryCity).toBe('Sydney');
      expect(data.header.shippingNotes).toBe('Urgent branch transfer');
      expect(data.lines).toHaveLength(1);
      expect(data.lines[0].productCode).toBe('PROD-A');
      expect(data.lines[0].quantityShipped).toBe(4);
      expect(data.totalQuantity).toBe(4);
      expect(data.totalLines).toBe(1);
    });
  });
});
