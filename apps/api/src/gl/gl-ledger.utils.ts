import { DrizzleDB } from '../drizzle/drizzle.module';
import { glSettings, glAccounts } from '@herobm/db-schema';
import { sql, eq } from 'drizzle-orm';

export interface GeneralLedgerFilters {
  accountCode?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  page?: number;
}

export async function fetchTrialBalance(
  db: DrizzleDB,
  asOfDate?: string,
  periodStart?: string,
) {
  // Determine the fiscal year start month
  const [settings] = await db
    .select({ fiscalYearStartMonth: glSettings.fiscalYearStartMonth })
    .from(glSettings)
    .limit(1);
  const fysm = settings?.fiscalYearStartMonth || 1;

  // Use current date if asOfDate is not provided
  const targetDateStr = asOfDate || new Date().toISOString().slice(0, 10);
  const targetDate = new Date(targetDateStr);

  let fyYear = targetDate.getFullYear();
  if (targetDate.getMonth() + 1 < fysm) {
    fyYear -= 1;
  }
  const financialYearStart = `${fyYear}-${String(fysm).padStart(2, '0')}-01`;

  const asOfDateSql = asOfDate ? sql`${asOfDate}` : sql`CURRENT_DATE`;
  const periodStartSql = periodStart ? sql`${periodStart}` : sql`'1970-01-01'`;
  const financialYearStartSql = sql`${financialYearStart}`;

  const query = sql`
    SELECT
      a.account_code,
      a.name,
      a.account_type,
      a.is_group,
      COALESCE(SUM(CASE WHEN je.entry_date < ${periodStartSql} THEN jl.debit - jl.credit ELSE 0 END), 0)::numeric AS opening_balance,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${periodStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS period_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${periodStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS period_credit,
      COALESCE(SUM(CASE WHEN je.entry_date <= ${asOfDateSql} THEN jl.debit - jl.credit ELSE 0 END), 0)::numeric AS closing_balance,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.debit ELSE 0 END), 0)::numeric AS ytd_debit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.credit ELSE 0 END), 0)::numeric AS ytd_credit,
      COALESCE(SUM(CASE WHEN je.entry_date >= ${financialYearStartSql} AND je.entry_date <= ${asOfDateSql} THEN jl.debit - jl.credit ELSE 0 END), 0)::numeric AS ytd_balance
    FROM herobm_core.gl_accounts a
    LEFT JOIN herobm_core.gl_journal_lines jl ON jl.gl_account_id = a.gl_account_id
    LEFT JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
    WHERE a.is_group = false
    GROUP BY a.gl_account_id, a.account_code, a.name, a.account_type, a.is_group
    ORDER BY a.account_code
  `;

  const rows = await db.execute(query);
  const resultRows = Array.isArray(rows)
    ? rows
    : (rows as { rows: unknown[] }).rows || [];

  return resultRows.map(
    (r: {
      account_code: string;
      name: string;
      account_type: string;
      is_group: boolean;
      opening_balance?: string;
      period_debit?: string;
      period_credit?: string;
      closing_balance?: string;
      ytd_debit?: string;
      ytd_credit?: string;
      ytd_balance?: string;
    }) => ({
      accountCode: r.account_code,
      name: r.name,
      accountType: r.account_type,
      isGroup: r.is_group,
      openingBalance: parseFloat(r.opening_balance || '0'),
      periodDebit: parseFloat(r.period_debit || '0'),
      periodCredit: parseFloat(r.period_credit || '0'),
      closingBalance: parseFloat(r.closing_balance || '0'),
      ytdDebit: parseFloat(r.ytd_debit || '0'),
      ytdCredit: parseFloat(r.ytd_credit || '0'),
      ytdBalance: parseFloat(r.ytd_balance || '0'),
    }),
  );
}

