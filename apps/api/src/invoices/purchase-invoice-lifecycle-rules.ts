import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { purchaseInvoices } from '../drizzle/herobm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { PURCHASE_INVOICE_STATE } from '@herobm/shared';

export interface PurchaseInvoiceLifecycleTrigger {
  entity: 'payment';
  id: string;
  action: 'allocated' | 'unallocated';
}

export interface AutoTransitionResult {
  ruleName: string;
  from: string;
  to: string;
  reason: string;
}

export interface PurchaseInvoiceLifecycleRule {
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (
    db: DrizzleDB,
    invoiceId: string,
    trigger: PurchaseInvoiceLifecycleTrigger,
    actor: string,
  ) => Promise<AutoTransitionResult | null>;
}

// ============================================================================
// Rules
// ============================================================================

export const autoTransitionPurchaseInvoiceBasedOnOutstandingAmount: PurchaseInvoiceLifecycleRule =
  {
    name: 'auto-transition-purchase-invoice-outstanding-amount',
    description:
      'Transitions a purchase invoice between invoiced, partially_paid, and paid based on its outstanding amount',
    enabled: true,
    evaluate: async (db, invoiceId, trigger, actor) => {
      // 1. Get current invoice state
      const [invoice] = await db
        .select({
          stateCode: purchaseInvoices.stateCode,
          totalAmount: purchaseInvoices.totalAmount,
          outstandingAmount: purchaseInvoices.outstandingAmount,
          invoiceNumber: purchaseInvoices.invoiceNumber,
        })
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));

      if (!invoice) return null;

      // Ignore drafts and cancelled invoices
      if (
        invoice.stateCode === PURCHASE_INVOICE_STATE.DRAFT ||
        invoice.stateCode === PURCHASE_INVOICE_STATE.CANCELLED
      )
        return null;

      const outstanding = parseFloat(invoice.outstandingAmount);
      const total = parseFloat(invoice.totalAmount);

      let targetState = invoice.stateCode;

      // 2. Determine correct state
      if (outstanding <= 0.001) {
        targetState = PURCHASE_INVOICE_STATE.PAID;
      } else if (outstanding < total - 0.001) {
        targetState = PURCHASE_INVOICE_STATE.PARTIALLY_PAID;
      } else {
        targetState = PURCHASE_INVOICE_STATE.INVOICED;
      }

      // 3. If state hasn't changed, do nothing
      if (targetState === invoice.stateCode) return null;

      // 4. Execute transition
      await db
        .update(purchaseInvoices)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ stateCode: targetState as any, modifiedOn: new Date() })
        .where(eq(purchaseInvoices.invoiceId, invoiceId));

      await emitEvent(db, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: invoice.invoiceNumber,
        payload: {
          isAutomated: true,
          rule: 'auto-transition-purchase-invoice-outstanding-amount',
          trigger,
          from: invoice.stateCode,
          to: targetState,
          reason: `Outstanding amount is ${outstanding}`,
        },
        actor,
      });

      return {
        ruleName: 'auto-transition-purchase-invoice-outstanding-amount',
        from: invoice.stateCode,
        to: targetState,
        reason: `Outstanding amount changed to ${outstanding}`,
      };
    },
  };

// ============================================================================
// Registry & Engine
// ============================================================================

const LIFECYCLE_RULES: PurchaseInvoiceLifecycleRule[] = [
  autoTransitionPurchaseInvoiceBasedOnOutstandingAmount,
];

/**
 * Evaluate all enabled lifecycle rules against the current state.
 */
export async function evaluatePurchaseInvoiceLifecycleRules(
  db: DrizzleDB,
  invoiceId: string,
  trigger: PurchaseInvoiceLifecycleTrigger,
  actor: string,
): Promise<AutoTransitionResult[]> {
  const transitions: AutoTransitionResult[] = [];

  for (const rule of LIFECYCLE_RULES) {
    if (!rule.enabled) continue;

    const result = await rule.evaluate(db, invoiceId, trigger, actor);
    if (result) {
      transitions.push(result);
      break; // One transition per pass
    }
  }

  return transitions;
}
