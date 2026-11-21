import {
  roundMoney,
  SALES_INVOICE_STATE,
  SALES_ORDER_STATE,
} from '@herobm/shared';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';

export interface AgedBalanceResult {
  customerId: string;
  customerName?: string;
  customerNumber?: string;
  currencyCode?: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalInvoiceOutstanding?: number;
  totalCreditNoteOutstanding?: number;
  unallocatedPaymentsTotal?: number;
  totalOutstanding: number;
  glBalance: number;
  discrepancyAmount: number;
  uninvoicedOrdersTotal: number;
  // Raw risk inputs (kept optional to avoid breaking existing credit logic)
  stateCode?: string;
  isOnCreditHold?: boolean;
  creditLimit?: string | null;
  overrideCreditHoldUntil?: Date | null;
  customerGroupId?: string;
  groupIsOnCreditHold?: boolean;
  groupCreditLimit?: string | null;
}

export async function calculateCustomerBalances(
  db: DrizzleDB,
  agingBasis: 'invoiceDate' | 'dueDate' = 'dueDate',
  customerIds?: string[],
): Promise<AgedBalanceResult[]> {
  const basisCol = agingBasis === 'invoiceDate' ? 'invoice_date' : 'due_date';

  const customerIdFilter =
    customerIds && customerIds.length > 0
      ? sql`AND c.customer_id IN (${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  const invoicesQuery = sql`
    SELECT 
      c.customer_id as "customerId",
      a.name as "customerName",
      c.customer_number as "customerNumber",
      c.currency_code as "currencyCode",
      c.state_code as "stateCode",
      c.is_on_credit_hold as "cIsOnCreditHold",
      c.credit_limit as "cCreditLimit",
      c.override_credit_hold_until as "cOverride",
      c.customer_group_id as "customerGroupId",
      g.is_on_credit_hold as "gIsOnCreditHold",
      g.credit_limit as "gCreditLimit",
      COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) as "current",
      COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '30 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days1To30",
      COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '30 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '60 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days31To60",
      COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '60 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days61To90",
      COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '90 days' OR i.${sql.identifier(basisCol)} IS NULL THEN i.outstanding_amount ELSE 0 END), 0) as "days90Plus",
      COALESCE(SUM(i.outstanding_amount), 0) as "totalOutstanding"
    FROM herobm_core.sales_invoices i
    LEFT JOIN herobm_core.sales_orders so ON i.sales_order_id = so.sales_order_id
    JOIN herobm_core.customers c ON c.customer_id = COALESCE(i.customer_id, so.customer_id)
    LEFT JOIN herobm_core.organizations a ON c.organization_id = a.organization_id
    LEFT JOIN herobm_core.customer_groups g ON c.customer_group_id = g.customer_group_id
    WHERE i.outstanding_amount > 0 AND i.state_code NOT IN (${SALES_INVOICE_STATE.DRAFT}, ${SALES_INVOICE_STATE.CANCELLED}, ${SALES_INVOICE_STATE.PAID})
    ${customerIdFilter}
    GROUP BY c.customer_id, a.name, c.customer_number, c.currency_code, c.state_code, c.is_on_credit_hold, c.credit_limit, c.override_credit_hold_until, c.customer_group_id, g.is_on_credit_hold, g.credit_limit
  `;

  const glFilter =
    customerIds && customerIds.length > 0
      ? sql`AND l.party_id IN (${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  const glQuery = sql`
    SELECT 
      l.party_id as "customerId",
      COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as "glBalance"
    FROM herobm_core.gl_journal_lines l
    JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
    WHERE l.party_type = 'customer'
    ${glFilter}
    GROUP BY l.party_id
  `;

  const uninvoicedFilter =
    customerIds && customerIds.length > 0
      ? sql`AND so.customer_id IN (${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  const uninvoicedQuery = sql`
    SELECT
      so.customer_id as "customerId",
      SUM(
        COALESCE((SELECT SUM(sol.total_amount) FROM herobm_core.sales_order_lines sol WHERE sol.sales_order_id = so.sales_order_id), 0)
        -
        COALESCE((SELECT SUM(si.total_amount) FROM herobm_core.sales_invoices si WHERE si.sales_order_id = so.sales_order_id AND si.state_code NOT IN (${SALES_INVOICE_STATE.DRAFT}, ${SALES_INVOICE_STATE.CANCELLED})), 0)
      ) as "uninvoicedTotal"
    FROM herobm_core.sales_orders so
    WHERE so.state_code IN (${SALES_ORDER_STATE.CONFIRMED}, ${SALES_ORDER_STATE.PICKING}, ${SALES_ORDER_STATE.SHIPPED})
    ${uninvoicedFilter}
    GROUP BY so.customer_id
  `;

  const creditNotesFilter =
    customerIds && customerIds.length > 0
      ? sql`AND cn.customer_id IN (${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  const creditNotesQuery = sql`
    SELECT
      cn.customer_id as "customerId",
      COALESCE(SUM(cn.outstanding_amount), 0) as "creditNotesTotal"
    FROM herobm_core.sales_credit_notes cn
    WHERE cn.outstanding_amount > 0 AND cn.state_code NOT IN ('draft', 'cancelled', 'paid', 'void')
    ${creditNotesFilter}
    GROUP BY cn.customer_id
  `;

  const paymentsFilter =
    customerIds && customerIds.length > 0
      ? sql`AND pe.party_id IN (${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  const paymentsQuery = sql`
    SELECT
      pe.party_id as "customerId",
      COALESCE(SUM(CASE WHEN pe.payment_type = 'customer_receipt' THEN pe.unallocated_amount ELSE -pe.unallocated_amount END), 0) as "unallocatedPaymentsTotal"
    FROM herobm_core.payment_entries pe
    WHERE pe.payment_type IN ('customer_receipt', 'customer_refund') AND pe.state_code = 'posted' AND pe.unallocated_amount > 0
    ${paymentsFilter}
    GROUP BY pe.party_id
  `;

  const [invoicesRes, glRes, uninvoicedRes, creditNotesRes, paymentsRes] =
    await Promise.all([
      db.execute(invoicesQuery),
      db.execute(glQuery),
      db.execute(uninvoicedQuery),
      db.execute(creditNotesQuery),
      db.execute(paymentsQuery),
    ]);

  const invoicesRows = ((invoicesRes as unknown as Record<string, unknown>)
    .rows ?? invoicesRes) as Record<string, unknown>[];
  const glRows = ((glRes as unknown as Record<string, unknown>).rows ??
    glRes) as Record<string, unknown>[];
  const uninvoicedRows = ((uninvoicedRes as unknown as Record<string, unknown>)
    .rows ?? uninvoicedRes) as Record<string, unknown>[];
  const creditNotesRows = ((
    creditNotesRes as unknown as Record<string, unknown>
  ).rows ?? creditNotesRes) as Record<string, unknown>[];
  const paymentsRows = ((paymentsRes as unknown as Record<string, unknown>)
    .rows ?? paymentsRes) as Record<string, unknown>[];

  const glMap = new Map<string, number>();
  for (const row of glRows) {
    if (row.customerId) {
      glMap.set(row.customerId as string, Number(row.glBalance));
    }
  }

  const uninvoicedMap = new Map<string, number>();
  for (const row of uninvoicedRows) {
    if (row.customerId) {
      uninvoicedMap.set(row.customerId as string, Number(row.uninvoicedTotal));
    }
  }

  const creditNotesMap = new Map<string, number>();
  for (const row of creditNotesRows) {
    if (row.customerId) {
      creditNotesMap.set(
        row.customerId as string,
        Number(row.creditNotesTotal),
      );
    }
  }

  const paymentsMap = new Map<string, number>();
  for (const row of paymentsRows) {
    if (row.customerId) {
      paymentsMap.set(
        row.customerId as string,
        Number(row.unallocatedPaymentsTotal),
      );
    }
  }

  const invoicesMap = new Map<string, Record<string, unknown>>();
  for (const row of invoicesRows) {
    if (row.customerId) {
      invoicesMap.set(row.customerId as string, row);
    }
  }

  const allIds = new Set<string>();
  if (customerIds && customerIds.length > 0) {
    customerIds.forEach((id) => allIds.add(id));
  } else {
    invoicesRows.forEach(
      (r) => r.customerId && allIds.add(r.customerId as string),
    );
    creditNotesRows.forEach(
      (r) => r.customerId && allIds.add(r.customerId as string),
    );
    paymentsRows.forEach(
      (r) => r.customerId && allIds.add(r.customerId as string),
    );
    glRows.forEach((r) => r.customerId && allIds.add(r.customerId as string));
  }

  const resultMap = new Map<string, AgedBalanceResult>();

  for (const id of allIds) {
    const invRow = invoicesMap.get(id);
    const glBalance = glMap.get(id) || 0;
    const uninvoiced = uninvoicedMap.get(id) || 0;
    const invoiceOutstanding = Number(invRow?.totalOutstanding || 0);
    const cnTotal = creditNotesMap.get(id) || 0;
    const payments = paymentsMap.get(id) || 0;
    const totalCredit = cnTotal + payments;

    let days90Plus = Number(invRow?.days90Plus || 0);
    let days61To90 = Number(invRow?.days61To90 || 0);
    let days31To60 = Number(invRow?.days31To60 || 0);
    let days1To30 = Number(invRow?.days1To30 || 0);
    let current = Number(invRow?.current || 0);

    let remCredit = totalCredit;
    if (remCredit > 0) {
      const r90 = Math.min(days90Plus, remCredit);
      days90Plus -= r90;
      remCredit -= r90;
    }
    if (remCredit > 0) {
      const r61 = Math.min(days61To90, remCredit);
      days61To90 -= r61;
      remCredit -= r61;
    }
    if (remCredit > 0) {
      const r31 = Math.min(days31To60, remCredit);
      days31To60 -= r31;
      remCredit -= r31;
    }
    if (remCredit > 0) {
      const r1 = Math.min(days1To30, remCredit);
      days1To30 -= r1;
      remCredit -= r1;
    }
    if (remCredit > 0) {
      current -= remCredit;
    }

    const totalOutstanding = roundMoney(
      current + days1To30 + days31To60 + days61To90 + days90Plus,
    ).toNumber();

    resultMap.set(id, {
      customerId: id,
      customerName: invRow?.customerName as string | undefined,
      customerNumber: invRow?.customerNumber as string | undefined,
      currencyCode: invRow?.currencyCode as string | undefined,
      current: roundMoney(current).toNumber(),
      days1To30: roundMoney(days1To30).toNumber(),
      days31To60: roundMoney(days31To60).toNumber(),
      days61To90: roundMoney(days61To90).toNumber(),
      days90Plus: roundMoney(days90Plus).toNumber(),
      totalInvoiceOutstanding: invoiceOutstanding,
      totalCreditNoteOutstanding: cnTotal,
      unallocatedPaymentsTotal: payments,
      totalOutstanding,
      glBalance,
      discrepancyAmount: roundMoney(
        Math.abs(totalOutstanding - glBalance),
      ).toNumber(),
      uninvoicedOrdersTotal: uninvoiced,
      // Pass these through for risk calculation
      stateCode: invRow?.stateCode as string | undefined,
      isOnCreditHold: invRow ? Boolean(invRow.cIsOnCreditHold) : false,
      creditLimit:
        invRow && invRow.cCreditLimit !== null
          ? String(invRow.cCreditLimit as string | number)
          : null,
      overrideCreditHoldUntil:
        invRow && invRow.cOverride
          ? new Date(invRow.cOverride as string)
          : null,
      customerGroupId: invRow?.customerGroupId as string | undefined,
      groupIsOnCreditHold: invRow ? Boolean(invRow.gIsOnCreditHold) : false,
      groupCreditLimit:
        invRow && invRow.gCreditLimit !== null
          ? String(invRow.gCreditLimit as string | number)
          : null,
    });
  }

  return Array.from(resultMap.values());
}
