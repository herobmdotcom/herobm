import {
  autoShipWhenFullyShipped,
  revertToPickingOnShipmentCancel,
  evaluateLifecycleRules,
  LifecycleTrigger,
} from './order-lifecycle-rules';
import { createMemoryDb } from '../../test/utils/memory-db';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderShipments,
  salesOrderShipmentLines,
  locations,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

// Mock emitEvent to avoid needing event emitter setup
jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

import { emitEvent } from '../common/emit-event';

describe('Order Lifecycle Rules', () => {
  let db: PgliteDatabase<any>;

  const ORDER_ID = '00000000-0000-0000-0000-000000000001';
  const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
  const TAX_CAT_ID = '00000000-0000-0000-0000-000000000007';
  const LINE_1_ID = '00000000-0000-0000-0000-000000000011';
  const LINE_2_ID = '00000000-0000-0000-0000-000000000012';

  beforeEach(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;

    await db.insert(locations).values({
      locationId: LOCATION_ID,
      code: 'MAIN',
      name: 'Main',
    });

    await db.insert(taxCategories).values({
      taxCategoryId: TAX_CAT_ID,
      code: 'GST',
      title: 'GST',
      rate: '0.1',
      type: 'tax_applies',
    });

    jest.clearAllMocks();
  });

  async function seedOrder(state: any) {
    await db.insert(salesOrders).values({
      salesOrderId: ORDER_ID,
      orderNumber: 'ORD-001',
      stateCode: state,
      fulfillmentLocationId: LOCATION_ID,
      currencyCode: 'AUD',
    });
    await db.insert(salesOrderLineItems).values([
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
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
      });
      await db.insert(salesOrderShipmentLines).values([
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
        db,
        ORDER_ID,
        trigger,
        'admin',
      );

      expect(result?.to).toBe('shipped');
      const [order] = await db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ORDER_ID));
      expect(order.stateCode).toBe('shipped');
    });

    it('should do nothing if an order line is only partially shipped', async () => {
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
      });
      await db.insert(salesOrderShipmentLines).values([
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
        db,
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
      await seedOrder('shipped');

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'cancelled',
      });

      const result = await revertToPickingOnShipmentCancel.evaluate(
        db,
        ORDER_ID,
        trigger,
        'admin',
      );

      expect(result?.to).toBe('picking');
    });
  });

  describe('evaluateLifecycleRules', () => {
    it('should run rules and return transitions', async () => {
      await seedOrder('picking');

      const SHIP_ID = '00000000-0000-0000-0000-000000000055';
      await db.insert(salesOrderShipments).values({
        shipmentId: SHIP_ID,
        salesOrderId: ORDER_ID,
        shipmentNumber: 'SHP-001',
        stateCode: 'dispatched',
      });
      await db.insert(salesOrderShipmentLines).values([
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
        db,
        ORDER_ID,
        { entity: 'shipment', id: SHIP_ID, action: 'dispatched' },
        'admin',
      );

      expect(transitions).toHaveLength(1);
    });
  });
});
