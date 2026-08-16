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
  customers,
  suppliers,
  costCenters,
  activities,
  outbox,
  actors,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  REVENUE_ROUTING_PRECEDENCE,
  EXPENSE_ROUTING_PRECEDENCE,
  GL_ACCOUNT_TYPE,
  GLAccountType,
  DATA_SOURCE_CONTEXT,
} from '@herobm/shared';
import { JournalLineDto } from './dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class JournalMeta {
  sourceType!:
    | 'sales_invoice'
    | 'purchase_invoice'
    | 'sales_credit_note'
    | 'purchase_debit_note'
    | 'manual'
    | 'adjustment'
    | 'inventory_receipt'
    | 'inventory_dispatch'
    | 'inventory_adjustment'
    | 'payment_entry'
    | 'sales_invoice_reversal'
    | 'purchase_invoice_reversal';
  sourceId?: string;
  memo?: string;
  entryDate?: string; // ISO date, defaults to today
  actor?: string;
  journalEntryId?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

import { AppConfigService } from '../settings/app-config.service';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import type { OnModuleInit } from '@nestjs/common';

@Injectable()
export class GlService implements OnModuleInit {
  private readonly logger = new Logger(GlService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly dataSourcesRegistry: DataSourcesRegistry,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.FINANCIAL_GL, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getBusinessReportData(filters),
    });
  }

  private defaultCostCenterId: string | null = null;
  private defaultActivityId: string | null = null;

  private async getDefaults(db: DrizzleDB) {
    if (this.defaultCostCenterId && this.defaultActivityId) {
      return {
        costCenterId: this.defaultCostCenterId,
        activityId: this.defaultActivityId,
      };
    }

    const [cc] = await db
      .select({ id: costCenters.costCenterId })
      .from(costCenters)
      .where(eq(costCenters.code, '00'))
      .limit(1);
    const [act] = await db
      .select({ id: activities.activityId })
      .from(activities)
      .where(eq(activities.code, '00'))
      .limit(1);

    if (!cc || !act) {
      this.logger.warn(
        'System default dimensions (code 00) not found. Please run migrations.',
      );
    }

    this.defaultCostCenterId = cc?.id || null;
    this.defaultActivityId = act?.id || null;

    return {
      costCenterId: this.defaultCostCenterId || undefined,
      activityId: this.defaultActivityId || undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Core: Post a balanced journal entry
  // -------------------------------------------------------------------------

  /**
   * Posts a balanced journal entry to the general ledger.
   *
   * @param lines The debits and credits. Must sum to zero.
   * @param meta Metadata for the journal entry (source type, memo, etc.)
   * @param tx Optional but HIGHLY RECOMMENDED database transaction object.
   *           When `tx` is provided, all queries and inserts run on the caller's
   *           transaction. This is REQUIRED when the GL posting must be atomic
   *           with a parent business operation (e.g. goods receipt, shipment, invoice).
   *           When omitted, a self-contained transaction is opened internally (only for standalone ops).
   *
   * @example
   * // Correct: Pass the tx object for atomic operations
   * await this.db.transaction(async (tx) => {
   *   await tx.insert(salesInvoices).values(...);
   *   await this.glService.postJournalEntry(lines, meta, tx);
   * });
   *
   * @example
   * // Incorrect: Failing to pass the tx object inside an outer transaction will cause deadlocks
   * // or silent partial commits in PGlite testing.
   * await this.db.transaction(async (tx) => {
   *   await tx.insert(salesInvoices).values(...);
   *   await this.glService.postJournalEntry(lines, meta); // BAD!
   * });
   */
  async postJournalEntry(
    lines: JournalLineDto[],
    meta: JournalMeta,
    tx?: DrizzleDB,
  ) {
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

    // Use provided transaction or fall back to the root connection
    const queryDb = tx || this.db;

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

    const accountRows = await queryDb
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
    const entryNumber = await this.generateEntryNumber(queryDb);
    const entryDate = meta.entryDate || new Date().toISOString().slice(0, 10);

    // 4. Insert — either directly on the caller's tx, or in a self-contained transaction
    const doInsert = async (db: DrizzleDB) => {
      const [entry] = await db
        .insert(glJournalEntries)
        .values({
          journalEntryId: meta.journalEntryId,
          entryNumber,
          entryDate,
          memo: meta.memo,
          sourceType: meta.sourceType,
          sourceId: meta.sourceId,
          createdBy: meta.actor,
          isReversed: false,
        })
        .returning();

      const defaults = await this.getDefaults(db);

      const lineValues = lines.map((l) => ({
        journalEntryId: entry.journalEntryId,
        glAccountId: l.accountId!,
        costCenterId: l.costCenterId || defaults.costCenterId,
        activityId: l.activityId || defaults.activityId,
        partyType: l.partyType || null,
        partyId: l.partyId || null,
        debit: String(l.debit),
        credit: String(l.credit),
        foreignDebit: String(l.foreignDebit ?? l.debit),
        foreignCredit: String(l.foreignCredit ?? l.credit),
        foreignCurrencyCode: l.foreignCurrencyCode || null,
        exchangeRate: l.exchangeRate ? String(l.exchangeRate) : '1',
        memo: l.memo,
      }));

      await db
        .insert(glJournalLines)
        .values(lineValues.map((line) => ({ isReconciled: false, ...line })));

      // Write 'gl_posted' event for sync routing + audit trail
      await emitEvent(db, {
        entityType: EntityType.SYSTEM,
        entityId: entry.journalEntryId,
        eventType: EventType.GL_POSTED,
        entityDisplayName: 'System',
        payload: {
          entryNumber,
          entryDate,
          sourceType: meta.sourceType,
          sourceId: meta.sourceId,
          lines: lineValues,
        },
      });

      return entry;
    };

    const result = tx
      ? await doInsert(tx)
      : await this.db.transaction(doInsert);

    this.logger.debug(
      `Journal entry ${entryNumber} posted: ${lines.length} lines, ${meta.sourceType}`,
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Entry number generation: JE-YYYYMMDD-NNNN
  // -------------------------------------------------------------------------

  private async generateEntryNumber(
    queryDb: DrizzleDB = this.db,
  ): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `JE-${today}-`;

    const result = await queryDb
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

  async getAccountsList(filters?: { isBankAccount?: boolean }) {
    const conditions = [];
    if (filters?.isBankAccount !== undefined) {
      conditions.push(eq(glAccounts.isBankAccount, filters.isBankAccount));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select({
        glAccountId: glAccounts.glAccountId,
        accountCode: glAccounts.accountCode,
        name: glAccounts.name,
        accountType: glAccounts.accountType,
        isGroup: glAccounts.isGroup,
        isBankAccount: glAccounts.isBankAccount,
        currencyCode: glAccounts.currencyCode,
        isActive: glAccounts.isActive,
        parentAccountId: glAccounts.parentAccountId,
        isSystem: glAccounts.isSystem,
      })
      .from(glAccounts)
      .where(whereClause)
      .orderBy(glAccounts.accountCode);
  }

  async createAccount(
    data: {
      accountCode: string;
      name: string;
      accountType: GLAccountType;
      parentAccountId?: string;
      isGroup?: boolean;
      isBankAccount?: boolean;
      currencyCode?: string;
      metadata?: Record<string, unknown>;
    },
    userId?: string,
  ) {
    // Validate account type
    const validTypes = Object.values(GL_ACCOUNT_TYPE) as string[];
    if (!validTypes.includes(data.accountType)) {
      throw new BadRequestException(
        `Invalid account type '${data.accountType}'. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    return await this.db.transaction(async (tx) => {
      // Validate parent exists if specified
      if (data.parentAccountId) {
        const parent = await tx
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
        if (parent[0].accountType !== data.accountType) {
          throw new BadRequestException(
            'Child account type must match parent account type.',
          );
        }
      }

      const [account] = await tx
        .insert(glAccounts)
        .values({
          accountCode: data.accountCode,
          name: data.name,
          accountType: data.accountType,
          parentAccountId: data.parentAccountId,
          isGroup: data.isGroup ?? false,
          isBankAccount: data.isBankAccount ?? false,
          currencyCode: data.currencyCode ?? this.appConfig.homeCurrency(),
          metadata: data.metadata ?? {},
          isSystem: false,
          isActive: true,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.GL_ACCOUNT,
        entityId: account.glAccountId,
        eventType: EventType.CREATED,
        entityDisplayName: account.accountCode,
        payload: data,
        actor: userId,
      });

      return account;
    });
  }

  async updateAccount(
    glAccountId: string,
    data: {
      name?: string;
      isActive?: boolean;
      isBankAccount?: boolean;
      metadata?: Record<string, unknown>;
    },
    userId?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      // Don't allow deactivating system accounts
      const [existing] = await tx
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

      const [updated] = await tx
        .update(glAccounts)
        .set(data)
        .where(eq(glAccounts.glAccountId, glAccountId))
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.GL_ACCOUNT,
        entityId: updated.glAccountId,
        eventType: EventType.UPDATED,
        entityDisplayName: updated.accountCode,
        payload: data,
        actor: userId,
      });

      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Reporting queries
  // -------------------------------------------------------------------------

  async getTrialBalance(asOfDate?: string, periodStart?: string) {
    // Determine the fiscal year start month
    const [settings] = await this.db
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
    const periodStartSql = periodStart
      ? sql`${periodStart}`
      : sql`'1970-01-01'`;
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

    const rows = await this.db.execute(query);
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

  async getGeneralLedger(filters: {
    accountCode?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    page?: number;
  }) {
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
      FROM herobm_core.gl_journal_lines jl
      JOIN herobm_core.gl_journal_entries je
        ON je.journal_entry_id = jl.journal_entry_id
      JOIN herobm_core.gl_accounts a
        ON a.gl_account_id = jl.gl_account_id
      ${whereClause}
      ORDER BY je.entry_date DESC, je.entry_number DESC
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
      this.db.execute(entriesQuery),
      this.db.execute(countQuery),
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
    }[];
    const countRows = (
      Array.isArray(countResult)
        ? countResult
        : (countResult as { rows: unknown[] }).rows || []
    ) as { count: number }[];

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
    sourceId?: string;
    entryNumber?: string;
    limit?: number;
    page?: number;
  }) {
    const conditions: import('drizzle-orm').SQL[] = [];

    if (filters.fromDate) {
      conditions.push(sql`je.entry_date >= ${filters.fromDate}`);
    }
    if (filters.toDate) {
      conditions.push(sql`je.entry_date <= ${filters.toDate}`);
    }
    if (filters.sourceType) {
      conditions.push(sql`je.source_type = ${filters.sourceType}`);
    }
    if (filters.sourceId) {
      conditions.push(sql`je.source_id = ${filters.sourceId}`);
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
        FROM herobm_core.gl_journal_lines
        WHERE party_id IS NOT NULL
        ORDER BY journal_entry_id, journal_line_id
      )
      SELECT 
        je.*,
        COALESCE(acc_actor.name, supp_actor.name) as "partyName",
        flp.party_id as "partyIdRef",
        flp.party_type as "partyTypeRef",
        COALESCE(
          si.invoice_number,
          pi.invoice_number,
          scn.credit_note_number,
          pdn.debit_note_number,
          sos.shipment_number,
          pe.payment_number,
          gr.receipt_number,
          sir.invoice_number,
          pir.invoice_number
        ) as "sourceNumber"
      FROM herobm_core.gl_journal_entries je
      LEFT JOIN first_line_parties flp ON flp.journal_entry_id = je.journal_entry_id
      LEFT JOIN herobm_core.customers acc ON acc.customer_id = flp.party_id::uuid AND flp.party_type = 'customer'
      LEFT JOIN herobm_core.actors acc_actor ON acc.actor_id = acc_actor.actor_id
      LEFT JOIN herobm_core.suppliers supp ON supp.vendor_id = flp.party_id::uuid AND flp.party_type = 'supplier'
      LEFT JOIN herobm_core.actors supp_actor ON supp.actor_id = supp_actor.actor_id
      LEFT JOIN herobm_core.sales_invoices si ON si.invoice_id = je.source_id AND je.source_type = 'sales_invoice'
      LEFT JOIN herobm_core.purchase_invoices pi ON pi.invoice_id = je.source_id AND je.source_type = 'purchase_invoice'
      LEFT JOIN herobm_core.sales_credit_notes scn ON scn.credit_note_id = je.source_id AND je.source_type = 'sales_credit_note'
      LEFT JOIN herobm_core.purchase_debit_notes pdn ON pdn.debit_note_id = je.source_id AND je.source_type = 'purchase_debit_note'
      LEFT JOIN herobm_core.sales_order_shipments sos ON sos.shipment_id = je.source_id AND je.source_type = 'inventory_dispatch'
      LEFT JOIN herobm_core.payment_entries pe ON pe.payment_id = je.source_id AND je.source_type = 'payment_entry'
      LEFT JOIN herobm_core.goods_received gr ON gr.goods_received_id = je.source_id AND je.source_type = 'inventory_receipt'
      LEFT JOIN herobm_core.sales_invoices sir ON sir.invoice_id = je.source_id AND je.source_type = 'sales_invoice_reversal'
      LEFT JOIN herobm_core.purchase_invoices pir ON pir.invoice_id = je.source_id AND je.source_type = 'purchase_invoice_reversal'
      ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      ORDER BY je.entry_date DESC, je.entry_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [entriesResult, countResult] = await Promise.all([
      this.db.execute(entriesQuery),
      this.db.execute(sql`
        SELECT count(*)::int as count 
        FROM herobm_core.gl_journal_entries je 
        ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      `),
    ]);

    // Handle different driver result formats (pg vs postgres.js)
    const rawRows = (
      Array.isArray(entriesResult)
        ? entriesResult
        : (entriesResult as { rows: unknown[] }).rows || []
    ) as {
      journal_entry_id: string;
      entry_number: string;
      entry_date: string;
      memo?: string;
      source_type?: string;
      source_id?: string;
      partyName?: string;
      partyIdRef?: string;
      partyTypeRef?: string;
      sourceNumber?: string;
      created_by: string;
      created_on: Date;
    }[];

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
      Array.isArray(countResult)
        ? countResult
        : (countResult as { rows: unknown[] }).rows || []
    ) as { count: number }[];

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
        customerName: sql<string>`case when ${glJournalLines.partyType} = 'customer' then ${actors.name} else null end`,
        supplierName: sql<string>`case when ${glJournalLines.partyType} = 'supplier' then ${actors.name} else null end`,
        accountId: glJournalLines.glAccountId,
        accountCode: glAccounts.accountCode,
        accountName: glAccounts.name,
        costCenterId: glJournalLines.costCenterId,
        costCenterCode: costCenters.code,
        activityId: glJournalLines.activityId,
        activityCode: activities.code,
      })
      .from(glJournalLines)
      .innerJoin(
        glAccounts,
        eq(glJournalLines.glAccountId, glAccounts.glAccountId),
      )
      .leftJoin(
        customers,
        and(
          sql`${glJournalLines.partyId}::uuid = ${customers.customerId}`,
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
      .leftJoin(
        actors,
        or(
          and(
            eq(glJournalLines.partyType, 'customer'),
            eq(customers.actorId, actors.actorId),
          ),
          and(
            eq(glJournalLines.partyType, 'supplier'),
            eq(suppliers.actorId, actors.actorId),
          ),
        ),
      )
      .leftJoin(
        costCenters,
        eq(glJournalLines.costCenterId, costCenters.costCenterId),
      )
      .leftJoin(
        activities,
        eq(glJournalLines.activityId, activities.activityId),
      )
      .where(eq(glJournalLines.journalEntryId, journalEntryId));

    // Map to final lines, coalescing names in TypeScript for better SQL mapping safety
    const mappedLines = rows.map((r) => ({
      ...r,
      partyName: r.customerName || r.supplierName || null,
    }));

    return { ...entry, lines: mappedLines };
  }

  async findJournalEntryBySource(sourceType: string, sourceId: string) {
    const [entry] = await this.db
      .select({ journalEntryId: glJournalEntries.journalEntryId })
      .from(glJournalEntries)
      .where(
        and(
          eq(glJournalEntries.sourceType, sourceType),
          eq(glJournalEntries.sourceId, sourceId),
        ),
      )
      .limit(1);

    if (!entry) return null;
    return this.getJournalEntry(entry.journalEntryId);
  }

  // -------------------------------------------------------------------------
  // GL Settings
  // -------------------------------------------------------------------------

  async getSettings(tx?: DrizzleDB) {
    const db = tx || this.db;
    const [settings] = await db.select().from(glSettings).limit(1);

    const supportedFormats =
      settings?.supportedBatchPaymentFormats &&
      settings.supportedBatchPaymentFormats.length > 0
        ? settings.supportedBatchPaymentFormats
        : settings?.baseCurrency === 'USD'
          ? ['NACHA']
          : ['ABA'];

    return {
      ...(settings || {}),
      supportedBatchPaymentFormats: supportedFormats,
      revenueRoutingPrecedence: REVENUE_ROUTING_PRECEDENCE,
      expenseRoutingPrecedence: EXPENSE_ROUTING_PRECEDENCE,
    };
  }

  async updateSettings(
    data: Partial<typeof glSettings.$inferInsert>,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [existing] = await db.select().from(glSettings).limit(1);

    if (!existing) {
      // If no settings exist, create them (should be rare, but safe fallback)
      const [newSettings] = await db
        .insert(glSettings)
        .values(data as typeof glSettings.$inferInsert)
        .returning();

      await emitEvent(db, {
        entityType: EntityType.GL_SETTINGS,
        entityId: newSettings.settingsId,
        entityDisplayName: 'General Ledger Settings',
        eventType: EventType.UPDATED,
        payload: { changes: data },
        actor: 'system',
      });
      return newSettings;
    }

    const validData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(validData).length === 0) {
      return existing;
    }

    const [updated] = await db
      .update(glSettings)
      .set(validData)
      .where(eq(glSettings.settingsId, existing.settingsId))
      .returning();

    await emitEvent(db, {
      entityType: EntityType.GL_SETTINGS,
      entityId: existing.settingsId,
      entityDisplayName: 'General Ledger Settings',
      eventType: EventType.UPDATED,
      payload: { changes: validData },
      actor: 'system',
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildTree(accounts: (typeof glAccounts.$inferSelect)[]) {
    const map = new Map<string | null, typeof accounts>();

    for (const acct of accounts) {
      const parentId = acct.parentAccountId || null;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(acct);
    }

    const build = (
      parentId: string | null,
    ): ((typeof accounts)[0] & { children?: unknown[] })[] => {
      const children = map.get(parentId) || [];
      return children.map((acct) => ({
        ...acct,
        children: acct.isGroup ? build(acct.glAccountId) : undefined,
      }));
    };

    return build(null);
  }

  // -------------------------------------------------------------------------
  // Business Reporting
  // -------------------------------------------------------------------------
  async getBusinessReportData(
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

    const rows = await this.db.execute(sql`
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
}
