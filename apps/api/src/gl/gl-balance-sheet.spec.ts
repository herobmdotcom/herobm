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
} from '@herobm/db-schema';
import { randomUUID } from 'crypto';

describe('Balance Sheet Movements (MTD, YTD, Last YTD)', () => {
  const pg = setupPgliteSuite();
  let service: GlService;

  beforeEach(async () => {
    await pg.db.delete(glJournalLines);
    await pg.db.delete(glJournalEntries);
    await pg.db.delete(glSettings);
    await pg.db.delete(glAccounts);

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
            homeCurrency: jest.fn().mockReturnValue('USD'),
            inventoryAccountingMode: () => 'perpetual',
          },
        },
      ],
    }).compile();

    service = module.get<GlService>(GlService);
  });

  it('should accurately compute Movement MTD, YTD, and Last YTD across accounting periods', async () => {
    // 1. Set up GL settings with fiscal year starting July (month 7)
    await pg.db.insert(glSettings).values({
      settingsId: randomUUID(),
      fiscalYearStartMonth: 7,
      bankMatchDateToleranceDays: 0,
      baseCurrency: 'USD',
      revenueRoutingPrecedence: 'customer_first',
      expenseRoutingPrecedence: 'supplier_first',
    } as any);

    // 2. Set up Chart of Accounts
    const bankAcctId = randomUUID();
    const arAcctId = randomUUID();
    const fixedAssetAcctId = randomUUID();
    const apAcctId = randomUUID();
    const equityAcctId = randomUUID();
    const revenueAcctId = randomUUID();
    const expenseAcctId = randomUUID();

    await pg.db.insert(glAccounts).values([
      {
        glAccountId: bankAcctId,
        accountCode: '1010',
        name: 'Operating Cash',
        accountType: 'asset',
        reportCategory: 'cash',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: true,
      },
      {
        glAccountId: arAcctId,
        accountCode: '1100',
        name: 'Accounts Receivable',
        accountType: 'asset',
        reportCategory: 'accounts_receivable',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: fixedAssetAcctId,
        accountCode: '1500',
        name: 'Equipment & Machinery',
        accountType: 'asset',
        reportCategory: 'fixed_asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: apAcctId,
        accountCode: '2000',
        name: 'Accounts Payable',
        accountType: 'liability',
        reportCategory: 'accounts_payable',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: equityAcctId,
        accountCode: '3000',
        name: 'Share Capital',
        accountType: 'equity',
        reportCategory: 'equity',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: revenueAcctId,
        accountCode: '4000',
        name: 'Service Revenue',
        accountType: 'revenue',
        reportCategory: 'operating_revenue',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: expenseAcctId,
        accountCode: '6000',
        name: 'Operating Expense',
        accountType: 'expense',
        reportCategory: 'operating_expense',
        isGroup: false,
        isActive: true,
        currencyCode: 'USD',
        isSystem: false,
        isBankAccount: false,
      },
    ] as any);

    // Scenario: As of date is 2026-08-31
    // Fiscal Year Start (fysm = 7): 2026-07-01
    // MTD window: 2026-08-01 to 2026-08-31
    // YTD window: 2026-07-01 to 2026-08-31 (July + August 2026)
    // Last YTD window: 2025-07-01 to 2025-08-31 (July + August 2025)

    // Entry 1: Last Year comparative period (2025-08-10):
    // Dr. Operating Cash $5,000 / Cr. Share Capital $5,000
    await service.postJournalEntry(
      [
        { accountCode: '1010', debit: 5000, credit: 0 },
        { accountCode: '3000', debit: 0, credit: 5000 },
      ],
      {
        sourceType: 'manual',
        entryDate: '2025-08-10',
        memo: 'Last YTD Equity Investment',
      },
    );

    // Entry 2: Current FY prior month (July 2026 - 2026-07-15):
    // Dr. Equipment $12,000 / Cr. Accounts Payable $12,000
    await service.postJournalEntry(
      [
        { accountCode: '1500', debit: 12000, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 12000 },
      ],
      {
        sourceType: 'manual',
        entryDate: '2026-07-15',
        memo: 'July Equipment Purchase',
      },
    );

    // Entry 3: Current Month (August 2026 - 2026-08-05):
    // Dr. Operating Cash $8,000 / Cr. Service Revenue $8,000
    await service.postJournalEntry(
      [
        { accountCode: '1010', debit: 8000, credit: 0 },
        { accountCode: '4000', debit: 0, credit: 8000 },
      ],
      {
        sourceType: 'manual',
        entryDate: '2026-08-05',
        memo: 'August Customer Revenue',
      },
    );

    // Entry 4: Current Month (August 2026 - 2026-08-20):
    // Dr. Operating Expense $3,000 / Cr. Operating Cash $3,000
    await service.postJournalEntry(
      [
        { accountCode: '6000', debit: 3000, credit: 0 },
        { accountCode: '1010', debit: 0, credit: 3000 },
      ],
      {
        sourceType: 'manual',
        entryDate: '2026-08-20',
        memo: 'August Operating Expense',
      },
    );

    // 3. Query Balance Sheet as of 2026-08-31
    const bs = await service.getBalanceSheet({
      asOfDate: '2026-08-31',
    });

    expect(bs).toBeDefined();
    expect(bs.validation.isBalanced).toBe(true);
    expect(bs.validation.drift).toBe(0);

    // --- Current Assets (Operating Cash 1010) ---
    // Cumulative Balance: 5000 (Entry 1) + 8000 (Entry 3) - 3000 (Entry 4) = 10,000
    // MTD: 8000 - 3000 = 5,000
    // YTD: 8000 - 3000 = 5,000 (July had 0 cash movement)
    // Last YTD: 5,000 (from 2025-08-10)
    const cashLine = bs.currentAssets.lines.find(
      (l) => l.accountCode === '1010',
    );
    expect(cashLine).toBeDefined();
    expect(cashLine?.balance).toBe(10000);
    expect(cashLine?.movementMtd).toBe(5000);
    expect(cashLine?.movementYtd).toBe(5000);
    expect(cashLine?.movementLastYtd).toBe(5000);

    // --- Non-Current Assets (Equipment 1500) ---
    // Cumulative Balance: 12,000
    // MTD: 0
    // YTD: 12,000 (posted in July 2026)
    // Last YTD: 0
    const equipLine = bs.nonCurrentAssets.lines.find(
      (l) => l.accountCode === '1500',
    );
    expect(equipLine).toBeDefined();
    expect(equipLine?.balance).toBe(12000);
    expect(equipLine?.movementMtd).toBe(0);
    expect(equipLine?.movementYtd).toBe(12000);
    expect(equipLine?.movementLastYtd).toBe(0);

    // --- Current Liabilities (AP 2000) ---
    // Cumulative Balance: 12,000
    // MTD: 0
    // YTD: 12,000
    // Last YTD: 0
    const apLine = bs.currentLiabilities.lines.find(
      (l) => l.accountCode === '2000',
    );
    expect(apLine).toBeDefined();
    expect(apLine?.balance).toBe(12000);
    expect(apLine?.movementMtd).toBe(0);
    expect(apLine?.movementYtd).toBe(12000);
    expect(apLine?.movementLastYtd).toBe(0);

    // --- Equity (Share Capital 3000) ---
    // Cumulative Balance: 5,000
    // MTD: 0
    // YTD: 0
    // Last YTD: 5,000
    const eqLine = bs.equity.lines.find((l) => l.accountCode === '3000');
    expect(eqLine).toBeDefined();
    expect(eqLine?.balance).toBe(5000);
    expect(eqLine?.movementMtd).toBe(0);
    expect(eqLine?.movementYtd).toBe(0);
    expect(eqLine?.movementLastYtd).toBe(5000);

    // --- Equity: Current Period Earnings / Net Income ---
    // Cumulative Balance: Revenue(8000) - Expense(3000) = 5,000
    // MTD: 8000 - 3000 = 5,000
    // YTD: 8000 - 3000 = 5,000
    // Last YTD: 0
    const earningsLine = bs.equity.lines.find((l) =>
      l.accountName.includes('Current Period Earnings'),
    );
    expect(earningsLine).toBeDefined();
    expect(earningsLine?.balance).toBe(5000);
    expect(earningsLine?.movementMtd).toBe(5000);
    expect(earningsLine?.movementYtd).toBe(5000);
    expect(earningsLine?.movementLastYtd).toBe(0);

    // --- Totals and Validation Parity ---
    // Total Assets: 10,000 (Current) + 12,000 (Non-Current) = 22,000
    expect(bs.validation.totalAssets).toBe(22000);
    // Total Liabilities & Equity: 12,000 (Liabilities) + 5,000 (Share Capital) + 5,000 (Net Income) = 22,000
    expect(bs.validation.totalLiabilitiesAndEquity).toBe(22000);

    // MTD Movements:
    // Total Assets MTD: 5,000 (Cash) + 0 (Equipment) = 5,000
    // Total L&E MTD: 0 (Liab) + 0 (Capital) + 5,000 (Net Income) = 5,000
    expect(bs.validation.totalAssetsMovementMtd).toBe(5000);
    expect(bs.validation.totalLiabilitiesAndEquityMovementMtd).toBe(5000);

    // YTD Movements:
    // Total Assets YTD: 5,000 (Cash) + 12,000 (Equipment) = 17,000
    // Total L&E YTD: 12,000 (Liab) + 0 (Capital) + 5,000 (Net Income) = 17,000
    expect(bs.validation.totalAssetsMovementYtd).toBe(17000);
    expect(bs.validation.totalLiabilitiesAndEquityMovementYtd).toBe(17000);

    // Last YTD Movements:
    // Total Assets Last YTD: 5,000 (Cash) + 0 (Equipment) = 5,000
    // Total L&E Last YTD: 0 (Liab) + 5,000 (Capital) + 0 (Net Income) = 5,000
    expect(bs.validation.totalAssetsMovementLastYtd).toBe(5000);
    expect(bs.validation.totalLiabilitiesAndEquityMovementLastYtd).toBe(5000);
  });
});
