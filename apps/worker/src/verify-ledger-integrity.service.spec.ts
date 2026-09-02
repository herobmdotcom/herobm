import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyLedgerIntegrity } from './verify-ledger-integrity.service';
import { Job } from 'bullmq';

describe('verify-ledger-integrity.service', () => {
  let mockDb: any;
  let mockJob: Job;

  beforeEach(() => {
    mockJob = { id: 'test-job' } as unknown as Job;
  });

  it('should pass cleanly with zero anomalies when ledger is fully consistent', async () => {
    const invoices = [
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-20260831-0001',
        stateCode: 'invoiced',
        createdOn: new Date('2026-08-31T09:00:00Z'),
        totalAmount: '100.00',
      },
      {
        invoiceId: 'inv-2',
        invoiceNumber: 'INV-20260831-0002',
        stateCode: 'invoiced',
        createdOn: new Date('2026-08-31T10:00:00Z'),
        totalAmount: '200.00',
      },
    ];

    const journals = [
      {
        journalEntryId: 'je-1',
        entryNumber: 'JE-20260831-0001',
        sourceType: 'sales_invoice',
        sourceId: 'inv-1',
        isReversed: false,
      },
      {
        journalEntryId: 'je-2',
        entryNumber: 'JE-20260831-0002',
        sourceType: 'sales_invoice',
        sourceId: 'inv-2',
        isReversed: false,
      },
    ];

    const lines = [
      { journalEntryId: 'je-1', debit: '100.00', credit: '0' },
      { journalEntryId: 'je-1', debit: '0', credit: '100.00' },
      { journalEntryId: 'je-2', debit: '200.00', credit: '0' },
      { journalEntryId: 'je-2', debit: '0', credit: '200.00' },
    ];

    let selectCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              orderBy: vi.fn().mockResolvedValue(invoices),
            };
          } else if (selectCallCount === 2) {
            return Promise.resolve(journals);
          } else {
            return Promise.resolve(lines);
          }
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };

    const res = await verifyLedgerIntegrity(mockJob, mockDb);

    expect(res.anomaliesCount).toBe(0);
    expect(res.verifiedInvoicesCount).toBe(2);
    expect(res.verifiedJournalsCount).toBe(2);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('should detect sequence gaps in invoice numbering', async () => {
    const invoices = [
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-20260831-0001',
        stateCode: 'invoiced',
        createdOn: new Date('2026-08-31T09:00:00Z'),
        totalAmount: '100.00',
      },
      {
        invoiceId: 'inv-3',
        invoiceNumber: 'INV-20260831-0003', // Gap: missing 0002!
        stateCode: 'invoiced',
        createdOn: new Date('2026-08-31T10:00:00Z'),
        totalAmount: '200.00',
      },
    ];

    const journals = [
      { journalEntryId: 'je-1', sourceId: 'inv-1', sourceType: 'sales_invoice' },
      { journalEntryId: 'je-3', sourceId: 'inv-3', sourceType: 'sales_invoice' },
    ];

    const lines = [
      { journalEntryId: 'je-1', debit: '100.00', credit: '0' },
      { journalEntryId: 'je-1', debit: '0', credit: '100.00' },
      { journalEntryId: 'je-3', debit: '200.00', credit: '0' },
      { journalEntryId: 'je-3', debit: '0', credit: '200.00' },
    ];

    let selectCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              orderBy: vi.fn().mockResolvedValue(invoices),
            };
          } else if (selectCallCount === 2) {
            return Promise.resolve(journals);
          } else {
            return Promise.resolve(lines);
          }
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };

    const res = await verifyLedgerIntegrity(mockJob, mockDb);

    expect(res.anomaliesCount).toBe(1);
    expect(res.anomalies[0].type).toBe('sequence_gap');
    expect(res.anomalies[0].invoiceNumber).toBe('INV-20260831-0003');
    expect(res.anomalies[0].details.expectedSequence).toBe(2);
    expect(mockDb.insert).toHaveBeenCalledTimes(3); // system_events, outbox, email_outbox
  });

  it('should detect timestamp inversions and missing GL journals', async () => {
    const invoices = [
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-20260831-0001',
        stateCode: 'invoiced',
        createdOn: new Date('2026-08-31T12:00:00Z'),
        totalAmount: '100.00',
      },
      {
        invoiceId: 'inv-2',
        invoiceNumber: 'INV-20260831-0002',
        stateCode: 'invoiced',
        createdOn: new Date('2026-08-31T08:00:00Z'), // Inversion! Created before 0001
        totalAmount: '200.00',
      },
    ];

    // No journals -> missing GL journals!
    const journals: any[] = [];
    const lines: any[] = [];

    let selectCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              orderBy: vi.fn().mockResolvedValue(invoices),
            };
          } else if (selectCallCount === 2) {
            return Promise.resolve(journals);
          } else {
            return Promise.resolve(lines);
          }
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };

    const res = await verifyLedgerIntegrity(mockJob, mockDb);

    const types = res.anomalies.map((a) => a.type);
    expect(types).toContain('timestamp_inversion');
    expect(types).toContain('missing_gl_journal');
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should detect unbalanced double-entry journals', async () => {
    const invoices: any[] = [];
    const journals = [
      {
        journalEntryId: 'je-broken',
        entryNumber: 'JE-20260831-9999',
        sourceType: 'manual',
      },
    ];
    const lines = [
      { journalEntryId: 'je-broken', debit: '100.00', credit: '0' },
      { journalEntryId: 'je-broken', debit: '0', credit: '80.00' }, // Unbalanced by 20.00!
    ];

    let selectCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              orderBy: vi.fn().mockResolvedValue(invoices),
            };
          } else if (selectCallCount === 2) {
            return Promise.resolve(journals);
          } else {
            return Promise.resolve(lines);
          }
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };

    const res = await verifyLedgerIntegrity(mockJob, mockDb);

    expect(res.anomaliesCount).toBe(1);
    expect(res.anomalies[0].type).toBe('unbalanced_journal_entry');
    expect(res.anomalies[0].journalEntryId).toBe('je-broken');
  });

  it('should detect hash_chain_violation when a journal entry hash is corrupted', async () => {
    const invoices: any[] = [];
    const journals = [
      {
        journalEntryId: 'je-1',
        sequenceNumber: 1,
        entryNumber: 'JE-20260831-0001',
        entryDate: '2026-08-31',
        memo: 'Test 1',
        sourceType: 'manual',
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
        entryHash: 'corrupted-hash-value-1234567890',
        isReversed: false,
      },
    ];
    const lines = [
      { journalEntryId: 'je-1', glAccountId: 'acct-1', debit: '100.00', credit: '0' },
      { journalEntryId: 'je-1', glAccountId: 'acct-2', debit: '0', credit: '100.00' },
    ];

    let selectCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              orderBy: vi.fn().mockResolvedValue(invoices),
            };
          } else if (selectCallCount === 2) {
            return Promise.resolve(journals);
          } else {
            return Promise.resolve(lines);
          }
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };

    const res = await verifyLedgerIntegrity(mockJob, mockDb);

    expect(res.anomaliesCount).toBe(1);
    expect(res.anomalies[0].type).toBe('hash_chain_violation');
    expect(res.anomalies[0].entryNumber).toBe('JE-20260831-0001');
  });

  it('should skip missing_gl_journal and sequence gaps for historical imported invoices before take-on date', async () => {
    // 2 historical pre-takeon invoices imported from legacy ABM without individual GL journals
    const invoices = [
      {
        invoiceId: 'inv-legacy-1',
        invoiceNumber: 'INV-2020-0001',
        stateCode: 'invoiced',
        invoiceDate: new Date('2020-05-15T00:00:00Z'),
        createdBy: 'abm-import',
        createdOn: new Date('2026-08-01T00:00:00Z'),
        totalAmount: '5000.00',
      },
      {
        invoiceId: 'inv-legacy-2',
        invoiceNumber: 'INV-2020-0010', // Legacy sequence gap
        stateCode: 'invoiced',
        invoiceDate: new Date('2020-06-15T00:00:00Z'),
        createdBy: 'abm-import',
        createdOn: new Date('2026-08-01T00:00:00Z'),
        totalAmount: '3000.00',
      },
    ];

    // Single opening balance journal taking on all historical ledger balances on 2026-08-01
    const journals = [
      {
        journalEntryId: 'je-opening',
        entryNumber: 'JE-OPENING-20260801',
        entryDate: '2026-08-01',
        sourceType: 'opening_balance',
        sourceId: null,
        isReversed: false,
      },
    ];

    const lines = [
      { journalEntryId: 'je-opening', debit: '8000.00', credit: '0' },
      { journalEntryId: 'je-opening', debit: '0', credit: '8000.00' },
    ];

    let selectCallCount = 0;
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              orderBy: vi.fn().mockResolvedValue(invoices),
            };
          } else if (selectCallCount === 2) {
            return Promise.resolve(journals);
          } else {
            return Promise.resolve(lines);
          }
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    };

    const res = await verifyLedgerIntegrity(mockJob, mockDb);

    // 0 anomalies because historical invoices are covered by opening balance journal
    expect(res.anomaliesCount).toBe(0);
    expect(res.verifiedInvoicesCount).toBe(2);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

