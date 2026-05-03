import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, isNull, and, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glAccounts,
  glJournalEntries,
  glJournalLines,
  glSettings,
  accounts,
  suppliers,
  outbox,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import {
  REVENUE_ROUTING_PRECEDENCE,
  EXPENSE_ROUTING_PRECEDENCE,
} from '@modbm/shared';
import { JournalLineDto } from './dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class JournalMeta {
  sourceType!:
    | 'sales_invoice'
    | 'purchase_invoice'
    | 'sales_credit_note'
    | 'manual'
    | 'adjustment'
    | 'inventory_receipt'
    | 'inventory_dispatch'
    | 'inventory_adjustment';
  sourceId?: string;
  memo?: string;
  entryDate?: string; // ISO date, defaults to today
  actor?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class GlService {
  private readonly logger = new Logger(GlService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Core: Post a balanced journal entry
  // -------------------------------------------------------------------------

  async postJournalEntry(lines: JournalLineDto[], meta: JournalMeta) {
    if (!lines || lines.length < 2) {
      throw new BadRequestException(
        'A journal entry requires at least 2 lines.',
      );
    }

    // 1. Validate balance invariant
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    // Use rounding to avoid floating-point issues (2 decimal places)
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new BadRequestException(
        `Journal entry is unbalanced: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}`,
      );
    }

    // 2. Resolve account codes/IDs and validate
    const accountCodes = [
      ...new Set(lines.map((l) => l.accountCode).filter(Boolean)),
    ];
    const accountIds = [
      ...new Set(lines.map((l) => l.accountId).filter(Boolean)),
    ];

    const conditions = [];
    if (accountCodes.length > 0) {
      conditions.push(
        sql`${glAccounts.accountCode} IN (${sql.join(
          accountCodes.map((c) => sql`${c}`),
          sql`, `,
        )})`,
      );
    }
    if (accountIds.length > 0) {
      conditions.push(
        sql`${glAccounts.glAccountId} IN (${sql.join(
          accountIds.map((c) => sql`${c}`),
          sql`, `,
        )})`,
      );
    }

    if (conditions.length === 0) {
      throw new BadRequestException(
        'All journal lines must specify either accountCode or accountId.',
      );
    }

    const accountRows = await this.db
      .select({
        glAccountId: glAccounts.glAccountId,
        accountCode: glAccounts.accountCode,
        isGroup: glAccounts.isGroup,
        isActive: glAccounts.isActive,
        name: glAccounts.name,
      })
      .from(glAccounts)
      .where(or(...conditions));

    const codeMap = new Map(accountRows.map((a) => [a.accountCode, a]));
    const idMap = new Map(accountRows.map((a) => [a.glAccountId, a]));

    for (const line of lines) {
      const acct = line.accountId
        ? idMap.get(line.accountId)
        : codeMap.get(line.accountCode!);
      const ref = line.accountId || line.accountCode;

      if (!acct) {
        throw new BadRequestException(`Account '${ref}' does not exist.`);
      }
      if (acct.isGroup) {
        throw new BadRequestException(
          `Account '${acct.accountCode} - ${acct.name}' is a group account and cannot receive postings.`,
        );
      }
      if (!acct.isActive) {
        throw new BadRequestException(
          `Account '${acct.accountCode} - ${acct.name}' is inactive.`,
        );
      }
      // Attach the resolved UUID to the line for the insert step
      line.accountId = acct.glAccountId;
    }

    // 3. Generate entry number
    const entryNumber = await this.generateEntryNumber();
    const entryDate = meta.entryDate || new Date().toISOString().slice(0, 10);

    // 4. Insert in a single transaction
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [entry] = await tx
        .insert(glJournalEntries)
        .values({
          entryNumber,
          entryDate,
          memo: meta.memo,
          sourceType: meta.sourceType,
          sourceId: meta.sourceId,
          createdBy: meta.actor,
        })
        .returning();

      const lineValues = lines.map((l) => ({
        journalEntryId: entry.journalEntryId,
        glAccountId: l.accountId!,
        partyType: l.partyType || null,
        partyId: l.partyId || null,
        debit: String(l.debit),
        credit: String(l.credit),
        memo: l.memo,
      }));

      await tx.insert(glJournalLines).values(lineValues);

      // Write 'gl_posted' event for sync routing + audit trail
      await emitEvent(tx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: entry.journalEntryId,
        eventType: EventType.GL_POSTED,
        payload: {
          entryNumber,
          entryDate,
          sourceType: meta.sourceType,
          sourceId: meta.sourceId,
          lines: lineValues,
        },
      });

      return entry;
    });

    this.logger.log(
      `Journal entry ${entryNumber} posted: ${lines.length} lines, ${meta.sourceType}`,
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Entry number generation: JE-YYYYMMDD-NNNN
  // -------------------------------------------------------------------------

  private async generateEntryNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `JE-${today}-`;

    const result = await this.db
      .select({ entryNumber: glJournalEntries.entryNumber })
      .from(glJournalEntries)
      .where(sql`${glJournalEntries.entryNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${glJournalEntries.entryNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].entryNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // -------------------------------------------------------------------------
  // Chart of Accounts queries
  // -------------------------------------------------------------------------

  async getChartOfAccounts() {
    const accounts = await this.db
      .select()
      .from(glAccounts)
      .orderBy(glAccounts.accountCode);

    return this.buildTree(accounts);
  }

  async getAccountsList() {
    return this.db.select().from(glAccounts).orderBy(glAccounts.accountCode);
  }

  async createAccount(data: {
    accountCode: string;
    name: string;
    accountType: string;
    parentAccountId?: string;
    isGroup?: boolean;
    currencyCode?: string;
  }) {
    // Validate account type
    const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    if (!validTypes.includes(data.accountType)) {
      throw new BadRequestException(
        `Invalid account type '${data.accountType}'. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    // Validate parent exists if specified
    if (data.parentAccountId) {
      const parent = await this.db
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, data.parentAccountId))
        .limit(1);

      if (parent.length === 0) {
        throw new BadRequestException('Parent account not found.');
      }
      if (!parent[0].isGroup) {
        throw new BadRequestException(
          'Parent account must be a group account.',
        );
      }
    }

    const [account] = await this.db
      .insert(glAccounts)
      .values({
        accountCode: data.accountCode,
        name: data.name,
        accountType: data.accountType,
        parentAccountId: data.parentAccountId,
        isGroup: data.isGroup ?? false,
        currencyCode: data.currencyCode ?? this.appConfig.homeCurrency(),
      })
      .returning();

    return account;
  }

  async updateAccount(
    glAccountId: string,
    data: { name?: string; isActive?: boolean },
  ) {
    // Don't allow deactivating system accounts
    const [existing] = await this.db
      .select()
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, glAccountId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Account '${glAccountId}' not found.`);
    }

    if (existing.isSystem && data.isActive === false) {
      throw new BadRequestException(
        `System account '${existing.accountCode} - ${existing.name}' cannot be deactivated.`,
      );
    }

    const [updated] = await this.db
      .update(glAccounts)
      .set(data)
      .where(eq(glAccounts.glAccountId, glAccountId))
      .returning();

    return updated;
  }

  // -------------------------------------------------------------------------
  // Reporting queries
  // -------------------------------------------------------------------------

  async getTrialBalance(asOfDate?: string) {
    const dateFilterSub = asOfDate
      ? sql`WHERE je.entry_date <= ${asOfDate}`
      : sql``;

    const rows = await this.db.execute(sql`
      SELECT
        a.account_code,
        a.name,
        a.account_type,
        a.is_group,
        COALESCE(SUM(activity.debit), 0)::numeric  AS total_debit,
        COALESCE(SUM(activity.credit), 0)::numeric AS total_credit,
        COALESCE(SUM(activity.debit), 0) - COALESCE(SUM(activity.credit), 0) AS balance
      FROM modbm_core.gl_accounts a
      LEFT JOIN (
        SELECT jl.gl_account_id, jl.debit, jl.credit
        FROM modbm_core.gl_journal_lines jl
        JOIN modbm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
        ${dateFilterSub}
      ) activity ON activity.gl_account_id = a.gl_account_id
      WHERE a.is_group = false
      GROUP BY a.gl_account_id, a.account_code, a.name, a.account_type, a.is_group
      ORDER BY a.account_code
    `);

    return (rows as any).rows ?? rows;
  }

  async getGeneralLedger(filters: {
    accountCode?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    page?: number;
  }) {
    const conditions: any[] = [];

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
        je.created_on
      FROM modbm_core.gl_journal_lines jl
      JOIN modbm_core.gl_journal_entries je
        ON je.journal_entry_id = jl.journal_entry_id
      JOIN modbm_core.gl_accounts a
        ON a.gl_account_id = jl.gl_account_id
      ${whereClause}
      ORDER BY je.entry_date DESC, je.entry_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = sql`
      SELECT count(*)::int as count 
      FROM modbm_core.gl_journal_lines jl
      JOIN modbm_core.gl_journal_entries je
        ON je.journal_entry_id = jl.journal_entry_id
      JOIN modbm_core.gl_accounts a
        ON a.gl_account_id = jl.gl_account_id
      ${whereClause}
    `;

    const [entriesResult, countResult] = await Promise.all([
      this.db.execute(entriesQuery),
      this.db.execute(countQuery),
    ]);

    const rawRows = (
      Array.isArray(entriesResult)
        ? entriesResult
        : (entriesResult as any).rows || []
    ) as any[];
    const countRows = (
      Array.isArray(countResult) ? countResult : (countResult as any).rows || []
    ) as any[];

    // Map raw DB rows to camelCase for the frontend DataGrid
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
    }));

    return {
      data: entries,
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    };
  }

  async getJournalEntries(filters: {
    fromDate?: string;
    toDate?: string;
    sourceType?: string;
    entryNumber?: string;
    limit?: number;
    page?: number;
  }) {
    const conditions: any[] = [];

    if (filters.fromDate) {
      conditions.push(sql`je.entry_date >= ${filters.fromDate}`);
    }
    if (filters.toDate) {
      conditions.push(sql`je.entry_date <= ${filters.toDate}`);
    }
    if (filters.sourceType) {
      conditions.push(sql`je.source_type = ${filters.sourceType}`);
    }
    if (filters.entryNumber) {
      conditions.push(
        sql`je.entry_number ILIKE ${'%' + filters.entryNumber + '%'}`,
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions.map((c) => c)) : undefined;

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit || 50, 200);
    const offset = (page - 1) * limit;

    const entriesQuery = sql`
      WITH first_line_parties AS (
        SELECT DISTINCT ON (journal_entry_id)
          journal_entry_id,
          party_id,
          party_type
        FROM modbm_core.gl_journal_lines
        WHERE party_id IS NOT NULL
        ORDER BY journal_entry_id, journal_line_id
      )
      SELECT 
        je.*,
        COALESCE(acc.name, supp.name) as "partyName",
        flp.party_id as "partyIdRef",
        flp.party_type as "partyTypeRef",
        COALESCE(si.invoice_number, pi.invoice_number, sor.return_number) as "sourceNumber"
      FROM modbm_core.gl_journal_entries je
      LEFT JOIN first_line_parties flp ON flp.journal_entry_id = je.journal_entry_id
      LEFT JOIN modbm_core.accounts acc ON acc.account_id = flp.party_id::uuid AND flp.party_type = 'customer'
      LEFT JOIN modbm_core.suppliers supp ON supp.vendor_id = flp.party_id::uuid AND flp.party_type = 'supplier'
      LEFT JOIN modbm_core.sales_invoices si ON si.invoice_id = je.source_id AND je.source_type = 'sales_invoice'
      LEFT JOIN modbm_core.purchase_invoices pi ON pi.invoice_id = je.source_id AND je.source_type = 'purchase_invoice'
      LEFT JOIN modbm_core.sales_order_returns sor ON sor.return_id = je.source_id AND je.source_type = 'sales_credit_note'
      ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      ORDER BY je.entry_date DESC, je.entry_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [entriesResult, countResult] = await Promise.all([
      this.db.execute(entriesQuery),
      this.db.execute(sql`
        SELECT count(*)::int as count 
        FROM modbm_core.gl_journal_entries je 
        ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      `),
    ]);

    // Handle different driver result formats (pg vs postgres.js)
    const rawRows = (
      Array.isArray(entriesResult)
        ? entriesResult
        : (entriesResult as any).rows || []
    ) as any[];

    // Map raw DB rows to camelCase for the frontend DataGrid
    const entries = rawRows.map((row) => ({
      journalEntryId: row.journal_entry_id,
      entryNumber: row.entry_number,
      entryDate: row.entry_date,
      memo: row.memo,
      sourceType: row.source_type,
      sourceId: row.source_id,
      partyName: row.partyName,
      partyId: row.partyIdRef,
      partyType: row.partyTypeRef,
      sourceNumber: row.sourceNumber,
      createdBy: row.created_by,
      createdOn: row.created_on,
    }));

    const countRows = (
      Array.isArray(countResult) ? countResult : (countResult as any).rows || []
    ) as any[];

    return {
      data: entries,
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    };
  }

  async getJournalEntry(journalEntryId: string) {
    const [entry] = await this.db
      .select()
      .from(glJournalEntries)
      .where(eq(glJournalEntries.journalEntryId, journalEntryId))
      .limit(1);

    if (!entry) {
      throw new NotFoundException(
        `Journal entry '${journalEntryId}' not found.`,
      );
    }

    const rows = await this.db
      .select({
        journalLineId: glJournalLines.journalLineId,
        debit: glJournalLines.debit,
        credit: glJournalLines.credit,
        memo: glJournalLines.memo,
        partyType: glJournalLines.partyType,
        partyId: glJournalLines.partyId,
        customerName: accounts.name,
        supplierName: suppliers.name,
        accountCode: glAccounts.accountCode,
        accountName: glAccounts.name,
      })
      .from(glJournalLines)
      .innerJoin(
        glAccounts,
        eq(glJournalLines.glAccountId, glAccounts.glAccountId),
      )
      .leftJoin(
        accounts,
        and(
          sql`${glJournalLines.partyId}::uuid = ${accounts.accountId}`,
          eq(glJournalLines.partyType, 'customer'),
        ),
      )
      .leftJoin(
        suppliers,
        and(
          sql`${glJournalLines.partyId}::uuid = ${suppliers.vendorId}`,
          eq(glJournalLines.partyType, 'supplier'),
        ),
      )
      .where(eq(glJournalLines.journalEntryId, journalEntryId));

    // Map to final lines, coalescing names in TypeScript for better SQL mapping safety
    const mappedLines = rows.map((r) => ({
      ...r,
      partyName: r.customerName || r.supplierName || null,
    }));

    return { ...entry, lines: mappedLines };
  }

  // -------------------------------------------------------------------------
  // GL Settings
  // -------------------------------------------------------------------------

  async getSettings() {
    const [settings] = await this.db.select().from(glSettings).limit(1);
    return {
      ...(settings || {}),
      revenueRoutingPrecedence: REVENUE_ROUTING_PRECEDENCE,
      expenseRoutingPrecedence: EXPENSE_ROUTING_PRECEDENCE,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildTree(accounts: any[]) {
    const map = new Map<string | null, any[]>();

    for (const acct of accounts) {
      const parentId = acct.parentAccountId || null;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(acct);
    }

    const build = (parentId: string | null): any[] => {
      const children = map.get(parentId) || [];
      return children.map((acct) => ({
        ...acct,
        children: acct.isGroup ? build(acct.glAccountId) : undefined,
      }));
    };

    return build(null);
  }
}
