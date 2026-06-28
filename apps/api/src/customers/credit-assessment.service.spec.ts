import { Test, TestingModule } from '@nestjs/testing';
import { CreditAssessmentService } from './credit-assessment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  customers,
  salesOrders,
  salesInvoices,
  glJournalLines,
  glJournalEntries,
  glAccounts,
  locations,
} from '../drizzle/herobm-core-schema';

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
        '00000000-0000-4000-8000-000000000000',
      );
      expect(result).toEqual({
        totalInvoiceBalance: 0,
        overdueInvoiceBalance: 0,
        glBalance: 0,
        isOverdue: false,
      });
    });

    it('should calculate correct balances from invoices and GL', async () => {
      const [acc] = await pg.db
        .insert(customers)
        .values({
          name: 'Test Customer',
          customerNumber: 'CUST-1',
          currencyCode: 'USD',
          billingAddressCountry: 'AU',
        })
        .returning();

      // Create GL entry
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

      const [loc] = await pg.db
        .insert(locations)
        .values({ name: 'Main Warehouse', code: 'MAIN' })
        .returning();

      // Create Sales Order and Invoices
      const [order] = await pg.db
        .insert(salesOrders)
        .values({
          customerId: acc.customerId,
          orderNumber: 'SO-1',
          currencyCode: 'USD',
          stateCode: 'confirmed',
          baseTotalAmount: '1000',
          fulfillmentLocationId: loc.locationId,
        })
        .returning();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await pg.db.insert(salesInvoices).values([
        {
          invoiceNumber: 'INV-1',
          salesOrderId: order.salesOrderId,
          dueDate: yesterday,
          stateCode: 'unpaid',
          totalAmount: '400',
          outstandingAmount: '400',
          currencyCode: 'USD',
        },
        {
          invoiceNumber: 'INV-2',
          salesOrderId: order.salesOrderId,
          dueDate: tomorrow,
          stateCode: 'unpaid',
          totalAmount: '600',
          outstandingAmount: '600',
          currencyCode: 'USD',
        },
      ]);

      const result = await service.assessCredit(acc.customerId);
      expect(result.glBalance).toBe(300); // 500 - 200
      expect(result.totalInvoiceBalance).toBe(1000); // 400 + 600
      expect(result.overdueInvoiceBalance).toBe(400); // Only INV-1 is overdue
      expect(result.isOverdue).toBe(true);
    });
  });
});
