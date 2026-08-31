import {
  autoShipWhenFullyShipped,
  revertToPickingOnShipmentCancel,
  autoInvoiceWhenFullyInvoiced,
  revertInvoicedWhenInvoiceCancelled,
  evaluateLifecycleRules,
  LifecycleTrigger,
} from './order-lifecycle-rules';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesOrderPicks,
  salesInvoices,
  salesInvoiceLines,
  products,
  uomDictionary,
  locations,
  taxCategories,
  salesEvents,
  outbox,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  SALES_ORDER_STATE,
  SHIPMENT_STATE,
  SALES_INVOICE_STATE,
  SALES_ORDER_PICK_STATE,
  PRODUCT_STATE,
  type SalesInvoiceState,
} from '@herobm/shared';

// Mock emitEvent to avoid needing event emitter setup
jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

import { emitEvent } from '../common/emit-event';

describe('Order Lifecycle Rules', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });

  const ORDER_ID = '00000000-0000-4000-8000-000000000001';
  const LOCATION_ID = '00000000-0000-4000-8000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-4000-8000-000000000007';
  const LINE_1_ID = '00000000-0000-4000-8000-000000000011';
  const LINE_2_ID = '00000000-0000-4000-8000-000000000012';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(salesEvents);
    await pg.db.delete(outbox);
    await pg.db.delete(salesInvoiceLines);
    await pg.db.delete(salesInvoices);
    await pg.db.delete(salesOrderShipmentLines);
    await pg.db.delete(salesOrderShipments);
    await pg.db.delete(salesOrderPicks);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(products);
    await pg.db.delete(uomDictionary);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);

    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
    });

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
      source: 'app',
      createdBy: 'system',
    });

    await pg.db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    jest.clearAllMocks();
  });

  async function seedOrder(state: string) {
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      stateCode: state as any,
      fulfillmentLocationId: LOCATION_ID,
      currencyCode: 'AUD',
      baseTotalAmount: '0',
      exchangeRate: '1',
      discrepanciesAcknowledged: false,
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(salesOrderLineItems).values([
      {
        salesOrderLineId: LINE_1_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 1,
        quantity: '10',
        pricePerUnit: '0',
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
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
        quantity: '5',
        pricePerUnit: '0',
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
        discountPercentage: '0',
        amount: '0',
        tax: '0',
        quantityPicked: '0',
        isPostConfirmation: false,
      },
    ]);
  }

  const makeInvoiceValues = (
    invoiceId: string,
    invoiceNumber: string,
    stateCode: SalesInvoiceState = SALES_INVOICE_STATE.INVOICED,
  ) => ({
    invoiceId,
    salesOrderId: ORDER_ID,
    invoiceNumber,
    stateCode,
    totalAmount: '0',
    outstandingAmount: '0',
    taxAmount: '0',
    baseTotalAmount: '0',
    baseOutstandingAmount: '0',
    currencyCode: 'AUD',
    exchangeRate: '1',
    invoiceDate: new Date(),
    dueDate: new Date(),
    createdBy: 'system',
  });

  describe('autoShipWhenFullyShipped', () => {
    const trigger: LifecycleTrigger = {
      entity: 'shipment',
      id: 'shp-1',
      action: 'dispatched',
    };

    it('should transition order to shipped when all lines are fully shipped', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);

      const SHIP_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: SHIPMENT_STATE.DISPATCHED,
        createdBy: 'system',
      });
      await pg.db.insert(salesOrderShipmentLines).values([
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_1_ID,
          quantityShipped: '10',
        },
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_2_ID,
          quantityShipped: '5',
        },
      ]);

      const result = await autoShipWhenFullyShipped.evaluate(
        pg.db,
        ORDER_ID,
        trigger,
        'admin',
      );

      expect(result?.to).toBe(SALES_ORDER_STATE.SHIPPED);
      const [order] = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe(SALES_ORDER_STATE.SHIPPED);
    });

    it('should transition order from confirmed to shipped when all lines are fully shipped', async () => {
      await seedOrder(SALES_ORDER_STATE.CONFIRMED);

      const SHIP_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: SHIPMENT_STATE.DISPATCHED,
        createdBy: 'system',
      });
      await pg.db.insert(salesOrderShipmentLines).values([
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_1_ID,
          quantityShipped: '10',
        },
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_2_ID,
          quantityShipped: '5',
        },
      ]);

      const result = await autoShipWhenFullyShipped.evaluate(
        pg.db,
        ORDER_ID,
        trigger,
        'admin',
      );

      expect(result?.from).toBe(SALES_ORDER_STATE.CONFIRMED);
      expect(result?.to).toBe(SALES_ORDER_STATE.SHIPPED);
      const [order] = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe(SALES_ORDER_STATE.SHIPPED);
    });

    it('should do nothing if an order line is only partially shipped', async () => {
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
        createdBy: 'system',
      });
      await pg.db.insert(salesOrderShipmentLines).values([
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_1_ID,
          quantityShipped: '10',
        },
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_2_ID,
          quantityShipped: '2',
        },
      ]);

      const result = await autoShipWhenFullyShipped.evaluate(
        pg.db,
        ORDER_ID,
        trigger,
        'admin',
      );

      expect(result).toBeNull();
    });
  });

  describe('revertToPickingOnShipmentCancel', () => {
    const trigger: LifecycleTrigger = {
      entity: 'shipment',
      id: 'shp-1',
      action: 'cancelled',
    };

    it('should transition order to picking when lines are no longer fully shipped', async () => {
      await seedOrder(SALES_ORDER_STATE.SHIPPED);

      const SHIP_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: SHIPMENT_STATE.CANCELLED,
        createdBy: 'system',
      });

      const result = await revertToPickingOnShipmentCancel.evaluate(
        pg.db,
        ORDER_ID,
        trigger,
        'admin',
      );

      expect(result?.to).toBe(SALES_ORDER_STATE.PICKING);
    });
  });

  describe('autoInvoiceWhenFullyInvoiced', () => {
    const invoiceTrigger: LifecycleTrigger = {
      entity: 'sales_invoice',
      id: 'inv-1',
      action: 'created',
    };

    it('should transition order from confirmed to invoiced when fully billed', async () => {
      await seedOrder(SALES_ORDER_STATE.CONFIRMED);

      const INVOICE_ID = '00000000-0000-4000-8000-000000000077';
      await pg.db
        .insert(salesInvoices)
        .values(makeInvoiceValues(INVOICE_ID, 'INV-001'));
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '5',
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await autoInvoiceWhenFullyInvoiced.evaluate(
        pg.db,
        ORDER_ID,
        invoiceTrigger,
        'admin',
      );

      expect(result?.from).toBe(SALES_ORDER_STATE.CONFIRMED);
      expect(result?.to).toBe(SALES_ORDER_STATE.INVOICED);

      const [order] = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe(SALES_ORDER_STATE.INVOICED);
    });

    it('should transition order from shipped to invoiced when fully billed', async () => {
      await seedOrder(SALES_ORDER_STATE.SHIPPED);

      const INVOICE_ID = '00000000-0000-4000-8000-000000000077';
      await pg.db
        .insert(salesInvoices)
        .values(makeInvoiceValues(INVOICE_ID, 'INV-001'));
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '5',
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await autoInvoiceWhenFullyInvoiced.evaluate(
        pg.db,
        ORDER_ID,
        invoiceTrigger,
        'admin',
      );

      expect(result?.from).toBe(SALES_ORDER_STATE.SHIPPED);
      expect(result?.to).toBe(SALES_ORDER_STATE.INVOICED);
    });

    it('should do nothing if only partially invoiced', async () => {
      await seedOrder(SALES_ORDER_STATE.CONFIRMED);

      const INVOICE_ID = '00000000-0000-4000-8000-000000000077';
      await pg.db
        .insert(salesInvoices)
        .values(makeInvoiceValues(INVOICE_ID, 'INV-001'));
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '2', // Ordered 5, only 2 invoiced
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await autoInvoiceWhenFullyInvoiced.evaluate(
        pg.db,
        ORDER_ID,
        invoiceTrigger,
        'admin',
      );

      expect(result).toBeNull();
    });
  });

  describe('revertInvoicedWhenInvoiceCancelled', () => {
    const cancelTrigger: LifecycleTrigger = {
      entity: 'sales_invoice',
      id: '00000000-0000-4000-8000-000000000077',
      action: 'cancelled',
    };

    it('should revert order from invoiced to shipped when invoice is cancelled and order has shipments', async () => {
      await seedOrder(SALES_ORDER_STATE.INVOICED);

      // Create shipment records
      const SHIP_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
        createdBy: 'system',
      });
      await pg.db.insert(salesOrderShipmentLines).values([
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_1_ID,
          quantityShipped: '10',
        },
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_2_ID,
          quantityShipped: '5',
        },
      ]);

      // Create a cancelled invoice
      const INVOICE_ID = '00000000-0000-4000-8000-000000000077';
      const invValues = makeInvoiceValues(INVOICE_ID, 'INV-001');
      invValues.stateCode = SALES_INVOICE_STATE.CANCELLED;
      await pg.db.insert(salesInvoices).values(invValues);
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '5',
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await revertInvoicedWhenInvoiceCancelled.evaluate(
        pg.db,
        ORDER_ID,
        cancelTrigger,
        'admin',
      );

      expect(result?.from).toBe(SALES_ORDER_STATE.INVOICED);
      expect(result?.to).toBe(SALES_ORDER_STATE.SHIPPED);

      const [order] = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe(SALES_ORDER_STATE.SHIPPED);
    });

    it('should revert order from invoiced to confirmed when invoice is cancelled and order has no shipments', async () => {
      await seedOrder(SALES_ORDER_STATE.INVOICED);

      const INVOICE_ID = '00000000-0000-4000-8000-000000000077';
      const invValues = makeInvoiceValues(INVOICE_ID, 'INV-001');
      invValues.stateCode = SALES_INVOICE_STATE.CANCELLED;
      await pg.db.insert(salesInvoices).values(invValues);
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '5',
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await revertInvoicedWhenInvoiceCancelled.evaluate(
        pg.db,
        ORDER_ID,
        cancelTrigger,
        'admin',
      );

      expect(result?.from).toBe(SALES_ORDER_STATE.INVOICED);
      expect(result?.to).toBe(SALES_ORDER_STATE.CONFIRMED);

      const [order] = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe(SALES_ORDER_STATE.CONFIRMED);
    });

    it('should revert order from invoiced to shipped for counter sales with counter picks', async () => {
      await seedOrder(SALES_ORDER_STATE.INVOICED);

      // Create counter pick records (immediate handover pick lines)
      const PRODUCT_ID = '00000000-0000-4000-8000-000000000099';
      await pg.db.insert(products).values({
        productId: PRODUCT_ID,
        productNumber: 'PROD-01',
        name: 'Test Product',
        productType: 'inventory',
        structureType: 'standard',
        baseUom: 'EA',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      });
      await pg.db.insert(salesOrderPicks).values([
        {
          salesOrderId: ORDER_ID,
          salesOrderLineId: LINE_1_ID,
          productId: PRODUCT_ID,
          quantity: '10',
          stateCode: SALES_ORDER_PICK_STATE.SHIPPED,
          createdBy: 'system',
        },
        {
          salesOrderId: ORDER_ID,
          salesOrderLineId: LINE_2_ID,
          productId: PRODUCT_ID,
          quantity: '5',
          stateCode: SALES_ORDER_PICK_STATE.SHIPPED,
          createdBy: 'system',
        },
      ]);

      // Create a cancelled invoice
      const INVOICE_ID = '00000000-0000-4000-8000-000000000077';
      const invValues = makeInvoiceValues(INVOICE_ID, 'INV-001');
      invValues.stateCode = SALES_INVOICE_STATE.CANCELLED;
      await pg.db.insert(salesInvoices).values(invValues);
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: INVOICE_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '5',
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await revertInvoicedWhenInvoiceCancelled.evaluate(
        pg.db,
        ORDER_ID,
        cancelTrigger,
        'admin',
      );

      expect(result?.from).toBe(SALES_ORDER_STATE.INVOICED);
      expect(result?.to).toBe(SALES_ORDER_STATE.SHIPPED);

      const [order] = await pg.db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe(SALES_ORDER_STATE.SHIPPED);
    });

    it('should not revert order if remaining active invoices still fully cover the lines', async () => {
      await seedOrder(SALES_ORDER_STATE.INVOICED);

      // Cancelled invoice
      const CANCELLED_INV_ID = '00000000-0000-4000-8000-000000000077';
      const invValues = makeInvoiceValues(CANCELLED_INV_ID, 'INV-001');
      invValues.stateCode = SALES_INVOICE_STATE.CANCELLED;
      await pg.db.insert(salesInvoices).values(invValues);

      // Active invoice covering the order
      const ACTIVE_INV_ID = '00000000-0000-4000-8000-000000000088';
      await pg.db
        .insert(salesInvoices)
        .values(makeInvoiceValues(ACTIVE_INV_ID, 'INV-002'));
      await pg.db.insert(salesInvoiceLines).values([
        {
          invoiceId: ACTIVE_INV_ID,
          salesOrderLineId: LINE_1_ID,
          quantityInvoiced: '10',
          pricePerUnit: '0',
          amount: '0',
        },
        {
          invoiceId: ACTIVE_INV_ID,
          salesOrderLineId: LINE_2_ID,
          quantityInvoiced: '5',
          pricePerUnit: '0',
          amount: '0',
        },
      ]);

      const result = await revertInvoicedWhenInvoiceCancelled.evaluate(
        pg.db,
        ORDER_ID,
        cancelTrigger,
        'admin',
      );

      expect(result).toBeNull();
    });
  });

  describe('evaluateLifecycleRules', () => {
    it('should run rules and return transitions', async () => {
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-4000-8000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
        createdBy: 'system',
      });
      await pg.db.insert(salesOrderShipmentLines).values([
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_1_ID,
          quantityShipped: '10',
        },
        {
          shipmentId: SHIP_ID,
          salesOrderLineId: LINE_2_ID,
          quantityShipped: '5',
        },
      ]);

      const transitions = await evaluateLifecycleRules(
        pg.db,
        ORDER_ID,
        { entity: 'shipment', id: SHIP_ID, action: 'dispatched' },
        'admin',
      );

      expect(transitions).toHaveLength(1);
    });
  });
});
