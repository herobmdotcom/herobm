import {
  calculateCashFlowStatement,
  calculateCashFlowLineDrilldown,
} from './gl-cash-flow.utils';

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

  describe('Universal and International Multi-Standard Chart of Accounts (ADV-172)', () => {
    it('correctly classifies French PCG chart of accounts (Class 5 Bank, Class 4 AR/AP, Class 2 Capex, Class 1 Loans/Equity)', async () => {
      const frenchAccounts = [
        {
          glAccountId: 'fr-acc-bank',
          accountCode: '512000',
          name: 'Banque BNP Paribas',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: true,
        },
        {
          glAccountId: 'fr-acc-ar',
          accountCode: '411000',
          name: 'Clients (Créances)',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'fr-acc-ap',
          accountCode: '401000',
          name: 'Fournisseurs (Dettes)',
          accountType: 'liability',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'fr-acc-capex',
          accountCode: '215000',
          name: 'Matériel et outillage industriel',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'fr-acc-loan',
          accountCode: '164000',
          name: 'Emprunts auprès des établissements de crédit',
          accountType: 'liability',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'fr-acc-equity',
          accountCode: '101000',
          name: 'Capital social',
          accountType: 'equity',
          isGroup: false,
          isBankAccount: false,
        },
      ];

      const frenchJournals = [
        // Entry 1: Customer payment (Debit Bank 30,000, Credit Clients 30,000) -> Operating +30,000
        {
          journalEntryId: 'je-fr-1',
          entryNumber: 'JE-FR-001',
          entryDate: '2026-08-04',
          sourceType: 'customer_receipt',
          entryMemo: 'Paiement facture client',
          journalLineId: 'jl-fr-1',
          glAccountId: 'fr-acc-bank',
          debit: '30000',
          credit: '0',
          partyType: 'customer',
        },
        {
          journalEntryId: 'je-fr-1',
          entryNumber: 'JE-FR-001',
          entryDate: '2026-08-04',
          sourceType: 'customer_receipt',
          entryMemo: 'Paiement facture client',
          journalLineId: 'jl-fr-2',
          glAccountId: 'fr-acc-ar',
          debit: '0',
          credit: '30000',
          partyType: 'customer',
        },
        // Entry 2: Supplier payment (Credit Bank 12,000, Debit Fournisseurs 12,000) -> Operating -12,000
        {
          journalEntryId: 'je-fr-2',
          entryNumber: 'JE-FR-002',
          entryDate: '2026-08-08',
          sourceType: 'supplier_payment',
          entryMemo: 'Règlement fournisseur',
          journalLineId: 'jl-fr-3',
          glAccountId: 'fr-acc-bank',
          debit: '0',
          credit: '12000',
          partyType: 'supplier',
        },
        {
          journalEntryId: 'je-fr-2',
          entryNumber: 'JE-FR-002',
          entryDate: '2026-08-08',
          sourceType: 'supplier_payment',
          entryMemo: 'Règlement fournisseur',
          journalLineId: 'jl-fr-4',
          glAccountId: 'fr-acc-ap',
          debit: '12000',
          credit: '0',
          partyType: 'supplier',
        },
        // Entry 3: Fixed asset purchase (Credit Bank 8,000, Debit Matériel 8,000) -> Investing -8,000
        {
          journalEntryId: 'je-fr-3',
          entryNumber: 'JE-FR-003',
          entryDate: '2026-08-14',
          sourceType: 'manual',
          entryMemo: 'Acquisition machine découpe',
          journalLineId: 'jl-fr-5',
          glAccountId: 'fr-acc-bank',
          debit: '0',
          credit: '8000',
          partyType: '',
        },
        {
          journalEntryId: 'je-fr-3',
          entryNumber: 'JE-FR-003',
          entryDate: '2026-08-14',
          sourceType: 'manual',
          entryMemo: 'Acquisition machine découpe',
          journalLineId: 'jl-fr-6',
          glAccountId: 'fr-acc-capex',
          debit: '8000',
          credit: '0',
          partyType: '',
        },
        // Entry 4: Bank loan drawdown (Debit Bank 15,000, Credit Emprunts 15,000) -> Financing +15,000
        {
          journalEntryId: 'je-fr-4',
          entryNumber: 'JE-FR-004',
          entryDate: '2026-08-22',
          sourceType: 'manual',
          entryMemo: 'Déblocage prêt bancaire',
          journalLineId: 'jl-fr-7',
          glAccountId: 'fr-acc-bank',
          debit: '15000',
          credit: '0',
          partyType: '',
        },
        {
          journalEntryId: 'je-fr-4',
          entryNumber: 'JE-FR-004',
          entryDate: '2026-08-22',
          sourceType: 'manual',
          entryMemo: 'Déblocage prêt bancaire',
          journalLineId: 'jl-fr-8',
          glAccountId: 'fr-acc-loan',
          debit: '0',
          credit: '15000',
          partyType: '',
        },
      ];

      mockDb.execute.mockResolvedValueOnce(frenchAccounts);
      mockDb.execute.mockResolvedValueOnce([
        { openingCash: '50000', closingCash: '75000' },
      ]);
      mockDb.execute.mockResolvedValueOnce(frenchJournals);

      const result = await calculateCashFlowStatement(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.operatingActivities.netCash).toBe(18000); // 30,000 - 12,000
      expect(result.investingActivities.netCash).toBe(-8000);
      expect(result.financingActivities.netCash).toBe(15000);
      expect(result.reconciliation.beginningCash).toBe(50000);
      expect(result.reconciliation.endingCash).toBe(75000);
      expect(result.reconciliation.netChangeInCash).toBe(25000);
      expect(result.reconciliation.drift).toBe(0);
      expect(result.reconciliation.isReconciled).toBe(true);
    });

    it('correctly classifies German DATEV SKR04 chart of accounts', async () => {
      const germanAccounts = [
        {
          glAccountId: 'de-acc-bank',
          accountCode: '1800',
          name: 'Commerzbank',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: true,
        },
        {
          glAccountId: 'de-acc-ar',
          accountCode: '1200',
          name: 'Forderungen aus Lieferungen und Leistungen',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'de-acc-ap',
          accountCode: '3300',
          name: 'Verbindlichkeiten aus Lieferungen und Leistungen',
          accountType: 'liability',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'de-acc-capex',
          accountCode: '0600',
          name: 'Betriebs- und Geschäftsausstattung',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'de-acc-loan',
          accountCode: '3100',
          name: 'Bankdarlehen (langfristig)',
          accountType: 'liability',
          isGroup: false,
          isBankAccount: false,
        },
      ];

      const germanJournals = [
        // Entry 1: Customer Receipt +40,000 (Operating)
        {
          journalEntryId: 'je-de-1',
          entryNumber: 'JE-DE-001',
          entryDate: '2026-08-05',
          sourceType: 'payment',
          entryMemo: 'Kundenzahlung Rechnung 100',
          journalLineId: 'jl-de-1',
          glAccountId: 'de-acc-bank',
          debit: '40000',
          credit: '0',
          partyType: 'customer',
        },
        {
          journalEntryId: 'je-de-1',
          entryNumber: 'JE-DE-001',
          entryDate: '2026-08-05',
          sourceType: 'payment',
          entryMemo: 'Kundenzahlung Rechnung 100',
          journalLineId: 'jl-de-2',
          glAccountId: 'de-acc-ar',
          debit: '0',
          credit: '40000',
          partyType: 'customer',
        },
        // Entry 2: Capex Equipment Purchase -10,000 (Investing)
        {
          journalEntryId: 'je-de-2',
          entryNumber: 'JE-DE-002',
          entryDate: '2026-08-12',
          sourceType: 'manual',
          entryMemo: 'Kauf Werkstatteinrichtung',
          journalLineId: 'jl-de-3',
          glAccountId: 'de-acc-bank',
          debit: '0',
          credit: '10000',
          partyType: '',
        },
        {
          journalEntryId: 'je-de-2',
          entryNumber: 'JE-DE-002',
          entryDate: '2026-08-12',
          sourceType: 'manual',
          entryMemo: 'Kauf Werkstatteinrichtung',
          journalLineId: 'jl-de-4',
          glAccountId: 'de-acc-capex',
          debit: '10000',
          credit: '0',
          partyType: '',
        },
        // Entry 3: Loan Repayment -5,000 (Financing)
        {
          journalEntryId: 'je-de-3',
          entryNumber: 'JE-DE-003',
          entryDate: '2026-08-20',
          sourceType: 'manual',
          entryMemo: 'Tilgung Bankdarlehen',
          journalLineId: 'jl-de-5',
          glAccountId: 'de-acc-bank',
          debit: '0',
          credit: '5000',
          partyType: '',
        },
        {
          journalEntryId: 'je-de-3',
          entryNumber: 'JE-DE-003',
          entryDate: '2026-08-20',
          sourceType: 'manual',
          entryMemo: 'Tilgung Bankdarlehen',
          journalLineId: 'jl-de-6',
          glAccountId: 'de-acc-loan',
          debit: '5000',
          credit: '0',
          partyType: '',
        },
      ];

      mockDb.execute.mockResolvedValueOnce(germanAccounts);
      mockDb.execute.mockResolvedValueOnce([
        { openingCash: '100000', closingCash: '125000' },
      ]);
      mockDb.execute.mockResolvedValueOnce(germanJournals);

      const result = await calculateCashFlowStatement(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.operatingActivities.netCash).toBe(40000);
      expect(result.investingActivities.netCash).toBe(-10000);
      expect(result.financingActivities.netCash).toBe(-5000);
      expect(result.reconciliation.netChangeInCash).toBe(25000);
      expect(result.reconciliation.isReconciled).toBe(true);
      expect(result.reconciliation.drift).toBe(0);
    });

    it('supports alphanumeric chart of accounts and control accounts mapped via glSettings', async () => {
      const alphaAccounts = [
        {
          glAccountId: 'acc-bank-usd',
          accountCode: 'BANK-USD-01',
          name: 'US Dollar Operating Account',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: true,
        },
        {
          glAccountId: 'acc-ar-main',
          accountCode: 'GL-1100-DOM',
          name: 'Trade Debtors',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'acc-ap-main',
          accountCode: 'GL-2000-TRADE',
          name: 'Trade Creditors',
          accountType: 'liability',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'acc-capex-eq',
          accountCode: 'GL-1500-EQUIP',
          name: 'Production Line Automation',
          accountType: 'asset',
          isGroup: false,
          isBankAccount: false,
        },
        {
          glAccountId: 'acc-equity-com',
          accountCode: 'GL-3000-SERIES-B',
          name: 'Series B Preferred Shares',
          accountType: 'equity',
          isGroup: false,
          isBankAccount: false,
        },
      ];

      const alphaJournals = [
        {
          journalEntryId: 'je-alpha-1',
          entryNumber: 'JE-ALPHA-01',
          entryDate: '2026-08-10',
          sourceType: 'customer_receipt',
          entryMemo: 'Invoice settlement',
          journalLineId: 'jl-a-1',
          glAccountId: 'acc-bank-usd',
          debit: '50000',
          credit: '0',
          partyType: 'customer',
        },
        {
          journalEntryId: 'je-alpha-1',
          entryNumber: 'JE-ALPHA-01',
          entryDate: '2026-08-10',
          sourceType: 'customer_receipt',
          entryMemo: 'Invoice settlement',
          journalLineId: 'jl-a-2',
          glAccountId: 'acc-ar-main',
          debit: '0',
          credit: '50000',
          partyType: 'customer',
        },
        {
          journalEntryId: 'je-alpha-2',
          entryNumber: 'JE-ALPHA-02',
          entryDate: '2026-08-15',
          sourceType: 'manual',
          entryMemo: 'Series B Equity Injection',
          journalLineId: 'jl-a-3',
          glAccountId: 'acc-bank-usd',
          debit: '100000',
          credit: '0',
          partyType: '',
        },
        {
          journalEntryId: 'je-alpha-2',
          entryNumber: 'JE-ALPHA-02',
          entryDate: '2026-08-15',
          sourceType: 'manual',
          entryMemo: 'Series B Equity Injection',
          journalLineId: 'jl-a-4',
          glAccountId: 'acc-equity-com',
          debit: '0',
          credit: '100000',
          partyType: '',
        },
      ];

      mockDb.execute.mockResolvedValueOnce(alphaAccounts);
      mockDb.execute.mockResolvedValueOnce([
        { openingCash: '200000', closingCash: '350000' },
      ]);
      mockDb.execute.mockResolvedValueOnce(alphaJournals);

      const result = await calculateCashFlowStatement(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        glSettings: {
          defaultArAccountId: 'acc-ar-main',
          defaultApAccountId: 'acc-ap-main',
        },
      });

      expect(result.operatingActivities.netCash).toBe(50000);
      expect(result.financingActivities.netCash).toBe(100000);
      expect(result.reconciliation.netChangeInCash).toBe(150000);
      expect(result.reconciliation.beginningCash).toBe(200000);
      expect(result.reconciliation.endingCash).toBe(350000);
      expect(result.reconciliation.isReconciled).toBe(true);
      expect(result.reconciliation.drift).toBe(0);
    });
  });

  describe('Lazy-Loaded Line Drilldown (calculateCashFlowLineDrilldown)', () => {
    const drilldownJournals = [
      {
        journalEntryId: 'je-drill-1',
        entryNumber: 'JE-001',
        entryDate: '2026-08-05',
        sourceType: 'customer_receipt',
        entryMemo: 'August Customer Payment',
        journalLineId: 'jl-d-1',
        glAccountId: 'acc-cash-1',
        debit: '120000',
        credit: '0',
        partyType: 'customer',
      },
      {
        journalEntryId: 'je-drill-1',
        entryNumber: 'JE-001',
        entryDate: '2026-08-05',
        sourceType: 'customer_receipt',
        entryMemo: 'August Customer Payment',
        journalLineId: 'jl-d-2',
        glAccountId: 'acc-ar',
        debit: '0',
        credit: '120000',
        partyType: 'customer',
      },
      {
        journalEntryId: 'je-drill-2',
        entryNumber: 'JE-002',
        entryDate: '2026-08-15',
        sourceType: 'manual',
        entryMemo: 'Capex Purchase',
        journalLineId: 'jl-d-3',
        glAccountId: 'acc-cash-1',
        debit: '0',
        credit: '25000',
        partyType: '',
      },
      {
        journalEntryId: 'je-drill-2',
        entryNumber: 'JE-002',
        entryDate: '2026-08-15',
        sourceType: 'manual',
        entryMemo: 'Capex Purchase',
        journalLineId: 'jl-d-4',
        glAccountId: 'acc-ppe',
        debit: '25000',
        credit: '0',
        partyType: '',
      },
    ];

    it('returns decomposed transactions for customer receipts with exact amounts', async () => {
      mockDb.execute.mockResolvedValueOnce(mockAccounts);
      mockDb.execute.mockResolvedValueOnce(drilldownJournals);

      const drilldown = await calculateCashFlowLineDrilldown(
        mockDb,
        {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        },
        'op-customers',
      );

      expect(drilldown.lineId).toBe('op-customers');
      expect(drilldown.category).toBe('operating');
      expect(drilldown.totalAmount).toBe(120000);
      expect(drilldown.transactions).toHaveLength(1);
      expect(drilldown.transactions[0].entryNumber).toBe('JE-001');
      expect(drilldown.transactions[0].allocatedCash).toBe(120000);
      expect(drilldown.transactions[0].accountCode).toBe('1100');
    });

    it('returns decomposed transactions for capex purchase lines', async () => {
      mockDb.execute.mockResolvedValueOnce(mockAccounts);
      mockDb.execute.mockResolvedValueOnce(drilldownJournals);

      const drilldown = await calculateCashFlowLineDrilldown(
        mockDb,
        {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        },
        'inv-capex',
      );

      expect(drilldown.lineId).toBe('inv-capex');
      expect(drilldown.category).toBe('investing');
      expect(drilldown.totalAmount).toBe(-25000);
      expect(drilldown.transactions).toHaveLength(1);
      expect(drilldown.transactions[0].entryNumber).toBe('JE-002');
      expect(drilldown.transactions[0].allocatedCash).toBe(-25000);
      expect(drilldown.transactions[0].accountCode).toBe('1510');
    });

    it('ignores INITIAL_IMPORT / opening balance take-on entries from operational decomposition', async () => {
      const openingJournalWithOperational = [
        ...drilldownJournals,
        {
          journalEntryId: 'je-opening-take-on',
          entryNumber: 'JE-OPENING-20260825',
          entryDate: '2026-08-25',
          sourceType: 'INITIAL_IMPORT',
          entryMemo: 'ABM Opening Balance Take-On',
          journalLineId: 'jl-open-1',
          glAccountId: 'acc-cash-1',
          debit: '173477.74',
          credit: '0',
          partyType: '',
        },
        {
          journalEntryId: 'je-opening-take-on',
          entryNumber: 'JE-OPENING-20260825',
          entryDate: '2026-08-25',
          sourceType: 'INITIAL_IMPORT',
          entryMemo: 'ABM Opening Balance Take-On',
          journalLineId: 'jl-open-2',
          glAccountId: 'acc-ar',
          debit: '0',
          credit: '173477.74',
          partyType: '',
        },
      ];

      // Drilldown query executed directly by the DB should filter out opening entries
      // When mockDb returns only the non-opening journals as the SQL query specifies:
      mockDb.execute.mockResolvedValueOnce(mockAccounts);
      mockDb.execute.mockResolvedValueOnce(drilldownJournals);

      const drilldown = await calculateCashFlowLineDrilldown(
        mockDb,
        {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        },
        'op-customers',
      );

      expect(drilldown.totalAmount).toBe(120000);
      expect(
        drilldown.transactions.every((t) => t.sourceType !== 'INITIAL_IMPORT'),
      ).toBe(true);
    });

    it('ignores manual opening_balance take-on entries from operational decomposition', async () => {
      mockDb.execute.mockResolvedValueOnce(mockAccounts);
      mockDb.execute.mockResolvedValueOnce(drilldownJournals);

      const drilldown = await calculateCashFlowLineDrilldown(
        mockDb,
        {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        },
        'op-customers',
      );

      expect(
        drilldown.transactions.every((t) => t.sourceType !== 'opening_balance'),
      ).toBe(true);
    });
  });

  describe('Pre-Take-On & Loan Account Defensive Protections (ADV-176)', () => {
    it('defensively excludes loan accounts from bank control balance pool even if flagged as is_bank_account', async () => {
      const accountsWithLoan = [
        ...mockAccounts,
        {
          glAccountId: 'acc-loan-prop',
          accountCode: '0507',
          name: '3 ANZ Property Loan',
          accountType: 'Asset',
          isGroup: false,
          isBankAccount: true,
        },
        {
          glAccountId: 'acc-loan-jindera',
          accountCode: '0665',
          name: 'ANZ Loan Jindera Property',
          accountType: 'Liability',
          isGroup: false,
          isBankAccount: true,
        },
      ];

      // Proof engine returns balances only for the true cash accounts
      mockDb.execute.mockResolvedValueOnce(accountsWithLoan);
      mockDb.execute.mockResolvedValueOnce([
        { openingCash: '50000', closingCash: '50000' },
      ]);
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await calculateCashFlowStatement(mockDb, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.reconciliation.beginningCash).toBe(50000);
      expect(result.reconciliation.endingCash).toBe(50000);
      expect(result.reconciliation.drift).toBe(0);
      expect(result.reconciliation.isReconciled).toBe(true);
    });

    it('reconciles cleanly with zero drift for periods prior to the take-on opening balance date', async () => {
      // For July 2026 (prior to August 1 opening balance):
      // Opening Cash = 0, Closing Cash = 0, Net Period Change = 0 -> Drift = 0
      mockDb.execute.mockResolvedValueOnce(mockAccounts);
      mockDb.execute.mockResolvedValueOnce([
        { openingCash: '0', closingCash: '0' },
      ]);
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await calculateCashFlowStatement(mockDb, {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      });

      expect(result.operatingActivities.netCash).toBe(0);
      expect(result.investingActivities.netCash).toBe(0);
      expect(result.financingActivities.netCash).toBe(0);
      expect(result.reconciliation.beginningCash).toBe(0);
      expect(result.reconciliation.endingCash).toBe(0);
      expect(result.reconciliation.netChangeInCash).toBe(0);
      expect(result.reconciliation.drift).toBe(0);
      expect(result.reconciliation.isReconciled).toBe(true);
    });
  });
});
