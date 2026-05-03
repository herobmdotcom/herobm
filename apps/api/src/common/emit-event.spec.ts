import { emitEvent, EmitEventParams } from './emit-event';
import { AggregateType, EventType, OUTBOX_EVENT_TYPES } from './event-types';

// ---------------------------------------------------------------------------
// Mock DB transaction — tracks all insert calls for assertion
// ---------------------------------------------------------------------------

interface InsertCall {
  table: any;
  values: any;
}

function createMockTx() {
  const calls: InsertCall[] = [];

  const tx = {
    insert: (table: any) => ({
      values: (vals: any) => {
        calls.push({ table, values: vals });
        return Promise.resolve();
      },
    }),
  };

  return { tx, calls };
}

function createFailingTx(failOnTable?: any) {
  const tx = {
    insert: (table: any) => ({
      values: (_vals: any) => {
        if (!failOnTable || table === failOnTable) {
          return Promise.reject(new Error('DB_INSERT_FAILED'));
        }
        return Promise.resolve();
      },
    }),
  };

  return tx;
}

// ---------------------------------------------------------------------------
// Import tables for assertion matching
// ---------------------------------------------------------------------------

import {
  orderEvents,
  purchaseOrderEvents,
  productEvents,
  accountEvents,
  supplierEvents,
  productSupplierEvents,
  systemEvents,
  outbox,
} from '../drizzle/modbm-core-schema';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emitEvent', () => {
  // ── 1. Routing correctness ────────────────────────────────────────────

  describe('routing correctness', () => {
    it('should route sales_order events to orderEvents with salesOrderId FK', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: 'so-001',
        eventType: EventType.CREATED,
        payload: { orderNumber: 'ORD-001' },
        actor: 'admin',
      });

      expect(calls[0].table).toBe(orderEvents);
      expect(calls[0].values).toEqual({
        salesOrderId: 'so-001',
        eventType: 'created',
        payload: { orderNumber: 'ORD-001' },
        actor: 'admin',
      });
    });

    it('should route purchase_order events to purchaseOrderEvents with purchaseOrderId FK', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: 'po-001',
        eventType: EventType.STOCK_RECEIVED,
        payload: { receptionId: 'r-001' },
        actor: 'warehouse',
      });

      expect(calls[0].table).toBe(purchaseOrderEvents);
      expect(calls[0].values.purchaseOrderId).toBe('po-001');
    });

    it('should route product events to productEvents with productId FK', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.PRODUCT,
        aggregateId: 'prod-001',
        eventType: EventType.CREATED,
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(productEvents);
      expect(calls[0].values.productId).toBe('prod-001');
    });

    it('should route account events to accountEvents with accountId FK', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.ACCOUNT,
        aggregateId: 'acc-001',
        eventType: EventType.UPDATED,
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(accountEvents);
      expect(calls[0].values.accountId).toBe('acc-001');
    });

    it('should route supplier events to supplierEvents with vendorId FK', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.SUPPLIER,
        aggregateId: 'sup-001',
        eventType: EventType.ARCHIVED,
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(supplierEvents);
      expect(calls[0].values.vendorId).toBe('sup-001');
    });

    it('should route product_supplier events to productSupplierEvents with productSupplierId FK', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.PRODUCT_SUPPLIER,
        aggregateId: 'ps-001',
        eventType: EventType.LINKED,
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(productSupplierEvents);
      expect(calls[0].values.productSupplierId).toBe('ps-001');
    });
  });

  // ── 2. System events routing ──────────────────────────────────────────

  describe('system events routing', () => {
    it('should route system events to systemEvents with aggregateType + aggregateId', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: 'je-001',
        eventType: EventType.GL_POSTED,
        payload: { entryNumber: 'JE-001' },
        actor: 'system',
      });

      expect(calls[0].table).toBe(systemEvents);
      expect(calls[0].values.aggregateType).toBe('system');
      expect(calls[0].values.aggregateId).toBe('je-001');
      expect(calls[0].values.eventType).toBe('gl_posted');
    });
  });

  // ── 3. Outbox gating ─────────────────────────────────────────────────

  describe('outbox gating', () => {
    it('should write to BOTH audit table AND outbox for integration events', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: 'so-001',
        eventType: EventType.STOCK_DISPATCHED,
        payload: { shipmentId: 'sh-001' },
        actor: 'warehouse',
      });

      // Two inserts: audit + outbox
      expect(calls).toHaveLength(2);
      expect(calls[0].table).toBe(orderEvents);
      expect(calls[1].table).toBe(outbox);
      expect(calls[1].values).toEqual({
        aggregateType: 'sales_order',
        aggregateId: 'so-001',
        eventType: 'stock_dispatched',
        payload: { shipmentId: 'sh-001' },
      });
    });

    it('should write to audit table ONLY for non-integration events', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: 'so-001',
        eventType: EventType.CREATED,
        payload: {},
        actor: 'admin',
      });

      // Only one insert: audit
      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe(orderEvents);
    });

    it('should have consistent gating for all declared integration event types', () => {
      // Sanity check: all OUTBOX_EVENT_TYPES should map to valid EventType values
      const allEventTypeValues = new Set(Object.values(EventType) as string[]);

      for (const outboxType of OUTBOX_EVENT_TYPES) {
        expect(allEventTypeValues.has(outboxType)).toBe(true);
      }
    });
  });

  // ── 4. Failure propagation (CRITICAL) ─────────────────────────────────

  describe('failure propagation', () => {
    it('should NOT swallow audit insert errors — they must propagate', async () => {
      const tx = createFailingTx(orderEvents);

      await expect(
        emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: 'so-001',
          eventType: EventType.CREATED,
          payload: {},
          actor: 'admin',
        }),
      ).rejects.toThrow('DB_INSERT_FAILED');
    });

    it('should NOT swallow outbox insert errors — they must propagate', async () => {
      const tx = createFailingTx(outbox);

      await expect(
        emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: 'so-001',
          eventType: EventType.STOCK_DISPATCHED, // in OUTBOX_EVENT_TYPES
          payload: {},
          actor: 'admin',
        }),
      ).rejects.toThrow('DB_INSERT_FAILED');
    });

    it('should NOT swallow system events insert errors', async () => {
      const tx = createFailingTx(systemEvents);

      await expect(
        emitEvent(tx, {
          aggregateType: AggregateType.SYSTEM,
          aggregateId: 'je-001',
          eventType: EventType.GL_POSTED,
          payload: {},
          actor: 'system',
        }),
      ).rejects.toThrow('DB_INSERT_FAILED');
    });
  });

  // ── 5. Unknown aggregate type ─────────────────────────────────────────

  describe('unknown aggregate type', () => {
    it('should throw a clear error for unrecognized aggregate types', async () => {
      const { tx } = createMockTx();

      await expect(
        emitEvent(tx, {
          aggregateType: 'unknown_entity' as any,
          aggregateId: 'id-001',
          eventType: 'created',
          payload: {},
        }),
      ).rejects.toThrow("emitEvent: unknown aggregateType 'unknown_entity'");
    });
  });
});
