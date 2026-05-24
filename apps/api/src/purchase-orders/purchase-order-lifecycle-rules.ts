import { eq, inArray, and, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseInvoices,
  purchaseInvoiceLines,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { PURCHASE_ORDER_STATE } from '@modbm/shared';

export interface POLifecycleTrigger {
  entity: 'goods_receipt' | 'purchase_invoice' | 'purchase_return';
  action: 'created' | 'posted' | 'cancelled' | 'shipped';
  id?: string;
}

export interface POAutoTransitionResult {
  ruleName: string;
  from: string;
  to: string;
  reason: string;
}

export interface POLifecycleRule {
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (
    db: DrizzleDB,
    purchaseOrderId: string,
    trigger: POLifecycleTrigger,
    actor: string,
  ) => Promise<POAutoTransitionResult | null>;
}

// ============================================================================
// Rules
// ============================================================================

export const autoReceiveWhenFullyReceived: POLifecycleRule = {
  name: 'auto-receive-when-fully-received',
  description:
    'Transitions a PO from ordered/partially_received to received when all lines are fully received',
  enabled: true,
  evaluate: async (db, poId, trigger, actor) => {
    if (
      trigger.entity !== 'goods_receipt' ||
      trigger.action !== EventType.CREATED
    )
      return null;

    const [order] = await db
      .select({ stateCode: purchaseOrders.stateCode })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (
      !order ||
      ![
        PURCHASE_ORDER_STATE.ORDERED,
        PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
        PURCHASE_ORDER_STATE.DRAFT,
      ].includes(order.stateCode as any)
    )
      return null;

    const lines = await db
      .select({
        quantity: purchaseOrderLineItems.quantity,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
      })
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

    if (lines.length === 0) return null;

    const isFullyReceived = lines.every((line) => {
      const ordered = parseFloat(line.quantity || '0');
      const received = parseFloat(line.quantityReceived || '0');
      return received >= ordered;
    });

    if (!isFullyReceived) return null;

    // Execute transition
    await db
      .update(purchaseOrders)
      .set({ stateCode: PURCHASE_ORDER_STATE.RECEIVED, modifiedOn: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        rule: 'auto-receive-when-fully-received',
        trigger,
        from: order.stateCode,
        to: PURCHASE_ORDER_STATE.RECEIVED,
        reason: 'All lines fully received',
      },
      actor,
    });

    return {
      ruleName: 'auto-receive-when-fully-received',
      from: order.stateCode,
      to: PURCHASE_ORDER_STATE.RECEIVED,
      reason: 'All lines fully received',
    };
  },
};

export const autoPartiallyReceiveWhenSomeReceived: POLifecycleRule = {
  name: 'auto-partially-receive-when-some-received',
  description:
    'Transitions a PO from ordered/draft to partially_received when some lines are received',
  enabled: true,
  evaluate: async (db, poId, trigger, actor) => {
    if (
      trigger.entity !== 'goods_receipt' ||
      trigger.action !== EventType.CREATED
    )
      return null;

    const [order] = await db
      .select({ stateCode: purchaseOrders.stateCode })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (
      !order ||
      ![PURCHASE_ORDER_STATE.ORDERED, PURCHASE_ORDER_STATE.DRAFT].includes(
        order.stateCode as any,
      )
    )
      return null;

    const lines = await db
      .select({
        quantity: purchaseOrderLineItems.quantity,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
      })
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

    if (lines.length === 0) return null;

    const isFullyReceived = lines.every((line) => {
      const ordered = parseFloat(line.quantity || '0');
      const received = parseFloat(line.quantityReceived || '0');
      return received >= ordered;
    });

    if (isFullyReceived) return null; // handled by autoReceiveWhenFullyReceived

    const isPartiallyReceived = lines.some(
      (line) => parseFloat(line.quantityReceived || '0') > 0,
    );

    if (!isPartiallyReceived) return null;

    // Execute transition
    await db
      .update(purchaseOrders)
      .set({
        stateCode: PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        rule: 'auto-partially-receive-when-some-received',
        trigger,
        from: order.stateCode,
        to: PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
        reason: 'Some lines received',
      },
      actor,
    });

    return {
      ruleName: 'auto-partially-receive-when-some-received',
      from: order.stateCode,
      to: PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
      reason: 'Some lines received',
    };
  },
};

