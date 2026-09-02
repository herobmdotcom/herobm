import { sql } from 'drizzle-orm';

export function getCreditBlockedSql() {
  return sql<boolean>`CASE 
    WHEN sales_orders.credit_hold_override_at IS NOT NULL THEN false
    ELSE COALESCE((
      SELECT 
        CASE 
          WHEN c.override_credit_hold_until IS NOT NULL AND c.override_credit_hold_until > CURRENT_TIMESTAMP THEN false
          WHEN c.state_code != 'active' THEN true
          WHEN cg.state_code IS NOT NULL AND cg.state_code != 'active' THEN true
          WHEN c.is_on_credit_hold = true THEN true
          WHEN cg.is_on_credit_hold = true AND c.credit_limit IS NULL AND c.trading_terms_id IS NULL THEN true
          WHEN (
            SELECT COALESCE(SUM(si.outstanding_amount), 0)
            FROM herobm_core.sales_invoices si
            JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id
            WHERE so.customer_id = sales_orders.customer_id
              AND si.state_code NOT IN ('draft', 'cancelled')
              AND si.due_date < CURRENT_DATE
          ) > 0 THEN true
          ELSE false
        END
      FROM herobm_core.customers c
      LEFT JOIN herobm_core.customer_groups cg ON cg.customer_group_id = c.customer_group_id
      WHERE c.customer_id = sales_orders.customer_id
    ), false)
  END`;
}
