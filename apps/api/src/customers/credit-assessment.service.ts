import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glJournalLines,
  glJournalEntries,
  customers,
  customerGroups,
  tradingTerms,
} from '@herobm/db-schema';
import { eq, sql, and } from 'drizzle-orm';
import { resolveEffectiveTradingTermsId } from './credit-control.utils';
import { SALES_INVOICE_STATE } from '@herobm/shared';

export interface CreditAssessmentResult {
  totalInvoiceBalance: number;
  overdueInvoiceBalance: number;
  totalCreditNoteBalance?: number;
  unallocatedPaymentBalance?: number;
  netOutstandingBalance?: number;
  glBalance: number;
  isOverdue: boolean;
  oldestOverdueInvoice?: string;
  oldestOverdueInvoiceId?: string;
}

@Injectable()
export class CreditAssessmentService {
  private readonly logger = new Logger(CreditAssessmentService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Calculates the current credit standing based on the Open Item strategy.
   * Assesses total and overdue balances directly from unpaid sales invoices,
   * factoring in outstanding credit notes and unallocated customer payments.
   * Also fetches the GL Balance for transparency and audit reconciliation.
   */
  async assessCredit(
    customerId: string,
    tx?: DrizzleDB,
  ): Promise<CreditAssessmentResult> {
    const db = tx || this.db;

    // 1. Check if customer exists to return 0s quickly if not found
    const acctList = await db
      .select({ customerId: customers.customerId })
      .from(customers)
      .where(eq(customers.customerId, customerId))
      .limit(1);

    if (!acctList.length) {
      return {
        totalInvoiceBalance: 0,
        overdueInvoiceBalance: 0,
        totalCreditNoteBalance: 0,
        unallocatedPaymentBalance: 0,
        netOutstandingBalance: 0,
        glBalance: 0,
        isOverdue: false,
      };
    }

    // 2. Query invoices for Open Item calculation
    const invoicesQuery = sql`
      SELECT 
        COALESCE(SUM(si.outstanding_amount), 0) AS total_invoice_balance,
        COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE THEN si.outstanding_amount ELSE 0 END), 0) AS overdue_invoice_balance,
        (array_agg(si.invoice_number ORDER BY si.due_date ASC) FILTER (WHERE si.due_date < CURRENT_DATE))[1] AS oldest_overdue_invoice,
        (array_agg(si.invoice_id ORDER BY si.due_date ASC) FILTER (WHERE si.due_date < CURRENT_DATE))[1] AS oldest_overdue_invoice_id
      FROM herobm_core.sales_invoices si
      LEFT JOIN herobm_core.sales_orders so ON si.sales_order_id = so.sales_order_id
      WHERE COALESCE(si.customer_id, so.customer_id) = ${customerId}
        AND si.state_code NOT IN (${SALES_INVOICE_STATE.DRAFT}, ${SALES_INVOICE_STATE.CANCELLED}, ${SALES_INVOICE_STATE.PAID})
        AND si.outstanding_amount > 0
    `;

    // 3. Query sales credit notes for open credit balance
    const creditNotesQuery = sql`
      SELECT 
        COALESCE(SUM(cn.outstanding_amount), 0) AS total_credit_note_balance
      FROM herobm_core.sales_credit_notes cn
      WHERE cn.customer_id = ${customerId}
        AND cn.state_code NOT IN ('draft', 'cancelled', 'paid', 'void')
        AND cn.outstanding_amount > 0
    `;

    // 4. Query payment entries for unallocated customer receipts
    const paymentsQuery = sql`
      SELECT 
        COALESCE(SUM(pe.unallocated_amount), 0) AS unallocated_payment_balance
      FROM herobm_core.payment_entries pe
      WHERE pe.party_id = ${customerId}
        AND pe.payment_type = 'customer_receipt'
        AND pe.state_code = 'posted'
        AND pe.unallocated_amount > 0
    `;

    // 5. Query the GL for net balance transparency
    const glQuery = sql`
      SELECT 
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS gl_balance
      FROM herobm_core.gl_journal_lines l
      JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
      WHERE l.party_id = ${customerId} AND l.party_type = 'customer'
    `;

    const [invoicesResult, creditNotesResult, paymentsResult, glResult] =
      await Promise.all([
        db.execute(invoicesQuery),
        db.execute(creditNotesQuery),
        db.execute(paymentsQuery),
        db.execute(glQuery),
      ]);

    const invoicesRows =
      (invoicesResult as { rows?: unknown[] }).rows ?? invoicesResult;
    const creditNotesRows =
      (creditNotesResult as { rows?: unknown[] }).rows ?? creditNotesResult;
    const paymentsRows =
      (paymentsResult as { rows?: unknown[] }).rows ?? paymentsResult;
    const glRows = (glResult as { rows?: unknown[] }).rows ?? glResult;

    const invoicesPayload =
      (invoicesRows as unknown as Record<string, string>[])[0] || {};
    const creditNotesPayload =
      (creditNotesRows as unknown as Record<string, string>[])[0] || {};
    const paymentsPayload =
      (paymentsRows as unknown as Record<string, string>[])[0] || {};
    const glPayload = (glRows as unknown as Record<string, string>[])[0] || {};

    const totalInvoiceBalance = parseFloat(
      invoicesPayload.total_invoice_balance || '0',
    );
    const overdueInvoiceBalance = parseFloat(
      invoicesPayload.overdue_invoice_balance || '0',
    );
    const totalCreditNoteBalance = parseFloat(
      creditNotesPayload.total_credit_note_balance || '0',
    );
    const unallocatedPaymentBalance = parseFloat(
      paymentsPayload.unallocated_payment_balance || '0',
    );
    const netOutstandingBalance =
      totalInvoiceBalance - totalCreditNoteBalance - unallocatedPaymentBalance;
    const glBalance = parseFloat(glPayload.gl_balance || '0');

    return {
      totalInvoiceBalance,
      overdueInvoiceBalance,
      totalCreditNoteBalance,
      unallocatedPaymentBalance,
      netOutstandingBalance,
      glBalance,
      isOverdue: overdueInvoiceBalance > 0,
      oldestOverdueInvoice: invoicesPayload.oldest_overdue_invoice || undefined,
      oldestOverdueInvoiceId:
        invoicesPayload.oldest_overdue_invoice_id || undefined,
    };
  }

  /**
   * Calculates the current credit standing for multiple customers in batch.
   */
  async assessCreditBatch(
    customerIds: string[],
    tx?: DrizzleDB,
  ): Promise<Record<string, CreditAssessmentResult>> {
    const db = tx || this.db;
    const resultMap: Record<string, CreditAssessmentResult> = {};

    if (!customerIds.length) {
      return resultMap;
    }

    for (const id of customerIds) {
      resultMap[id] = {
        totalInvoiceBalance: 0,
        overdueInvoiceBalance: 0,
        totalCreditNoteBalance: 0,
        unallocatedPaymentBalance: 0,
        netOutstandingBalance: 0,
        glBalance: 0,
        isOverdue: false,
      };
    }

    const idsSql = sql.join(
      customerIds.map((id) => sql`${id}`),
      sql`, `,
    );

    const invoicesQuery = sql`
      SELECT 
        COALESCE(si.customer_id, so.customer_id) AS customer_id,
        COALESCE(SUM(si.outstanding_amount), 0) AS total_invoice_balance,
        COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE THEN si.outstanding_amount ELSE 0 END), 0) AS overdue_invoice_balance,
        (array_agg(si.invoice_number ORDER BY si.due_date ASC) FILTER (WHERE si.due_date < CURRENT_DATE))[1] AS oldest_overdue_invoice,
        (array_agg(si.invoice_id ORDER BY si.due_date ASC) FILTER (WHERE si.due_date < CURRENT_DATE))[1] AS oldest_overdue_invoice_id
      FROM herobm_core.sales_invoices si
      LEFT JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id
      WHERE COALESCE(si.customer_id, so.customer_id) IN (${idsSql})
        AND si.state_code NOT IN ('draft', 'cancelled', 'paid')
      GROUP BY COALESCE(si.customer_id, so.customer_id)
    `;

    const creditNotesQuery = sql`
      SELECT 
        cn.customer_id AS customer_id,
        COALESCE(SUM(cn.outstanding_amount), 0) AS total_credit_note_balance
      FROM herobm_core.sales_credit_notes cn
      WHERE cn.customer_id IN (${idsSql})
        AND cn.state_code NOT IN ('draft', 'cancelled', 'paid', 'void')
        AND cn.outstanding_amount > 0
      GROUP BY cn.customer_id
    `;

    const paymentsQuery = sql`
      SELECT 
        pe.party_id AS customer_id,
        COALESCE(SUM(pe.unallocated_amount), 0) AS unallocated_payment_balance
      FROM herobm_core.payment_entries pe
      WHERE pe.party_id IN (${idsSql})
        AND pe.payment_type = 'customer_receipt'
        AND pe.state_code = 'posted'
        AND pe.unallocated_amount > 0
      GROUP BY pe.party_id
    `;

    const glQuery = sql`
      SELECT 
        l.party_id as customer_id,
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS gl_balance
      FROM herobm_core.gl_journal_lines l
      JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
      WHERE l.party_id IN (${idsSql}) AND l.party_type = 'customer'
      GROUP BY l.party_id
    `;

    const [invoicesResult, creditNotesResult, paymentsResult, glResult] =
      await Promise.all([
        db.execute(invoicesQuery),
        db.execute(creditNotesQuery),
        db.execute(paymentsQuery),
        db.execute(glQuery),
      ]);

    const invoicesRows =
      (invoicesResult as { rows?: unknown[] }).rows ?? invoicesResult;
    const creditNotesRows =
      (creditNotesResult as { rows?: unknown[] }).rows ?? creditNotesResult;
    const paymentsRows =
      (paymentsResult as { rows?: unknown[] }).rows ?? paymentsResult;
    const glRows = (glResult as { rows?: unknown[] }).rows ?? glResult;

    for (const row of invoicesRows as Record<string, string>[]) {
      const custId = row.customer_id;
      if (resultMap[custId]) {
        resultMap[custId].totalInvoiceBalance = parseFloat(
          row.total_invoice_balance || '0',
        );
        resultMap[custId].overdueInvoiceBalance = parseFloat(
          row.overdue_invoice_balance || '0',
        );
        resultMap[custId].isOverdue =
          resultMap[custId].overdueInvoiceBalance > 0;
        resultMap[custId].oldestOverdueInvoice =
          row.oldest_overdue_invoice || undefined;
        resultMap[custId].oldestOverdueInvoiceId =
          row.oldest_overdue_invoice_id || undefined;
      }
    }

    for (const row of creditNotesRows as Record<string, string>[]) {
      const custId = row.customer_id;
      if (resultMap[custId]) {
        resultMap[custId].totalCreditNoteBalance = parseFloat(
          row.total_credit_note_balance || '0',
        );
      }
    }

    for (const row of paymentsRows as Record<string, string>[]) {
      const custId = row.customer_id;
      if (resultMap[custId]) {
        resultMap[custId].unallocatedPaymentBalance = parseFloat(
          row.unallocated_payment_balance || '0',
        );
      }
    }

    for (const row of glRows as Record<string, string>[]) {
      const custId = row.customer_id;
      if (resultMap[custId]) {
        resultMap[custId].glBalance = parseFloat(row.gl_balance || '0');
      }
    }

    for (const custId of customerIds) {
      if (resultMap[custId]) {
        resultMap[custId].netOutstandingBalance =
          resultMap[custId].totalInvoiceBalance -
          (resultMap[custId].totalCreditNoteBalance ?? 0) -
          (resultMap[custId].unallocatedPaymentBalance ?? 0);
      }
    }

    return resultMap;
  }
}
