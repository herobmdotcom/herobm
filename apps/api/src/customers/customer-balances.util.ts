import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { SALES_INVOICE_STATE, SALES_ORDER_STATE } from '@herobm/shared';

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
    LEFT JOIN herobm_core.actors a ON c.actor_id = a.actor_id
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

  const [invoicesRes, glRes, uninvoicedRes] = await Promise.all([
    db.execute(invoicesQuery),
    db.execute(glQuery),
    db.execute(uninvoicedQuery),
  ]);

  const invoicesRows = ((invoicesRes as unknown as Record<string, unknown>)
    .rows ?? invoicesRes) as Record<string, unknown>[];
  const glRows = ((glRes as unknown as Record<string, unknown>).rows ??
    glRes) as Record<string, unknown>[];
  const uninvoicedRows = ((uninvoicedRes as unknown as Record<string, unknown>)
    .rows ?? uninvoicedRes) as Record<string, unknown>[];

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

  // If customerIds is passed (i.e. we are fulfilling the Customers Table index),
  // we must ensure we return a result for EVERY requested customer, even if they have $0 outstanding invoices.
  // The invoicesQuery only returns customers with outstanding invoices.
  // So we merge.
  const resultMap = new Map<string, AgedBalanceResult>();

  if (customerIds && customerIds.length > 0) {
    // Pre-populate with 0 balances
    for (const id of customerIds) {
      resultMap.set(id, {
        customerId: id,
        current: 0,
        days1To30: 0,
        days31To60: 0,
        days61To90: 0,
        days90Plus: 0,
        totalOutstanding: 0,
        glBalance: glMap.get(id) || 0,
        discrepancyAmount: Math.abs(0 - (glMap.get(id) || 0)),
        uninvoicedOrdersTotal: uninvoicedMap.get(id) || 0,
      });
    }
  }

  for (const row of invoicesRows) {
    const id = row.customerId as string;
    const glBalance = glMap.get(id) || 0;
    const uninvoiced = uninvoicedMap.get(id) || 0;
    const totalOutstanding = Number(row.totalOutstanding);

    resultMap.set(id, {
      customerId: id,
      customerName: row.customerName as string,
      customerNumber: row.customerNumber as string,
      currencyCode: row.currencyCode as string,
      current: Number(row.current),
      days1To30: Number(row.days1To30),
      days31To60: Number(row.days31To60),
      days61To90: Number(row.days61To90),
      days90Plus: Number(row.days90Plus),
      totalOutstanding,
      glBalance,
      discrepancyAmount: Math.abs(totalOutstanding - glBalance),
      uninvoicedOrdersTotal: uninvoiced,
      // Pass these through for risk calculation
      stateCode: row.stateCode as string,
      isOnCreditHold: Boolean(row.cIsOnCreditHold),
      creditLimit:
        row.cCreditLimit !== null
          ? String(row.cCreditLimit as string | number)
          : null,
      overrideCreditHoldUntil: row.cOverride
        ? new Date(row.cOverride as string)
        : null,
      customerGroupId: row.customerGroupId as string | undefined,
      groupIsOnCreditHold: Boolean(row.gIsOnCreditHold),
      groupCreditLimit:
        row.gCreditLimit !== null
          ? String(row.gCreditLimit as string | number)
          : null,
    });
  }

  return Array.from(resultMap.values());
}
