/**
 * Centralized Statement of Cash Flows Calculation & Mathematical Proof Engine
 *
 * Implements Direct Activity Classification of General Ledger movements
 * partitioned into Operating, Investing, and Financing activities, with an
 * independent control account proof engine asserting zero reconciliation drift.
 */

import { DrizzleDB } from '../drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import { roundCurrency } from './gl-financial-statements.utils';

export interface CashFlowLineItem {
  id: string;
  name: string;
  category: 'operating' | 'investing' | 'financing';
  amount: number; // positive = inflow, negative = outflow
  accountCodes?: string[];
}

export interface CashFlowSection {
  title: string;
  lines: CashFlowLineItem[];
  netCash: number;
}

export interface CashFlowReconciliation {
  beginningCash: number;
  netChangeInCash: number;
  endingCash: number;
  glCashBalance: number;
  drift: number;
  isReconciled: boolean;
}

export interface CashFlowStatementResult {
  period: {
    startDate: string;
    endDate: string;
    periodName?: string;
    fiscalYear?: number;
    periodNumber?: number;
  };
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  reconciliation: CashFlowReconciliation;
  comparativePeriod?: CashFlowStatementResult;
}

export interface CalculateCashFlowOptions {
  startDate: string;
  endDate: string;
  periodName?: string;
  fiscalYear?: number;
  periodNumber?: number;
  comparativeStartDate?: string;
  comparativeEndDate?: string;
}

/**
 * Pure calculation engine for Cash Flow Statement with dual verification.
 */
