import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glJournalLines,
  glJournalEntries,
  customers,
  customerGroups,
  tradingTerms,
} from '../drizzle/schema';
import { eq, sql, and } from 'drizzle-orm';
import { resolveEffectiveTradingTermsId } from './credit-control.utils';

export interface CreditAssessmentResult {
  totalInvoiceBalance: number;
  overdueInvoiceBalance: number;
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
   * Assesses total and overdue balances directly from unpaid sales invoices.
   * Also fetches the GL Balance for transparency and unallocated payment discovery.
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
      JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id
      WHERE so.customer_id = ${customerId}
        AND si.state_code NOT IN ('draft', 'cancelled', 'paid')
    `;

    // 3. Query the GL for net balance transparency
    const glQuery = sql`
      SELECT 
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS gl_balance
      FROM herobm_core.gl_journal_lines l
      JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
      WHERE l.party_id = ${customerId} AND l.party_type = 'customer'
    `;

    const [invoicesResult, glResult] = await Promise.all([
      db.execute(invoicesQuery),
      db.execute(glQuery),
    ]);

    const invoicesRows =
      (invoicesResult as { rows?: unknown[] }).rows ?? invoicesResult;
    const glRows = (glResult as { rows?: unknown[] }).rows ?? glResult;

    const invoicesPayload =
      (invoicesRows as unknown as Record<string, string>[])[0] || {};
    const glPayload = (glRows as unknown as Record<string, string>[])[0] || {};

    const totalInvoiceBalance = parseFloat(
      invoicesPayload.total_invoice_balance || '0',
    );
    const overdueInvoiceBalance = parseFloat(
      invoicesPayload.overdue_invoice_balance || '0',
    );
    const glBalance = parseFloat(glPayload.gl_balance || '0');

    return {
      totalInvoiceBalance,
      overdueInvoiceBalance,
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
        so.customer_id,
        COALESCE(SUM(si.outstanding_amount), 0) AS total_invoice_balance,
        COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE THEN si.outstanding_amount ELSE 0 END), 0) AS overdue_invoice_balance,
        (array_agg(si.invoice_number ORDER BY si.due_date ASC) FILTER (WHERE si.due_date < CURRENT_DATE))[1] AS oldest_overdue_invoice,
        (array_agg(si.invoice_id ORDER BY si.due_date ASC) FILTER (WHERE si.due_date < CURRENT_DATE))[1] AS oldest_overdue_invoice_id
      FROM herobm_core.sales_invoices si
      JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id
      WHERE so.customer_id IN (${idsSql})
        AND si.state_code NOT IN ('draft', 'cancelled', 'paid')
      GROUP BY so.customer_id
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

    const [invoicesResult, glResult] = await Promise.all([
      db.execute(invoicesQuery),
      db.execute(glQuery),
    ]);

    const invoicesRows =
      (invoicesResult as { rows?: unknown[] }).rows ?? invoicesResult;
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

    for (const row of glRows as Record<string, string>[]) {
      const custId = row.customer_id;
      if (resultMap[custId]) {
        resultMap[custId].glBalance = parseFloat(row.gl_balance || '0');
      }
    }

    return resultMap;
  }
}
