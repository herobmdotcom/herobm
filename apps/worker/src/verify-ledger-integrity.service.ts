import { Job } from 'bullmq';
import { eq, and, sql, asc, isNotNull } from 'drizzle-orm';
import {
  salesInvoices,
  glJournalEntries,
  glJournalLines,
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
    | 'hash_chain_violation';
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
        createdOn: salesInvoices.createdOn,
        totalAmount: salesInvoices.totalAmount,
      })
      .from(salesInvoices)
      .orderBy(asc(salesInvoices.createdOn), asc(salesInvoices.invoiceNumber));

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
      let expectedSeq: number | null = null;
      let prevCreatedOn: Date | null = null;
      let prevInvNum: string | null = null;

      for (const inv of invList) {
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

    const journalBySourceId = new Map<string, (typeof allJournalEntries)[0][]>();
    for (const je of allJournalEntries) {
      if (je.sourceId) {
        const sid = String(je.sourceId);
        if (!journalBySourceId.has(sid)) {
          journalBySourceId.set(sid, []);
        }
        journalBySourceId.get(sid)!.push(je);
      }
    }

    for (const inv of allInvoices) {
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
          verifiedInvoicesCount: allInvoices.length,
          verifiedJournalsCount: allJournalEntries.length,
        },
        'Ledger integrity verification passed with 0 anomalies.',
      );
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
