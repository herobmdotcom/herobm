import { eq, inArray, and } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseInvoices,
  purchaseInvoiceLines,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';

export interface POLifecycleTrigger {
  entity: 'goods_receipt' | 'purchase_invoice';
  action: 'created' | 'posted' | 'cancelled';
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
    if (trigger.entity !== 'goods_receipt' || trigger.action !== 'created')
      return null;

    const [order] = await db
      .select({ stateCode: purchaseOrders.stateCode })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (
      !order ||
      !['ordered', 'partially_received', 'draft'].includes(order.stateCode)
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
      .set({ stateCode: 'received', modifiedOn: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: 'auto_status_changed',
      payload: {
        rule: 'auto-receive-when-fully-received',
        trigger,
        from: order.stateCode,
        to: 'received',
        reason: 'All lines fully received',
      },
      actor,
    });

    return {
      ruleName: 'auto-receive-when-fully-received',
      from: order.stateCode,
      to: 'received',
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
    if (trigger.entity !== 'goods_receipt' || trigger.action !== 'created')
      return null;

    const [order] = await db
      .select({ stateCode: purchaseOrders.stateCode })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (!order || !['ordered', 'draft'].includes(order.stateCode)) return null;

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
      .set({ stateCode: 'partially_received', modifiedOn: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: 'auto_status_changed',
      payload: {
        rule: 'auto-partially-receive-when-some-received',
        trigger,
        from: order.stateCode,
        to: 'partially_received',
        reason: 'Some lines received',
      },
      actor,
    });

    return {
      ruleName: 'auto-partially-receive-when-some-received',
      from: order.stateCode,
      to: 'partially_received',
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
      ['invoiced', 'cancelled', 'closed_short'].includes(order.stateCode)
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
    const { sql } = await import('drizzle-orm');

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
            eq(purchaseInvoices.stateCode, 'invoiced'),
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
      .set({ stateCode: 'invoiced', modifiedOn: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(db as any, {
      aggregateType: AggregateType.PURCHASE_ORDER,
      aggregateId: poId,
      eventType: 'auto_status_changed',
      payload: {
        rule: 'auto-invoice-when-fully-invoiced-and-received',
        trigger,
        from: order.stateCode,
        to: 'invoiced',
        reason: 'All lines fully invoiced and received',
      },
      actor,
    });

    return {
      ruleName: 'auto-invoice-when-fully-invoiced-and-received',
      from: order.stateCode,
      to: 'invoiced',
      reason: 'All lines fully invoiced and received',
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
