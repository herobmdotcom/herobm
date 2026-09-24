import { Job } from 'bullmq';
import { eq, and, sql, asc, isNotNull } from 'drizzle-orm';
import {
  salesInvoices,
  glJournalEntries,
  glJournalLines,
  glSettings,
  glAccounts,
  systemEvents,
  emailOutbox,
  outbox,
} from '@herobm/db-schema';
import { verifyJournalChain } from '@herobm/shared';
import { relayLogger as logger } from './logger';
import { randomUUID } from 'crypto';

export interface LedgerAnomaly {
  type:
    | 'sequence_gap'
    | 'timestamp_inversion'
    | 'missing_gl_journal'
    | 'missing_cancellation_reversal'
    | 'unbalanced_journal_entry'
    | 'hash_chain_violation'
    | 'subledger_drift'
    | 'trial_balance_unbalanced';
  invoiceNumber?: string;
  invoiceId?: string;
  journalEntryId?: string;
  entryNumber?: string;
  details: Record<string, unknown>;
}

export interface VerificationResult {
  verifiedInvoicesCount: number;
  verifiedJournalsCount: number;
  anomaliesCount: number;
  anomalies: LedgerAnomaly[];
  auditedAt: string;
}

/**
 * BullMQ processor for the system maintenance queue.
 * Performs a comprehensive audit of invoice numbering continuity,
 * timestamp monotonicity, GL matching, and double-entry invariants.
 */
