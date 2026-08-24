import { Test, TestingModule } from '@nestjs/testing';
import { GlService } from './gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  glAccounts,
  glJournalEntries,
  glJournalLines,
  glSettings,
  costCenters,
  activities,
} from '@herobm/db-schema';
import { randomUUID } from 'crypto';

describe('GL Import Parity & Opening Balances', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GlService;

  beforeEach(async () => {
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
          useValue: { register: jest.fn() },
        },
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            homeCurrency: () => 'EUR',
            inventoryAccountingMode: () => 'perpetual',
          },
        },
      ],
    }).compile();

    service = module.get<GlService>(GlService);

    await pg.db.insert(costCenters).values({
      costCenterId: randomUUID(),
      code: '00',
      name: 'Default Cost Center',
      isSystem: true,
      isActive: true,
    });
    await pg.db.insert(activities).values({
      activityId: randomUUID(),
      code: '00',
      name: 'Default Activity',
      isSystem: true,
      isActive: true,
    });
    await pg.db.insert(glSettings).values({
      fiscalYearStartMonth: 1,
      bankMatchDateToleranceDays: 3,
      baseCurrency: 'EUR',
      revenueRoutingPrecedence: 'product_first',
      expenseRoutingPrecedence: 'product_first',
    });
  });

  it('correctly aggregates opening trial balance from imported take-on journals', async () => {
    // 1. Seed COA
    const [bankAcct] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1020',
        name: 'Operating Bank Account',
        accountType: 'asset',
        isGroup: false,
        isSystem: false,
        isBankAccount: true,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    const [arAcct] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1200',
        name: 'Accounts Receivable',
        accountType: 'asset',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    const [equityAcct] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '3000',
        name: 'Retained Earnings',
        accountType: 'equity',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    // 2. Post opening journal entry (Bank: 10000 Dr, AR: 5000 Dr, Equity: 15000 Cr)
    const [openingEntry] = await pg.db
      .insert(glJournalEntries)
      .values({
        journalEntryId: randomUUID(),
        entryNumber: 'JE-OPENING-20260801',
        entryDate: '2026-08-01',
        memo: 'ABM Opening Balance Take-On',
        sourceType: 'INITIAL_IMPORT',
        isReversed: false,
        createdBy: 'abm-import',
      })
      .returning();

    await pg.db.insert(glJournalLines).values([
      {
        journalLineId: randomUUID(),
        journalEntryId: openingEntry.journalEntryId,
        glAccountId: bankAcct.glAccountId,
        debit: '10000.00',
        credit: '0.00',
        foreignDebit: '10000.00',
        foreignCredit: '0.00',
        foreignCurrencyCode: 'EUR',
        exchangeRate: '1.0',
        memo: 'Opening Balance: 1020 - Operating Bank Account',
        isReconciled: false,
      },
      {
        journalLineId: randomUUID(),
        journalEntryId: openingEntry.journalEntryId,
        glAccountId: arAcct.glAccountId,
        debit: '5000.00',
        credit: '0.00',
        foreignDebit: '5000.00',
        foreignCredit: '0.00',
        foreignCurrencyCode: 'EUR',
        exchangeRate: '1.0',
        memo: 'Opening Balance: 1200 - Accounts Receivable',
        isReconciled: false,
      },
      {
        journalLineId: randomUUID(),
        journalEntryId: openingEntry.journalEntryId,
        glAccountId: equityAcct.glAccountId,
        debit: '0.00',
        credit: '15000.00',
        foreignDebit: '0.00',
        foreignCredit: '15000.00',
        foreignCurrencyCode: 'EUR',
        exchangeRate: '1.0',
        memo: 'Opening Balance: 3000 - Retained Earnings',
        isReconciled: false,
      },
    ]);

    // 3. Verify Trial Balance
    const tb = await service.getTrialBalance('2026-08-31', '2026-08-01');
    expect(tb).toBeDefined();
    expect(tb.length).toBe(3);

    const bankRow = tb.find((r) => r.accountCode === '1020');
    const arRow = tb.find((r) => r.accountCode === '1200');
    const equityRow = tb.find((r) => r.accountCode === '3000');

    expect(bankRow?.periodDebit).toBe(10000);
    expect(bankRow?.closingBalance).toBe(10000);

    expect(arRow?.periodDebit).toBe(5000);
    expect(arRow?.closingBalance).toBe(5000);

    expect(equityRow?.periodCredit).toBe(15000);
    expect(equityRow?.closingBalance).toBe(-15000);

    // 4. Verify Zero-Sum Continuous Reconciliation
    const recon = await service.getSubledgerReconciliation();
    expect(recon.trialBalanceZeroSum.isBalanced).toBe(true);
    expect(recon.trialBalanceZeroSum.totalDebit).toBe(15000);
    expect(recon.trialBalanceZeroSum.totalCredit).toBe(15000);
    expect(recon.trialBalanceZeroSum.netDifference).toBe(0);
  });

  it('guarantees zero-sum balance when historical imbalance is offset to 3999 suspense', async () => {
    const [invAcct] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1300',
        name: 'Inventory On Hand',
        accountType: 'asset',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    const [suspenseAcct] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '3999',
        name: 'Opening Balance Suspense',
        accountType: 'equity',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    // Opening entry where raw legacy debit = 12500, but legacy credit was missing (diff = 12500)
    const [openingEntry] = await pg.db
      .insert(glJournalEntries)
      .values({
        journalEntryId: randomUUID(),
        entryNumber: 'JE-OPENING-20260801',
        entryDate: '2026-08-01',
        memo: 'ABM Opening Balance Take-On',
        sourceType: 'INITIAL_IMPORT',
        isReversed: false,
        createdBy: 'abm-import',
      })
      .returning();

    await pg.db.insert(glJournalLines).values([
      {
        journalLineId: randomUUID(),
        journalEntryId: openingEntry.journalEntryId,
        glAccountId: invAcct.glAccountId,
        debit: '12500.00',
        credit: '0.00',
        foreignDebit: '12500.00',
        foreignCredit: '0.00',
        foreignCurrencyCode: 'EUR',
        exchangeRate: '1.0',
        memo: 'Opening Balance: 1300 - Inventory On Hand',
        isReconciled: false,
      },
      {
        journalLineId: randomUUID(),
        journalEntryId: openingEntry.journalEntryId,
        glAccountId: suspenseAcct.glAccountId,
        debit: '0.00',
        credit: '12500.00',
        foreignDebit: '0.00',
        foreignCredit: '12500.00',
        foreignCurrencyCode: 'EUR',
        exchangeRate: '1.0',
        memo: 'Historical Trial Balance Imbalance Offset',
        isReconciled: false,
      },
    ]);

    const recon = await service.getSubledgerReconciliation();
    expect(recon.trialBalanceZeroSum.isBalanced).toBe(true);
    expect(recon.trialBalanceZeroSum.netDifference).toBe(0);
    expect(recon.trialBalanceZeroSum.totalDebit).toBe(12500);
    expect(recon.trialBalanceZeroSum.totalCredit).toBe(12500);
  });
});