export async function fetchGeneralLedger(
  db: DrizzleDB,
  filters: GeneralLedgerFilters,
) {
  const conditions: import('drizzle-orm').SQL[] = [];

  if (filters.accountCode) {
    conditions.push(sql`a.account_code = ${filters.accountCode}`);
  }
  if (filters.fromDate) {
    conditions.push(sql`je.entry_date >= ${filters.fromDate}`);
  }
  if (filters.toDate) {
    conditions.push(sql`je.entry_date <= ${filters.toDate}`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit || 50, 200);
  const offset = (page - 1) * limit;

  let openingBalance = 0;
  let accountSummary: {
    accountCode: string;
    accountName: string;
    accountType: string;
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    netMovement: number;
    closingBalance: number;
  } | null = null;

  let targetAccount: {
    glAccountId: string;
    accountCode: string;
    name: string;
    accountType: string;
  } | null = null;

  if (filters.accountCode) {
    const [acc] = await db
      .select({
        glAccountId: glAccounts.glAccountId,
        accountCode: glAccounts.accountCode,
        name: glAccounts.name,
        accountType: glAccounts.accountType,
      })
      .from(glAccounts)
      .where(eq(glAccounts.accountCode, filters.accountCode))
      .limit(1);
    targetAccount = acc || null;

    if (targetAccount) {
      if (filters.fromDate) {
        const openBalRes = await db.execute(sql`
          SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::numeric AS opening_balance
          FROM herobm_core.gl_journal_lines jl
          JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
          WHERE jl.gl_account_id = ${targetAccount.glAccountId}
            AND je.entry_date < ${filters.fromDate}
        `);
        const openRow = Array.isArray(openBalRes)
          ? openBalRes[0]
          : (openBalRes as { rows: unknown[] })?.rows?.[0];
        openingBalance = parseFloat(
          (openRow as { opening_balance?: string })?.opening_balance || '0',
        );
      }

      const summaryConditions: import('drizzle-orm').SQL[] = [
        sql`jl.gl_account_id = ${targetAccount.glAccountId}`,
      ];
      if (filters.fromDate) {
        summaryConditions.push(sql`je.entry_date >= ${filters.fromDate}`);
      }
      if (filters.toDate) {
        summaryConditions.push(sql`je.entry_date <= ${filters.toDate}`);
      }

      const summaryWhere = sql`WHERE ${sql.join(summaryConditions, sql` AND `)}`;
      const sumRes = await db.execute(sql`
        SELECT
          COALESCE(SUM(jl.debit), 0)::numeric AS period_debit,
          COALESCE(SUM(jl.credit), 0)::numeric AS period_credit
        FROM herobm_core.gl_journal_lines jl
        JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
        ${summaryWhere}
      `);
      const sumRow = Array.isArray(sumRes)
        ? sumRes[0]
        : (sumRes as { rows: unknown[] })?.rows?.[0];

      const periodDebit = parseFloat(
        (sumRow as { period_debit?: string })?.period_debit || '0',
      );
      const periodCredit = parseFloat(
        (sumRow as { period_credit?: string })?.period_credit || '0',
      );
      const netMovement = Math.round((periodDebit - periodCredit) * 100) / 100;
      const closingBalance =
        Math.round((openingBalance + netMovement) * 100) / 100;

      accountSummary = {
        accountCode: targetAccount.accountCode,
        accountName: targetAccount.name,
        accountType: targetAccount.accountType,
        openingBalance: Math.round(openingBalance * 100) / 100,
        periodDebit: Math.round(periodDebit * 100) / 100,
        periodCredit: Math.round(periodCredit * 100) / 100,
        netMovement,
        closingBalance,
      };
    }
  }

  const runningBalanceSelect = targetAccount
    ? sql`(COALESCE(SUM(jl.debit - jl.credit) OVER (
        ORDER BY je.entry_date ASC, je.entry_number ASC, jl.journal_line_id ASC
      ), 0)::numeric + ${openingBalance})::numeric AS running_balance`
    : sql`NULL::numeric AS running_balance`;

  const entriesQuery = sql`
    SELECT
      je.journal_entry_id AS journal_entry_id,
      je.entry_number,
      je.entry_date,
      je.memo AS entry_memo,
      je.source_type,
      je.source_id,
      a.account_code,
      a.name AS account_name,
      jl.party_type,
      jl.party_id,
      jl.debit,
      jl.credit,
      jl.memo AS line_memo,
      je.created_by,
      je.created_on,
      ${runningBalanceSelect}
    FROM herobm_core.gl_journal_lines jl
    JOIN herobm_core.gl_journal_entries je
      ON je.journal_entry_id = jl.journal_entry_id
    JOIN herobm_core.gl_accounts a
      ON a.gl_account_id = jl.gl_account_id
    ${whereClause}
    ORDER BY je.entry_date DESC, je.entry_number DESC, jl.journal_line_id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countQuery = sql`
    SELECT count(*)::int as count 
    FROM herobm_core.gl_journal_lines jl
    JOIN herobm_core.gl_journal_entries je
      ON je.journal_entry_id = jl.journal_entry_id
    JOIN herobm_core.gl_accounts a
      ON a.gl_account_id = jl.gl_account_id
    ${whereClause}
  `;

  const [entriesResult, countResult] = await Promise.all([
    db.execute(entriesQuery),
    db.execute(countQuery),
  ]);

  const rawRows = (
    Array.isArray(entriesResult)
      ? entriesResult
      : (entriesResult as { rows: unknown[] }).rows || []
  ) as {
    journal_entry_id: string;
    entry_number: string;
    entry_date: string;
    entry_memo?: string;
    source_type?: string;
    source_id?: string;
    account_code: string;
    account_name: string;
    party_type?: string;
    party_id?: string;
    debit?: string;
    credit?: string;
    line_memo?: string;
    created_by: string;
    created_on: Date;
    running_balance?: string | null;
  }[];
  const countRows = (
    Array.isArray(countResult)
      ? countResult
      : (countResult as { rows: unknown[] }).rows || []
  ) as { count: number }[];

  const entries = rawRows.map((row) => ({
    journalEntryId: row.journal_entry_id,
    entryNumber: row.entry_number,
    entryDate: row.entry_date,
    entryMemo: row.entry_memo,
    sourceType: row.source_type,
    sourceId: row.source_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    partyType: row.party_type,
    partyId: row.party_id,
    debit: row.debit,
    credit: row.credit,
    lineMemo: row.line_memo,
    createdBy: row.created_by,
    createdOn: row.created_on,
    runningBalance:
      row.running_balance != null ? parseFloat(row.running_balance) : null,
  }));

  return {
    data: entries,
    page,
    limit,
    total: countRows[0]?.count ?? 0,
    accountSummary,
  };
}

export async function fetchBusinessReportData(
  db: DrizzleDB,
  filters: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const conditions: import('drizzle-orm').SQL[] = [];
  if (filters.fromDate) {
    conditions.push(sql`je.entry_date >= ${filters.fromDate}`);
  }
  if (filters.toDate) {
    conditions.push(sql`je.entry_date <= ${filters.toDate}`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  const rows = await db.execute(sql`
    SELECT
      a.account_code AS "accountCode",
      a.name AS "accountName",
      a.account_type AS "accountType",
      COALESCE(SUM(activity.debit), 0)::numeric  AS "totalDebit",
      COALESCE(SUM(activity.credit), 0)::numeric AS "totalCredit",
      COALESCE(SUM(activity.debit), 0) - COALESCE(SUM(activity.credit), 0) AS "balance"
    FROM herobm_core.gl_accounts a
    JOIN (
      SELECT jl.gl_account_id, jl.debit, jl.credit
      FROM herobm_core.gl_journal_lines jl
      JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
      ${whereClause}
    ) activity ON activity.gl_account_id = a.gl_account_id
    WHERE a.is_group = false
    GROUP BY a.gl_account_id, a.account_code, a.name, a.account_type, a.is_group
    ORDER BY a.account_code
  `);

  return Array.isArray(rows)
    ? (rows as Record<string, unknown>[])
    : (rows as { rows: Record<string, unknown>[] }).rows || [];
}
