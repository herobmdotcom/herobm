import { eq, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesInvoices,
  salesInvoiceLines,
} from '../drizzle/modbm-core-schema';
import { findOrder, getCommittedPerLine } from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import {
  SALES_ORDER_STATE,
  SHIPMENT_STATE,
  SALES_INVOICE_STATE,
} from '@modbm/shared';

export interface LifecycleTrigger {
  entity: 'shipment' | 'sales_invoice' | 'picking';
  id: string;
  action: string;
}

export interface AutoTransitionResult {
  ruleName: string;
  from: string;
  to: string;
  reason: string;
}

export interface LifecycleRule {
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (
    db: DrizzleDB,
    salesOrderId: string,
    trigger: LifecycleTrigger,
    actor: string,
  ) => Promise<AutoTransitionResult | null>;
}

// ============================================================================
// Rules
// ============================================================================

export const autoShipWhenFullyShipped: LifecycleRule = {
  name: 'auto-ship-when-fully-shipped',
  description:
    'Transitions an order from picking to shipped when all lines are fully shipped',
  enabled: true,
  evaluate: async (db, salesOrderId, trigger, actor) => {
    // 1. Only applies if triggered by a shipment dispatch
    if (
      trigger.entity !== 'shipment' ||
      trigger.action !== SHIPMENT_STATE.DISPATCHED
    )
      return null;

    // 2. Order must be in 'picking'
    const order = await findOrder(db, salesOrderId);
    if (order.stateCode !== SALES_ORDER_STATE.PICKING) return null;

    // 3. Get all lines and shipped quantities
    const lines = await db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        quantity: salesOrderLineItems.quantity,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    if (lines.length === 0) return null;

    const committedMap = await getCommittedPerLine(db, salesOrderId);

    // 4. Check if fully shipped
    const isFullyShipped = lines.every((line) => {
      const ordered = parseFloat(line.quantity);
      const committed = committedMap.get(line.salesOrderLineId) ?? 0;
      return committed >= ordered;
    });

    if (!isFullyShipped) return null;

    // 5. Execute transition
    await db
      .update(salesOrders)
      .set({ stateCode: SALES_ORDER_STATE.SHIPPED, modifiedOn: new Date() })
      .where(eq(salesOrders.salesOrderId, salesOrderId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.SALES_ORDER,
      aggregateId: salesOrderId,
      eventType: 'auto_status_changed',
      payload: {
        rule: 'auto-ship-when-fully-shipped',
        trigger,
        from: SALES_ORDER_STATE.PICKING,
        to: SALES_ORDER_STATE.SHIPPED,
        reason: 'All lines fully shipped',
      },
      actor,
    });

    return {
      ruleName: 'auto-ship-when-fully-shipped',
      from: SALES_ORDER_STATE.PICKING,
      to: SALES_ORDER_STATE.SHIPPED,
      reason: 'All lines fully shipped',
    };
  },
};

export const revertToPickingOnShipmentCancel: LifecycleRule = {
  name: 'revert-to-picking-on-shipment-cancel',
  description:
    'Transitions an order from shipped back to picking if a shipment is cancelled/reverted, causing it to no longer be fully shipped',
  enabled: true,
  evaluate: async (db, salesOrderId, trigger, actor) => {
    // 1. Only applies if a shipment was cancelled or reverted to draft
    if (
      trigger.entity !== AggregateType.SHIPMENT ||
      ![SHIPMENT_STATE.CANCELLED, SHIPMENT_STATE.DRAFT].includes(
        trigger.action as any,
      )
    ) {
      return null;
    }

    // 2. Order must NOT be picking already
    const order = await findOrder(db, salesOrderId);
    if (order.stateCode === SALES_ORDER_STATE.PICKING) return null;

    // 3. Get all lines and shipped quantities
    const lines = await db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        quantity: salesOrderLineItems.quantity,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    if (lines.length === 0) return null;

    const committedMap = await getCommittedPerLine(db, salesOrderId);

    // 4. Check if NO LONGER fully shipped
    const isFullyShipped = lines.every((line) => {
      const ordered = parseFloat(line.quantity);
      const committed = committedMap.get(line.salesOrderLineId) ?? 0;
      return committed >= ordered;
    });

    if (isFullyShipped) return null;

    // 5. Execute transition
    await db
      .update(salesOrders)
      .set({ stateCode: SALES_ORDER_STATE.PICKING, modifiedOn: new Date() })
      .where(eq(salesOrders.salesOrderId, salesOrderId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.SALES_ORDER,
      aggregateId: salesOrderId,
      eventType: 'auto_status_changed',
      payload: {
        rule: 'revert-to-picking-on-shipment-cancel',
        trigger,
        from: SALES_ORDER_STATE.SHIPPED,
        to: SALES_ORDER_STATE.PICKING,
        reason: `Shipment ${trigger.action === SHIPMENT_STATE.DRAFT ? 'reverted to draft' : trigger.action}, order no longer fully shipped`,
      },
      actor,
    });

    return {
      ruleName: 'revert-to-picking-on-shipment-cancel',
      from: SALES_ORDER_STATE.SHIPPED,
      to: SALES_ORDER_STATE.PICKING,
      reason: 'Order no longer fully shipped',
    };
  },
};