export async function calculateCashFlowStatement(
  db: DrizzleDB,
  options: CalculateCashFlowOptions,
): Promise<CashFlowStatementResult> {
  const { startDate, endDate, periodName, fiscalYear, periodNumber } = options;

  // 1. Fetch all active GL accounts to determine Cash/Bank control accounts
  const accountsQuery = sql`
    SELECT
      gl_account_id AS "glAccountId",
      account_code AS "accountCode",
      name,
      account_type AS "accountType",
      is_group AS "isGroup"
    FROM herobm_core.gl_accounts
    WHERE is_group = false
    ORDER BY account_code ASC
  `;
  const rawAccounts = (await db.execute(accountsQuery)) as unknown as Array<{
    glAccountId: string;
    accountCode: string;
    name: string;
    accountType: string;
    isGroup: boolean;
  }>;

  const accountsList = Array.isArray(rawAccounts)
    ? rawAccounts
    : (rawAccounts as unknown as { rows: typeof rawAccounts }).rows || [];

  const cashAccountIds = new Set<string>();
  const accountMap = new Map<string, (typeof accountsList)[0]>();

  for (const acc of accountsList) {
    accountMap.set(acc.glAccountId, acc);
    const typeLower = (acc.accountType || '').toLowerCase();
    const code = acc.accountCode || '';

    if (
      typeLower === 'cash' ||
      typeLower === 'bank' ||
      code.startsWith('101') ||
      code.startsWith('102') ||
      code.startsWith('100') ||
      (code >= '1000' && code <= '1099')
    ) {
      cashAccountIds.add(acc.glAccountId);
    }
  }

  // 2. Independent Proof Engine: Calculate Beginning & Ending Cash Balances from GL
  const startDateSql = sql`${startDate}`;
  const endDateSql = sql`${endDate}`;

  let beginningCash = 0;
  let endingCash = 0;

  if (cashAccountIds.size > 0) {
    const cashIdsSql = sql.join(
      Array.from(cashAccountIds).map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    const cashBalancesQuery = sql`
      SELECT
        COALESCE(SUM(CASE WHEN je.entry_date < ${startDateSql} THEN jl.debit - jl.credit ELSE 0 END), 0)::numeric AS "openingCash",
        COALESCE(SUM(CASE WHEN je.entry_date <= ${endDateSql} THEN jl.debit - jl.credit ELSE 0 END), 0)::numeric AS "closingCash"
      FROM herobm_core.gl_journal_lines jl
      JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
      WHERE jl.gl_account_id IN (${cashIdsSql})
    `;

    const cashBalRes = await db.execute(cashBalancesQuery);
    const cashBalRows = Array.isArray(cashBalRes)
      ? cashBalRes
      : (
          cashBalRes as unknown as {
            rows: Array<{ openingCash: string; closingCash: string }>;
          }
        ).rows || [];

    const cashRow = cashBalRows[0] as
      | { openingCash?: string | number; closingCash?: string | number }
      | undefined;
    const rawOpening = cashRow?.openingCash ?? '0';
    const rawClosing = cashRow?.closingCash ?? '0';
    beginningCash = roundCurrency(
      typeof rawOpening === 'number'
        ? rawOpening
        : parseFloat(rawOpening || '0'),
    );
    endingCash = roundCurrency(
      typeof rawClosing === 'number'
        ? rawClosing
        : parseFloat(rawClosing || '0'),
    );
  }

  const expectedCashDelta = roundCurrency(endingCash - beginningCash);

  // 3. Direct Activity Decomposition: Fetch all journal lines touching Cash in the window
  const journalActivityQuery = sql`
    SELECT
      je.journal_entry_id AS "journalEntryId",
      je.entry_number AS "entryNumber",
      je.entry_date AS "entryDate",
      je.source_type AS "sourceType",
      je.memo AS "entryMemo",
      jl.journal_line_id AS "journalLineId",
      jl.gl_account_id AS "glAccountId",
      jl.debit::numeric AS "debit",
      jl.credit::numeric AS "credit",
      jl.party_type AS "partyType"
    FROM herobm_core.gl_journal_entries je
    JOIN herobm_core.gl_journal_lines jl ON jl.journal_entry_id = je.journal_entry_id
    WHERE je.journal_entry_id IN (
      SELECT DISTINCT je_inner.journal_entry_id
      FROM herobm_core.gl_journal_entries je_inner
      JOIN herobm_core.gl_journal_lines jl_inner ON jl_inner.journal_entry_id = je_inner.journal_entry_id
      WHERE je_inner.entry_date >= ${startDateSql}
        AND je_inner.entry_date <= ${endDateSql}
        AND jl_inner.gl_account_id IN (${
          cashAccountIds.size > 0
            ? sql.join(
                Array.from(cashAccountIds).map((id) => sql`${id}::uuid`),
                sql`, `,
              )
            : sql`'00000000-0000-0000-0000-000000000000'::uuid`
        })
    )
    ORDER BY je.entry_date ASC, je.journal_entry_id ASC
  `;

  const rawEntries = await db.execute(journalActivityQuery);
  const entryRows = (
    Array.isArray(rawEntries)
      ? rawEntries
      : (rawEntries as unknown as { rows: unknown[] }).rows || []
  ) as Array<{
    journalEntryId: string;
    entryNumber: string;
    entryDate: string;
    sourceType: string;
    entryMemo: string;
    journalLineId: string;
    glAccountId: string;
    debit: string;
    credit: string;
    partyType: string;
  }>;

  // Group lines by journal entry
  const entriesMap = new Map<string, typeof entryRows>();
  for (const row of entryRows) {
    if (!entriesMap.has(row.journalEntryId)) {
      entriesMap.set(row.journalEntryId, []);
    }
    entriesMap.get(row.journalEntryId)!.push(row);
  }

  // Buckets for Operating Activities
  let cashFromCustomers = 0;
  let cashPaidToSuppliers = 0;
  let cashPaidToEmployees = 0;
  let cashPaidForTaxes = 0;
  let cashPaidForInterest = 0;
  let otherOperatingCash = 0;

  // Buckets for Investing Activities
  let capexPurchases = 0;
  let assetDisposalProceeds = 0;
  const otherInvestingCash = 0;

  // Buckets for Financing Activities
  let equityProceeds = 0;
  let loanDrawdowns = 0;
  let debtRepayments = 0;
  let dividendDistributions = 0;
  const otherFinancingCash = 0;

  // Decompose each journal entry touching cash
  for (const [, lines] of entriesMap.entries()) {
    let entryNetCash = 0;
    const nonCashLines: Array<{
      acc: (typeof accountsList)[0];
      netLine: number;
    }> = [];

    for (const line of lines) {
      const isCash = cashAccountIds.has(line.glAccountId);
      const debit = parseFloat(line.debit || '0');
      const credit = parseFloat(line.credit || '0');
      const netMovement = debit - credit;

      if (isCash) {
        entryNetCash += netMovement;
      } else {
        const acc = accountMap.get(line.glAccountId);
        if (acc) {
          nonCashLines.push({ acc, netLine: netMovement });
        }
      }
    }

    if (Math.abs(entryNetCash) < 0.001) {
      // Inter-bank transfer: net cash impact is 0.00
      continue;
    }

    // Allocate the entry's net cash flow based on counterpart non-cash lines
    const totalOpposing = nonCashLines.reduce(
      (sum, l) => sum + Math.abs(l.netLine),
      0,
    );

    if (totalOpposing === 0) {
      // Direct cash adjustment without opposing non-cash line
      if (entryNetCash > 0) {
        otherOperatingCash += entryNetCash;
      } else {
        otherOperatingCash += entryNetCash;
      }
      continue;
    }

    for (const nl of nonCashLines) {
      const weight = Math.abs(nl.netLine) / totalOpposing;
      const allocatedCash = entryNetCash * weight;
      const code = nl.acc.accountCode || '';
      const type = (nl.acc.accountType || '').toLowerCase();

      // ── Classification Logic ───────────────────────────────────────────
      // 1. Operating Activities
      if (
        type === 'receivable' ||
        type === 'revenue' ||
        type === 'income' ||
        code.startsWith('11') ||
        code.startsWith('4')
      ) {
        cashFromCustomers += allocatedCash;
      } else if (
        type === 'payable' ||
        type === 'stock' ||
        type === 'cogs' ||
        code.startsWith('20') ||
        code.startsWith('21') ||
        code.startsWith('13') ||
        code.startsWith('5')
      ) {
        cashPaidToSuppliers += allocatedCash;
      } else if (
        code.startsWith('60') ||
        code.startsWith('61') ||
        nl.acc.name.toLowerCase().includes('wage') ||
        nl.acc.name.toLowerCase().includes('payroll')
      ) {
        cashPaidToEmployees += allocatedCash;
      } else if (
        type === 'tax' ||
        code.startsWith('12') ||
        code.startsWith('22') ||
        code.startsWith('80') ||
        nl.acc.name.toLowerCase().includes('tax') ||
        nl.acc.name.toLowerCase().includes('gst')
      ) {
        cashPaidForTaxes += allocatedCash;
      } else if (
        nl.acc.name.toLowerCase().includes('interest') ||
        nl.acc.name.toLowerCase().includes('finance') ||
        code.startsWith('7')
      ) {
        cashPaidForInterest += allocatedCash;
      }
      // 2. Investing Activities
      else if (
        code.startsWith('15') ||
        code.startsWith('16') ||
        code.startsWith('17') ||
        code.startsWith('18') ||
        code.startsWith('19') ||
        type.includes('depreciation')
      ) {
        if (allocatedCash < 0) {
          capexPurchases += allocatedCash;
        } else {
          assetDisposalProceeds += allocatedCash;
        }
      }
      // 3. Financing Activities
      else if (
        code.startsWith('25') ||
        code.startsWith('26') ||
        code.startsWith('27') ||
        code.startsWith('28') ||
        code.startsWith('29') ||
        nl.acc.name.toLowerCase().includes('loan') ||
        nl.acc.name.toLowerCase().includes('borrowing')
      ) {
        if (allocatedCash > 0) {
          loanDrawdowns += allocatedCash;
        } else {
          debtRepayments += allocatedCash;
        }
      } else if (
        type === 'equity' ||
        code.startsWith('3') ||
        nl.acc.name.toLowerCase().includes('capital') ||
        nl.acc.name.toLowerCase().includes('equity') ||
        nl.acc.name.toLowerCase().includes('drawing') ||
        nl.acc.name.toLowerCase().includes('dividend')
      ) {
        if (allocatedCash > 0) {
          equityProceeds += allocatedCash;
        } else {
          dividendDistributions += allocatedCash;
        }
      }
      // Default: Operating
      else {
        otherOperatingCash += allocatedCash;
      }
    }
  }

  // 4. Build Structured Sections
  const operatingLines: CashFlowLineItem[] = [
    {
      id: 'op-customers',
      name: 'Cash Receipts from Customers & Sales',
      category: 'operating' as const,
      amount: roundCurrency(cashFromCustomers),
    },
    {
      id: 'op-suppliers',
      name: 'Cash Paid to Suppliers & Inventory',
      category: 'operating' as const,
      amount: roundCurrency(cashPaidToSuppliers),
    },
    {
      id: 'op-employees',
      name: 'Cash Paid to Employees & Payroll',
      category: 'operating' as const,
      amount: roundCurrency(cashPaidToEmployees),
    },
    {
      id: 'op-tax',
      name: 'Income Tax & GST Payments (Net)',
      category: 'operating' as const,
      amount: roundCurrency(cashPaidForTaxes),
    },
    {
      id: 'op-interest',
      name: 'Interest & Finance Charges Paid',
      category: 'operating' as const,
      amount: roundCurrency(cashPaidForInterest),
    },
    {
      id: 'op-other',
      name: 'Other Operating Cash Movements',
      category: 'operating' as const,
      amount: roundCurrency(otherOperatingCash),
    },
  ].filter((l) => Math.abs(l.amount) > 0.001);

  const netOperatingCash = roundCurrency(
    operatingLines.reduce((sum, l) => sum + l.amount, 0),
  );

  const investingLines: CashFlowLineItem[] = [
    {
      id: 'inv-capex',
      name: 'Purchase of Property, Plant & Equipment (Capex)',
      category: 'investing' as const,
      amount: roundCurrency(capexPurchases),
    },
    {
      id: 'inv-disposals',
      name: 'Proceeds from Sale of Fixed Assets',
      category: 'investing' as const,
      amount: roundCurrency(assetDisposalProceeds),
    },
    {
      id: 'inv-other',
      name: 'Other Investing Cash Transactions',
      category: 'investing' as const,
      amount: roundCurrency(otherInvestingCash),
    },
  ].filter((l) => Math.abs(l.amount) > 0.001);

  const netInvestingCash = roundCurrency(
    investingLines.reduce((sum, l) => sum + l.amount, 0),
  );

  const financingLines: CashFlowLineItem[] = [
    {
      id: 'fin-equity',
      name: 'Proceeds from Issuance of Share Capital',
      category: 'financing' as const,
      amount: roundCurrency(equityProceeds),
    },
    {
      id: 'fin-loans',
      name: 'Proceeds from Borrowings & Bank Facilities',
      category: 'financing' as const,
      amount: roundCurrency(loanDrawdowns),
    },
    {
      id: 'fin-repayments',
      name: 'Repayment of Borrowings & Leases',
      category: 'financing' as const,
      amount: roundCurrency(debtRepayments),
    },
    {
      id: 'fin-dividends',
      name: 'Dividends & Capital Distributions Paid',
      category: 'financing' as const,
      amount: roundCurrency(dividendDistributions),
    },
    {
      id: 'fin-other',
      name: 'Other Financing Cash Movements',
      category: 'financing' as const,
      amount: roundCurrency(otherFinancingCash),
    },
  ].filter((l) => Math.abs(l.amount) > 0.001);

  const netFinancingCash = roundCurrency(
    financingLines.reduce((sum, l) => sum + l.amount, 0),
  );

  const netChangeInCash = roundCurrency(
    netOperatingCash + netInvestingCash + netFinancingCash,
  );

  // 5. Dual Verification Check (Parity Proof)
  const drift = roundCurrency(netChangeInCash - expectedCashDelta);
  const isReconciled = Math.abs(drift) < 0.05;

  const currentResult: CashFlowStatementResult = {
    period: {
      startDate,
      endDate,
      periodName,
      fiscalYear,
      periodNumber,
    },
    operatingActivities: {
      title: 'Cash Flows from Operating Activities',
      lines: operatingLines,
      netCash: netOperatingCash,
    },
    investingActivities: {
      title: 'Cash Flows from Investing Activities',
      lines: investingLines,
      netCash: netInvestingCash,
    },
    financingActivities: {
      title: 'Cash Flows from Financing Activities',
      lines: financingLines,
      netCash: netFinancingCash,
    },
    reconciliation: {
      beginningCash,
      netChangeInCash,
      endingCash,
      glCashBalance: endingCash,
      drift,
      isReconciled,
    },
  };

  // 6. Optional Comparative Period
  if (options.comparativeStartDate && options.comparativeEndDate) {
    const comparativeResult = await calculateCashFlowStatement(db, {
      startDate: options.comparativeStartDate,
      endDate: options.comparativeEndDate,
    });
    currentResult.comparativePeriod = comparativeResult;
  }

  return currentResult;
}
