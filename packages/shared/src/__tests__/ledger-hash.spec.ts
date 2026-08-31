import {
  GENESIS_HASH,
  computeCanonicalPayloadHash,
  computeEntryHash,
  verifyJournalChain,
} from '../ledger-hash';

describe('Cryptographic Ledger Hash Chaining', () => {
  it('computes deterministic canonical payload hash regardless of line order', () => {
    const payload1 = {
      sequenceNumber: 1,
      entryNumber: 'JE-20260831-0001',
      entryDate: '2026-08-31',
      sourceType: 'manual',
      sourceId: null,
      memo: 'Test Entry',
      lines: [
        { glAccountId: '11111111-1111-1111-1111-111111111111', debit: '100.00', credit: '0.00' },
        { glAccountId: '22222222-2222-2222-2222-222222222222', debit: '0.00', credit: '100.00' },
      ],
    };

    const payload2 = {
      sequenceNumber: 1,
      entryNumber: 'JE-20260831-0001',
      entryDate: '2026-08-31',
      sourceType: 'manual',
      sourceId: null,
      memo: 'Test Entry',
      lines: [
        { glAccountId: '22222222-2222-2222-2222-222222222222', debit: '0.00', credit: '100.00' },
        { glAccountId: '11111111-1111-1111-1111-111111111111', debit: '100.00', credit: '0.00' },
      ],
    };

    const hash1 = computeCanonicalPayloadHash(payload1);
    const hash2 = computeCanonicalPayloadHash(payload2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('verifies a valid linear hash chain starting from GENESIS_HASH', () => {
    const entries = [];
    let prevHash = GENESIS_HASH;

    for (let seq = 1; seq <= 5; seq++) {
      const entryNumber = `JE-20260831-000${seq}`;
      const lines = [
        { glAccountId: '11111111-1111-1111-1111-111111111111', debit: `${seq * 10}.00`, credit: '0.00' },
        { glAccountId: '22222222-2222-2222-2222-222222222222', debit: '0.00', credit: `${seq * 10}.00` },
      ];
      const payloadHash = computeCanonicalPayloadHash({
        sequenceNumber: seq,
        entryNumber,
        entryDate: '2026-08-31',
        sourceType: 'manual',
        sourceId: null,
        memo: `Entry ${seq}`,
        lines,
      });
      const entryHash = computeEntryHash(prevHash, payloadHash);

      entries.push({
        sequenceNumber: seq,
        entryNumber,
        entryDate: '2026-08-31',
        sourceType: 'manual',
        sourceId: null,
        memo: `Entry ${seq}`,
        prevHash,
        entryHash,
        lines,
      });

      prevHash = entryHash;
    }

    const result = verifyJournalChain(entries);
    expect(result.isValid).toBe(true);
    expect(result.verifiedCount).toBe(5);
  });

  it('detects tampering when an entry line amount is modified', () => {
    const entries = [];
    let prevHash = GENESIS_HASH;

    for (let seq = 1; seq <= 3; seq++) {
      const entryNumber = `JE-20260831-000${seq}`;
      const lines = [
        { glAccountId: '11111111-1111-1111-1111-111111111111', debit: '100.00', credit: '0.00' },
        { glAccountId: '22222222-2222-2222-2222-222222222222', debit: '0.00', credit: '100.00' },
      ];
      const payloadHash = computeCanonicalPayloadHash({
        sequenceNumber: seq,
        entryNumber,
        entryDate: '2026-08-31',
        sourceType: 'manual',
        sourceId: null,
        memo: `Entry ${seq}`,
        lines,
      });
      const entryHash = computeEntryHash(prevHash, payloadHash);

      entries.push({
        sequenceNumber: seq,
        entryNumber,
        entryDate: '2026-08-31',
        sourceType: 'manual',
        sourceId: null,
        memo: `Entry ${seq}`,
        prevHash,
        entryHash,
        lines,
      });

      prevHash = entryHash;
    }

    // Tamper with entry #2's line debit
    entries[1].lines[0].debit = '999.00';

    const result = verifyJournalChain(entries);
    expect(result.isValid).toBe(false);
    expect(result.verifiedCount).toBe(1);
    expect(result.brokenSequenceNumber).toBe(2);
    expect(result.error).toContain('Payload tampering detected at sequence #2');
  });

  it('detects broken chain link when prevHash is altered or a row is missing', () => {
    const entries = [];
    let prevHash = GENESIS_HASH;

    for (let seq = 1; seq <= 3; seq++) {
      const entryNumber = `JE-20260831-000${seq}`;
      const lines = [
        { glAccountId: '11111111-1111-1111-1111-111111111111', debit: '50.00', credit: '0.00' },
        { glAccountId: '22222222-2222-2222-2222-222222222222', debit: '0.00', credit: '50.00' },
      ];
      const payloadHash = computeCanonicalPayloadHash({
        sequenceNumber: seq,
        entryNumber,
        entryDate: '2026-08-31',
        sourceType: 'manual',
        sourceId: null,
        memo: `Entry ${seq}`,
        lines,
      });
      const entryHash = computeEntryHash(prevHash, payloadHash);

      entries.push({
        sequenceNumber: seq,
        entryNumber,
        entryDate: '2026-08-31',
        sourceType: 'manual',
        sourceId: null,
        memo: `Entry ${seq}`,
        prevHash,
        entryHash,
        lines,
      });

      prevHash = entryHash;
    }

    // Break prevHash on entry #3
    entries[2].prevHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    const result = verifyJournalChain(entries);
    expect(result.isValid).toBe(false);
    expect(result.verifiedCount).toBe(2);
    expect(result.brokenSequenceNumber).toBe(3);
    expect(result.error).toContain('Broken chain link at sequence #3');
  });
});