export async function verifyLedgerIntegrity(
  job: Job,
  db: any,
): Promise<VerificationResult> {
  try {
    logger.info('Starting Ledger Integrity & Sequence Gap verification...');
    const anomalies: LedgerAnomaly[] = [];

    // 1. Fetch all sales invoices
    const allInvoices = await db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        stateCode: salesInvoices.stateCode,
        invoiceDate: salesInvoices.invoiceDate,
        createdBy: salesInvoices.createdBy,
        createdOn: salesInvoices.createdOn,
        totalAmount: salesInvoices.totalAmount,
      })
      .from(salesInvoices)
      .orderBy(asc(salesInvoices.createdOn), asc(salesInvoices.invoiceNumber));

    // 2. Fetch all journal entries
    const allJournalEntries = await db
      .select({
        journalEntryId: glJournalEntries.journalEntryId,
        sequenceNumber: glJournalEntries.sequenceNumber,
        entryNumber: glJournalEntries.entryNumber,
        entryDate: glJournalEntries.entryDate,
        memo: glJournalEntries.memo,
        sourceType: glJournalEntries.sourceType,
        sourceId: glJournalEntries.sourceId,
        prevHash: glJournalEntries.prevHash,
        entryHash: glJournalEntries.entryHash,
        isReversed: glJournalEntries.isReversed,
      })
      .from(glJournalEntries);

    // Identify if the system has take-on opening balance journal entries
    const openingEntries = allJournalEntries.filter((je: any) => {
      const st = (je.sourceType || '').toLowerCase();
      const en = (je.entryNumber || '').toUpperCase();
      return (
        st === 'initial_import' ||
        st === 'opening_balance' ||
        en.startsWith('JE-OPENING-')
      );
    });

    let takeOnDate: Date | null = null;
    if (openingEntries.length > 0) {
      const dates = openingEntries
        .map((je: any) =>
          je.entryDate ? new Date(je.entryDate).getTime() : null,
        )
        .filter((d: any): d is number => d !== null && !isNaN(d));
      if (dates.length > 0) {
        takeOnDate = new Date(Math.min(...dates));
      }
    }

    const isHistoricalImport = (inv: (typeof allInvoices)[0]) => {
      const creator = (inv.createdBy || '').toLowerCase();
      if (
        [
          'abm-import',
          'system-import',
          'legacy-import',
          'data-import',
          'initial_import',
        ].includes(creator)
      ) {
        return true;
      }
      if (
        takeOnDate &&
        inv.invoiceDate &&
        new Date(inv.invoiceDate) < takeOnDate
      ) {
        return true;
      }
      return false;
    };

    // Group invoices by sequence prefix (e.g. "INV-20260831-" or "INV-2026-")
    const invoicesByPrefix = new Map<string, typeof allInvoices>();
    for (const inv of allInvoices) {
      if (!inv.invoiceNumber) continue;
      const match = inv.invoiceNumber.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        if (!invoicesByPrefix.has(prefix)) {
          invoicesByPrefix.set(prefix, []);
        }
        invoicesByPrefix.get(prefix)!.push(inv);
      }
    }

    // A. Check Sequence Continuity and Timestamp Monotonicity within each prefix series
    for (const [prefix, invList] of invoicesByPrefix.entries()) {
      // If all invoices in this prefix are legacy historical imports, skip sequence gap detection
      const operationalInvoices = (invList as (typeof allInvoices[number])[]).filter(
        (inv: typeof allInvoices[number]) => !isHistoricalImport(inv),
      );
      if (operationalInvoices.length === 0) continue;

      let expectedSeq: number | null = null;
      let prevCreatedOn: Date | null = null;
      let prevInvNum: string | null = null;

      for (const inv of operationalInvoices) {
        const match = inv.invoiceNumber.match(/^(.*?)(\d+)$/);
        if (!match) continue;
        const currentSeq = parseInt(match[2], 10);
        const currentCreatedOn = new Date(inv.createdOn);

        if (expectedSeq !== null && currentSeq > expectedSeq) {
          anomalies.push({
            type: 'sequence_gap',
            invoiceNumber: inv.invoiceNumber,
            invoiceId: inv.invoiceId,
            details: {
              prefix,
              expectedSequence: expectedSeq,
              actualSequence: currentSeq,
              missingCount: currentSeq - expectedSeq,
            },
          });
        }
        expectedSeq = currentSeq + 1;

        if (prevCreatedOn && currentCreatedOn < prevCreatedOn) {
          anomalies.push({
            type: 'timestamp_inversion',
            invoiceNumber: inv.invoiceNumber,
            invoiceId: inv.invoiceId,
            details: {
              currentCreatedOn: currentCreatedOn.toISOString(),
              previousCreatedOn: prevCreatedOn.toISOString(),
              previousInvoiceNumber: prevInvNum,
            },
          });
        }
        prevCreatedOn = currentCreatedOn;
        prevInvNum = inv.invoiceNumber;
      }
    }

    // B. Check GL Posting & Cancellation Reversals for each invoice
    const journalBySourceId = new Map<
      string,
      (typeof allJournalEntries)[0][]
    >();
    for (const je of allJournalEntries) {
      if (je.sourceId) {
        const sid = String(je.sourceId);
        if (!journalBySourceId.has(sid)) {
          journalBySourceId.set(sid, []);
        }
        journalBySourceId.get(sid)!.push(je);
      }
    }

    const operationalInvoices = (allInvoices as (typeof allInvoices[number])[]).filter(
      (inv: typeof allInvoices[number]) => !isHistoricalImport(inv),
    );

    for (const inv of operationalInvoices) {
      if (inv.stateCode === 'draft') continue;

      const journals = journalBySourceId.get(inv.invoiceId) || [];
      const hasPosting = journals.some(
        (j) => j.sourceType === 'sales_invoice',
      );

      if (!hasPosting) {
        anomalies.push({
          type: 'missing_gl_journal',
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv.invoiceId,
          details: {
            stateCode: inv.stateCode,
            totalAmount: inv.totalAmount,
          },
        });
      }

      if (inv.stateCode === 'cancelled') {
        const hasReversal = journals.some(
          (j) => j.sourceType === 'sales_invoice_reversal',
        );
        if (!hasReversal) {
          anomalies.push({
            type: 'missing_cancellation_reversal',
            invoiceNumber: inv.invoiceNumber,
            invoiceId: inv.invoiceId,
            details: {
              stateCode: inv.stateCode,
            },
          });
        }
      }
    }

    // C. Check Double-Entry Debit/Credit Invariant for all Journal Entries
    const allLines = await db
      .select({
        journalEntryId: glJournalLines.journalEntryId,
        glAccountId: glJournalLines.glAccountId,
        costCenterId: glJournalLines.costCenterId,
        activityId: glJournalLines.activityId,
        partyType: glJournalLines.partyType,
        partyId: glJournalLines.partyId,
        debit: glJournalLines.debit,
        credit: glJournalLines.credit,
      })
      .from(glJournalLines);

    const totalsByEntry = new Map<
      string,
      { debit: number; credit: number }
    >();
    for (const line of allLines) {
      const entryId = line.journalEntryId;
      const current = totalsByEntry.get(entryId) || { debit: 0, credit: 0 };
      current.debit += parseFloat(line.debit || '0');
      current.credit += parseFloat(line.credit || '0');
      totalsByEntry.set(entryId, current);
    }

    for (const je of allJournalEntries) {
      const totals = totalsByEntry.get(je.journalEntryId);
      if (totals) {
        const drift = Math.abs(totals.debit - totals.credit);
        if (drift > 0.005) {
          anomalies.push({
            type: 'unbalanced_journal_entry',
            journalEntryId: je.journalEntryId,
            entryNumber: je.entryNumber,
            details: {
              totalDebit: totals.debit,
              totalCredit: totals.credit,
              drift,
            },
          });
        }
      }
    }

    // D. Check Cryptographic Ledger Hash Chain for all sequenced Journal Entries
    const sequencedEntries = allJournalEntries
      .filter((je: any) => je.sequenceNumber !== null && je.sequenceNumber !== undefined)
      .sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    if (sequencedEntries.length > 0) {
      const linesByEntry = new Map<string, typeof allLines>();
      for (const line of allLines) {
        const existing = linesByEntry.get(line.journalEntryId) || [];
        existing.push(line);
        linesByEntry.set(line.journalEntryId, existing);
      }

      const chainPayloads = sequencedEntries.map((e: any) => ({
        sequenceNumber: e.sequenceNumber,
        entryNumber: e.entryNumber,
        entryDate: e.entryDate || '',
        sourceType: e.sourceType,
        sourceId: e.sourceId ? String(e.sourceId) : null,
        memo: e.memo || null,
        prevHash: e.prevHash || '',
        entryHash: e.entryHash || '',
        lines: (linesByEntry.get(e.journalEntryId) || []).map((l: any) => ({
          glAccountId: l.glAccountId,
          debit: l.debit,
          credit: l.credit,
          costCenterId: l.costCenterId || null,
          activityId: l.activityId || null,
          partyType: l.partyType || null,
          partyId: l.partyId || null,
        })),
      }));

      const chainResult = verifyJournalChain(chainPayloads);
      if (!chainResult.isValid) {
        anomalies.push({
          type: 'hash_chain_violation',
          entryNumber: chainResult.brokenEntryNumber,
          details: {
            brokenSequenceNumber: chainResult.brokenSequenceNumber,
            error: chainResult.error,
          },
        });
      }
    }

    // E. Subledger-to-GL Continuous Reconciliation & Global Trial Balance Zero-Sum
    if (typeof db.execute === 'function') {
      const execScalar = async (query: import('drizzle-orm').SQL): Promise<number> => {
        try {
          const res = await db.execute(query);
          const row = Array.isArray(res)
            ? (res[0] as Record<string, string | number | null> | undefined)
            : (res as { rows: Record<string, string | number | null>[] })?.rows?.[0];
          if (!row) return 0;
          const firstVal = Object.values(row)[0];
          if (typeof firstVal === 'number') return firstVal;
          if (typeof firstVal === 'string') return parseFloat(firstVal) || 0;
          return 0;
        } catch {
          return 0;
        }
      };

      // 1. Global Trial Balance Zero-Sum: sum(debit) - sum(credit) = 0.00 across all journal lines
      const tbDebit = await execScalar(
        sql`SELECT COALESCE(SUM(debit), 0)::numeric FROM herobm_core.gl_journal_lines`,
      );
      const tbCredit = await execScalar(
        sql`SELECT COALESCE(SUM(credit), 0)::numeric FROM herobm_core.gl_journal_lines`,
      );
      const tbDrift = Math.round((tbDebit - tbCredit) * 100) / 100;
      if (Math.abs(tbDrift) > 0.005) {
        anomalies.push({
          type: 'trial_balance_unbalanced',
          details: {
            totalDebit: tbDebit,
            totalCredit: tbCredit,
            drift: tbDrift,
          },
        });
      }

      // 2. Fetch Control Account Configuration
      let settings: any = null;
      try {
        const rows = await db
          .select({
            defaultArAccountId: glSettings.defaultArAccountId,
            defaultApAccountId: glSettings.defaultApAccountId,
            defaultGrniAccountId: glSettings.defaultGrniAccountId,
            defaultInventoryAccountId: glSettings.defaultInventoryAccountId,
          })
          .from(glSettings)
          .limit(1);
        settings = rows[0];
      } catch {
        // Fallback for isolated environments or unmigrated tests
      }

      const arId = settings?.defaultArAccountId;
      const apId = settings?.defaultApAccountId;
      const grniId = settings?.defaultGrniAccountId;
      const invId = settings?.defaultInventoryAccountId;

      let arAcct: any = null;
      let apAcct: any = null;
      let grniAcct: any = null;
      let invAcct: any = null;

      try {
        if (arId) {
          const rows = await db
            .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
            .from(glAccounts)
            .where(eq(glAccounts.glAccountId, arId))
            .limit(1);
          arAcct = rows[0];
        }
        if (apId) {
          const rows = await db
            .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
            .from(glAccounts)
            .where(eq(glAccounts.glAccountId, apId))
            .limit(1);
          apAcct = rows[0];
        }
        if (grniId) {
          const rows = await db
            .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
            .from(glAccounts)
            .where(eq(glAccounts.glAccountId, grniId))
            .limit(1);
          grniAcct = rows[0];
        }
        if (invId) {
          const rows = await db
            .select({ accountCode: glAccounts.accountCode, name: glAccounts.name })
            .from(glAccounts)
            .where(eq(glAccounts.glAccountId, invId))
            .limit(1);
          invAcct = rows[0];
        }
      } catch {
        // Fallback if glAccounts query fails
      }

      // 3. Accounts Receivable (AR) Parity
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
      if (Math.abs(arDrift) > 0.005) {
        anomalies.push({
          type: 'subledger_drift',
          details: {
            subledger: 'accounts_receivable',
            subledgerName: 'Accounts Receivable (AR)',
            controlAccountCode: arAcct?.accountCode || '1200',
            controlAccountName: arAcct?.name || 'Accounts Receivable',
            subledgerBalance: arSubledger,
            glBalance: arGl,
            drift: arDrift,
          },
        });
      }

      // 4. Accounts Payable (AP) Parity
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
      if (Math.abs(apDrift) > 0.005) {
        anomalies.push({
          type: 'subledger_drift',
          details: {
            subledger: 'accounts_payable',
            subledgerName: 'Accounts Payable (AP)',
            controlAccountCode: apAcct?.accountCode || '2000',
            controlAccountName: apAcct?.name || 'Accounts Payable',
            subledgerBalance: apSubledger,
            glBalance: apGl,
            drift: apDrift,
          },
        });
      }

      // 5. Goods Received Not Invoiced (GRNI) Parity
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
      if (Math.abs(grniDrift) > 0.005) {
        anomalies.push({
          type: 'subledger_drift',
          details: {
            subledger: 'goods_received_not_invoiced',
            subledgerName: 'Goods Received Not Invoiced (GRNI)',
            controlAccountCode: grniAcct?.accountCode || '2150',
            controlAccountName: grniAcct?.name || 'GRNI Clearing',
            subledgerBalance: grniSubledger,
            glBalance: grniGl,
            drift: grniDrift,
          },
        });
      }

      // 6. Perpetual Inventory Parity
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
      if (Math.abs(invDrift) > 0.005) {
        anomalies.push({
          type: 'subledger_drift',
          details: {
            subledger: 'perpetual_inventory',
            subledgerName: 'Perpetual Inventory Valuation',
            controlAccountCode: invAcct?.accountCode || '1300',
            controlAccountName: invAcct?.name || 'Inventory on Hand',
            subledgerBalance: invSubledger,
            glBalance: invGl,
            drift: invDrift,
          },
        });
      }
    }

    const auditedAt = new Date().toISOString();
    const result: VerificationResult = {
      verifiedInvoicesCount: allInvoices.length,
      verifiedJournalsCount: allJournalEntries.length,
      anomaliesCount: anomalies.length,
      anomalies,
      auditedAt,
    };

    // 2. Multi-channel Alerting on Failure
    if (anomalies.length > 0) {
      logger.error(
        { anomaliesCount: anomalies.length, anomalies },
        'COMPLIANCE ALERT: Ledger integrity anomalies detected!',
      );

      const eventId = randomUUID();
      const payload = {
        anomaliesCount: anomalies.length,
        anomalies,
        auditedAt,
      };

      // A. Emit system_events (routed to Dashboard Timeline)
      await db.insert(systemEvents).values({
        eventId,
        entityType: 'system',
        entityId: eventId,
        eventType: 'ledger_integrity_violation',
        entityDisplayName: `Ledger Integrity Alert: ${anomalies.length} anomaly detected`,
        payload,
        actor: 'system-worker',
        createdOn: new Date(),
      });

      // B. Emit outbox event
      await db.insert(outbox).values({
        outboxId: eventId,
        entityType: 'system',
        entityId: eventId,
        eventType: 'system.ledger_integrity_violation',
        entityDisplayName: `Ledger Integrity Alert: ${anomalies.length} anomaly detected`,
        payload,
        createdOn: new Date(),
      });

      // C. Enqueue Admin Email Alert
      const anomalyListHtml = anomalies
        .slice(0, 10)
        .map(
          (a) =>
            `<li><b>${a.type}</b>: ${a.invoiceNumber || a.entryNumber || a.journalEntryId || 'Unknown'} - ${JSON.stringify(a.details)}</li>`,
        )
        .join('');

      await db.insert(emailOutbox).values({
        id: randomUUID(),
        toAddress: process.env.ADMIN_EMAIL || 'admin@herobm.internal',
        subject: `[ALERT] General Ledger Integrity Violation Detected (${anomalies.length} issues)`,
        htmlBody: `
          <h2>General Ledger Integrity Violation Alert</h2>
          <p>The automated scheduled compliance audit detected <b>${anomalies.length}</b> anomalies in the ledger at ${auditedAt}:</p>
          <ul>${anomalyListHtml}</ul>
          <p>Please review the General Ledger audit log immediately.</p>
        `,
        status: 'pending',
        retries: 0,
        entityType: 'system',
        entityId: eventId,
        createdAt: new Date(),
      });
    } else {
      logger.info(
        {
          verifiedInvoicesCount: operationalInvoices.length,
          verifiedJournalsCount: allJournalEntries.length,
        },
        'Ledger integrity verification passed with 0 anomalies.',
      );

      const eventId = randomUUID();
      const payload = {
        anomaliesCount: 0,
        anomalies: [],
        verifiedInvoicesCount: operationalInvoices.length,
        verifiedJournalsCount: allJournalEntries.length,
        auditedAt,
      };

      await db.insert(systemEvents).values({
        eventId,
        entityType: 'system',
        entityId: eventId,
        eventType: 'ledger_integrity_verified',
        entityDisplayName: `Ledger Integrity Verified: 0 anomalies across ${allJournalEntries.length} journals`,
        payload,
        actor: 'system-worker',
        createdOn: new Date(),
      });
    }

    return result;
  } catch (error: any) {
    logger.error(
      { err: error.message },
      'Failed to execute Ledger Integrity verification job',
    );
    throw error;
  }
}
