import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesInvoices, purchaseInvoices } from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { SALES_INVOICE_STATE } from '@modbm/shared';

export interface InvoiceLifecycleTrigger {
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

export interface InvoiceLifecycleRule {
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (
    db: DrizzleDB,
    invoiceType: 'sales' | 'purchase',
    invoiceId: string,
    trigger: InvoiceLifecycleTrigger,
    actor: string,
  ) => Promise<AutoTransitionResult | null>;
}

// ============================================================================
// Rules
// ============================================================================

export const autoTransitionInvoiceBasedOnOutstandingAmount: InvoiceLifecycleRule =
  {
    name: 'auto-transition-invoice-outstanding-amount',
    description:
      'Transitions an invoice between invoiced, partially_paid, and paid based on its outstanding amount',
    enabled: true,
    evaluate: async (db, invoiceType, invoiceId, trigger, actor) => {
      const table = invoiceType === 'sales' ? salesInvoices : purchaseInvoices;
      const pkColumn =
        invoiceType === 'sales'
          ? salesInvoices.invoiceId
          : purchaseInvoices.invoiceId;

      // 1. Get current invoice state
      const [invoice] = await db
        .select({
          stateCode: table.stateCode,
          totalAmount: table.totalAmount,
          outstandingAmount: table.outstandingAmount,
        })
        .from(table)
        .where(eq(pkColumn, invoiceId));

      if (!invoice) return null;

      // Ignore drafts and cancelled invoices
      if (
        invoice.stateCode === SALES_INVOICE_STATE.DRAFT ||
        invoice.stateCode === SALES_INVOICE_STATE.CANCELLED
      )
        return null;

      const outstanding = parseFloat(invoice.outstandingAmount);
      const total = parseFloat(invoice.totalAmount);

      let targetState = invoice.stateCode;

      // 2. Determine correct state
      if (outstanding <= 0.001) {
        targetState = SALES_INVOICE_STATE.PAID;
      } else if (outstanding < total - 0.001) {
        targetState = SALES_INVOICE_STATE.PARTIALLY_PAID;
      } else {
        targetState = SALES_INVOICE_STATE.INVOICED;
      }

      // 3. If state hasn't changed, do nothing
      if (targetState === invoice.stateCode) return null;

      // 4. Execute transition
      await db
        .update(table as any)
        .set({ stateCode: targetState, modifiedOn: new Date() })
        .where(eq(pkColumn, invoiceId));

      const entityType =
        invoiceType === 'sales'
          ? EntityType.SALES_INVOICE
          : EntityType.PURCHASE_INVOICE;

      await emitEvent(db as any, {
        entityType,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        payload: {
          isAutomated: true,
          rule: 'auto-transition-invoice-outstanding-amount',
          trigger,
          from: invoice.stateCode,
          to: targetState,
          reason: `Outstanding amount is ${outstanding}`,
        },
        actor,
      });

      return {
        ruleName: 'auto-transition-invoice-outstanding-amount',
        from: invoice.stateCode,
        to: targetState,
        reason: `Outstanding amount changed to ${outstanding}`,
      };
    },
  };

// ============================================================================
// Registry & Engine
// ============================================================================

const LIFECYCLE_RULES: InvoiceLifecycleRule[] = [
  autoTransitionInvoiceBasedOnOutstandingAmount,
];

/**
 * Evaluate all enabled lifecycle rules against the current state.
 */
export async function evaluateInvoiceLifecycleRules(
  db: DrizzleDB,
  invoiceType: 'sales' | 'purchase',
  invoiceId: string,
  trigger: InvoiceLifecycleTrigger,
  actor: string,
): Promise<AutoTransitionResult[]> {
  const transitions: AutoTransitionResult[] = [];

  for (const rule of LIFECYCLE_RULES) {
    if (!rule.enabled) continue;

    const result = await rule.evaluate(
      db,
      invoiceType,
      invoiceId,
      trigger,
      actor,
    );
    if (result) {
      transitions.push(result);
      break; // One transition per pass
    }
  }

  return transitions;
}
