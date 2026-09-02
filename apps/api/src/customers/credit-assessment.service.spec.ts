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
  actors,
} from '@herobm/db-schema';
import { CUSTOMER_STATE, ACTOR_STATE } from '@herobm/shared';

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
        isGroup: false,
        isSystem: false,
        isBankAccount: false,
        isActive: true,
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
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Test Customer',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId: act.actorId,
          customerNumber: 'CUST-1',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      // Create GL entry
      const [entry] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-1',
          entryDate: new Date().toISOString(),
          sourceType: 'manual',
          isReversed: false,
          createdBy: 'system',
        })
        .returning();

      await pg.db.insert(glJournalLines).values([
        {
          journalEntryId: entry.journalEntryId,
          partyId: acc.customerId,
          partyType: 'customer',
          debit: '500',
          credit: '0',
          foreignDebit: '500',
          foreignCredit: '0',
          glAccountId: testGlAccountId,
          exchangeRate: '1',
          isReconciled: false,
        },
        {
          journalEntryId: entry.journalEntryId,
          partyId: acc.customerId,
          partyType: 'customer',
          debit: '0',
          credit: '200',
          foreignDebit: '0',
          foreignCredit: '200',
          glAccountId: testGlAccountId,
          exchangeRate: '1',
          isReconciled: false,
        },
      ]);

      const [loc] = await pg.db
        .insert(locations)
        .values({
          name: 'Main Warehouse',
          code: 'MAIN',
          source: 'app',
          createdBy: 'system',
        })
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
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
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
          stateCode: 'invoiced',
          totalAmount: '400',
          outstandingAmount: '400',
          currencyCode: 'USD',
          exchangeRate: '1',
          baseTotalAmount: '0',
          taxAmount: '0',
          baseOutstandingAmount: '0',
          createdBy: 'system',
        },
        {
          invoiceNumber: 'INV-2',
          salesOrderId: order.salesOrderId,
          dueDate: tomorrow,
          stateCode: 'invoiced',
          totalAmount: '600',
          outstandingAmount: '600',
          currencyCode: 'USD',
          exchangeRate: '1',
          baseTotalAmount: '0',
          taxAmount: '0',
          baseOutstandingAmount: '0',
          createdBy: 'system',
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
