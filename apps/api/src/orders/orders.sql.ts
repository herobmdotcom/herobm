import { sql } from 'drizzle-orm';
import { customers, customerGroups } from '@herobm/db-schema';
import { salesOrders } from '@herobm/db-schema';

export function getCreditBlockedSql() {
  return sql<boolean>`CASE 
    WHEN ${salesOrders.creditHoldOverrideAt} IS NOT NULL THEN false
    WHEN ${customers.overrideCreditHoldUntil} IS NOT NULL AND ${customers.overrideCreditHoldUntil} > CURRENT_TIMESTAMP THEN false
    ELSE (
      ${customers.stateCode} != 'active'
      OR ${customerGroups.stateCode} != 'active'
      OR ${customers.isOnCreditHold} = true
      OR (${customerGroups.isOnCreditHold} = true AND ${customers.creditLimit} IS NULL AND ${customers.tradingTermsId} IS NULL)
      OR (
        SELECT COALESCE(SUM(si.outstanding_amount), 0)
        FROM herobm_core.sales_invoices si
        JOIN herobm_core.sales_orders so ON so.sales_order_id = si.sales_order_id
        WHERE so.customer_id = ${salesOrders.customerId}
          AND si.state_code NOT IN ('draft', 'cancelled')
          AND si.due_date < CURRENT_DATE
      ) > 0
    )
  END`;
}
