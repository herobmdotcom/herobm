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
import { TAKE_ON_JOURNAL_SOURCE_TYPES } from '@herobm/shared';

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
  glSettings?: {
    defaultArAccountId?: string | null;
    defaultApAccountId?: string | null;
    defaultRevenueAccountId?: string | null;
    defaultCogsAccountId?: string | null;
    defaultSalesTaxAccountId?: string | null;
    defaultPurchaseTaxAccountId?: string | null;
    defaultInventoryAccountId?: string | null;
    defaultExpenseAccountId?: string | null;
  };
}

export interface CashFlowCounterpartClassification {
  lineId: string;
  lineName: string;
  category: 'operating' | 'investing' | 'financing';
}

export interface CashFlowDrilldownTransaction {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  sourceType: string;
  memo: string;
  partyType?: string;
  partyName?: string;
  accountCode: string;
  accountName: string;
  allocatedCash: number;
}

export interface CashFlowDrilldownStatementResult {
  lineId: string;
  lineName: string;
  category: 'operating' | 'investing' | 'financing';
  totalAmount: number;
  transactions: CashFlowDrilldownTransaction[];
}

export function classifyCashFlowCounterpart(
  nl: {
    acc: {
      glAccountId: string;
      accountCode?: string | null;
      name?: string | null;
      accountType?: string | null;
    };
    partyType?: string | null;
  },
  allocatedCash: number,
  entrySourceType: string,
  glSettings?: CalculateCashFlowOptions['glSettings'],
): CashFlowCounterpartClassification {
  const type = (nl.acc.accountType || '').toLowerCase();
  const rawName = (nl.acc.name || '').toLowerCase();
  // Remove diacritics / accents for universal language matching (e.g. matériel -> materiel)
  const name = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const party = (nl.partyType || '').toLowerCase();
  const source = entrySourceType.toLowerCase();

  // Control account mappings (if provided in options)
  const isArAccount = glSettings?.defaultArAccountId === nl.acc.glAccountId;
  const isApAccount = glSettings?.defaultApAccountId === nl.acc.glAccountId;
  const isTaxAccount =
    glSettings?.defaultSalesTaxAccountId === nl.acc.glAccountId ||
    glSettings?.defaultPurchaseTaxAccountId === nl.acc.glAccountId;
  const isRevenueAccount =
    glSettings?.defaultRevenueAccountId === nl.acc.glAccountId;
  const isCogsOrInvAccount =
    glSettings?.defaultCogsAccountId === nl.acc.glAccountId ||
    glSettings?.defaultInventoryAccountId === nl.acc.glAccountId;

  // 1. Operating Activities: Customer & Sales Receipts
  if (
    isArAccount ||
    isRevenueAccount ||
    party === 'customer' ||
    source === 'sales_invoice' ||
    source === 'customer_receipt' ||
    source === 'receipt' ||
    (source === 'payment_entry' &&
      (allocatedCash > 0 || party === 'customer')) ||
    type === 'receivable' ||
    type === 'revenue' ||
    type === 'income' ||
    name.includes('customer') ||
    name.includes('client') ||
    name.includes('receivable') ||
    name.includes('forder') ||
    name.includes('creance') ||
    name.includes('sales') ||
    name.includes('erlos') ||
    name.includes('vente')
  ) {
    return {
      lineId: 'op-customers',
      lineName: 'Cash Receipts from Customers & Sales',
      category: 'operating',
    };
  }

  // 2. Operating Activities: Tax & GST Payments
  if (
    isTaxAccount ||
    type === 'tax' ||
    name.includes('tax') ||
    name.includes('gst') ||
    name.includes('vat') ||
    name.includes('steuer') ||
    name.includes('tva') ||
    name.includes('clearing')
  ) {
    return {
      lineId: 'op-tax',
      lineName: 'Income Tax & GST Payments (Net)',
      category: 'operating',
    };
  }

  // 3. Operating Activities: Employee Wages & Payroll
  if (
    name.includes('wage') ||
    name.includes('payroll') ||
    name.includes('salary') ||
    name.includes('gehalt') ||
    name.includes('lohn') ||
    name.includes('salaire') ||
    name.includes('superannuation') ||
    name.includes('pension')
  ) {
    return {
      lineId: 'op-employees',
      lineName: 'Cash Paid to Employees & Payroll',
      category: 'operating',
    };
  }

  // 4. Operating Activities: Interest & Finance Costs
  if (
    name.includes('interest') ||
    name.includes('zins') ||
    name.includes('interet') ||
    name.includes('finance charge') ||
    name.includes('bank fee')
  ) {
    return {
      lineId: 'op-interest',
      lineName: 'Interest & Finance Charges Paid',
      category: 'operating',
    };
  }

  // 5. Operating Activities: Supplier & Inventory Payments
  if (
    isApAccount ||
    isCogsOrInvAccount ||
    party === 'supplier' ||
    party === 'vendor' ||
    source === 'purchase_invoice' ||
    source === 'supplier_payment' ||
    type === 'payable' ||
    type === 'stock' ||
    type === 'cogs' ||
    type === 'expense' ||
    name.includes('supplier') ||
    name.includes('vendor') ||
    name.includes('fournisseur') ||
    name.includes('verbindlich') ||
    name.includes('payable') ||
    name.includes('inventory') ||
    name.includes('stock') ||
    name.includes('wareneingang') ||
    name.includes('cogs') ||
    name.includes('material') ||
    name.includes('direct cost')
  ) {
    return {
      lineId: 'op-suppliers',
      lineName: 'Cash Paid to Suppliers & Inventory',
      category: 'operating',
    };
  }

  // 6. Investing Activities: Capex & Fixed Asset Movements
  if (
    type.includes('depreciation') ||
    (type === 'asset' &&
      !isArAccount &&
      !isCogsOrInvAccount &&
      !name.includes('receivable') &&
      !name.includes('inventory') &&
      !name.includes('prepaid') &&
      !name.includes('deposit')) ||
    name.includes('machinery') ||
    name.includes('equipment') ||
    name.includes('property') ||
    name.includes('plant') ||
    name.includes('sachanlage') ||
    name.includes('materiel') ||
    name.includes('immobilis') ||
    name.includes('vehicle') ||
    name.includes('capex')
  ) {
    if (allocatedCash < 0) {
      return {
        lineId: 'inv-capex',
        lineName: 'Purchase of Property, Plant & Equipment (Capex)',
        category: 'investing',
      };
    }
    return {
      lineId: 'inv-disposals',
      lineName: 'Proceeds from Sale of Fixed Assets',
      category: 'investing',
    };
  }

  // 7. Financing Activities: Loans & Borrowings
  if (
    (type === 'liability' &&
      !isApAccount &&
      !isTaxAccount &&
      !name.includes('payable') &&
      !name.includes('tax') &&
      !name.includes('gst') &&
      !name.includes('accru')) ||
    name.includes('loan') ||
    name.includes('borrowing') ||
    name.includes('darlehen') ||
    name.includes('kredit') ||
    name.includes('emprunt') ||
    name.includes('debt') ||
    name.includes('facility')
  ) {
    if (allocatedCash > 0) {
      return {
        lineId: 'fin-loans',
        lineName: 'Proceeds from Borrowings & Bank Facilities',
        category: 'financing',
      };
    }
    return {
      lineId: 'fin-repayments',
      lineName: 'Repayment of Borrowings & Leases',
      category: 'financing',
    };
  }

  // 8. Financing Activities: Equity & Distributions
  if (
    type === 'equity' ||
    name.includes('capital') ||
    name.includes('equity') ||
    name.includes('drawing') ||
    name.includes('dividend') ||
    name.includes('stammkapital') ||
    name.includes('eigenkapital')
  ) {
    if (allocatedCash > 0) {
      return {
        lineId: 'fin-equity',
        lineName: 'Proceeds from Issuance of Share Capital',
        category: 'financing',
      };
    }
    return {
      lineId: 'fin-dividends',
      lineName: 'Dividends & Capital Distributions Paid',
      category: 'financing',
    };
  }

  // 9. Default: Other Operating Cash
  return {
    lineId: 'op-other',
    lineName: 'Other Operating Cash Movements',
    category: 'operating',
  };
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
      is_group AS "isGroup",
      is_bank_account AS "isBankAccount"
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
    isBankAccount?: boolean;
  }>;

  const accountsList = Array.isArray(rawAccounts)
    ? rawAccounts
    : (rawAccounts as unknown as { rows: typeof rawAccounts }).rows || [];

  const cashAccountIds = new Set<string>();
  const accountMap = new Map<string, (typeof accountsList)[0]>();

  for (const acc of accountsList) {
    accountMap.set(acc.glAccountId, acc);
    const typeLower = (acc.accountType || '').toLowerCase();

    if (
      acc.isBankAccount === true ||
      typeLower === 'cash' ||
      typeLower === 'bank'
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
        COALESCE(SUM(CASE 
          WHEN je.entry_date < ${startDateSql} 
            OR LOWER(je.source_type) IN ('initial_import', 'opening_balance')
            OR UPPER(je.source_type) IN ('INITIAL_IMPORT', 'OPENING_BALANCE')
            OR je.entry_number LIKE 'JE-OPENING-%'
          THEN jl.debit - jl.credit 
          ELSE 0 
        END), 0)::numeric AS "openingCash",
        COALESCE(SUM(CASE 
          WHEN je.entry_date <= ${endDateSql} 
          THEN jl.debit - jl.credit 
          ELSE 0 
        END), 0)::numeric AS "closingCash"
      FROM herobm_core.gl_journal_lines jl
      JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
      WHERE jl.gl_account_id IN (${cashIdsSql})
        AND je.is_reversed = false
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

  // 3. Direct Activity Decomposition: Fetch all operational journal lines touching Cash in the window
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
        AND je_inner.is_reversed = false
        AND UPPER(je_inner.source_type) NOT IN ('INITIAL_IMPORT', 'OPENING_BALANCE')
        AND je_inner.entry_number NOT LIKE 'JE-OPENING-%'
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
    const entrySourceType = lines[0]?.sourceType || '';
    const nonCashLines: Array<{
      acc: (typeof accountsList)[0];
      netLine: number;
      partyType?: string;
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
          nonCashLines.push({
            acc,
            netLine: netMovement,
            partyType: line.partyType,
          });
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
      otherOperatingCash += entryNetCash;
      continue;
    }

    for (const nl of nonCashLines) {
      const weight = Math.abs(nl.netLine) / totalOpposing;
      const allocatedCash = entryNetCash * weight;
      const classification = classifyCashFlowCounterpart(
        nl,
        allocatedCash,
        entrySourceType,
        options.glSettings,
      );

      switch (classification.lineId) {
        case 'op-customers':
          cashFromCustomers += allocatedCash;
          break;
        case 'op-tax':
          cashPaidForTaxes += allocatedCash;
          break;
        case 'op-employees':
          cashPaidToEmployees += allocatedCash;
          break;
        case 'op-interest':
          cashPaidForInterest += allocatedCash;
          break;
        case 'op-suppliers':
          cashPaidToSuppliers += allocatedCash;
          break;
        case 'inv-capex':
          capexPurchases += allocatedCash;
          break;
        case 'inv-disposals':
          assetDisposalProceeds += allocatedCash;
          break;
        case 'fin-loans':
          loanDrawdowns += allocatedCash;
          break;
        case 'fin-repayments':
          debtRepayments += allocatedCash;
          break;
        case 'fin-equity':
          equityProceeds += allocatedCash;
          break;
        case 'fin-dividends':
          dividendDistributions += allocatedCash;
          break;
        default:
          otherOperatingCash += allocatedCash;
          break;
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

/**
 * Lazy-loaded drilldown engine for a single Cash Flow line item.
 * Resolves all decomposed journal lines that contributed to the target line bucket.
 */
export async function calculateCashFlowLineDrilldown(
  db: DrizzleDB,
  options: CalculateCashFlowOptions,
  targetLineId: string,
): Promise<CashFlowDrilldownStatementResult> {
  const { startDate, endDate } = options;

  // 1. Fetch active accounts to map cash accounts and opposing details
  const accountsQuery = sql`
    SELECT
      gl_account_id AS "glAccountId",
      account_code AS "accountCode",
      name,
      account_type AS "accountType",
      is_group AS "isGroup",
      is_bank_account AS "isBankAccount"
    FROM herobm_core.gl_accounts
    WHERE is_group = false
  `;

  const rawAccounts = await db.execute(accountsQuery);
  const accountRows = (
    Array.isArray(rawAccounts)
      ? rawAccounts
      : (rawAccounts as unknown as { rows: unknown[] }).rows || []
  ) as Array<{
    glAccountId: string;
    accountCode: string;
    name: string;
    accountType: string;
    isGroup: boolean;
    isBankAccount: boolean;
  }>;

  const cashAccountIds = new Set<string>();
  const accountMap = new Map<string, (typeof accountRows)[0]>();

  for (const acc of accountRows) {
    accountMap.set(acc.glAccountId, acc);
    const typeLower = (acc.accountType || '').toLowerCase();
    if (
      acc.isBankAccount === true ||
      typeLower === 'cash' ||
      typeLower === 'bank'
    ) {
      cashAccountIds.add(acc.glAccountId);
    }
  }

  // 2. Fetch journal entries touching bank accounts in this window
  const journalActivityQuery = sql`
    WITH relevant_entries AS (
      SELECT DISTINCT journal_entry_id
      FROM herobm_core.gl_journal_lines
      WHERE gl_account_id IN (
        SELECT gl_account_id FROM herobm_core.gl_accounts
        WHERE is_group = false AND is_bank_account = true
      )
    )
    SELECT
      je.journal_entry_id AS "journalEntryId",
      je.entry_number AS "entryNumber",
      je.entry_date AS "entryDate",
      je.source_type AS "sourceType",
      je.memo AS "entryMemo",
      jl.journal_line_id AS "journalLineId",
      jl.gl_account_id AS "glAccountId",
      jl.debit::text AS "debit",
      jl.credit::text AS "credit",
      jl.party_type AS "partyType"
    FROM herobm_core.gl_journal_entries je
    JOIN herobm_core.gl_journal_lines jl ON jl.journal_entry_id = je.journal_entry_id
    WHERE je.journal_entry_id IN (SELECT journal_entry_id FROM relevant_entries)
      AND je.entry_date >= ${startDate}::date
      AND je.entry_date <= ${endDate}::date
      AND je.is_reversed = false
      AND LOWER(je.source_type) NOT IN ('initial_import', 'opening_balance')
      AND UPPER(je.source_type) NOT IN ('INITIAL_IMPORT', 'OPENING_BALANCE')
      AND je.entry_number NOT LIKE 'JE-OPENING-%'
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

  const entriesMap = new Map<string, typeof entryRows>();
  for (const row of entryRows) {
    if (!entriesMap.has(row.journalEntryId)) {
      entriesMap.set(row.journalEntryId, []);
    }
    entriesMap.get(row.journalEntryId)!.push(row);
  }

  let lineName = targetLineId;
  let category: 'operating' | 'investing' | 'financing' = 'operating';
  const transactions: CashFlowDrilldownTransaction[] = [];

  for (const [, lines] of entriesMap) {
    let entryNetCash = 0;
    const nonCashLines: Array<{
      acc: (typeof accountRows)[0];
      netLine: number;
      partyType?: string | null;
    }> = [];
    const entrySourceType = lines[0]?.sourceType || 'manual';
    const entryNumber = lines[0]?.entryNumber || '';
    const rawDate = lines[0]?.entryDate;
    const entryDate =
      typeof rawDate === 'string'
        ? rawDate.slice(0, 10)
        : rawDate
          ? new Date(rawDate).toISOString().slice(0, 10)
          : '';
    const entryMemo = lines[0]?.entryMemo || '';

    for (const line of lines) {
      const debit = parseFloat(line.debit || '0') || 0;
      const credit = parseFloat(line.credit || '0') || 0;
      const netMovement = debit - credit;

      if (cashAccountIds.has(line.glAccountId)) {
        entryNetCash += netMovement;
      } else {
        const acc = accountMap.get(line.glAccountId);
        if (acc) {
          nonCashLines.push({
            acc,
            netLine: netMovement,
            partyType: line.partyType,
          });
        }
      }
    }

    if (Math.abs(entryNetCash) < 0.001) continue;

    const totalOpposing = nonCashLines.reduce(
      (sum, l) => sum + Math.abs(l.netLine),
      0,
    );

    if (totalOpposing === 0) {
      if (targetLineId === 'op-other') {
        lineName = 'Other Operating Cash Movements';
        category = 'operating';
        transactions.push({
          journalEntryId: lines[0].journalEntryId,
          entryNumber,
          entryDate,
          sourceType: entrySourceType,
          memo: entryMemo || 'Direct Cash Adjustment',
          accountCode: '',
          accountName: 'Direct Cash Adjustment',
          allocatedCash: roundCurrency(entryNetCash),
        });
      }
      continue;
    }

    for (const nl of nonCashLines) {
      const weight = Math.abs(nl.netLine) / totalOpposing;
      const allocatedCash = entryNetCash * weight;
      const classification = classifyCashFlowCounterpart(
        nl,
        allocatedCash,
        entrySourceType,
        options.glSettings,
      );

      if (classification.lineId === targetLineId) {
        lineName = classification.lineName;
        category = classification.category;
        transactions.push({
          journalEntryId: lines[0].journalEntryId,
          entryNumber,
          entryDate,
          sourceType: entrySourceType,
          memo: entryMemo || nl.acc.name || '',
          partyType: nl.partyType || undefined,
          accountCode: nl.acc.accountCode || '',
          accountName: nl.acc.name || '',
          allocatedCash: roundCurrency(allocatedCash),
        });
      }
    }
  }

  const totalAmount = roundCurrency(
    transactions.reduce((sum, t) => sum + t.allocatedCash, 0),
  );

  return {
    lineId: targetLineId,
    lineName,
    category,
    totalAmount,
    transactions,
  };
}
