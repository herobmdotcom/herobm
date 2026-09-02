import { asc, eq, and, sql, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glJournalEntries,
  glJournalLines,
  salesInvoices,
  systemEvents,
} from '@herobm/db-schema';
import { verifyJournalChain, SALES_INVOICE_STATE } from '@herobm/shared';
import { LedgerIntegrityAuditResponseDto, AnomalyDetailDto } from './dto';

/**
 * Executes a comprehensive audit of invoice numbering continuity,
 * timestamp monotonicity, GL matching, and double-entry invariants.
 */
export async function executeLedgerIntegrityAudit(
  db: DrizzleDB,
): Promise<LedgerIntegrityAuditResponseDto> {
  const anomalies: AnomalyDetailDto[] = [];
  const auditedAt = new Date().toISOString();

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
  const openingEntries = allJournalEntries.filter(
    (je: (typeof allJournalEntries)[number]) => {
      const st = (je.sourceType || '').toLowerCase();
      const en = (je.entryNumber || '').toUpperCase();
      return (
        st === 'initial_import' ||
        st === 'opening_balance' ||
        en.startsWith('JE-OPENING-')
      );
    },
  );

  let takeOnDate: Date | null = null;
  if (openingEntries.length > 0) {
    const dates = openingEntries
      .map((je: (typeof allJournalEntries)[number]) =>
        je.entryDate ? new Date(je.entryDate).getTime() : null,
      )
      .filter((d: number | null): d is number => d !== null && !isNaN(d));
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

  // A. Check Sequence Continuity and Timestamp Monotonicity within each prefix series
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

  for (const [prefix, invList] of invoicesByPrefix.entries()) {
    const operationalInvoices = invList.filter(
      (inv) => !isHistoricalImport(inv),
    );
    if (operationalInvoices.length === 0) continue;

    let expectedSeq: number | null = null;
    let prevCreatedOn: Date | null = null;
    let prevInvNum: string | null = null;

    for (const inv of operationalInvoices) {
      const match = inv.invoiceNumber.match(/^(.*?)(\d+)$/);
      if (!match) continue;
      const currentSeq = parseInt(match[2], 10);
      const currentCreatedOn = new Date(inv.createdOn || 0);

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

  const operationalInvoices = allInvoices.filter(
    (inv) => !isHistoricalImport(inv),
  );
  for (const inv of operationalInvoices) {
    if (inv.stateCode === SALES_INVOICE_STATE.DRAFT) continue;

    const journals = journalBySourceId.get(inv.invoiceId) || [];
    const hasPosting = journals.some((j) => j.sourceType === 'sales_invoice');

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

    if (inv.stateCode === SALES_INVOICE_STATE.CANCELLED) {
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

  const linesByJournal = new Map<string, typeof allLines>();
  for (const line of allLines) {
    const jid = line.journalEntryId;
    if (!linesByJournal.has(jid)) {
      linesByJournal.set(jid, []);
    }
    linesByJournal.get(jid)!.push(line);
  }

  for (const je of allJournalEntries) {
    const lines = linesByJournal.get(je.journalEntryId) || [];
    const totalDebit = lines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce(
      (acc, l) => acc + Number(l.credit || 0),
      0,
    );
    const drift = Math.abs(totalDebit - totalCredit);

    if (drift > 0.001) {
      anomalies.push({
        type: 'unbalanced_journal_entry',
        entryNumber: je.entryNumber,
        journalEntryId: je.journalEntryId,
        details: {
          totalDebit: Number(totalDebit.toFixed(2)),
          totalCredit: Number(totalCredit.toFixed(2)),
          drift: Number(drift.toFixed(4)),
        },
      });
    }
  }

  // D. Check Cryptographic Hash Chain Continuity for sequenced entries
  const sequencedEntries = allJournalEntries
    .filter(
      (je) => je.sequenceNumber !== null && je.sequenceNumber !== undefined,
    )
    .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

  if (sequencedEntries.length > 0) {
    const journalListForVerification = sequencedEntries.map((je) => {
      const lines = (linesByJournal.get(je.journalEntryId) || []).map((l) => ({
        glAccountId: l.glAccountId,
        costCenterId: l.costCenterId,
        activityId: l.activityId,
        partyType: l.partyType,
        partyId: l.partyId,
        debit: l.debit,
        credit: l.credit,
      }));
      return {
        sequenceNumber: je.sequenceNumber!,
        entryNumber: je.entryNumber,
        entryDate: je.entryDate,
        memo: je.memo,
        sourceType: je.sourceType,
        sourceId: je.sourceId,
        prevHash: je.prevHash || '',
        entryHash: je.entryHash || '',
        lines,
      };
    });

    const chainVerification = verifyJournalChain(
      journalListForVerification as Parameters<typeof verifyJournalChain>[0],
    );
    if (!chainVerification.isValid) {
      anomalies.push({
        type: 'hash_chain_violation',
        entryNumber: chainVerification.brokenEntryNumber,
        details: {
          error: chainVerification.error,
          brokenSequenceNumber: chainVerification.brokenSequenceNumber,
        },
      });
    }
  }

  const eventId = randomUUID();
  const payload = {
    anomaliesCount: anomalies.length,
    anomalies,
    verifiedInvoicesCount: operationalInvoices.length,
    verifiedJournalsCount: allJournalEntries.length,
    auditedAt,
  };

  const isClean = anomalies.length === 0;
  const eventType = isClean
    ? 'ledger_integrity_verified'
    : 'ledger_integrity_violation';
  const entityDisplayName = isClean
    ? `Ledger Integrity Verified: 0 anomalies across ${allJournalEntries.length} journals`
    : `Ledger Integrity Alert: ${anomalies.length} anomaly detected`;

  await db.insert(systemEvents).values({
    eventId,
    entityType: 'system',
    entityId: eventId,
    eventType,
    entityDisplayName,
    payload,
    actor: 'system-worker',
    createdOn: new Date(),
  });

  return {
    hasAudit: true,
    eventId,
    entityDisplayName,
    createdOn: new Date(),
    anomaliesCount: anomalies.length,
    anomalies,
    auditedAt,
    verifiedInvoicesCount: operationalInvoices.length,
    verifiedJournalsCount: allJournalEntries.length,
  };
}

/**
 * Fetches the integrity audit finding from system_events or executes on-demand verification.
 */
export async function fetchIntegrityAuditReport(
  db: DrizzleDB,
  eventId?: string,
): Promise<LedgerIntegrityAuditResponseDto> {
  let event;
  if (eventId) {
    const rows = await db
      .select()
      .from(systemEvents)
      .where(
        and(
          eq(systemEvents.eventId, eventId),
          sql`${systemEvents.eventType} IN ('ledger_integrity_violation', 'ledger_integrity_verified')`,
        ),
      )
      .limit(1);
    event = rows[0];
  } else {
    const rows = await db
      .select()
      .from(systemEvents)
      .where(
        sql`${systemEvents.eventType} IN ('ledger_integrity_violation', 'ledger_integrity_verified')`,
      )
      .orderBy(desc(systemEvents.createdOn))
      .limit(1);
    event = rows[0];
  }

  if (!event) {
    return executeLedgerIntegrityAudit(db);
  }

  const payload =
    (event.payload as {
      anomaliesCount?: number;
      anomalies?: Record<string, unknown>[];
      auditedAt?: string;
      verifiedInvoicesCount?: number;
      verifiedJournalsCount?: number;
    }) || {};
  return {
    hasAudit: true,
    eventId: event.eventId,
    entityDisplayName: event.entityDisplayName,
    createdOn: event.createdOn,
    anomaliesCount: payload.anomaliesCount ?? (payload.anomalies?.length || 0),
    anomalies: (payload.anomalies || []) as unknown as AnomalyDetailDto[],
    auditedAt: payload.auditedAt || event.createdOn?.toISOString() || null,
    verifiedInvoicesCount: payload.verifiedInvoicesCount ?? undefined,
    verifiedJournalsCount: payload.verifiedJournalsCount ?? undefined,
  };
}
