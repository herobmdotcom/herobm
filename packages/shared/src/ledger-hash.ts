import * as crypto from 'crypto';

export const GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

export interface CanonicalJournalLine {
  glAccountId: string;
  debit: string;
  credit: string;
  costCenterId?: string | null;
  activityId?: string | null;
  partyType?: string | null;
  partyId?: string | null;
}

export interface CanonicalJournalPayload {
  sequenceNumber: number;
  entryNumber: string;
  entryDate: string;
  sourceType: string;
  sourceId: string | null;
  memo: string | null;
  lines: CanonicalJournalLine[];
}

/**
 * Computes a deterministic SHA-256 hash of a journal entry's canonical payload.
 * Lines are sorted deterministically so identical transactions produce identical hashes.
 */
export function computeCanonicalPayloadHash(
  payload: CanonicalJournalPayload,
): string {
  const sortedLines = [...payload.lines]
    .map((l) => ({
      glAccountId: l.glAccountId,
      debit: Number(l.debit || 0).toFixed(2),
      credit: Number(l.credit || 0).toFixed(2),
      costCenterId: l.costCenterId || null,
      activityId: l.activityId || null,
      partyType: l.partyType || null,
      partyId: l.partyId || null,
    }))
    .sort((a, b) => {
      const cmpAcct = a.glAccountId.localeCompare(b.glAccountId);
      if (cmpAcct !== 0) return cmpAcct;
      const cmpDebit = a.debit.localeCompare(b.debit);
      if (cmpDebit !== 0) return cmpDebit;
      const cmpCredit = a.credit.localeCompare(b.credit);
      if (cmpCredit !== 0) return cmpCredit;
      return (a.partyId || '').localeCompare(b.partyId || '');
    });

  const canonicalObj = {
    sequenceNumber: payload.sequenceNumber,
    entryNumber: payload.entryNumber,
    entryDate: payload.entryDate,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId || null,
    memo: payload.memo || null,
    lines: sortedLines,
  };

  const jsonString = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Computes the chained entry hash from previous entry hash and current payload hash.
 */
export function computeEntryHash(
  prevHash: string,
  payloadHash: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${prevHash}:${payloadHash}`)
    .digest('hex');
}

export interface ChainVerificationResult {
  isValid: boolean;
  verifiedCount: number;
  brokenSequenceNumber?: number;
  brokenEntryNumber?: string;
  error?: string;
}

/**
 * Verifies a sequential array of journal entries and their lines.
 */
export function verifyJournalChain(
  entries: Array<{
    sequenceNumber: number;
    entryNumber: string;
    entryDate: string;
    sourceType: string;
    sourceId: string | null;
    memo: string | null;
    prevHash: string;
    entryHash: string;
    lines: CanonicalJournalLine[];
  }>,
): ChainVerificationResult {
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedSeq = i + 1;

    if (entry.sequenceNumber !== expectedSeq) {
      return {
        isValid: false,
        verifiedCount: i,
        brokenSequenceNumber: entry.sequenceNumber,
        brokenEntryNumber: entry.entryNumber,
        error: `Sequence gap or invalid sequence: expected ${expectedSeq}, found ${entry.sequenceNumber}`,
      };
    }

    if (entry.prevHash !== expectedPrevHash) {
      return {
        isValid: false,
        verifiedCount: i,
        brokenSequenceNumber: entry.sequenceNumber,
        brokenEntryNumber: entry.entryNumber,
        error: `Broken chain link at sequence #${entry.sequenceNumber} (${entry.entryNumber}): expected prevHash ${expectedPrevHash}, found ${entry.prevHash}`,
      };
    }

    const computedPayloadHash = computeCanonicalPayloadHash({
      sequenceNumber: entry.sequenceNumber,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      memo: entry.memo,
      lines: entry.lines,
    });

    const computedEntryHash = computeEntryHash(
      entry.prevHash,
      computedPayloadHash,
    );

    if (entry.entryHash !== computedEntryHash) {
      return {
        isValid: false,
        verifiedCount: i,
        brokenSequenceNumber: entry.sequenceNumber,
        brokenEntryNumber: entry.entryNumber,
        error: `Payload tampering detected at sequence #${entry.sequenceNumber} (${entry.entryNumber}): expected entryHash ${computedEntryHash}, found ${entry.entryHash}`,
      };
    }

    expectedPrevHash = entry.entryHash;
  }

  return {
    isValid: true,
    verifiedCount: entries.length,
  };
}
