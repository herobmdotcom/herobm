import { calculateCashFlowStatement } from './gl-cash-flow.utils';

describe('gl-cash-flow.utils', () => {
  let mockDb: any;

  const mockAccounts = [
    {
      glAccountId: 'acc-cash-1',
      accountCode: '1010',
      name: 'Main Operating Bank',
      accountType: 'Bank',
      isGroup: false,
    },
    {
      glAccountId: 'acc-cash-2',
      accountCode: '1020',
      name: 'Savings Account',
      accountType: 'Bank',
      isGroup: false,
    },
    {
      glAccountId: 'acc-ar',
      accountCode: '1100',
      name: 'Accounts Receivable',
      accountType: 'Receivable',
      isGroup: false,
    },
    {
      glAccountId: 'acc-ap',
      accountCode: '2000',
      name: 'Accounts Payable',
      accountType: 'Payable',
      isGroup: false,
    },
    {
      glAccountId: 'acc-payroll',
      accountCode: '6000',
      name: 'Wages Expense',
      accountType: 'Expense',
      isGroup: false,
    },
    {
      glAccountId: 'acc-tax',
      accountCode: '2200',
      name: 'GST Clearing Account',
      accountType: 'Tax',
      isGroup: false,
    },
    {
      glAccountId: 'acc-ppe',
      accountCode: '1510',
      name: 'Machinery & Equipment',
      accountType: 'Asset',
      isGroup: false,
    },
    {
      glAccountId: 'acc-loan',
      accountCode: '2500',
      name: 'Commercial Bank Loan',
      accountType: 'Liability',
      isGroup: false,
    },
    {
      glAccountId: 'acc-equity',
      accountCode: '3000',
      name: 'Share Capital',
      accountType: 'Equity',
      isGroup: false,
    },
  ];

  beforeEach(() => {
    mockDb = {
      execute: jest.fn(),
    };
  });

  it('handles empty period with zero cash activity gracefully', async () => {
    // 1. Accounts query
    mockDb.execute.mockResolvedValueOnce(mockAccounts);
    // 2. Proof engine cash balances query (opening 50,000, closing 50,000)
    mockDb.execute.mockResolvedValueOnce([
      { openingCash: '50000', closingCash: '50000' },
    ]);
    // 3. Journal activity query (no entries)
    mockDb.execute.mockResolvedValueOnce([]);

    const result = await calculateCashFlowStatement(mockDb, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(result.operatingActivities.netCash).toBe(0);
    expect(result.investingActivities.netCash).toBe(0);
    expect(result.financingActivities.netCash).toBe(0);
    expect(result.reconciliation.beginningCash).toBe(50000);
    expect(result.reconciliation.endingCash).toBe(50000);
    expect(result.reconciliation.netChangeInCash).toBe(0);
    expect(result.reconciliation.drift).toBe(0);
    expect(result.reconciliation.isReconciled).toBe(true);
  });

  it('correctly partitions operating, investing, and financing flows with zero drift', async () => {
    // Opening: 100,000, Closing: 145,000 => Delta = +45,000
    // Activity in period:
    // Entry 1: Customer payment (Debit Cash 50,000, Credit AR 50,000) -> Operating +50,000
    // Entry 2: Supplier payment (Credit Cash 20,000, Debit AP 20,000) -> Operating -20,000
    // Entry 3: Capex Equipment (Credit Cash 15,000, Debit PPE 15,000) -> Investing -15,000
    // Entry 4: Share Capital Issue (Debit Cash 30,000, Credit Equity 30,000) -> Financing +30,000
    // Total Net Flow = +50k - 20k - 15k + 30k = +45,000

    mockDb.execute.mockResolvedValueOnce(mockAccounts);
    mockDb.execute.mockResolvedValueOnce([
      { openingCash: '100000', closingCash: '145000' },
    ]);

    const sampleJournalRows = [
      // Entry 1
      {
        journalEntryId: 'je-1',
        entryNumber: 'JE-001',
        entryDate: '2026-08-05',
        sourceType: 'payment',
        entryMemo: 'Customer payment',
        journalLineId: 'jl-1',
        glAccountId: 'acc-cash-1',
        debit: '50000',
        credit: '0',
        partyType: 'customer',
      },
      {
        journalEntryId: 'je-1',
        entryNumber: 'JE-001',
        entryDate: '2026-08-05',
        sourceType: 'payment',
        entryMemo: 'Customer payment',
        journalLineId: 'jl-2',
        glAccountId: 'acc-ar',
        debit: '0',
        credit: '50000',
        partyType: 'customer',
      },
      // Entry 2
      {
        journalEntryId: 'je-2',
        entryNumber: 'JE-002',
        entryDate: '2026-08-10',
        sourceType: 'payment',
        entryMemo: 'Supplier payment',
        journalLineId: 'jl-3',
        glAccountId: 'acc-cash-1',
        debit: '0',
        credit: '20000',
        partyType: 'supplier',
      },
      {
        journalEntryId: 'je-2',
        entryNumber: 'JE-002',
        entryDate: '2026-08-10',
        sourceType: 'payment',
        entryMemo: 'Supplier payment',
        journalLineId: 'jl-4',
        glAccountId: 'acc-ap',
        debit: '20000',
        credit: '0',
        partyType: 'supplier',
      },
      // Entry 3
      {
        journalEntryId: 'je-3',
        entryNumber: 'JE-003',
        entryDate: '2026-08-15',
        sourceType: 'manual',
        entryMemo: 'Purchased manufacturing lathe',
        journalLineId: 'jl-5',
        glAccountId: 'acc-cash-1',
        debit: '0',
        credit: '15000',
        partyType: '',
      },
      {
        journalEntryId: 'je-3',
        entryNumber: 'JE-003',
        entryDate: '2026-08-15',
        sourceType: 'manual',
        entryMemo: 'Purchased manufacturing lathe',
        journalLineId: 'jl-6',
        glAccountId: 'acc-ppe',
        debit: '15000',
        credit: '0',
        partyType: '',
      },
      // Entry 4
      {
        journalEntryId: 'je-4',
        entryNumber: 'JE-004',
        entryDate: '2026-08-20',
        sourceType: 'manual',
        entryMemo: 'Series A Share Capital',
        journalLineId: 'jl-7',
        glAccountId: 'acc-cash-1',
        debit: '30000',
        credit: '0',
        partyType: '',
      },
      {
        journalEntryId: 'je-4',
        entryNumber: 'JE-004',
        entryDate: '2026-08-20',
        sourceType: 'manual',
        entryMemo: 'Series A Share Capital',
        journalLineId: 'jl-8',
        glAccountId: 'acc-equity',
        debit: '0',
        credit: '30000',
        partyType: '',
      },
    ];

    mockDb.execute.mockResolvedValueOnce(sampleJournalRows);

    const result = await calculateCashFlowStatement(mockDb, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(result.operatingActivities.netCash).toBe(30000); // 50,000 - 20,000
    expect(result.investingActivities.netCash).toBe(-15000);
    expect(result.financingActivities.netCash).toBe(30000);
    expect(result.reconciliation.netChangeInCash).toBe(45000);
    expect(result.reconciliation.beginningCash).toBe(100000);
    expect(result.reconciliation.endingCash).toBe(145000);
    expect(result.reconciliation.drift).toBe(0);
    expect(result.reconciliation.isReconciled).toBe(true);
  });

  it('ensures inter-bank transfers do not distort operational cash flows (net zero invariant)', async () => {
    // Transfer $10,000 from Bank 1 to Bank 2
    mockDb.execute.mockResolvedValueOnce(mockAccounts);
    mockDb.execute.mockResolvedValueOnce([
      { openingCash: '100000', closingCash: '100000' },
    ]);

    const transferJournal = [
      {
        journalEntryId: 'je-xfer',
        entryNumber: 'JE-XFER',
        entryDate: '2026-08-12',
        sourceType: 'transfer',
        entryMemo: 'Transfer to savings',
        journalLineId: 'jl-10',
        glAccountId: 'acc-cash-1',
        debit: '0',
        credit: '10000',
        partyType: '',
      },
      {
        journalEntryId: 'je-xfer',
        entryNumber: 'JE-XFER',
        entryDate: '2026-08-12',
        sourceType: 'transfer',
        entryMemo: 'Transfer to savings',
        journalLineId: 'jl-11',
        glAccountId: 'acc-cash-2',
        debit: '10000',
        credit: '0',
        partyType: '',
      },
    ];

    mockDb.execute.mockResolvedValueOnce(transferJournal);

    const result = await calculateCashFlowStatement(mockDb, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(result.operatingActivities.netCash).toBe(0);
    expect(result.investingActivities.netCash).toBe(0);
    expect(result.financingActivities.netCash).toBe(0);
    expect(result.reconciliation.netChangeInCash).toBe(0);
    expect(result.reconciliation.drift).toBe(0);
    expect(result.reconciliation.isReconciled).toBe(true);
  });

  it('handles compound split entries with taxes and discounts accurately', async () => {
    // Compound invoice receipt: Cash +9,800, Discount Given -200, AR Credit 10,000
    mockDb.execute.mockResolvedValueOnce(mockAccounts);
    mockDb.execute.mockResolvedValueOnce([
      { openingCash: '0', closingCash: '9800' },
    ]);

    const splitJournal = [
      {
        journalEntryId: 'je-split',
        entryNumber: 'JE-SPLIT',
        entryDate: '2026-08-18',
        sourceType: 'receipt',
        entryMemo: 'Discounted customer settlement',
        journalLineId: 'jl-20',
        glAccountId: 'acc-cash-1',
        debit: '9800',
        credit: '0',
        partyType: 'customer',
      },
      {
        journalEntryId: 'je-split',
        entryNumber: 'JE-SPLIT',
        entryDate: '2026-08-18',
        sourceType: 'receipt',
        entryMemo: 'Early pay discount',
        journalLineId: 'jl-21',
        glAccountId: 'acc-payroll', // using an expense
        debit: '200',
        credit: '0',
        partyType: '',
      },
      {
        journalEntryId: 'je-split',
        entryNumber: 'JE-SPLIT',
        entryDate: '2026-08-18',
        sourceType: 'receipt',
        entryMemo: 'Clear AR',
        journalLineId: 'jl-22',
        glAccountId: 'acc-ar',
        debit: '0',
        credit: '10000',
        partyType: 'customer',
      },
    ];

    mockDb.execute.mockResolvedValueOnce(splitJournal);

    const result = await calculateCashFlowStatement(mockDb, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(result.operatingActivities.netCash).toBe(9800);
    expect(result.reconciliation.netChangeInCash).toBe(9800);
    expect(result.reconciliation.drift).toBe(0);
    expect(result.reconciliation.isReconciled).toBe(true);
  });

  describe('Generative Invariant Simulation (Property-Based Verification)', () => {
    it('guarantees zero drift across 50 randomized compound transaction sequences', async () => {
      for (let run = 0; run < 50; run++) {
        let runningCash = 50000;
        const initialCash = runningCash;
        const generatedRows: any[] = [];
        const entryCount = 10;

        for (let i = 0; i < entryCount; i++) {
          const entryId = `je-rand-${run}-${i}`;
          const typeChoice = i % 5;
          const amount = Math.round((Math.random() * 5000 + 100) * 100) / 100;

          if (typeChoice === 0) {
            // Customer Inflow
            runningCash += amount;
            generatedRows.push(
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-10',
                sourceType: 'payment',
                entryMemo: 'Customer receipt',
                journalLineId: `jl-${run}-${i}-1`,
                glAccountId: 'acc-cash-1',
                debit: String(amount),
                credit: '0',
                partyType: 'customer',
              },
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-10',
                sourceType: 'payment',
                entryMemo: 'Customer receipt',
                journalLineId: `jl-${run}-${i}-2`,
                glAccountId: 'acc-ar',
                debit: '0',
                credit: String(amount),
                partyType: 'customer',
              },
            );
          } else if (typeChoice === 1) {
            // Supplier Outflow
            runningCash -= amount;
            generatedRows.push(
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-12',
                sourceType: 'payment',
                entryMemo: 'Supplier pay',
                journalLineId: `jl-${run}-${i}-1`,
                glAccountId: 'acc-cash-1',
                debit: '0',
                credit: String(amount),
                partyType: 'supplier',
              },
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-12',
                sourceType: 'payment',
                entryMemo: 'Supplier pay',
                journalLineId: `jl-${run}-${i}-2`,
                glAccountId: 'acc-ap',
                debit: String(amount),
                credit: '0',
                partyType: 'supplier',
              },
            );
          } else if (typeChoice === 2) {
            // Capex Purchase Outflow
            runningCash -= amount;
            generatedRows.push(
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-15',
                sourceType: 'manual',
                entryMemo: 'Capex',
                journalLineId: `jl-${run}-${i}-1`,
                glAccountId: 'acc-cash-1',
                debit: '0',
                credit: String(amount),
                partyType: '',
              },
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-15',
                sourceType: 'manual',
                entryMemo: 'Capex',
                journalLineId: `jl-${run}-${i}-2`,
                glAccountId: 'acc-ppe',
                debit: String(amount),
                credit: '0',
                partyType: '',
              },
            );
          } else if (typeChoice === 3) {
            // Equity Inflow
            runningCash += amount;
            generatedRows.push(
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-20',
                sourceType: 'manual',
                entryMemo: 'Equity',
                journalLineId: `jl-${run}-${i}-1`,
                glAccountId: 'acc-cash-1',
                debit: String(amount),
                credit: '0',
                partyType: '',
              },
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-20',
                sourceType: 'manual',
                entryMemo: 'Equity',
                journalLineId: `jl-${run}-${i}-2`,
                glAccountId: 'acc-equity',
                debit: '0',
                credit: String(amount),
                partyType: '',
              },
            );
          } else {
            // Inter-bank Transfer
            generatedRows.push(
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-22',
                sourceType: 'transfer',
                entryMemo: 'Xfer',
                journalLineId: `jl-${run}-${i}-1`,
                glAccountId: 'acc-cash-1',
                debit: '0',
                credit: String(amount),
                partyType: '',
              },
              {
                journalEntryId: entryId,
                entryNumber: `JE-${run}-${i}`,
                entryDate: '2026-08-22',
                sourceType: 'transfer',
                entryMemo: 'Xfer',
                journalLineId: `jl-${run}-${i}-2`,
                glAccountId: 'acc-cash-2',
                debit: String(amount),
                credit: '0',
                partyType: '',
              },
            );
          }
        }

        mockDb.execute.mockResolvedValueOnce(mockAccounts);
        mockDb.execute.mockResolvedValueOnce([
          {
            openingCash: String(initialCash),
            closingCash: String(Math.round(runningCash * 100) / 100),
          },
        ]);
        mockDb.execute.mockResolvedValueOnce(generatedRows);

        const result = await calculateCashFlowStatement(mockDb, {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        });

        expect(result.reconciliation.drift).toBe(0);
        expect(result.reconciliation.isReconciled).toBe(true);
        expect(result.reconciliation.netChangeInCash).toBe(
          Math.round((runningCash - initialCash) * 100) / 100,
        );
      }
    });
  });
});