export const autoInvoiceWhenFullyInvoicedAndReceived: POLifecycleRule = {
  name: 'auto-invoice-when-fully-invoiced-and-received',
  description:
    'Transitions a PO to invoiced when all lines are fully billed and fully received',
  enabled: true,
  evaluate: async (db, poId, trigger, actor) => {
    // 1. Applies if triggered by invoice posting or goods receipt
    if (!['goods_receipt', 'purchase_invoice'].includes(trigger.entity))
      return null;

    const [order] = await db
      .select({ stateCode: purchaseOrders.stateCode })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (
      !order ||
      [
        PURCHASE_ORDER_STATE.INVOICED,
        PURCHASE_ORDER_STATE.CANCELLED,
        PURCHASE_ORDER_STATE.CLOSED_SHORT,
      ].includes(order.stateCode as any)
    )
      return null;

    // 2. Get all lines, ordered, and received quantities
    const lines = await db
      .select({
        poLineId: purchaseOrderLineItems.purchaseOrderLineId,
        quantity: purchaseOrderLineItems.quantity,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
      })
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

    if (lines.length === 0) return null;

    const isFullyReceived = lines.every((line) => {
      const ordered = parseFloat(line.quantity || '0');
      const received = parseFloat(line.quantityReceived || '0');
      return received >= ordered;
    });

    if (!isFullyReceived) return null; // Cannot be invoiced if not fully received

    // 3. Get invoiced quantities

    let isFullyInvoiced = true;
    for (const line of lines) {
      // We only sum invoiced quantities from 'invoiced' AP bills
      // If an invoice is posted, it's 'invoiced'. We only count posted invoices.

      const [{ totalPostedInvoiced }] = await db
        .select({
          totalPostedInvoiced:
            sql<string>`COALESCE(SUM(CAST(${purchaseInvoiceLines.quantityInvoiced} AS NUMERIC)), 0)::text` as any,
        })
        .from(purchaseInvoiceLines)
        .innerJoin(
          purchaseInvoices,
          eq(purchaseInvoiceLines.invoiceId, purchaseInvoices.invoiceId),
        )
        .where(
          and(
            eq(purchaseInvoiceLines.purchaseOrderLineId, line.poLineId),
            eq(purchaseInvoices.stateCode, PURCHASE_ORDER_STATE.INVOICED),
          ),
        );

      const invoiced = parseFloat(totalPostedInvoiced || '0');
      const ordered = parseFloat(line.quantity || '0');

      if (invoiced < ordered - 0.001) {
        isFullyInvoiced = false;
        break;
      }
    }

    if (!isFullyInvoiced) return null;

    // 4. Execute transition
    await db
      .update(purchaseOrders)
      .set({ stateCode: PURCHASE_ORDER_STATE.INVOICED, modifiedOn: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        rule: 'auto-invoice-when-fully-invoiced-and-received',
        trigger,
        from: order.stateCode,
        to: PURCHASE_ORDER_STATE.INVOICED,
        reason: 'All lines fully invoiced and received',
      },
      actor,
    });

    return {
      ruleName: 'auto-invoice-when-fully-invoiced-and-received',
      from: order.stateCode,
      to: PURCHASE_ORDER_STATE.INVOICED,
      reason: 'All lines fully invoiced and received',
    };
  },
};

export const autoRevertToPartiallyReceivedOnReturn: POLifecycleRule = {
  name: 'auto-revert-to-partially-received-on-return',
  description:
    'Transitions a PO from received to partially_received or ordered when a return shipment drops total received quantity below ordered quantity',
  enabled: true,
  evaluate: async (db, poId, trigger, actor) => {
    if (trigger.entity !== 'purchase_return' || trigger.action !== 'shipped')
      return null;

    const [order] = await db
      .select({ stateCode: purchaseOrders.stateCode })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (
      !order ||
      ![
        PURCHASE_ORDER_STATE.RECEIVED,
        PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED,
        PURCHASE_ORDER_STATE.INVOICED, // maybe? But if invoiced, we probably have a debit note process
      ].includes(order.stateCode as any)
    )
      return null;

    const lines = await db
      .select({
        quantity: purchaseOrderLineItems.quantity,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
      })
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

    if (lines.length === 0) return null;

    let hasAnyReceipts = false;
    let isFullyReceived = true;

    for (const line of lines) {
      const ordered = parseFloat(line.quantity || '0');
      const received = parseFloat(line.quantityReceived || '0');

      if (received > 0) hasAnyReceipts = true;
      if (received < ordered) isFullyReceived = false;
    }

    let newState: string | null = null;
    let reason = '';

    if (!hasAnyReceipts && order.stateCode !== PURCHASE_ORDER_STATE.ORDERED) {
      newState = PURCHASE_ORDER_STATE.ORDERED;
      reason = 'All receipts were returned (0 received)';
    } else if (
      !isFullyReceived &&
      order.stateCode !== PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED &&
      order.stateCode !== PURCHASE_ORDER_STATE.ORDERED
    ) {
      newState = PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED;
      reason =
        'Return shipment dropped received quantity below ordered quantity';
    }

    if (!newState) return null;

    // Execute transition
    await db
      .update(purchaseOrders)
      .set({
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        rule: 'auto-revert-to-partially-received-on-return',
        trigger,
        from: order.stateCode,
        to: newState,
        reason,
      },
      actor,
    });

    return {
      ruleName: 'auto-revert-to-partially-received-on-return',
      from: order.stateCode,
      to: newState,
      reason,
    };
  },
};

// ============================================================================
// Registry & Engine
// ============================================================================

const PO_LIFECYCLE_RULES: POLifecycleRule[] = [
  autoInvoiceWhenFullyInvoicedAndReceived, // check this first, as it's terminal
  autoReceiveWhenFullyReceived,
  autoPartiallyReceiveWhenSomeReceived,
  autoRevertToPartiallyReceivedOnReturn,
];

/**
 * Evaluate all enabled PO lifecycle rules against the current state.
 * Returns information about any automatic transitions that occurred.
 */
export async function evaluatePOLifecycleRules(
  db: DrizzleDB,
  purchaseOrderId: string,
  trigger: POLifecycleTrigger,
  actor: string,
): Promise<POAutoTransitionResult[]> {
  const transitions: POAutoTransitionResult[] = [];

  for (const rule of PO_LIFECYCLE_RULES) {
    if (!rule.enabled) continue;

    const result = await rule.evaluate(db, purchaseOrderId, trigger, actor);
    if (result) {
      transitions.push(result);
      break; // Only execute one rule per run to prevent cascading overrides incorrectly
    }
  }

  return transitions;
}
