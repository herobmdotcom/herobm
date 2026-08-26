import { Test, TestingModule } from '@nestjs/testing';
import { ACTOR_STATE, CUSTOMER_STATE } from '@herobm/shared';
import { GlService } from './gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  glAccounts,
  glJournalEntries,
  glJournalLines,
  costCenters,
  activities,
  glSettings,
  salesInvoices,
  salesCreditNotes,
  purchaseInvoices,
  purchaseDebitNotes,
  salesOrderShipments,
  customers,
  suppliers,
  actors,
} from '@herobm/db-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('GlService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GlService;

  beforeEach(async () => {
    // Clean tables for isolation
    await pg.db.delete(glJournalLines);
    await pg.db.delete(glJournalEntries);
    await pg.db.delete(glSettings);
    await pg.db.delete(glAccounts);
    await pg.db.delete(costCenters);
    await pg.db.delete(activities);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlService,
        {
          provide: DataSourcesRegistry,
          useValue: { registerReport: jest.fn(), getReport: jest.fn() },
        },
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            homeCurrency: jest.fn().mockReturnValue('EUR'),
            inventoryAccountingMode: () => 'perpetual',
          },
        },
      ],
    }).compile();

    service = module.get<GlService>(GlService);
  });

  describe('postJournalEntry — balance invariant', () => {
    it('should reject null/undefined lines', async () => {
      await expect(
        // @ts-expect-error -- intentionally testing invalid input
        service.postJournalEntry(null, { sourceType: 'manual' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty lines array', async () => {
      await expect(
        service.postJournalEntry([], { sourceType: 'manual' }),
      ).rejects.toThrow('at least 2 lines');
    });

    it('should reject a single line', async () => {
      await expect(
        service.postJournalEntry(
          [{ accountCode: '1100', debit: 100, credit: 0 }],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('at least 2 lines');
    });

    it('should reject when debits exceed credits', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 50 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should reject when credits exceed debits', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 50, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should accept balanced entries (proceeds past balance check to account lookup)', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'NON-EXISTENT-1', debit: 100, credit: 0 },
            { accountCode: 'NON-EXISTENT-2', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist');
    });

    it('should tolerate floating-point imprecision within 0.005', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'NON-EXISTENT-1', debit: 0.1 + 0.2, credit: 0 },
            { accountCode: 'NON-EXISTENT-2', debit: 0, credit: 0.3 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist');
    });

    it('should reject imbalance beyond tolerance (0.01)', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100.01, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100.0 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should reject lines with negative debit or credit amounts', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: -100, credit: 0 },
            { accountCode: '4100', debit: 0, credit: -100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('negative amounts');
    });

    it('should reject lines with negative foreign amounts', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100, credit: 0, foreignDebit: -100 },
            { accountCode: '4100', debit: 0, credit: 100, foreignCredit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('negative foreign amounts');
    });

    it('should reject dual-sided lines with both debit and credit', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100, credit: 50 },
            { accountCode: '4100', debit: 0, credit: 50 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('both debit');
    });

    it('should reject zero-amount lines where debit and credit are zero', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 0, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 0 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('zero debit and credit');
    });
  });

  describe('postJournalEntry — account validation', () => {
    it('should reject when no account codes exist', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'MISSING-1', debit: 100, credit: 0 },
            { accountCode: 'MISSING-2', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow("'MISSING-1' does not exist");
    });

    it('should reject posting to a group account', async () => {
      await pg.db.insert(glAccounts).values({
        glAccountId: randomUUID(),
        accountCode: 'G-VAL-1000',
        name: 'Group Account',
        accountType: 'asset',
        isGroup: true,
        isActive: true,
        currencyCode: 'AUD',
        isSystem: false,
        isBankAccount: false,
      });
      await pg.db.insert(glAccounts).values({
        glAccountId: randomUUID(),
        accountCode: 'L-VAL-1000',
        name: 'Leaf Account',
        accountType: 'asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
        isSystem: false,
        isBankAccount: false,
      });

      await expect(
        service.postJournalEntry(
          [
            { accountCode: 'G-VAL-1000', debit: 100, credit: 0 },
            { accountCode: 'L-VAL-1000', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('group account');
    });
  });

  describe('postJournalEntry — success path', () => {
    it('should create entry and lines within a transaction', async () => {
      const arId = randomUUID();
      const revId = randomUUID();
      const invId = randomUUID();
      await pg.db.insert(glAccounts).values([
        {
          glAccountId: arId,
          accountCode: 'S-1100',
          isGroup: false,
          isActive: true,
          name: 'AR',
          accountType: 'asset',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
        {
          glAccountId: revId,
          accountCode: 'S-4100',
          isGroup: false,
          isActive: true,
          name: 'Revenue',
          accountType: 'revenue',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
      ]);

      const result = await service.postJournalEntry(
        [
          { accountCode: 'S-1100', debit: 500, credit: 0, memo: 'AR debit' },
          { accountCode: 'S-4100', debit: 0, credit: 500, memo: 'Rev credit' },
        ],
        {
          sourceType: 'sales_invoice',
          sourceId: invId,
          memo: 'Test',
          actor: 'admin',
        },
      );

      expect(result.journalEntryId).toBeDefined();

      const [entry] = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.journalEntryId, result.journalEntryId));
      expect(entry).toMatchObject({
        sourceType: 'sales_invoice',
        sourceId: invId,
        memo: 'Test',
        createdBy: 'admin',
      });

      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, result.journalEntryId))
        .orderBy(glJournalLines.debit);
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l) => parseFloat(l.debit) === 500);
      const creditLine = lines.find((l) => parseFloat(l.credit) === 500);

      expect(debitLine).toMatchObject({
        glAccountId: arId,
        memo: 'AR debit',
      });
      expect(creditLine).toMatchObject({
        glAccountId: revId,
        memo: 'Rev credit',
      });
    });

    it('should increment sequence when entries already exist today', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const todayStripped = today.replace(/-/g, '');

      await pg.db.insert(glAccounts).values([
        {
          accountCode: 'SEQ-1100',
          name: 'AR',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
        {
          accountCode: 'SEQ-4100',
          name: 'Rev',
          accountType: 'revenue',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
      ]);

      await pg.db.insert(glJournalEntries).values({
        entryNumber: `JE-${todayStripped}-0003`,
        entryDate: today,
        sourceType: 'manual',
        isReversed: false,
        createdBy: 'system',
      });

      const result = await service.postJournalEntry(
        [
          { accountCode: 'SEQ-1100', debit: 100, credit: 0 },
          { accountCode: 'SEQ-4100', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual' },
      );

      const [entry] = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.journalEntryId, result.journalEntryId));
      expect(entry.entryNumber).toBe(`JE-${todayStripped}-0004`);
    });
  });

  describe('getChartOfAccounts (tree builder)', () => {
    it('should build nested tree from flat accounts', async () => {
      const a1 = randomUUID();
      const a2 = randomUUID();
      const a3 = randomUUID();
      const a4 = randomUUID();
      const a5 = randomUUID();

      await pg.db.insert(glAccounts).values([
        {
          glAccountId: a1,
          accountCode: 'T-1000',
          name: 'Assets Tree',
          parentAccountId: null,
          isGroup: true,
          accountType: 'asset',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
          isActive: true,
        },
        {
          glAccountId: a2,
          accountCode: 'T-1100',
          name: 'AR Tree',
          parentAccountId: a1,
          isGroup: false,
          accountType: 'asset',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
          isActive: true,
        },
        {
          glAccountId: a3,
          accountCode: 'T-1200',
          name: 'GST Tree',
          parentAccountId: a1,
          isGroup: false,
          accountType: 'asset',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
          isActive: true,
        },
        {
          glAccountId: a4,
          accountCode: 'T-2000',
          name: 'Liabilities Tree',
          parentAccountId: null,
          isGroup: true,
          accountType: 'liability',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
          isActive: true,
        },
        {
          glAccountId: a5,
          accountCode: 'T-2100',
          name: 'AP Tree',
          parentAccountId: a4,
          isGroup: false,
          accountType: 'liability',
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
          isActive: true,
        },
      ]);

      const tree = await service.getChartOfAccounts();

      expect(tree.length).toBeGreaterThanOrEqual(2);
      expect(tree.find((t) => t.name === 'Assets Tree')?.children).toHaveLength(
        2,
      );
      expect(
        tree.find((t) => t.name === 'Liabilities Tree')?.children,
      ).toHaveLength(1);
    });
  });

  describe('Trial Balance & General Ledger', () => {
    it('should return trial balance with correct balances', async () => {
      const [acct] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: 'TB-1100',
          name: 'AR TB',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        })
        .returning();

      const [entry] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-TB-001',
          entryDate: new Date().toISOString(),
          sourceType: 'manual',
          isReversed: false,
          createdBy: 'system',
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: entry.journalEntryId,
        glAccountId: acct.glAccountId,
        debit: '500',
        credit: '200',
        foreignDebit: '500',
        foreignCredit: '200',
        exchangeRate: '1',
        isReconciled: false,
      });

      const tb = await service.getTrialBalance();
      const row = tb.find((r) => r.accountCode === 'TB-1100');
      expect(row).toBeDefined();
      expect(row?.ytdDebit).toBe(500);
      expect(row?.ytdCredit).toBe(200);
      expect(row?.ytdBalance).toBe(300);
    });
  });

  describe('Dimension Resolution', () => {
    it('should resolve missing dimensions from system defaults (code 00)', async () => {
      const ccId = randomUUID();
      const actId = randomUUID();

      await pg.db
        .insert(costCenters)
        .values({
          costCenterId: ccId,
          code: '00',
          name: 'Default CC',
          isSystem: true,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: costCenters.code,
          set: { costCenterId: ccId },
        });

      await pg.db
        .insert(activities)
        .values({
          activityId: actId,
          code: '00',
          name: 'Default Activity',
          isSystem: true,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: activities.code,
          set: { activityId: actId },
        });

      const [acct] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: 'DIM-1000',
          name: 'Test Dim',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        })
        .returning();

      const result = await service.postJournalEntry(
        [
          { accountCode: 'DIM-1000', debit: 100, credit: 0 },
          { accountCode: 'DIM-1000', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual', actor: 'test' },
      );

      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, result.journalEntryId));
      expect(lines[0].costCenterId).toBe(ccId);
      expect(lines[0].activityId).toBe(actId);
    });
    describe('FX Symmetry and Multi-Currency', () => {
      beforeEach(async () => {
        await pg.db
          .insert(glAccounts)
          .values([
            {
              accountCode: 'FX-1000',
              name: 'FX AR',
              accountType: 'asset',
              isGroup: false,
              isActive: true,
              currencyCode: 'AUD',
              isSystem: false,
              isBankAccount: false,
            },
            {
              accountCode: 'FX-4000',
              name: 'FX Rev',
              accountType: 'revenue',
              isGroup: false,
              isActive: true,
              currencyCode: 'AUD',
              isSystem: false,
              isBankAccount: false,
            },
          ])
          .onConflictDoNothing();
      });

      it('should allow posting a journal with foreign amounts and an exchange rate', async () => {
        const result = await service.postJournalEntry(
          [
            {
              accountCode: 'FX-1000',
              debit: 110,
              credit: 0,
              foreignDebit: 100,
              foreignCredit: 0,
              foreignCurrencyCode: 'EUR',
              exchangeRate: 1.1,
            },
            {
              accountCode: 'FX-4000',
              debit: 0,
              credit: 110,
              foreignDebit: 0,
              foreignCredit: 100,
              foreignCurrencyCode: 'EUR',
              exchangeRate: 1.1,
            },
          ],
          { sourceType: 'manual', actor: 'test' },
        );

        const lines = await pg.db
          .select()
          .from(glJournalLines)
          .where(eq(glJournalLines.journalEntryId, result.journalEntryId))
          .orderBy(glJournalLines.debit);

        expect(lines).toHaveLength(2);
        const debitLine = lines.find((l) => parseFloat(l.debit) === 110);
        expect(debitLine).toBeDefined();
        expect(parseFloat(debitLine!.foreignDebit || '0')).toBe(100);
        expect(debitLine!.foreignCurrencyCode).toBe('EUR');
        expect(parseFloat(debitLine!.exchangeRate || '1')).toBe(1.1);
      });

      it('should reject a journal if base debit != base credit, even if foreign amounts balance', async () => {
        await expect(
          service.postJournalEntry(
            [
              {
                accountCode: 'FX-1000',
                debit: 110,
                credit: 0,
                foreignDebit: 100,
                foreignCredit: 0,
                foreignCurrencyCode: 'EUR',
                exchangeRate: 1.1,
              },
              {
                accountCode: 'FX-4000',
                debit: 0,
                credit: 115,
                foreignDebit: 0,
                foreignCredit: 100,
                foreignCurrencyCode: 'EUR',
                exchangeRate: 1.15,
              },
            ],
            { sourceType: 'manual', actor: 'test' },
          ),
        ).rejects.toThrow('Journal entry is unbalanced');
      });

      it('should accept a journal where base amounts balance but foreign amounts do not (e.g. Realized FX Variance)', async () => {
        // Base: 120 (Payment) - 100 (Invoice) - 20 (Loss) = 0.
        // Foreign: 100 EUR Payment - 100 EUR Invoice = 0.
        const result = await service.postJournalEntry(
          [
            {
              accountCode: 'FX-1000',
              debit: 120,
              credit: 0,
              foreignDebit: 100,
              foreignCredit: 0,
              foreignCurrencyCode: 'EUR',
              exchangeRate: 1.2,
            }, // Payment
            {
              accountCode: 'FX-4000',
              debit: 0,
              credit: 100,
              foreignDebit: 0,
              foreignCredit: 100,
              foreignCurrencyCode: 'EUR',
              exchangeRate: 1.0,
            }, // Clear AP
            {
              accountCode: 'FX-4000',
              debit: 0,
              credit: 20,
              foreignDebit: 0,
              foreignCredit: 0,
              foreignCurrencyCode: 'EUR',
              exchangeRate: 1.0,
            }, // Realized FX Loss
          ],
          { sourceType: 'manual', actor: 'test' },
        );

        expect(result.journalEntryId).toBeDefined();
      });
    });
  });

  describe('getJournalEntries', () => {
    beforeEach(async () => {
      await pg.db.insert(glAccounts).values([
        {
          glAccountId: randomUUID(),
          accountCode: '1000',
          name: 'Cash',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          isSystem: false,
          isBankAccount: true,
          currencyCode: 'EUR',
        },
        {
          glAccountId: randomUUID(),
          accountCode: '2000',
          name: 'Revenue',
          accountType: 'revenue',
          isGroup: false,
          isActive: true,
          isSystem: false,
          isBankAccount: false,
          currencyCode: 'EUR',
        },
      ]);
    });

    it('resolves sourceNumber for sales credit notes, purchase debit notes, and shipments', async () => {
      const actorId = randomUUID();
      await pg.db.insert(actors).values({
        actorId,
        name: 'Test Party',
        email: 'test@example.com',
        isTaxRegistered: false,
        stateCode: ACTOR_STATE.ACTIVE,
      });

      const customerId = randomUUID();
      await pg.db.insert(customers).values({
        customerId,
        actorId,
        customerNumber: 'CUST-01',
        currencyCode: 'EUR',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'test',
      });

      // 1. Sales Credit Note
      const cnId = randomUUID();
      await pg.db.insert(salesCreditNotes).values({
        creditNoteId: cnId,
        creditNoteNumber: 'CN-20260815-0001',
        customerId,
        totalAmount: '100.00',
        taxAmount: '0.00',
        feeAmount: '0.00',
        outstandingAmount: '100.00',
        currencyCode: 'EUR',
        stateCode: 'posted',
        baseTotalAmount: '100.00',
        baseOutstandingAmount: '100.00',
        exchangeRate: '1.0',
        createdBy: 'test',
      });

      await service.postJournalEntry(
        [
          {
            accountCode: '1000',
            debit: 100,
            credit: 0,
            partyType: 'customer',
            partyId: customerId,
          },
          { accountCode: '2000', debit: 0, credit: 100 },
        ],
        {
          sourceType: 'sales_credit_note',
          sourceId: cnId,
          memo: 'CN JE',
        },
      );

      const entries = await service.getJournalEntries({});
      expect(entries.total).toBe(1);

      const cnEntry = entries.data.find(
        (e) => e.sourceType === 'sales_credit_note',
      );
      expect(cnEntry?.sourceNumber).toBe('CN-20260815-0001');
      expect(cnEntry?.partyName).toBe('Test Party');
    });
  });

  describe('updateSettings', () => {
    it('should create new settings if none exist', async () => {
      const arAccountId = randomUUID();
      await pg.db.insert(glAccounts).values({
        glAccountId: arAccountId,
        accountCode: 'AR-100',
        name: 'Accounts Receivable',
        accountType: 'asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
        isSystem: false,
        isBankAccount: false,
      });

      const updated = await service.updateSettings({
        fiscalYearStartMonth: 7,
        bankMatchDateToleranceDays: 0,
        baseCurrency: 'AUD',
        revenueRoutingPrecedence: 'customer_first',
        expenseRoutingPrecedence: 'supplier_first',
        defaultArAccountId: arAccountId,
      });
      expect(updated.defaultArAccountId).toBe(arAccountId);
    });

    it('should update existing settings when provided valid fields', async () => {
      const arAccountId = randomUUID();
      const revAccountId = randomUUID();
      await pg.db.insert(glAccounts).values([
        {
          glAccountId: arAccountId,
          accountCode: 'AR-200',
          name: 'Accounts Receivable',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
        {
          glAccountId: revAccountId,
          accountCode: 'REV-200',
          name: 'Sales Revenue',
          accountType: 'revenue',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
      ]);

      await pg.db.insert(glSettings).values({
        settingsId: randomUUID(),
        fiscalYearStartMonth: 7,
        bankMatchDateToleranceDays: 0,
        baseCurrency: 'AUD',
        revenueRoutingPrecedence: 'customer_first',
        expenseRoutingPrecedence: 'supplier_first',
      });

      const updated = await service.updateSettings({
        defaultArAccountId: arAccountId,
        defaultRevenueAccountId: revAccountId,
      });

      expect(updated.defaultArAccountId).toBe(arAccountId);
      expect(updated.defaultRevenueAccountId).toBe(revAccountId);
    });
  });

  describe('getGeneralLedger — running balance & summary', () => {
    let bankAccountId: string;
    let revAccountId: string;

    beforeEach(async () => {
      bankAccountId = randomUUID();
      revAccountId = randomUUID();

      await pg.db.insert(glAccounts).values([
        {
          glAccountId: bankAccountId,
          accountCode: '1000',
          name: 'Operating Bank Account',
          accountType: 'asset',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: true,
        },
        {
          glAccountId: revAccountId,
          accountCode: '4000',
          name: 'Sales Revenue',
          accountType: 'revenue',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
      ]);
    });

    it('should return runningBalance: null and no accountSummary when account is not specified (All Accounts)', async () => {
      await service.postJournalEntry(
        [
          { accountCode: '1000', debit: 500, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 500 },
        ],
        { sourceType: 'manual', entryDate: '2026-01-10' },
      );

      const result = await service.getGeneralLedger({});

      expect(result.data.length).toBe(2);
      expect(result.accountSummary).toBeNull();
      expect(result.data[0].runningBalance).toBeNull();
      expect(result.data[1].runningBalance).toBeNull();
    });

    it('should compute running balances and account summary for a specific account without date filters', async () => {
      // Day 1: Deposit $1,000
      await service.postJournalEntry(
        [
          { accountCode: '1000', debit: 1000, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 1000 },
        ],
        { sourceType: 'manual', entryDate: '2026-01-05' },
      );

      // Day 2: Payment $200 (credit to bank)
      await service.postJournalEntry(
        [
          { accountCode: '4000', debit: 200, credit: 0 },
          { accountCode: '1000', debit: 0, credit: 200 },
        ],
        { sourceType: 'manual', entryDate: '2026-01-10' },
      );

      // Day 3: Deposit $350
      await service.postJournalEntry(
        [
          { accountCode: '1000', debit: 350, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 350 },
        ],
        { sourceType: 'manual', entryDate: '2026-01-15' },
      );

      const result = await service.getGeneralLedger({ accountCode: '1000' });

      expect(result.data.length).toBe(3);
      expect(result.accountSummary).toEqual({
        accountCode: '1000',
        accountName: 'Operating Bank Account',
        accountType: 'asset',
        openingBalance: 0,
        periodDebit: 1350,
        periodCredit: 200,
        netMovement: 1150,
        closingBalance: 1150,
      });

      // Data is returned newest first (DESC by date):
      // Jan 15: +350 -> running balance 1150
      // Jan 10: -200 -> running balance 800
      // Jan 05: +1000 -> running balance 1000
      const jan15 = result.data.find((e) => e.entryDate === '2026-01-15');
      const jan10 = result.data.find((e) => e.entryDate === '2026-01-10');
      const jan05 = result.data.find((e) => e.entryDate === '2026-01-05');

      expect(jan15?.runningBalance).toBe(1150);
      expect(jan10?.runningBalance).toBe(800);
      expect(jan05?.runningBalance).toBe(1000);
    });

    it('should correctly calculate openingBalance from prior transactions when fromDate is applied', async () => {
      // Prior period: Jan 01: Deposit $2,000
      await service.postJournalEntry(
        [
          { accountCode: '1000', debit: 2000, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 2000 },
        ],
        { sourceType: 'manual', entryDate: '2026-01-01' },
      );

      // Prior period: Jan 15: Withdrawal $500
      await service.postJournalEntry(
        [
          { accountCode: '4000', debit: 500, credit: 0 },
          { accountCode: '1000', debit: 0, credit: 500 },
        ],
        { sourceType: 'manual', entryDate: '2026-01-15' },
      );

      // Within period (Feb): Feb 05: Deposit $300
      await service.postJournalEntry(
        [
          { accountCode: '1000', debit: 300, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 300 },
        ],
        { sourceType: 'manual', entryDate: '2026-02-05' },
      );

      // Query Feb 01 to Feb 28
      const result = await service.getGeneralLedger({
        accountCode: '1000',
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
      });

      expect(result.data.length).toBe(1);
      expect(result.accountSummary).toEqual({
        accountCode: '1000',
        accountName: 'Operating Bank Account',
        accountType: 'asset',
        openingBalance: 1500, // 2000 - 500
        periodDebit: 300,
        periodCredit: 0,
        netMovement: 300,
        closingBalance: 1800, // 1500 + 300
      });

      expect(result.data[0].runningBalance).toBe(1800);
    });
  });
});
