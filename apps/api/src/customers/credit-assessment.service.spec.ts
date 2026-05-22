import { Test, TestingModule } from '@nestjs/testing';
import { CreditAssessmentService } from './credit-assessment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  customers,
  tradingTerms,
  glJournalLines,
  glJournalEntries,
  glAccounts,
} from '../drizzle/modbm-core-schema';
import { sql } from 'drizzle-orm';

describe('CreditAssessmentService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: CreditAssessmentService;
  let testGlAccountId: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditAssessmentService,
        { provide: DRIZZLE, useValue: pg.db },
      ],
    }).compile();

    service = module.get<CreditAssessmentService>(CreditAssessmentService);

    // Seed a standard AR GL Customer
    const [gl] = await pg.db
      .insert(glAccounts)
      .values({
        accountCode: '1200',
        name: 'Customers Receivable',
        accountType: 'asset',
        currencyCode: 'USD',
      })
      .returning();
    testGlAccountId = gl.glAccountId;
  });

  describe('assessCredit', () => {
    it('should return zero balances if customer is missing', async () => {
      const result = await service.assessCredit(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toEqual({
        totalArBalance: 0,
        overdueBalance: 0,
        isOverdue: false,
      });
    });

    it('should calculate correct net AR balance from GL entries', async () => {
      const [term] = await pg.db
        .insert(tradingTerms)
        .values({
          code: 'NET30',
          days: 30,
          description: 'Net 30',
          type: 'net',
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          name: 'Test Customer',
          customerNumber: 'CUST-1',
          currencyCode: 'USD',
          tradingTermsId: term.tradingTermsId,
        })
        .returning();

      // Create a recent entry
      const [entry] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-1',
          entryDate: new Date().toISOString(),
          sourceType: 'manual',
        })
        .returning();

      await pg.db.insert(glJournalLines).values([
        {
          journalEntryId: entry.journalEntryId,
          partyId: acc.customerId,
          partyType: 'customer',
          debit: '500',
          credit: '0',
          glAccountId: testGlAccountId,
        },
        {
          journalEntryId: entry.journalEntryId,
          partyId: acc.customerId,
          partyType: 'customer',
          debit: '0',
          credit: '200',
          glAccountId: testGlAccountId,
        },
      ]);

      const result = await service.assessCredit(acc.customerId);
      expect(result.totalArBalance).toBe(300);
      expect(result.overdueBalance).toBe(0);
      expect(result.isOverdue).toBe(false);
    });

    it('should identify overdue debt using Balance Forward logic', async () => {
      const [term] = await pg.db
        .insert(tradingTerms)
        .values({
          code: 'NET30',
          days: 30,
          description: 'Net 30',
          type: 'net',
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          name: 'Overdue Customer',
          customerNumber: 'CUST-2',
          currencyCode: 'USD',
          tradingTermsId: term.tradingTermsId,
        })
        .returning();

      // 1. Old Overdue Debt (50 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 50);

      const [entryOld] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-OLD',
          entryDate: oldDate.toISOString(),
          sourceType: 'manual',
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: entryOld.journalEntryId,
        partyId: acc.customerId,
        partyType: 'customer',
        debit: '1000',
        credit: '0',
        glAccountId: testGlAccountId,
      });

      // 2. Recent Debt (5 days ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      const [entryRecent] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-RECENT',
          entryDate: recentDate.toISOString(),
          sourceType: 'manual',
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: entryRecent.journalEntryId,
        partyId: acc.customerId,
        partyType: 'customer',
        debit: '500',
        credit: '0',
        glAccountId: testGlAccountId,
      });

      // 3. Partial Payment (total credits)
      const [entryPay] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-PAY',
          entryDate: new Date().toISOString(),
          sourceType: 'manual',
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: entryPay.journalEntryId,
        partyId: acc.customerId,
        partyType: 'customer',
        debit: '0',
        credit: '400',
        glAccountId: testGlAccountId,
      });

      // Calculation:
      // Total Debits = 1000 + 500 = 1500
      // Total Credits = 400
      // Net AR = 1100
      // Overdue Debits = 1000 (from JE-OLD)
      // Overdue Balance = MAX(0, 1000 - 400) = 600

      const result = await service.assessCredit(acc.customerId);
      expect(result.totalArBalance).toBe(1100);
      expect(result.overdueBalance).toBe(600);
      expect(result.isOverdue).toBe(true);
    });
  });
});
