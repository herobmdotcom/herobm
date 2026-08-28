import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, isNull, and, or, inArray } from 'drizzle-orm';
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
  glFiscalPeriods,
  financialEvents,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  REVENUE_ROUTING_PRECEDENCE,
  EXPENSE_ROUTING_PRECEDENCE,
  GL_ACCOUNT_TYPE,
  GLAccountType,
  DATA_SOURCE_CONTEXT,
  type JournalEntrySourceType,
} from '@herobm/shared';
import { JournalLineDto } from './dto';
import { calculateSubledgerReconciliation } from './gl-reconciliation.utils';
import {
  fetchTrialBalance,
  fetchGeneralLedger,
  fetchBusinessReportData,
  GeneralLedgerFilters,
} from './gl-ledger.utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class JournalMeta {
  sourceType!: JournalEntrySourceType;
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

    // 1. Validate line-level invariants
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.debit < 0 || line.credit < 0) {
        throw new BadRequestException(
          `Journal line ${i + 1} has negative amounts. Debit and credit amounts must be non-negative.`,
        );
      }
      if (
        (line.foreignDebit !== undefined && line.foreignDebit < 0) ||
        (line.foreignCredit !== undefined && line.foreignCredit < 0)
      ) {
        throw new BadRequestException(
          `Journal line ${i + 1} has negative foreign amounts. Foreign amounts must be non-negative.`,
        );
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(
          `Journal line ${i + 1} specifies both debit (${line.debit}) and credit (${line.credit}). A line must be either debit or credit.`,
        );
      }
      if (
        (line.debit === 0 || line.debit === undefined || line.debit === null) &&
        (line.credit === 0 || line.credit === undefined || line.credit === null)
      ) {
        throw new BadRequestException(
          `Journal line ${i + 1} has zero debit and credit amounts. Each line must specify a non-zero amount.`,
        );
      }
    }

    // 2. Validate balance invariant
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

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

    const entryDate = meta.entryDate || new Date().toISOString().slice(0, 10);
    await this.assertPeriodOpen(entryDate, queryDb);

    // 3. Insert — either directly on the caller's tx, or in a self-contained transaction
    const doInsert = async (db: DrizzleDB) => {
      const entryNumber = await this.generateEntryNumber(db);
      let actorStr = 'system';
      if (typeof meta.actor === 'string') {
        actorStr = meta.actor;
      } else if (meta.actor && typeof meta.actor === 'object') {
        const actorObj = meta.actor as { username?: string; userId?: string };
        actorStr = actorObj.username || actorObj.userId || 'system';
      }

      const [entry] = await db
        .insert(glJournalEntries)
        .values({
          journalEntryId: meta.journalEntryId,
          entryNumber,
          entryDate,
          memo: meta.memo,
          sourceType: meta.sourceType,
          sourceId: meta.sourceId,
          createdBy: actorStr,
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
      `Journal entry ${result.entryNumber} posted: ${lines.length} lines, ${meta.sourceType}`,
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

    // Acquire transaction-scoped advisory lock to serialize concurrent sequence generation
    await queryDb.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('gl_journal_entries_seq'))`,
    );

    const result = await queryDb
      .select({ entryNumber: glJournalEntries.entryNumber })
      .from(glJournalEntries)
      .where(sql`${glJournalEntries.entryNumber} LIKE ${prefix + '%'}`)
      .orderBy(
        sql`LENGTH(${glJournalEntries.entryNumber}) DESC, ${glJournalEntries.entryNumber} DESC`,
      )
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
    return fetchTrialBalance(this.db, asOfDate, periodStart);
  }

  async getGeneralLedger(filters: GeneralLedgerFilters) {
    return fetchGeneralLedger(this.db, filters);
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
      createdBy:
        row.created_by === '[object Object]' ||
        typeof row.created_by === 'object'
          ? 'admin'
          : row.created_by,
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

    return {
      ...entry,
      createdBy:
        entry.createdBy === '[object Object]' ||
        typeof entry.createdBy === 'object'
          ? 'admin'
          : entry.createdBy,
      lines: mappedLines,
    };
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
    return fetchBusinessReportData(this.db, filters);
  }

  // -------------------------------------------------------------------------
  // Accounting Period Governance (Fiscal Period Locking & Hard Close)
  // -------------------------------------------------------------------------

  /**
   * Verifies that the given entryDate does not fall into a locked or closed accounting period.
   */
  async assertPeriodOpen(entryDate: string, tx?: DrizzleDB) {
    const queryDb = tx || this.db;
    const [period] = await queryDb
      .select()
      .from(glFiscalPeriods)
      .where(
        and(
          sql`${glFiscalPeriods.startDate} <= ${entryDate}`,
          sql`${glFiscalPeriods.endDate} >= ${entryDate}`,
        ),
      )
      .limit(1);

    if (!period) {
      return;
    }

    if (period.status === 'hard_closed') {
      throw new BadRequestException(
        `Cannot post to hard-closed accounting period '${period.periodName}' (${period.startDate} to ${period.endDate}). Postings in closed periods are forbidden.`,
      );
    }

    if (period.status === 'soft_locked') {
      throw new BadRequestException(
        `Cannot post to soft-locked accounting period '${period.periodName}' (${period.startDate} to ${period.endDate}). Period is locked for adjustments.`,
      );
    }
  }

  /**
   * Retrieves fiscal periods, optionally filtered by year and status.
   */
  async getFiscalPeriods(query?: {
    fiscalYear?: number;
    status?: 'open' | 'soft_locked' | 'hard_closed';
  }) {
    const targetYear = query?.fiscalYear || new Date().getFullYear();
    const existing = await this.db
      .select({ id: glFiscalPeriods.periodId })
      .from(glFiscalPeriods)
      .where(eq(glFiscalPeriods.fiscalYear, targetYear))
      .limit(1);

    if (existing.length === 0) {
      await this.generateFiscalYearPeriods(targetYear, 'system');
    }

    const conditions = [];
    if (query?.fiscalYear) {
      conditions.push(eq(glFiscalPeriods.fiscalYear, query.fiscalYear));
    }
    if (query?.status) {
      conditions.push(eq(glFiscalPeriods.status, query.status));
    }

    const periods = await this.db
      .select()
      .from(glFiscalPeriods)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(glFiscalPeriods.startDate);

    if (periods.length === 0) {
      return [];
    }

    const periodIds = periods.map((p) => p.periodId);
    const events = await this.db
      .select()
      .from(financialEvents)
      .where(
        and(
          eq(financialEvents.entityType, EntityType.FISCAL_PERIOD),
          inArray(financialEvents.entityId, periodIds),
        ),
      )
      .orderBy(sql`${financialEvents.createdOn} DESC`);

    const eventsByPeriodId = new Map<string, typeof events>();
    for (const evt of events) {
      const list = eventsByPeriodId.get(evt.entityId) || [];
      list.push(evt);
      eventsByPeriodId.set(evt.entityId, list);
    }

    return periods.map((p) => ({
      ...p,
      events: eventsByPeriodId.get(p.periodId) || [],
    }));
  }

  /**
   * Auto-generates 12 monthly fiscal periods for a fiscal year.
   */
  async generateFiscalYearPeriods(fiscalYear: number, actor?: string) {
    const [settings] = await this.db
      .select({ fiscalYearStartMonth: glSettings.fiscalYearStartMonth })
      .from(glSettings)
      .limit(1);
    const startMonth = settings?.fiscalYearStartMonth || 1;

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < 12; i++) {
        const periodNumber = i + 1;
        const monthZeroIndexed = (startMonth - 1 + i) % 12;
        const yearOffset = Math.floor((startMonth - 1 + i) / 12);
        const calendarYear = fiscalYear + yearOffset;
        const monthStr = String(monthZeroIndexed + 1).padStart(2, '0');

        const startDate = `${calendarYear}-${monthStr}-01`;
        const lastDay = new Date(
          calendarYear,
          monthZeroIndexed + 1,
          0,
        ).getDate();
        const endDate = `${calendarYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
        const periodName = `${calendarYear}-${monthStr}`;

        const [existing] = await tx
          .select()
          .from(glFiscalPeriods)
          .where(eq(glFiscalPeriods.periodName, periodName))
          .limit(1);

        if (!existing) {
          const notes = `Period ${periodNumber} of FY${fiscalYear} (created by ${actor || 'admin'})`;
          const [inserted] = await tx
            .insert(glFiscalPeriods)
            .values({
              periodName,
              fiscalYear,
              periodNumber,
              startDate,
              endDate,
              status: 'open',
              notes,
            })
            .returning();

          await emitEvent(tx, {
            entityType: EntityType.FISCAL_PERIOD,
            entityId: inserted.periodId,
            eventType: EventType.CREATED,
            entityDisplayName: inserted.periodName,
            payload: {
              periodName: inserted.periodName,
              fiscalYear: inserted.fiscalYear,
              periodNumber: inserted.periodNumber,
              startDate: inserted.startDate,
              endDate: inserted.endDate,
              status: inserted.status,
              notes: inserted.notes,
            },
            actor,
          });
        }
      }
    });

    return this.getFiscalPeriods({ fiscalYear });
  }

  /**
   * Updates the status of an accounting period (open, soft_locked, hard_closed).
   */
  async updatePeriodStatus(
    periodId: string,
    status: 'open' | 'soft_locked' | 'hard_closed',
    actor?: string,
    notes?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const [period] = await tx
        .select()
        .from(glFiscalPeriods)
        .where(eq(glFiscalPeriods.periodId, periodId))
        .limit(1);

      if (!period) {
        throw new NotFoundException(`Fiscal period '${periodId}' not found.`);
      }

      const updates: Record<string, unknown> = {
        status,
        modifiedOn: new Date(),
      };

      if (notes !== undefined) {
        updates.notes = notes;
      }

      if (status === 'soft_locked') {
        updates.lockedBy = actor || 'admin';
        updates.lockedAt = new Date();
      } else if (status === 'hard_closed') {
        updates.closedBy = actor || 'admin';
        updates.closedAt = new Date();
      } else if (status === 'open') {
        updates.lockedBy = null;
        updates.lockedAt = null;
        updates.closedBy = null;
        updates.closedAt = null;
      }

      const [updated] = await tx
        .update(glFiscalPeriods)
        .set(updates)
        .where(eq(glFiscalPeriods.periodId, periodId))
        .returning();

      if (status !== period.status) {
        await emitEvent(tx, {
          entityType: EntityType.FISCAL_PERIOD,
          entityId: updated.periodId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: updated.periodName,
          payload: {
            periodName: updated.periodName,
            fiscalYear: updated.fiscalYear,
            periodNumber: updated.periodNumber,
            startDate: updated.startDate,
            endDate: updated.endDate,
            status: updated.status,
            notes: updated.notes,
          },
          actor,
        });
      } else {
        await emitEvent(tx, {
          entityType: EntityType.FISCAL_PERIOD,
          entityId: updated.periodId,
          eventType: EventType.UPDATED,
          entityDisplayName: updated.periodName,
          payload: {
            periodName: updated.periodName,
            fiscalYear: updated.fiscalYear,
            periodNumber: updated.periodNumber,
            startDate: updated.startDate,
            endDate: updated.endDate,
            status: updated.status,
            notes: updated.notes,
          },
          actor,
        });
      }

      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Subledger-to-GL Continuous Reconciliation
  // -------------------------------------------------------------------------

  /**
   * Performs an automated continuous reconciliation between double-entry GL control accounts
   * and operational subledgers (Trial Balance Zero-Sum, AR, AP, GRNI, Perpetual Inventory).
   */
  async getSubledgerReconciliation(asOfDate?: string) {
    return calculateSubledgerReconciliation(this.db, asOfDate);
  }
}
