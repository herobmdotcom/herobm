import {
  autoShipWhenFullyShipped,
  revertToPickingOnShipmentCancel,
  evaluateLifecycleRules,
  LifecycleTrigger,
} from './order-lifecycle-rules';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderShipments,
  salesOrderShipmentLines,
  locations,
  taxCategories,
  orderEvents,
  outbox,
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { SALES_ORDER_STATE, SHIPMENT_STATE } from '@modbm/shared';

// Mock emitEvent to avoid needing event emitter setup
jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

import { emitEvent } from '../common/emit-event';

describe('Order Lifecycle Rules', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });

  const ORDER_ID = '00000000-0000-0000-0000-000000000001';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LINE_1_ID = '00000000-0000-0000-0000-000000000011';
  const LINE_2_ID = '00000000-0000-0000-0000-000000000012';

  beforeEach(async () => {
    // Clean data
    await pg.db.delete(orderEvents);
    await pg.db.delete(outbox);
    await pg.db.delete(salesOrderShipmentLines);
    await pg.db.delete(salesOrderShipments);
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(locations);
    await pg.db.delete(taxCategories);

    await pg.db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
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

  async function seedOrder(state: any) {
    await pg.db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      stateCode: state,
      fulfillmentLocationId: LOCATION_ID,
      currencyCode: 'AUD',
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
      },
      {
        salesOrderLineId: LINE_2_ID,
        salesOrderId: ORDER_ID,
        lineNumber: 2,
        quantity: '5',
        pricePerUnit: '0',
        fulfillmentLocationId: LOCATION_ID,
        taxCategoryId: TAX_CAT_ID,
      },
    ]);
  }

  describe('autoShipWhenFullyShipped', () => {
    const trigger: LifecycleTrigger = {
      entity: 'shipment',
      id: 'shp-1',
      action: 'dispatched',
    };

    it('should transition order to shipped when all lines are fully shipped', async () => {
      await seedOrder(SALES_ORDER_STATE.PICKING);

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: SHIPMENT_STATE.DISPATCHED,
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

    it('should do nothing if an order line is only partially shipped', async () => {
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
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

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: SHIPMENT_STATE.CANCELLED,
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

  describe('evaluateLifecycleRules', () => {
    it('should run rules and return transitions', async () => {
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await pg.db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
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
