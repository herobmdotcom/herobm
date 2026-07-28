import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesInvoices } from '../drizzle/schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { SALES_INVOICE_STATE } from '@herobm/shared';

export interface SalesInvoiceLifecycleTrigger {
  entity: 'payment';
  id: string;
  action: 'allocated' | 'unallocated' | 'cancelled';
}

export interface AutoTransitionResult {
  ruleName: string;
  from: string;
  to: string;
  reason: string;
}

export interface SalesInvoiceLifecycleRule {
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (
    db: DrizzleDB,
    invoiceId: string,
    trigger: SalesInvoiceLifecycleTrigger,
    actor: string,
  ) => Promise<AutoTransitionResult | null>;
}

// ============================================================================
// Rules
// ============================================================================

export const autoTransitionSalesInvoiceBasedOnOutstandingAmount: SalesInvoiceLifecycleRule =
  {
    name: 'auto-transition-sales-invoice-outstanding-amount',
    description:
      'Transitions a sales invoice between invoiced, partially_paid, and paid based on its outstanding amount',
    enabled: true,
    evaluate: async (db, invoiceId, trigger, actor) => {
      // 1. Get current invoice state
      const [invoice] = await db
        .select({
          stateCode: salesInvoices.stateCode,
          totalAmount: salesInvoices.totalAmount,
          outstandingAmount: salesInvoices.outstandingAmount,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId));

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
        .update(salesInvoices)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic state assignment bypasses strict Drizzle schema enums
        .set({ stateCode: targetState as any, modifiedOn: new Date() })
        .where(eq(salesInvoices.invoiceId, invoiceId));

      await emitEvent(db, {
        entityType: EntityType.SALES_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: invoice.invoiceNumber,
        payload: {
          isAutomated: true,
          rule: 'auto-transition-sales-invoice-outstanding-amount',
          trigger,
          from: invoice.stateCode,
          to: targetState,
          reason: `Outstanding amount is ${outstanding}`,
        },
        actor,
      });

      return {
        ruleName: 'auto-transition-sales-invoice-outstanding-amount',
        from: invoice.stateCode,
        to: targetState,
        reason: `Outstanding amount changed to ${outstanding}`,
      };
    },
  };

// ============================================================================
// Registry & Engine
// ============================================================================

const LIFECYCLE_RULES: SalesInvoiceLifecycleRule[] = [
  autoTransitionSalesInvoiceBasedOnOutstandingAmount,
];

/**
 * Evaluate all enabled lifecycle rules against the current state.
 */
export async function evaluateSalesInvoiceLifecycleRules(
  db: DrizzleDB,
  invoiceId: string,
  trigger: SalesInvoiceLifecycleTrigger,
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
