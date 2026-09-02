import { DrizzleDB } from '../drizzle/drizzle.module';
import { glSettings, glAccounts } from '@herobm/db-schema';
import { sql, eq } from 'drizzle-orm';

/**
 * Performs an automated continuous reconciliation between double-entry GL control accounts
 * and operational subledgers (Trial Balance Zero-Sum, AR, AP, GRNI, Perpetual Inventory).
 */
export async function calculateSubledgerReconciliation(
  db: DrizzleDB,
  _asOfDate?: string,
) {
  const [settings] = await db
    .select({
      defaultArAccountId: glSettings.defaultArAccountId,
      defaultApAccountId: glSettings.defaultApAccountId,
      defaultGrniAccountId: glSettings.defaultGrniAccountId,
      defaultInventoryAccountId: glSettings.defaultInventoryAccountId,
    })
    .from(glSettings)
    .limit(1);

  const arId = settings?.defaultArAccountId;
  const apId = settings?.defaultApAccountId;
  const grniId = settings?.defaultGrniAccountId;
  const invId = settings?.defaultInventoryAccountId;

  const [arAcct] = arId
    ? await db
        .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, arId))
        .limit(1)
    : [];

  const [apAcct] = apId
    ? await db
        .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, apId))
        .limit(1)
    : [];

  const [grniAcct] = grniId
    ? await db
        .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, grniId))
        .limit(1)
    : [];

  const [invAcct] = invId
    ? await db
        .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, invId))
        .limit(1)
    : [];

  const execScalar = async (
    query: import('drizzle-orm').SQL,
  ): Promise<number> => {
    const res = await db.execute(query);
    const row = Array.isArray(res)
      ? (res[0] as Record<string, string | number | null> | undefined)
      : (res as { rows: Record<string, string | number | null>[] })?.rows?.[0];
    if (!row) return 0;
    const firstVal = Object.values(row)[0];
    if (typeof firstVal === 'number') return firstVal;
    if (typeof firstVal === 'string') return parseFloat(firstVal) || 0;
    return 0;
  };

  // 1. Trial Balance Zero-Sum
  const tbDebit = await execScalar(
    sql`SELECT COALESCE(SUM(debit), 0)::numeric FROM herobm_core.gl_journal_lines`,
  );
  const tbCredit = await execScalar(
    sql`SELECT COALESCE(SUM(credit), 0)::numeric FROM herobm_core.gl_journal_lines`,
  );
  const tbDiff = Math.round((tbDebit - tbCredit) * 100) / 100;
  const isTbZeroSum = Math.abs(tbDiff) < 0.005;

  // 2. Accounts Receivable (AR) Parity
  const arSubledger = await execScalar(sql`
    SELECT ((SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.sales_invoices WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.sales_credit_notes WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_unallocated_amount, unallocated_amount)), 0)::numeric FROM herobm_core.payment_entries WHERE payment_type = 'customer_receipt' AND state_code NOT IN ('draft', 'cancelled')))::numeric
  `);
  const arGl = arId
    ? await execScalar(sql`
        SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::numeric
        FROM herobm_core.gl_journal_lines jl
        WHERE jl.gl_account_id = ${arId}::uuid
      `)
    : 0;
  const arDrift = Math.round((arSubledger - arGl) * 100) / 100;
  const isArMatched = Math.abs(arDrift) < 0.005;

  // 3. Accounts Payable (AP) Parity
  const apSubledger = await execScalar(sql`
    SELECT ((SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.purchase_invoices WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_outstanding_amount, outstanding_amount)), 0)::numeric FROM herobm_core.purchase_debit_notes WHERE state_code NOT IN ('draft', 'cancelled'))
          - (SELECT COALESCE(SUM(COALESCE(base_unallocated_amount, unallocated_amount)), 0)::numeric FROM herobm_core.payment_entries WHERE payment_type = 'supplier_payment' AND state_code NOT IN ('draft', 'cancelled')))::numeric
  `);
  const apGl = apId
    ? await execScalar(sql`
        SELECT COALESCE(SUM(jl.credit - jl.debit), 0)::numeric
        FROM herobm_core.gl_journal_lines jl
        WHERE jl.gl_account_id = ${apId}::uuid
      `)
    : 0;
  const apDrift = Math.round((apSubledger - apGl) * 100) / 100;
  const isApMatched = Math.abs(apDrift) < 0.005;

  // 4. Goods Received Not Invoiced (GRNI) Parity
  const grniSubledger = await execScalar(sql`
    SELECT COALESCE(SUM(CASE WHEN gr.state_code = 'received' THEN grl.quantity_received * COALESCE(grl.unit_cost, p.standard_cost, p.weighted_average_cost, 0) ELSE 0 END), 0)::numeric
    FROM herobm_core.goods_received_lines grl
    JOIN herobm_core.goods_received gr ON gr.goods_received_id = grl.goods_received_id
    JOIN herobm_core.products p ON p.product_id = grl.product_id
    WHERE gr.state_code = 'received'
  `);
  const grniGl = grniId
    ? await execScalar(sql`
        SELECT COALESCE(SUM(jl.credit - jl.debit), 0)::numeric
        FROM herobm_core.gl_journal_lines jl
        WHERE jl.gl_account_id = ${grniId}::uuid
      `)
    : 0;
  const grniDrift = Math.round((grniSubledger - grniGl) * 100) / 100;
  const isGrniMatched = Math.abs(grniDrift) < 0.005;

  // 5. Perpetual Inventory Parity
  const invSubledger = await execScalar(sql`
    SELECT COALESCE(SUM(bc.actual_quantity * COALESCE(p.standard_cost, p.weighted_average_cost, 0)), 0)::numeric
    FROM herobm_core.bin_contents bc
    JOIN herobm_core.products p ON p.product_id = bc.product_id
  `);
  const invGl = invId
    ? await execScalar(sql`
        SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::numeric
        FROM herobm_core.gl_journal_lines jl
        WHERE jl.gl_account_id = ${invId}::uuid
      `)
    : 0;
  const invDrift = Math.round((invSubledger - invGl) * 100) / 100;
  const isInvMatched = Math.abs(invDrift) < 0.005;

  const isOverallBalanced =
    isTbZeroSum && isArMatched && isApMatched && isGrniMatched && isInvMatched;

  return {
    timestamp: new Date().toISOString(),
    isOverallBalanced,
    trialBalanceZeroSum: {
      totalDebit: tbDebit,
      totalCredit: tbCredit,
      netDifference: tbDiff,
      isBalanced: isTbZeroSum,
    },
    accountsReceivable: {
      controlAccountCode: arAcct?.accountCode || '',
      controlAccountName: arAcct?.name || 'Accounts Receivable (Unconfigured)',
      subledgerBalance: arSubledger,
      glBalance: arGl,
      drift: arDrift,
      isMatched: isArMatched,
    },
    accountsPayable: {
      controlAccountCode: apAcct?.accountCode || '',
      controlAccountName: apAcct?.name || 'Accounts Payable (Unconfigured)',
      subledgerBalance: apSubledger,
      glBalance: apGl,
      drift: apDrift,
      isMatched: isApMatched,
    },
    goodsReceivedNotInvoiced: {
      controlAccountCode: grniAcct?.accountCode || '',
      controlAccountName: grniAcct?.name || 'GRNI Clearing (Unconfigured)',
      subledgerBalance: grniSubledger,
      glBalance: grniGl,
      drift: grniDrift,
      isMatched: isGrniMatched,
    },
    perpetualInventory: {
      controlAccountCode: invAcct?.accountCode || '',
      controlAccountName: invAcct?.name || 'Inventory on Hand (Unconfigured)',
      subledgerBalance: invSubledger,
      glBalance: invGl,
      drift: invDrift,
      isMatched: isInvMatched,
    },
  };
}
