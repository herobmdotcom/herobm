import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesOrders, salesOrderLineItems } from '../drizzle/modbm-core-schema';
import { findOrder, getCommittedPerLine, writeEvent } from './shipment-helpers';

export interface LifecycleTrigger {
  entity: 'shipment';
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
    if (trigger.entity !== 'shipment' || trigger.action !== 'dispatched')
      return null;

    // 2. Order must be in 'picking'
    const order = await findOrder(db, salesOrderId);
    if (order.stateCode !== 'picking') return null;

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
      .set({ stateCode: 'shipped', modifiedOn: new Date() })
      .where(eq(salesOrders.salesOrderId, salesOrderId));

    await writeEvent(
      db as any,
      salesOrderId,
      'auto_status_changed',
      {
        rule: 'auto-ship-when-fully-shipped',
        trigger,
        from: 'picking',
        to: 'shipped',
        reason: 'All lines fully shipped',
      },
      actor,
    );

    return {
      ruleName: 'auto-ship-when-fully-shipped',
      from: 'picking',
      to: 'shipped',
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
      trigger.entity !== 'shipment' ||
      !['cancelled', 'draft'].includes(trigger.action)
    ) {
      return null;
    }

    // 2. Order must NOT be picking already
    const order = await findOrder(db, salesOrderId);
    if (order.stateCode === 'picking') return null;

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
      .set({ stateCode: 'picking', modifiedOn: new Date() })
      .where(eq(salesOrders.salesOrderId, salesOrderId));

    await writeEvent(
      db as any,
      salesOrderId,
      'auto_status_changed',
      {
        rule: 'revert-to-picking-on-shipment-cancel',
        trigger,
        from: 'shipped',
        to: 'picking',
        reason: `Shipment ${trigger.action === 'draft' ? 'reverted to draft' : trigger.action}, order no longer fully shipped`,
      },
      actor,
    );

    return {
      ruleName: 'revert-to-picking-on-shipment-cancel',
      from: 'shipped',
      to: 'picking',
      reason: 'Order no longer fully shipped',
    };
  },
};

// ============================================================================
// Registry & Engine
// ============================================================================

const LIFECYCLE_RULES: LifecycleRule[] = [
  autoShipWhenFullyShipped,
  revertToPickingOnShipmentCancel,
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
