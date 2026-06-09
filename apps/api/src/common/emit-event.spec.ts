import { emitEvent, EmitEventParams } from './emit-event';
import { EntityType, EventType, OUTBOX_EVENT_TYPES } from './event-types';

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
  salesEvents,
  procurementEvents,
  masterDataEvents,
  systemEvents,
  warehouseEvents,
  financialEvents,
  inventoryEvents,
  outbox,
} from '../drizzle/modbm-core-schema';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emitEvent', () => {
  // ── 1. Routing correctness ────────────────────────────────────────────

  describe('routing correctness', () => {
    it('should route sales_order events to salesEvents', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: 'so-001',
        eventType: EventType.CREATED,
        entityDisplayName: 'Test Entity',
        payload: { orderNumber: 'ORD-001' },
        actor: 'admin',
      });

      expect(calls[0].table).toBe(salesEvents);
      expect(calls[0].values).toEqual({
        entityType: EntityType.SALES_ORDER,
        entityId: 'so-001',
        eventType: 'created',
        entityDisplayName: 'Test Entity',
        payload: { orderNumber: 'ORD-001' },
        actor: 'admin',
      });
    });

    it('should route purchase_order events to procurementEvents', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: 'po-001',
        eventType: EventType.CREATED,
        entityDisplayName: 'Test Entity',
        payload: { receptionId: 'r-001' },
        actor: 'warehouse',
      });

      expect(calls[0].table).toBe(procurementEvents);
      expect(calls[0].values.entityId).toBe('po-001');
    });

    it('should route product events to masterDataEvents', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: 'prod-001',
        eventType: EventType.CREATED,
        entityDisplayName: 'Test Entity',
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(masterDataEvents);
      expect(calls[0].values.entityId).toBe('prod-001');
    });

    it('should route customer events to masterDataEvents', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.CUSTOMER,
        entityId: 'acc-001',
        eventType: EventType.UPDATED,
        entityDisplayName: 'Test Entity',
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(masterDataEvents);
      expect(calls[0].values.entityId).toBe('acc-001');
    });

    it('should route supplier events to masterDataEvents', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.SUPPLIER,
        entityId: 'sup-001',
        eventType: EventType.ARCHIVED,
        entityDisplayName: 'Test Entity',
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(masterDataEvents);
      expect(calls[0].values.entityId).toBe('sup-001');
    });

    it('should route product_supplier events to masterDataEvents', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.PRODUCT_SUPPLIER,
        entityId: 'ps-001',
        eventType: EventType.LINKED,
        entityDisplayName: 'Test Entity',
        payload: {},
        actor: 'admin',
      });

      expect(calls[0].table).toBe(masterDataEvents);
      expect(calls[0].values.entityId).toBe('ps-001');
    });
  });

  // ── 2. System events routing ──────────────────────────────────────────

  describe('system events routing', () => {
    it('should route system events to financialEvents for gl_posted', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.SYSTEM,
        entityId: 'je-001',
        eventType: EventType.GL_POSTED,
        entityDisplayName: 'Test Entity',
        payload: { entryNumber: 'JE-001' },
        actor: 'system',
      });

      expect(calls[0].table).toBe(financialEvents);
      expect(calls[0].values.entityType).toBe('system');
      expect(calls[0].values.entityId).toBe('je-001');
      expect(calls[0].values.eventType).toBe('gl_posted');
    });
  });

  // ── 3. Outbox gating ─────────────────────────────────────────────────

  describe('outbox gating', () => {
    it('should write to BOTH audit table AND outbox for integration events', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: 'so-001',
        eventType: EventType.CREATED,
        entityDisplayName: 'Test Entity',
        payload: { orderNumber: 'ORD-001' },
        actor: 'admin',
      });

      // Two inserts: audit + outbox
      expect(calls).toHaveLength(2);
      expect(calls[0].table).toBe(salesEvents);
      expect(calls[1].table).toBe(outbox);
      expect(calls[1].values).toEqual({
        entityType: 'sales_order',
        entityId: 'so-001',
        eventType: 'sales_order.created',
        entityDisplayName: 'Test Entity',
        payload: { orderNumber: 'ORD-001' },
      });
    });

    it('should write to audit table ONLY for non-integration events', async () => {
      const { tx, calls } = createMockTx();
      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: 'so-001',
        eventType: EventType.LINE_ADDED,
        entityDisplayName: 'Test Entity',
        payload: {},
        actor: 'admin',
      });

      // Only one insert: audit
      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe(salesEvents);
    });

    it('should have consistent gating for all declared integration event types', () => {
      // Sanity check: all OUTBOX_EVENT_TYPES should be fully qualified entity.action strings
      for (const outboxType of OUTBOX_EVENT_TYPES) {
        expect(outboxType).toMatch(/^[a-z_]+\.[a-z_]+$/);
      }
    });
  });

  // ── 4. Failure propagation (CRITICAL) ─────────────────────────────────

  describe('failure propagation', () => {
    it('should NOT swallow audit insert errors — they must propagate', async () => {
      const tx = createFailingTx(salesEvents);

      await expect(
        emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: 'so-001',
          eventType: EventType.CREATED,
          entityDisplayName: 'Test Entity',
          payload: {},
          actor: 'admin',
        }),
      ).rejects.toThrow('DB_INSERT_FAILED');
    });

    it('should NOT swallow outbox insert errors — they must propagate', async () => {
      const tx = createFailingTx(outbox);

      await expect(
        emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: 'so-001',
          eventType: EventType.CREATED, // in OUTBOX_EVENT_TYPES
          entityDisplayName: 'Test Entity',
          payload: {},
          actor: 'admin',
        }),
      ).rejects.toThrow('DB_INSERT_FAILED');
    });

    it('should NOT swallow system events insert errors', async () => {
      const tx = createFailingTx(financialEvents);

      await expect(
        emitEvent(tx, {
          entityType: EntityType.SYSTEM,
          entityId: 'je-001',
          eventType: EventType.GL_POSTED,
          entityDisplayName: 'Test Entity',
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
          entityType: 'unknown_entity' as any,
          entityId: 'id-001',
          eventType: 'created',
          entityDisplayName: 'Test Entity',
          payload: {},
        }),
      ).rejects.toThrow("emitEvent: unknown entityType 'unknown_entity'");
    });
  });
});
