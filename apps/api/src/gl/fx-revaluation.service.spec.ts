import { Test, TestingModule } from '@nestjs/testing';
import { FxRevaluationService } from './fx-revaluation.service';
import { GlService } from './gl.service';

import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { randomUUID } from 'crypto';
import {
  glSettings,
  exchangeRates,
  purchaseInvoices,
  salesInvoices,
  salesOrders,
  goodsReceived,
  goodsReceivedLines,
  purchaseOrders,
  glAccounts,
  glJournalEntries,
  glJournalLines,
  suppliers,
  customers,
  locations,
  products,
  uomDictionary,
  actors,
} from '../drizzle/herobm-core-schema';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { MATCH_STATUS } from '@herobm/shared';

describe('FxRevaluationService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: FxRevaluationService;
  let glService: GlService;

  let apAccountId: string;
  let arAccountId: string;
  let grniAccountId: string;
  let fxGainAccountId: string;
  let fxLossAccountId: string;
  let vendorId: string;
  let customerId: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRevaluationService,
        {
          provide: DRIZZLE,
          useFactory: () => pg.db,
        },
        {
          provide: GlService,
          useValue: {
            getSettings: async (tx: any) => {
              const [settings] = await (tx || pg.db)
                .select()
                .from(glSettings)
                .limit(1);
              return settings;
            },
            postJournalEntry: async (lines: any[], meta: any, tx: any) => {
              const jeId = randomUUID();
              await (tx || pg.db).insert(glJournalEntries).values({
                journalEntryId: jeId,
                sourceId: meta.sourceId,
                sourceType: meta.sourceType,
                memo: meta.memo,
                entryDate: meta.entryDate,
                stateCode: 'POSTED',
                entryNumber: `JE-${randomUUID().substring(0, 5)}`,
              });

              for (const line of lines) {
                await (tx || pg.db).insert(glJournalLines).values({
                  journalLineId: randomUUID(),
                  journalEntryId: jeId,
                  glAccountId: line.accountId,
                  debit: line.debit.toString(),
                  credit: line.credit.toString(),
                  partyId: line.partyId,
                  partyType: line.partyType,
                  memo: line.memo,
                  foreignCurrencyCode: line.foreignCurrencyCode,
                  foreignDebit: (line.foreignDebit || 0).toString(),
                  foreignCredit: (line.foreignCredit || 0).toString(),
                  exchangeRate: (line.exchangeRate || 1).toString(),
                });
              }
            },
          },
        },
      ],
    }).compile();

    service = module.get<FxRevaluationService>(FxRevaluationService);
    glService = module.get<GlService>(GlService);

    // Clean tables
    await pg.db.delete(glJournalLines);
    await pg.db.delete(glJournalEntries);
    await pg.db.delete(goodsReceivedLines);
    await pg.db.delete(goodsReceived);
    await pg.db.delete(purchaseInvoices);
    await pg.db.delete(purchaseOrders);
    await pg.db.delete(salesInvoices);
    await pg.db.delete(salesOrders);
    await pg.db.delete(exchangeRates);
    await pg.db.delete(suppliers);
    await pg.db.delete(customers);
    await pg.db.delete(locations);
    await pg.db.delete(glSettings);
    await pg.db.delete(glAccounts);

    // Seed Accounts
    apAccountId = randomUUID();
    arAccountId = randomUUID();
    grniAccountId = randomUUID();
    fxGainAccountId = randomUUID();
    fxLossAccountId = randomUUID();

    await pg.db.insert(glAccounts).values([
      {
        glAccountId: apAccountId,
        accountCode: '2100',
        name: 'Accounts Payable',
        accountType: 'liability',
        currencyCode: 'AUD',
      },
      {
        glAccountId: arAccountId,
        accountCode: '1100',
        name: 'Accounts Receivable',
        accountType: 'asset',
        currencyCode: 'AUD',
      },
      {
        glAccountId: grniAccountId,
        accountCode: '2110',
        name: 'GRNI',
        accountType: 'liability',
        currencyCode: 'AUD',
      },
      {
        glAccountId: fxGainAccountId,
        accountCode: '4200',
        name: 'Unrealised FX Gain',
        accountType: 'revenue',
        currencyCode: 'AUD',
      },
      {
        glAccountId: fxLossAccountId,
        accountCode: '5200',
        name: 'Unrealised FX Loss',
        accountType: 'expense',
        currencyCode: 'AUD',
      },
    ]);

    await pg.db.insert(glSettings).values({
      fiscalYearStartMonth: 1,
      baseCurrency: 'AUD',
      defaultApAccountId: apAccountId,
      defaultArAccountId: arAccountId,
      defaultGrniAccountId: grniAccountId,
      unrealisedFxGainAccountId: fxGainAccountId,
      unrealisedFxLossAccountId: fxLossAccountId,
    });

    // Seed Vendor and Customer
    const vendorActorId = randomUUID();
    await pg.db.insert(actors).values({
      actorId: vendorActorId,
      name: 'Test Vendor',
      headquartersAddressLine1: 'USA',
    });
    vendorId = randomUUID();
    await pg.db.insert(suppliers).values({
      vendorId,
      actorId: vendorActorId,
      vendorNumber: 'V-001',
      isPurchasingBlocked: false,
      currencyCode: 'USD',
    });

    const customerActorId = randomUUID();
    await pg.db.insert(actors).values({
      actorId: customerActorId,
      name: 'Test Customer',
      headquartersAddressLine1: 'USA',
    });
    customerId = randomUUID();
    await pg.db.insert(customers).values({
      customerId,
      actorId: customerActorId,
      customerNumber: 'C-001',
      currencyCode: 'USD',
    });

    const locId = randomUUID();
    await pg.db.insert(locations).values({
      locationId: locId,
      code: 'LOC-1',
      name: 'Main',
    });

    // Seed Exchange Rates
    await pg.db.insert(exchangeRates).values([
      {
        currencyCode: 'USD',
        currencyName: 'US Dollar',
        effectiveDate: new Date('2026-01-01'),
        buyRate: '1.40',
        sellRate: '1.40',
      },
      {
        currencyCode: 'USD',
        currencyName: 'US Dollar',
        effectiveDate: new Date('2026-01-31'),
        buyRate: '1.50',
        sellRate: '1.50',
      }, // AUD weakened
    ]);
  });

  describe('generateCandidates and commitRevaluation', () => {
    it('should revalue open AP invoice correctly (Loss when AUD weakens)', async () => {
      // AP Liability created at 1.40
      const invoiceId = randomUUID();
      await pg.db.insert(purchaseInvoices).values({
        invoiceId,
        invoiceNumber: 'AP-001',
        vendorId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        currencyCode: 'USD',
        exchangeRate: '1.40', // 1000 USD = 1400 AUD
        stateCode: 'approved',
        invoiceDate: new Date('2026-01-15'),
      });

      // Run Revaluation on Jan 31st where rate is 1.50. Liability is now 1500 AUD.
      // Loss = 100
      const genRes = await service.generateCandidates({
        revaluationDate: '2026-01-31',
      });
      const res = await service.commitRevaluation(
        { revaluationDate: '2026-01-31', lines: genRes.candidates },
        'test-actor',
      );
      expect(res.success).toBe(true);
      expect(res.entriesGenerated).toBe(4);

      // Verify the Journal Entry (Revaluation)
      const revals = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceType, 'adjustment'));
      expect(revals.length).toBe(2); // One adjustment, one reversal

      const adj = revals.find(
        (r) => r.memo && r.memo.includes('Reversal') === false,
      );
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, adj!.journalEntryId))
        .orderBy(asc(glJournalLines.debit));
      expect(lines.length).toBe(2);

      const apLine = lines.find((l) => l.glAccountId === apAccountId);
      const lossLine = lines.find((l) => l.glAccountId === fxLossAccountId);

      expect(apLine).toBeDefined();
      expect(lossLine).toBeDefined();

      // AP should be Credited 100 to increase liability
      expect(parseFloat(apLine!.credit)).toBeCloseTo(100);
      expect(parseFloat(apLine!.debit)).toBeCloseTo(0);

      // FX Loss should be Debited 100
      expect(parseFloat(lossLine!.debit)).toBeCloseTo(100);
      expect(parseFloat(lossLine!.credit)).toBeCloseTo(0);

      // Verify the Reversal Entry
      const rev = revals.find((r) => r.memo && r.memo.includes('Reversal'));
      expect(rev!.entryDate).toBe('2026-02-01');

      const revLines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, rev!.journalEntryId));
      const apRevLine = revLines.find((l) => l.glAccountId === apAccountId);

      // AP should be Debited 100 in reversal
      expect(parseFloat(apRevLine!.debit)).toBeCloseTo(100);
    });

    it('should revalue open AR invoice correctly (Gain when AUD weakens)', async () => {
      // AR Asset created at 1.40
      const soId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId: soId,
        orderNumber: 'SO-001',
        customerId,
        currencyCode: 'USD',
        fulfillmentLocationId: (
          await pg.db.select().from(locations).limit(1)
        )[0].locationId,
      });

      const invoiceId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId,
        invoiceNumber: 'AR-001',
        salesOrderId: soId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        currencyCode: 'USD',
        exchangeRate: '1.40', // 1000 USD = 1400 AUD
        stateCode: 'invoiced',
        invoiceDate: new Date('2026-01-15'),
      });

      // Run Revaluation on Jan 31st where rate is 1.50. Asset is now 1500 AUD.
      // Gain = 100
      const genRes = await service.generateCandidates({
        revaluationDate: '2026-01-31',
      });
      const res = await service.commitRevaluation(
        { revaluationDate: '2026-01-31', lines: genRes.candidates },
        'test-actor',
      );

      const revals = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceType, 'adjustment'));
      const adj = revals.find(
        (r) => r.memo && r.memo.includes('Reversal') === false,
      );
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, adj!.journalEntryId));

      const arLine = lines.find((l) => l.glAccountId === arAccountId);
      const gainLine = lines.find((l) => l.glAccountId === fxGainAccountId);

      // AR should be Debited 100 to increase asset
      expect(parseFloat(arLine!.debit)).toBeCloseTo(100);

      // FX Gain should be Credited 100
      expect(parseFloat(gainLine!.credit)).toBeCloseTo(100);
    });

    it('should revalue open GRNI correctly', async () => {
      const locId = (await pg.db.select().from(locations).limit(1))[0]
        .locationId;

      const poId = randomUUID();
      await pg.db.insert(purchaseOrders).values({
        purchaseOrderId: poId,
        orderNumber: 'PO-001',
        vendorId,
        currencyCode: 'USD',
        exchangeRate: '1.40',
        deliveryLocationId: locId,
      });

      const grId = randomUUID();
      await pg.db.insert(goodsReceived).values({
        goodsReceivedId: grId,
        receiptNumber: 'GR-001',
        vendorId,
        locationId: locId,
        createdOn: new Date('2026-01-15T10:00:00Z'),
      });

      await pg.db
        .insert(uomDictionary)
        .values({
          uomCode: 'ea',
          description: 'Each',
        })
        .onConflictDoNothing();

      const prodId = randomUUID();
      await pg.db.insert(products).values({
        productId: prodId,
        productNumber: 'PROD-1',
        name: 'Test Product',
        productType: 'inventory',
        baseUom: 'ea',
      });

      await pg.db.insert(goodsReceivedLines).values({
        goodsReceivedId: grId,
        purchaseOrderId: poId,
        productId: prodId,
        quantityReceived: '10',
        unitCost: '100', // 1000 USD total
        matchStatus: MATCH_STATUS.UNMATCHED,
      });

      const genRes = await service.generateCandidates({
        revaluationDate: '2026-01-31',
      });
      const res = await service.commitRevaluation(
        { revaluationDate: '2026-01-31', lines: genRes.candidates },
        'test-actor',
      );
      expect(res.success).toBe(true);
      expect(res.entriesGenerated).toBe(4);

      const revals = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceType, 'adjustment'));
      const adj = revals.find(
        (r) => r.memo && r.memo.includes('Reversal') === false,
      );
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, adj!.journalEntryId));

      const grniLine = lines.find((l) => l.glAccountId === grniAccountId);
      const lossLine = lines.find((l) => l.glAccountId === fxLossAccountId);

      // Liability increased 100 -> Credit GRNI 100, Debit Loss 100
      expect(parseFloat(grniLine!.credit)).toBeCloseTo(100);
      expect(parseFloat(lossLine!.debit)).toBeCloseTo(100);

      const rev = revals.find((r) => r.memo && r.memo.includes('Reversal'));
      const revLines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, rev!.journalEntryId));

      const grniRevLine = revLines.find((l) => l.glAccountId === grniAccountId);
      const lossRevLine = revLines.find(
        (l) => l.glAccountId === fxLossAccountId,
      );

      // Liability increased 100 -> Credit GRNI 100, Debit Loss 100
      expect(parseFloat(grniRevLine!.debit)).toBeCloseTo(100);
      expect(parseFloat(lossRevLine!.credit)).toBeCloseTo(100);
    });

    it('should not revalue if rate has not changed', async () => {
      // Re-seed rates so there is no change
      await pg.db.delete(exchangeRates);
      await pg.db.insert(exchangeRates).values([
        {
          currencyCode: 'USD',
          currencyName: 'US Dollar',
          effectiveDate: new Date('2026-01-01'),
          buyRate: '1.40',
          sellRate: '1.40',
        },
        {
          currencyCode: 'USD',
          currencyName: 'US Dollar',
          effectiveDate: new Date('2026-01-31'),
          buyRate: '1.40',
          sellRate: '1.40',
        }, // No change
      ]);

      const invoiceId = randomUUID();
      await pg.db.insert(purchaseInvoices).values({
        invoiceId,
        invoiceNumber: 'AP-002',
        vendorId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        currencyCode: 'USD',
        exchangeRate: '1.40',
        stateCode: 'approved',
        invoiceDate: new Date('2026-01-15'),
      });

      const genRes = await service.generateCandidates({
        revaluationDate: '2026-01-31',
      });
      const res =
        genRes.candidates.length > 0
          ? await service.commitRevaluation(
              { revaluationDate: '2026-01-31', lines: genRes.candidates },
              'test-actor',
            )
          : { entriesGenerated: 0 };
      expect(res.entriesGenerated).toBe(0);

      const revals = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceType, 'adjustment'));
      expect(revals.length).toBe(0); // No journals posted
    });
  });
});
