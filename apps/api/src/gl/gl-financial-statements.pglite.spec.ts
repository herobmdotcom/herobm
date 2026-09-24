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
import {
  fetchProfitAndLoss,
  fetchBalanceSheet,
} from './gl-financial-statements.utils';

describe('GL Financial Statements PGlite Integration Tests', () => {
  const pg = setupPgliteSuite();
  let service: GlService;

  let accBank: any;
  let accAr: any;
  let accInventory: any;
  let accEquipment: any;
  let accAp: any;
  let accGstTax: any;
  let accLoan: any;
  let accShareCapital: any;
  let accSalesRevenue: any;
  let accSalesReturns: any;
  let accCogs: any;
  let accSalariesOpex: any;
  let accRentOpex: any;
  let accDepreciationOpex: any;
  let accInterestExpense: any;
  let accTaxExpense: any;

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
            homeCurrency: () => 'AUD',
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
      baseCurrency: 'AUD',
      revenueRoutingPrecedence: 'product_first',
      expenseRoutingPrecedence: 'product_first',
    });

    // 1. Seed Complete Chart of Accounts
    // Assets (Current: 10xx-13xx, Non-Current: 15xx)
    [accBank] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1000',
        name: 'Operating Bank Account',
        accountType: 'asset',
        reportCategory: 'cash_and_bank',
        isGroup: false,
        isSystem: false,
        isBankAccount: true,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accAr] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1200',
        name: 'Trade Accounts Receivable',
        accountType: 'asset',
        reportCategory: 'accounts_receivable',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accInventory] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1300',
        name: 'Merchandise Inventory',
        accountType: 'asset',
        reportCategory: 'inventory',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accEquipment] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1500',
        name: 'Machinery & Equipment',
        accountType: 'asset',
        reportCategory: 'fixed_asset',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    // Liabilities (Current: 20xx-22xx, Non-Current: 25xx)
    [accAp] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '2000',
        name: 'Trade Accounts Payable',
        accountType: 'liability',
        reportCategory: 'accounts_payable',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accGstTax] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '2200',
        name: 'GST / VAT Tax Payable',
        accountType: 'liability',
        reportCategory: 'tax_liability',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accLoan] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '2500',
        name: 'Long-Term Commercial Loan',
        accountType: 'liability',
        reportCategory: 'long_term_debt',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    // Equity (30xx)
    [accShareCapital] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '3000',
        name: 'Contributed Share Capital',
        accountType: 'equity',
        reportCategory: 'share_capital',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    // Revenue (40xx)
    [accSalesRevenue] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '4000',
        name: 'Gross Product Sales',
        accountType: 'revenue',
        reportCategory: 'operating_revenue',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accSalesReturns] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '4100',
        name: 'Sales Returns & Allowances',
        accountType: 'revenue',
        reportCategory: 'sales_discount',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    // Cost of Goods Sold (50xx)
    [accCogs] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '5000',
        name: 'Cost of Goods Sold - Materials',
        accountType: 'expense',
        reportCategory: 'cost_of_goods_sold',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    // Operating Expenses (60xx)
    [accSalariesOpex] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '6000',
        name: 'Salaries & Staff Wages',
        accountType: 'expense',
        reportCategory: 'payroll_expense',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accRentOpex] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '6100',
        name: 'Office & Warehouse Rent',
        accountType: 'expense',
        reportCategory: 'operating_expense',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accDepreciationOpex] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '6200',
        name: 'Depreciation Expense',
        accountType: 'expense',
        reportCategory: 'depreciation_expense',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    // Other Expenses / Financing / Tax (70xx-80xx)
    [accInterestExpense] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '7000',
        name: 'Bank Loan Interest Expense',
        accountType: 'expense',
        reportCategory: 'interest_expense',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();

    [accTaxExpense] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '8000',
        name: 'Income Tax Expense',
        accountType: 'expense',
        reportCategory: 'tax_expense',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'AUD',
        isActive: true,
      })
      .returning();
  });

  async function postJournal(params: {
    entryNumber: string;
    entryDate: string;
    memo: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
  }) {
    const [je] = await pg.db
      .insert(glJournalEntries)
      .values({
        journalEntryId: randomUUID(),
        entryNumber: params.entryNumber,
        entryDate: params.entryDate,
        memo: params.memo,
        sourceType: 'MANUAL',
        isReversed: false,
        createdBy: 'test-suite',
      })
      .returning();

    for (const l of params.lines) {
      await pg.db.insert(glJournalLines).values({
        journalLineId: randomUUID(),
        journalEntryId: je.journalEntryId,
        glAccountId: l.accountId,
        debit: l.debit.toFixed(2),
        credit: l.credit.toFixed(2),
        foreignDebit: l.debit.toFixed(2),
        foreignCredit: l.credit.toFixed(2),
        foreignCurrencyCode: 'AUD',
        exchangeRate: '1.0',
        isReconciled: false,
      });
    }
    return je;
  }

  describe('Scenario 1: Comprehensive Double-Entry Lifecycle & Statement Parity', () => {
    it('verifies exact figures on Profit & Loss and asserts 100% Balance Sheet parity', async () => {
      // 1. Initial Equity & Capital Contribution on 2026-08-01:
      // Dr Bank 100,000 / Cr Share Capital 100,000
      await postJournal({
        entryNumber: 'JE-001',
        entryDate: '2026-08-01',
        memo: 'Owner Share Capital Contribution',
        lines: [
          { accountId: accBank.glAccountId, debit: 100000, credit: 0 },
          { accountId: accShareCapital.glAccountId, debit: 0, credit: 100000 },
        ],
      });

      // 2. Non-Current Asset Purchase on 2026-08-02:
      // Dr Equipment 40,000 / Cr Long-Term Loan 30,000 / Cr Bank 10,000
      await postJournal({
        entryNumber: 'JE-002',
        entryDate: '2026-08-02',
        memo: 'Purchase Manufacturing Equipment with Bank Loan',
        lines: [
          { accountId: accEquipment.glAccountId, debit: 40000, credit: 0 },
          { accountId: accLoan.glAccountId, debit: 0, credit: 30000 },
          { accountId: accBank.glAccountId, debit: 0, credit: 10000 },
        ],
      });

      // 3. Purchase Raw Materials for Inventory on 2026-08-03:
      // Dr Inventory 30,000 / Cr AP 30,000
      await postJournal({
        entryNumber: 'JE-003',
        entryDate: '2026-08-03',
        memo: 'Purchase Raw Materials on Credit',
        lines: [
          { accountId: accInventory.glAccountId, debit: 30000, credit: 0 },
          { accountId: accAp.glAccountId, debit: 0, credit: 30000 },
        ],
      });

      // 4. Sales Invoices on 2026-08-10:
      // Dr AR 55,000 / Cr Sales Revenue 50,000 / Cr Tax Payable (GST) 5,000
      await postJournal({
        entryNumber: 'JE-004',
        entryDate: '2026-08-10',
        memo: 'Sales Invoices with GST',
        lines: [
          { accountId: accAr.glAccountId, debit: 55000, credit: 0 },
          { accountId: accSalesRevenue.glAccountId, debit: 0, credit: 50000 },
          { accountId: accGstTax.glAccountId, debit: 0, credit: 5000 },
        ],
      });

      // 5. Sales Returns / Credit Notes on 2026-08-12:
      // Dr Sales Returns 2,000 / Dr Tax Payable 200 / Cr AR 2,200
      await postJournal({
        entryNumber: 'JE-005',
        entryDate: '2026-08-12',
        memo: 'Customer Sales Return & Allowance',
        lines: [
          { accountId: accSalesReturns.glAccountId, debit: 2000, credit: 0 },
          { accountId: accGstTax.glAccountId, debit: 200, credit: 0 },
          { accountId: accAr.glAccountId, debit: 0, credit: 2200 },
        ],
      });

      // 6. Cost of Goods Sold on 2026-08-15:
      // Dr COGS 15,000 / Cr Inventory 15,000
      await postJournal({
        entryNumber: 'JE-006',
        entryDate: '2026-08-15',
        memo: 'Recognize Cost of Goods Sold for Dispatched Orders',
        lines: [
          { accountId: accCogs.glAccountId, debit: 15000, credit: 0 },
          { accountId: accInventory.glAccountId, debit: 0, credit: 15000 },
        ],
      });

      // 7. Customer Cash Receipts on 2026-08-20:
      // Dr Bank 40,000 / Cr AR 40,000
      await postJournal({
        entryNumber: 'JE-007',
        entryDate: '2026-08-20',
        memo: 'Customer Invoice Payments Received',
        lines: [
          { accountId: accBank.glAccountId, debit: 40000, credit: 0 },
          { accountId: accAr.glAccountId, debit: 0, credit: 40000 },
        ],
      });

      // 8. Supplier Payments on 2026-08-22:
      // Dr AP 20,000 / Cr Bank 20,000
      await postJournal({
        entryNumber: 'JE-008',
        entryDate: '2026-08-22',
        memo: 'Supplier Invoices Paid via Bank Wire',
        lines: [
          { accountId: accAp.glAccountId, debit: 20000, credit: 0 },
          { accountId: accBank.glAccountId, debit: 0, credit: 20000 },
        ],
      });

      // 9. Operating Expenses on 2026-08-28:
      // Dr Salaries 8,000 / Dr Rent 3,000 / Cr Bank 11,000
      await postJournal({
        entryNumber: 'JE-009',
        entryDate: '2026-08-28',
        memo: 'August Payroll and Warehouse Rent',
        lines: [
          { accountId: accSalariesOpex.glAccountId, debit: 8000, credit: 0 },
          { accountId: accRentOpex.glAccountId, debit: 3000, credit: 0 },
          { accountId: accBank.glAccountId, debit: 0, credit: 11000 },
        ],
      });

      // 10. Non-Cash Depreciation & Financing Expense on 2026-08-31:
      // Dr Depreciation 1,000 / Cr Equipment 1,000 (accumulated)
      // Dr Interest Expense 500 / Cr Bank 500
      // Dr Tax Expense 2,500 / Cr Tax Payable 2,500
      await postJournal({
        entryNumber: 'JE-010',
        entryDate: '2026-08-31',
        memo: 'Month-End Adjustments: Depreciation, Interest & Tax',
        lines: [
          {
            accountId: accDepreciationOpex.glAccountId,
            debit: 1000,
            credit: 0,
          },
          { accountId: accEquipment.glAccountId, debit: 0, credit: 1000 },
          { accountId: accInterestExpense.glAccountId, debit: 500, credit: 0 },
          { accountId: accBank.glAccountId, debit: 0, credit: 500 },
          { accountId: accTaxExpense.glAccountId, debit: 2500, credit: 0 },
          { accountId: accGstTax.glAccountId, debit: 0, credit: 2500 },
        ],
      });

      // =====================================================================
      // Assert Profit & Loss
      // =====================================================================
      const pnl = await service.getProfitAndLoss({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        periodName: '2026-08',
      });

      // Revenue: Gross Sales (50,000) + Returns (-2,000) = 48,000
      expect(pnl.summary.totalRevenue).toBe(48000);
      expect(pnl.revenue.lines).toHaveLength(2);

      // COGS: 15,000
      expect(pnl.summary.totalCogs).toBe(15000);
      expect(pnl.costOfGoodsSold.lines).toHaveLength(1);

      // Gross Profit: 48,000 - 15,000 = 33,000
      expect(pnl.summary.grossProfit).toBe(33000);
      // Gross Margin %: 33,000 / 48,000 * 100 = 68.75%
      expect(pnl.summary.grossMarginPercentage).toBeCloseTo(68.75, 2);

      // Operating Expenses: Salaries (8,000) + Rent (3,000) + Depreciation (1,000) = 12,000
      expect(pnl.summary.totalOperatingExpenses).toBe(12000);
      expect(pnl.operatingExpenses.lines).toHaveLength(3);

      // Operating Income (EBIT): 33,000 - 12,000 = 21,000
      expect(pnl.summary.operatingIncome).toBe(21000);

      // Other Income/Expenses: Interest (500) + Income Tax (2,500) = 3,000
      expect(pnl.summary.totalOtherIncomeExpense).toBe(3000);
      expect(pnl.otherIncomeExpense.lines).toHaveLength(2);

      // Net Income: 21,000 - 3,000 = 18,000
      expect(pnl.summary.netIncome).toBe(18000);
      // Net Margin %: 18,000 / 48,000 * 100 = 37.5%
      expect(pnl.summary.netMarginPercentage).toBeCloseTo(37.5, 2);

      // =====================================================================
      // Assert Balance Sheet
      // =====================================================================
      const bs = await service.getBalanceSheet({
        asOfDate: '2026-08-31',
        periodName: '2026-08',
      });

      // Assets Breakdown:
      // Bank: +100,000 - 10,000 + 40,000 - 20,000 - 11,000 - 500 = 98,500
      // AR: +55,000 - 2,200 - 40,000 = 12,800
      // Inventory: +30,000 - 15,000 = 15,000
      // Total Current Assets = 98,500 + 12,800 + 15,000 = 126,300
      expect(bs.currentAssets.total).toBe(126300);

      // Equipment (Non-Current): +40,000 - 1,000 = 39,000
      expect(bs.nonCurrentAssets.total).toBe(39000);

      // Total Assets = 126,300 + 39,000 = 165,300
      expect(bs.validation.totalAssets).toBe(165300);

      // Liabilities Breakdown:
      // AP (Current): +30,000 - 20,000 = 10,000
      // Tax Payable (Current): +5,000 - 200 + 2,500 = 7,300
      // Total Current Liabilities = 10,000 + 7,300 = 17,300
      expect(bs.currentLiabilities.total).toBe(17300);

      // Loan (Non-Current): 30,000
      expect(bs.nonCurrentLiabilities.total).toBe(30000);

      // Total Liabilities = 17,300 + 30,000 = 47,300
      expect(bs.validation.totalLiabilities).toBe(47300);

      // Equity Breakdown:
      // Share Capital: 100,000
      // Current Net Income: 18,000 (dynamically computed from unclosed P&L)
      // Total Equity = 100,000 + 18,000 = 118,000
      expect(bs.equity.total).toBe(118000);
      expect(bs.validation.totalEquity).toBe(118000);

      // Total Liabilities & Equity = 47,300 + 118,000 = 165,300
      expect(bs.validation.totalLiabilitiesAndEquity).toBe(165300);

      // Mathematical Double-Entry Parity
      expect(bs.validation.drift).toBe(0);
      expect(bs.validation.isBalanced).toBe(true);

      // Dynamic Equivalence assertion
      expect(bs.validation.totalAssets).toEqual(
        bs.validation.totalLiabilitiesAndEquity,
      );
    });
  });

  describe('Scenario 2: Multi-Period Rolling Activity & Point-in-Time Parity', () => {
    it('accurately isolates periodic movements while maintaining cumulative point-in-time parity', async () => {
      // Month 1 (July 2026):
      // Initial Capital 50,000 -> Bank 50,000 / Share Capital 50,000
      // Sales 20,000 -> AR 20,000 / Revenue 20,000
      // Expenses 5,000 -> Salaries 5,000 / Bank 5,000
      await postJournal({
        entryNumber: 'JE-JULY-01',
        entryDate: '2026-07-01',
        memo: 'July Capital & Operations',
        lines: [
          { accountId: accBank.glAccountId, debit: 50000, credit: 0 },
          { accountId: accShareCapital.glAccountId, debit: 0, credit: 50000 },
          { accountId: accAr.glAccountId, debit: 20000, credit: 0 },
          { accountId: accSalesRevenue.glAccountId, debit: 0, credit: 20000 },
          { accountId: accSalariesOpex.glAccountId, debit: 5000, credit: 0 },
          { accountId: accBank.glAccountId, debit: 0, credit: 5000 },
        ],
      });

      // Month 2 (August 2026):
      // Sales 30,000 -> Bank 30,000 / Revenue 30,000
      // Expenses 12,000 -> Salaries 12,000 / Bank 12,000
      await postJournal({
        entryNumber: 'JE-AUG-01',
        entryDate: '2026-08-15',
        memo: 'August Operations',
        lines: [
          { accountId: accBank.glAccountId, debit: 30000, credit: 0 },
          { accountId: accSalesRevenue.glAccountId, debit: 0, credit: 30000 },
          { accountId: accSalariesOpex.glAccountId, debit: 12000, credit: 0 },
          { accountId: accBank.glAccountId, debit: 0, credit: 12000 },
        ],
      });

      // 1. July P&L: Revenue = 20,000, OPEX = 5,000, Net Income = 15,000
      const julyPnl = await service.getProfitAndLoss({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        periodName: '2026-07',
      });
      expect(julyPnl.summary.totalRevenue).toBe(20000);
      expect(julyPnl.summary.totalOperatingExpenses).toBe(5000);
      expect(julyPnl.summary.netIncome).toBe(15000);

      // 2. August P&L: Period Revenue = 30,000, Period OPEX = 12,000, Period Net Income = 18,000
      // YTD Revenue = 50,000, YTD OPEX = 17,000
      const augPnl = await service.getProfitAndLoss({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        periodName: '2026-08',
      });
      expect(augPnl.summary.totalRevenue).toBe(30000);
      expect(augPnl.summary.totalOperatingExpenses).toBe(12000);
      expect(augPnl.summary.netIncome).toBe(18000);
      expect(augPnl.revenue.ytdTotal).toBe(50000);
      expect(augPnl.operatingExpenses.ytdTotal).toBe(17000);

      // 3. Balance Sheet as of July 31, 2026:
      // Bank = 45,000, AR = 20,000 -> Assets = 65,000
      // Share Capital = 50,000, July Earnings = 15,000 -> Equity = 65,000
      const julyBs = await service.getBalanceSheet({ asOfDate: '2026-07-31' });
      expect(julyBs.validation.totalAssets).toBe(65000);
      expect(julyBs.validation.totalEquity).toBe(65000);
      expect(julyBs.validation.isBalanced).toBe(true);

      // 4. Balance Sheet as of August 31, 2026:
      // Bank = 45,000 + 18,000 = 63,000, AR = 20,000 -> Assets = 83,000
      // Share Capital = 50,000, Cumulative Earnings = 33,000 -> Equity = 83,000
      const augBs = await service.getBalanceSheet({ asOfDate: '2026-08-31' });
      expect(augBs.validation.totalAssets).toBe(83000);
      expect(augBs.validation.totalEquity).toBe(83000);
      expect(augBs.validation.isBalanced).toBe(true);
    });
  });

  describe('Scenario 3: Fiscal Year Boundary Rollover', () => {
    it('respects custom fiscal year start month for YTD figures', async () => {
      // Set Fiscal Year Start to July (Month 7)
      await pg.db.update(glSettings).set({ fiscalYearStartMonth: 7 });

      // Transaction in June (Prior FY 2026): Revenue 10,000
      await postJournal({
        entryNumber: 'JE-JUNE',
        entryDate: '2026-06-25',
        memo: 'Prior FY Sales',
        lines: [
          { accountId: accBank.glAccountId, debit: 10000, credit: 0 },
          { accountId: accSalesRevenue.glAccountId, debit: 0, credit: 10000 },
        ],
      });

      // Transaction in July (Current FY Month 1): Revenue 25,000
      await postJournal({
        entryNumber: 'JE-JULY',
        entryDate: '2026-07-10',
        memo: 'Current FY Month 1 Sales',
        lines: [
          { accountId: accBank.glAccountId, debit: 25000, credit: 0 },
          { accountId: accSalesRevenue.glAccountId, debit: 0, credit: 25000 },
        ],
      });

      // Transaction in August (Current FY Month 2): Revenue 30,000
      await postJournal({
        entryNumber: 'JE-AUG',
        entryDate: '2026-08-15',
        memo: 'Current FY Month 2 Sales',
        lines: [
          { accountId: accBank.glAccountId, debit: 30000, credit: 0 },
          { accountId: accSalesRevenue.glAccountId, debit: 0, credit: 30000 },
        ],
      });

      // P&L for August 2026:
      // Period Revenue = 30,000
      // YTD Revenue must include July + August (55,000) and EXCLUDE June (which belonged to prior FY)
      const pnl = await service.getProfitAndLoss({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        periodName: '2026-08',
      });

      expect(pnl.summary.totalRevenue).toBe(30000);
      expect(pnl.revenue.ytdTotal).toBe(55000); // 25,000 (July) + 30,000 (August)
    });
  });

  describe('Scenario 4: Accounting Anomaly / Drift Detection', () => {
    it('flags imbalance and detects non-zero drift on single-sided corrupt ledger entry', async () => {
      // Post valid opening
      await postJournal({
        entryNumber: 'JE-VALID',
        entryDate: '2026-08-01',
        memo: 'Valid Entry',
        lines: [
          { accountId: accBank.glAccountId, debit: 10000, credit: 0 },
          { accountId: accShareCapital.glAccountId, debit: 0, credit: 10000 },
        ],
      });

      // Post unbalanced journal directly (simulating corrupt data or unverified raw migration)
      const [corruptJe] = await pg.db
        .insert(glJournalEntries)
        .values({
          journalEntryId: randomUUID(),
          entryNumber: 'JE-CORRUPT',
          entryDate: '2026-08-15',
          memo: 'Unbalanced Anomaly Entry',
          sourceType: 'MANUAL',
          isReversed: false,
          createdBy: 'rogue-actor',
        })
        .returning();

      // Only insert a debit without corresponding credit
      await pg.db.insert(glJournalLines).values({
        journalLineId: randomUUID(),
        journalEntryId: corruptJe.journalEntryId,
        glAccountId: accBank.glAccountId,
        debit: '5000.00',
        credit: '0.00',
        foreignDebit: '5000.00',
        foreignCredit: '0.00',
        foreignCurrencyCode: 'AUD',
        exchangeRate: '1.0',
        isReconciled: false,
      });

      const bs = await service.getBalanceSheet({ asOfDate: '2026-08-31' });

      // Assets = 15,000, Liabilities = 0, Equity = 10,000 => Drift = 5,000
      expect(bs.validation.totalAssets).toBe(15000);
      expect(bs.validation.totalLiabilitiesAndEquity).toBe(10000);
      expect(bs.validation.drift).toBe(5000);
      expect(bs.validation.isBalanced).toBe(false);
    });
  });
});
