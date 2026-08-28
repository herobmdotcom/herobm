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
  salesInvoices,
  salesOrders,
  customers,
  locations,
} from '@herobm/db-schema';
import { randomUUID } from 'crypto';

describe('GL Subledger-to-GL Continuous Reconciliation', () => {
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

  it('reports zero-sum trial balance and matched subledgers on a clean ledger', async () => {
    const report = await service.getSubledgerReconciliation();

    expect(report.isOverallBalanced).toBe(true);
    expect(report.trialBalanceZeroSum.isBalanced).toBe(true);
    expect(report.trialBalanceZeroSum.netDifference).toBe(0);
    expect(report.accountsReceivable.isMatched).toBe(true);
    expect(report.accountsPayable.isMatched).toBe(true);
    expect(report.goodsReceivedNotInvoiced.isMatched).toBe(true);
    expect(report.perpetualInventory.isMatched).toBe(true);
  });

  it('detects AR subledger drift when open sales invoice does not match GL 1200', async () => {
    // 1. Create AR and Revenue GL Accounts
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

    const [revAcct] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '4000',
        name: 'Sales Revenue',
        accountType: 'revenue',
        isGroup: false,
        isSystem: true,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    await pg.db
      .update(glSettings)
      .set({ defaultArAccountId: arAcct.glAccountId });

    // 2. Post a journal entry of 500 to GL 1200
    await service.postJournalEntry(
      [
        { accountId: arAcct.glAccountId, debit: 500, credit: 0 },
        { accountId: revAcct.glAccountId, debit: 0, credit: 500 },
      ],
      { sourceType: 'manual', entryDate: '2026-08-21' },
    );

    // Initial reconciliation: GL has 500 in 1200, but sales_invoices has 0 => drift of -500
    let report = await service.getSubledgerReconciliation();
    expect(report.trialBalanceZeroSum.isBalanced).toBe(true);
    expect(report.accountsReceivable.controlAccountCode).toBe('1200');
    expect(report.accountsReceivable.subledgerBalance).toBe(0);
    expect(report.accountsReceivable.glBalance).toBe(500);
    expect(report.accountsReceivable.drift).toBe(-500);
    expect(report.accountsReceivable.isMatched).toBe(false);
    expect(report.isOverallBalanced).toBe(false);

    // 3. Create prerequisite entities for sales_invoice
    const [loc] = await pg.db
      .insert(locations)
      .values({
        code: 'MAIN',
        name: 'Main Location',
        sourceId: 'loc-1',
        source: 'manual',
      })
      .returning();

    const [so] = await pg.db
      .insert(salesOrders)
      .values({
        orderNumber: 'SO-1001',
        stateCode: 'confirmed',
        currencyCode: 'EUR',
        exchangeRate: '1.0',
        fulfillmentLocationId: loc.locationId,
        discrepanciesAcknowledged: false,
        source: 'manual',
      })
      .returning();

    // Insert sales invoice for 500
    await pg.db.insert(salesInvoices).values({
      invoiceNumber: 'INV-1001',
      salesOrderId: so.salesOrderId,
      totalAmount: '500.00',
      outstandingAmount: '500.00',
      currencyCode: 'EUR',
      exchangeRate: '1.0',
      stateCode: 'invoiced',
    });

    // Subledger now has 500, matching GL 500 exactly
    report = await service.getSubledgerReconciliation();
    expect(report.accountsReceivable.subledgerBalance).toBe(500);
    expect(report.accountsReceivable.glBalance).toBe(500);
    expect(report.accountsReceivable.drift).toBe(0);
    expect(report.accountsReceivable.isMatched).toBe(true);
    expect(report.isOverallBalanced).toBe(true);
  });

  it('reconciles seamlessly with international or alphanumeric custom account codes without hardcoded prefixes', async () => {
    // 1. Create custom / French PCG style accounts
    const [customAr] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: 'FR-411000',
        name: 'Clients - Ventes de biens',
        accountType: 'asset',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    const [customRev] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: 'FR-707000',
        name: 'Ventes de marchandises',
        accountType: 'revenue',
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        currencyCode: 'EUR',
        isActive: true,
      })
      .returning();

    // 2. Set glSettings to point to custom accounts
    await pg.db
      .update(glSettings)
      .set({ defaultArAccountId: customAr.glAccountId });

    // 3. Post a journal entry of 1,200 to FR-411000
    await service.postJournalEntry(
      [
        { accountId: customAr.glAccountId, debit: 1200, credit: 0 },
        { accountId: customRev.glAccountId, debit: 0, credit: 1200 },
      ],
      { sourceType: 'manual', entryDate: '2026-08-22' },
    );

    // 4. Create matching sales invoice
    const [loc] = await pg.db
      .insert(locations)
      .values({
        code: 'PARIS',
        name: 'Paris Hub',
        sourceId: 'loc-fr',
        source: 'manual',
      })
      .returning();

    const [so] = await pg.db
      .insert(salesOrders)
      .values({
        orderNumber: 'SO-FR-01',
        stateCode: 'confirmed',
        currencyCode: 'EUR',
        exchangeRate: '1.0',
        fulfillmentLocationId: loc.locationId,
        discrepanciesAcknowledged: false,
        source: 'manual',
      })
      .returning();

    await pg.db.insert(salesInvoices).values({
      invoiceNumber: 'INV-FR-01',
      salesOrderId: so.salesOrderId,
      totalAmount: '1200.00',
      outstandingAmount: '1200.00',
      currencyCode: 'EUR',
      exchangeRate: '1.0',
      stateCode: 'invoiced',
    });

    const report = await service.getSubledgerReconciliation();
    expect(report.accountsReceivable.controlAccountCode).toBe('FR-411000');
    expect(report.accountsReceivable.controlAccountName).toBe(
      'Clients - Ventes de biens',
    );
    expect(report.accountsReceivable.subledgerBalance).toBe(1200);
    expect(report.accountsReceivable.glBalance).toBe(1200);
    expect(report.accountsReceivable.drift).toBe(0);
    expect(report.accountsReceivable.isMatched).toBe(true);
    expect(report.isOverallBalanced).toBe(true);
  });

  it('handles unconfigured control accounts gracefully without guessing account codes', async () => {
    // Ensure defaultArAccountId is null
    await pg.db.update(glSettings).set({ defaultArAccountId: null });

    // Insert an open invoice
    const [loc] = await pg.db
      .insert(locations)
      .values({
        code: 'UNCONF',
        name: 'Unconfigured Hub',
        sourceId: 'loc-unconf',
        source: 'manual',
      })
      .returning();

    const [so] = await pg.db
      .insert(salesOrders)
      .values({
        orderNumber: 'SO-UNCONF',
        stateCode: 'confirmed',
        currencyCode: 'EUR',
        exchangeRate: '1.0',
        fulfillmentLocationId: loc.locationId,
        discrepanciesAcknowledged: false,
        source: 'manual',
      })
      .returning();

    await pg.db.insert(salesInvoices).values({
      invoiceNumber: 'INV-UNCONF',
      salesOrderId: so.salesOrderId,
      totalAmount: '350.00',
      outstandingAmount: '350.00',
      currencyCode: 'EUR',
      exchangeRate: '1.0',
      stateCode: 'invoiced',
    });

    const report = await service.getSubledgerReconciliation();
    expect(report.accountsReceivable.controlAccountCode).toBe('');
    expect(report.accountsReceivable.controlAccountName).toBe(
      'Accounts Receivable (Unconfigured)',
    );
    expect(report.accountsReceivable.subledgerBalance).toBe(350);
    expect(report.accountsReceivable.glBalance).toBe(0);
    expect(report.accountsReceivable.drift).toBe(350);
    expect(report.accountsReceivable.isMatched).toBe(false);
    expect(report.isOverallBalanced).toBe(false);
  });
});
