import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, isNull, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glAccounts,
  glJournalEntries,
  glJournalLines,
  glSettings,
  outbox,
} from '../drizzle/modbm-core-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JournalLineDto {
  /** Account code (e.g. "1100") — resolved to gl_account_id internally */
  accountCode: string;
  partyType?: 'customer' | 'supplier' | null;
  partyId?: string | null;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalMeta {
  sourceType: 'sales_invoice' | 'purchase_invoice' | 'sales_credit_note' | 'manual' | 'adjustment';
  sourceId?: string;
  memo?: string;
  entryDate?: string; // ISO date, defaults to today
  actor?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class GlService {
  private readonly logger = new Logger(GlService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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

    // 2. Resolve account codes to IDs and validate
    const accountCodes = [...new Set(lines.map((l) => l.accountCode))];
    const accountRows = await this.db
      .select({
        glAccountId: glAccounts.glAccountId,
        accountCode: glAccounts.accountCode,
        isGroup: glAccounts.isGroup,
        isActive: glAccounts.isActive,
        name: glAccounts.name,
      })
      .from(glAccounts)
      .where(
        sql`${glAccounts.accountCode} IN (${sql.join(
          accountCodes.map((c) => sql`${c}`),
          sql`, `,
        )})`,
      );

    const accountMap = new Map(accountRows.map((a) => [a.accountCode, a]));

    for (const code of accountCodes) {
      const acct = accountMap.get(code);
      if (!acct) {
        throw new BadRequestException(`Account code '${code}' does not exist.`);
      }
      if (acct.isGroup) {
        throw new BadRequestException(
          `Account '${code} - ${acct.name}' is a group account and cannot receive postings.`,
        );
      }
      if (!acct.isActive) {
        throw new BadRequestException(
          `Account '${code} - ${acct.name}' is inactive.`,
        );
      }
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
        glAccountId: accountMap.get(l.accountCode)!.glAccountId,
        partyType: l.partyType || null,
        partyId: l.partyId || null,
        debit: String(l.debit),
        credit: String(l.credit),
        memo: l.memo,
      }));

      await tx.insert(glJournalLines).values(lineValues);

      // Write 'gl_posted' outbox event for sync routing
      await tx.insert(outbox).values({
        aggregateType: 'journal_entry',
        aggregateId: entry.journalEntryId,
        eventType: 'gl_posted',
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
        currencyCode: data.currencyCode ?? 'AUD',
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
    const dateFilter = asOfDate
      ? sql`AND je.${glJournalEntries.entryDate} <= ${asOfDate}`
      : sql``;

    const rows = await this.db.execute(sql`
      SELECT
        a.account_code,
        a.name,
        a.account_type,
        a.is_group,
        COALESCE(SUM(jl.debit), 0)::numeric  AS total_debit,
        COALESCE(SUM(jl.credit), 0)::numeric AS total_credit,
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS balance
      FROM modbm_core.gl_accounts a
      LEFT JOIN modbm_core.gl_journal_lines jl
        ON jl.gl_account_id = a.gl_account_id
      LEFT JOIN modbm_core.gl_journal_entries je
        ON je.journal_entry_id = jl.journal_entry_id
        ${dateFilter}
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

    const limit = Math.min(filters.limit || 200, 500);

    const rows = await this.db.execute(sql`
      SELECT
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
      LIMIT ${limit}
    `);

    return (rows as any).rows ?? rows;
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
      conditions.push(
        sql`${glJournalEntries.entryDate} >= ${filters.fromDate}`,
      );
    }
    if (filters.toDate) {
      conditions.push(sql`${glJournalEntries.entryDate} <= ${filters.toDate}`);
    }
    if (filters.sourceType) {
      conditions.push(
        sql`${glJournalEntries.sourceType} = ${filters.sourceType}`,
      );
    }
    if (filters.entryNumber) {
      conditions.push(
        sql`${glJournalEntries.entryNumber} ILIKE ${'%' + filters.entryNumber + '%'}`,
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions.map((c) => c)) : undefined;

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit || 50, 200);
    const offset = (page - 1) * limit;

    const [entries, countResult] = await Promise.all([
      this.db
        .select()
        .from(glJournalEntries)
        .where(whereClause || undefined)
        .orderBy(sql`${glJournalEntries.entryDate} DESC`)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(glJournalEntries)
        .where(whereClause || undefined),
    ]);

    return {
      data: entries,
      page,
      limit,
      total: countResult[0]?.count ?? 0,
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

    const lines = await this.db
      .select({
        journalLineId: glJournalLines.journalLineId,
        debit: glJournalLines.debit,
        credit: glJournalLines.credit,
        memo: glJournalLines.memo,
        partyType: glJournalLines.partyType,
        partyId: glJournalLines.partyId,
        accountCode: glAccounts.accountCode,
        accountName: glAccounts.name,
      })
      .from(glJournalLines)
      .innerJoin(
        glAccounts,
        eq(glJournalLines.glAccountId, glAccounts.glAccountId),
      )
      .where(eq(glJournalLines.journalEntryId, journalEntryId));

    return { ...entry, lines };
  }

  // -------------------------------------------------------------------------
  // GL Settings
  // -------------------------------------------------------------------------

  async getSettings() {
    const [settings] = await this.db.select().from(glSettings).limit(1);
    return settings || null;
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