export const autoInvoiceWhenFullyInvoiced: LifecycleRule = {
  name: 'auto-invoice-when-fully-invoiced',
  description:
    'Transitions an order to invoiced when all lines have been fully billed',
  enabled: true,
  evaluate: async (db, salesOrderId, trigger, actor) => {
    // 1. Only applies if triggered by an invoice creation
    if (trigger.entity !== 'sales_invoice' || trigger.action !== 'created')
      return null;

    const order = await findOrder(db, salesOrderId);
    if (
      order.stateCode === SALES_ORDER_STATE.INVOICED ||
      order.stateCode === SALES_ORDER_STATE.CANCELLED
    )
      return null;

    // 2. Get all lines and ordered quantities
    const lines = await db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        quantity: salesOrderLineItems.quantity,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    if (lines.length === 0) return null;

    let isFullyInvoiced = true;
    for (const line of lines) {
      const [{ totalInvoiced }] = await db
        .select({
          totalInvoiced:
            sql<string>`COALESCE(SUM(CAST(${salesInvoiceLines.quantityInvoiced} AS NUMERIC)), 0)::text` as any,
        })
        .from(salesInvoiceLines)
        .innerJoin(
          salesInvoices,
          eq(salesInvoiceLines.invoiceId, salesInvoices.invoiceId),
        )
        .where(eq(salesInvoiceLines.salesOrderLineId, line.salesOrderLineId));

      const invoiced = parseFloat(totalInvoiced || '0');
      const ordered = parseFloat(line.quantity || '0');

      if (invoiced < ordered - 0.001) {
        isFullyInvoiced = false;
        break;
      }
    }

    if (!isFullyInvoiced) return null;

    // 4. Execute transition
    await db
      .update(salesOrders)
      .set({ stateCode: SALES_ORDER_STATE.INVOICED, modifiedOn: new Date() })
      .where(eq(salesOrders.salesOrderId, salesOrderId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.SALES_ORDER,
      aggregateId: salesOrderId,
      eventType: 'auto_status_changed',
      payload: {
        rule: 'auto-invoice-when-fully-invoiced',
        trigger,
        from: SALES_ORDER_STATE.SHIPPED,
        to: SALES_ORDER_STATE.INVOICED,
        reason: 'All lines fully invoiced',
      },
      actor,
    });

    return {
      ruleName: 'auto-invoice-when-fully-invoiced',
      from: SALES_ORDER_STATE.SHIPPED,
      to: SALES_ORDER_STATE.INVOICED,
      reason: 'All lines fully invoiced',
    };
  },
};

const LIFECYCLE_RULES: LifecycleRule[] = [
  autoShipWhenFullyShipped,
  revertToPickingOnShipmentCancel,
  autoInvoiceWhenFullyInvoiced,
];

/**
 * Evaluate all enabled lifecycle rules against the current state.
 * Returns information about any automatic transitions that occurred.
 *
 * Designed to be called inside the same transaction as the triggering action.
 */
export async function evaluateLifecycleRules(
  db: DrizzleDB,
  salesOrderId: string,
  trigger: LifecycleTrigger,
  actor: string,
): Promise<AutoTransitionResult[]> {
  const transitions: AutoTransitionResult[] = [];

  for (const rule of LIFECYCLE_RULES) {
    if (!rule.enabled) continue;

    const result = await rule.evaluate(db, salesOrderId, trigger, actor);
    if (result) {
      transitions.push(result);
      // We only execute one rule at a time to prevent conflicting state changes.
      // E.g. if a rule changes state from A->B, we don't want another rule to
      // immediately fire and change B->C in the same pass.
      break;
    }
  }

  return transitions;
}
