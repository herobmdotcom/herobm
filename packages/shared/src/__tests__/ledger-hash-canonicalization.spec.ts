import { Decimal } from 'decimal.js';
import {
  computeCanonicalPayloadHash,
  computeEntryHash,
  verifyJournalChain,
  GENESIS_HASH,
  CanonicalJournalPayload,
} from '../ledger-hash';

describe('Cryptographic Ledger Hash Serialization & Canonicalization (Layer F)', () => {
  const basePayload: CanonicalJournalPayload = {
    sequenceNumber: 1,
    entryNumber: 'JE-000001',
    entryDate: '2026-09-26',
    sourceType: 'sales_invoice',
    sourceId: '11111111-1111-1111-1111-111111111111',
    memo: 'Test Invoice JE',
    lines: [
      {
        glAccountId: 'acct-1',
        debit: '100.00',
        credit: '0.00',
        partyType: 'customer',
        partyId: 'cust-1',
      },
      {
        glAccountId: 'acct-2',
        debit: '0.00',
        credit: '100.00',
      },
    ],
  };

  it('should produce identical payload hashes regardless of numeric string representation formatting', () => {
    const hashCanonical = computeCanonicalPayloadHash(basePayload);

    // Formatted with integer strings and varying zeroes
    const variation1: CanonicalJournalPayload = {
      ...basePayload,
      lines: [
        {
          glAccountId: 'acct-1',
          debit: '100', // integer string
          credit: '0',
          partyType: 'customer',
          partyId: 'cust-1',
        },
        {
          glAccountId: 'acct-2',
          debit: '0.000',
          credit: '100.0',
        },
      ],
    };

    const hashVariation1 = computeCanonicalPayloadHash(variation1);
    expect(hashVariation1).toBe(hashCanonical);
  });

  it('should normalize ISO timestamp dates to YYYY-MM-DD for stable payload hashing', () => {
    const hashDateOnly = computeCanonicalPayloadHash(basePayload);

    const variationIso: CanonicalJournalPayload = {
      ...basePayload,
      entryDate: '2026-09-26T14:32:00.000Z',
    };

    const hashIso = computeCanonicalPayloadHash(variationIso);
    expect(hashIso).toBe(hashDateOnly);
  });

  it('should normalize undefined and null fields identically', () => {
    const payloadWithNulls: CanonicalJournalPayload = {
      ...basePayload,
      sourceId: null,
      memo: null,
      lines: [
        {
          glAccountId: 'acct-1',
          debit: '50.00',
          credit: '0.00',
          costCenterId: null,
          activityId: null,
          partyType: null,
          partyId: null,
        },
      ],
    };

    const payloadWithUndefined: CanonicalJournalPayload = {
      ...basePayload,
      sourceId: undefined as unknown as null,
      memo: undefined as unknown as null,
      lines: [
        {
          glAccountId: 'acct-1',
          debit: '50.00',
          credit: '0.00',
          costCenterId: undefined,
          activityId: undefined,
          partyType: undefined,
          partyId: undefined,
        },
      ],
    };

    expect(computeCanonicalPayloadHash(payloadWithUndefined)).toBe(
      computeCanonicalPayloadHash(payloadWithNulls),
    );
  });

  it('should successfully verify journal chain across formatted entries', () => {
    const payloadHash = computeCanonicalPayloadHash(basePayload);
    const entryHash = computeEntryHash(GENESIS_HASH, payloadHash);

    const entries = [
      {
        sequenceNumber: 1,
        entryNumber: 'JE-000001',
        entryDate: '2026-09-26T00:00:00.000Z',
        sourceType: 'sales_invoice',
        sourceId: '11111111-1111-1111-1111-111111111111',
        memo: 'Test Invoice JE',
        prevHash: GENESIS_HASH,
        entryHash,
        lines: [
          {
            glAccountId: 'acct-1',
            debit: '100', // integer string representation
            credit: '0.0',
            partyType: 'customer',
            partyId: 'cust-1',
          },
          {
            glAccountId: 'acct-2',
            debit: '0.00',
            credit: '100.000',
          },
        ],
      },
    ];

    const result = verifyJournalChain(entries);
    expect(result.isValid).toBe(true);
    expect(result.verifiedCount).toBe(1);
  });
});
