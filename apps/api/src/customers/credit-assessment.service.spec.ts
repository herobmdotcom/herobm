import { Test, TestingModule } from '@nestjs/testing';
import { CreditAssessmentService } from './credit-assessment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  customers,
  salesOrders,
  salesInvoices,
  salesCreditNotes,
  paymentEntries,
  glJournalLines,
  glJournalEntries,
  glAccounts,
  locations,
  organizations,
} from '@herobm/db-schema';
import { CUSTOMER_STATE, ORGANIZATION_STATE } from '@herobm/shared';

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
        totalCreditNoteBalance: 0,
        unallocatedPaymentBalance: 0,
        netOutstandingBalance: 0,
        glBalance: 0,
        isOverdue: false,
      });
    });

    it('should calculate correct balances from invoices, credit notes, and GL', async () => {
      const [act] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Test Customer',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          organizationId: act.organizationId,
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
      expect(result.totalCreditNoteBalance).toBe(0);
      expect(result.unallocatedPaymentBalance).toBe(0);
      expect(result.netOutstandingBalance).toBe(1000);
    });

    it('should correctly factor sales credit notes into customer net standing (ADV-228)', async () => {
      const [act] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Credit Note Customer',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          organizationId: act.organizationId,
          customerNumber: 'CUST-CREDIT',
          currencyCode: 'AUD',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'abm',
          createdBy: 'system',
        })
        .returning();

      // Customer has a credit balance on GL (credit = 41072.90)
      const [entry] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-OPENING-CREDIT',
          entryDate: new Date().toISOString(),
          sourceType: 'INITIAL_IMPORT',
          isReversed: false,
          createdBy: 'system',
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: entry.journalEntryId,
        partyId: acc.customerId,
        partyType: 'customer',
        debit: '0',
        credit: '41072.90',
        foreignDebit: '0',
        foreignCredit: '41072.90',
        glAccountId: testGlAccountId,
        exchangeRate: '1',
        isReconciled: false,
      });

      // Customer has an open credit note for 41072.90 and 0 open invoices
      await pg.db.insert(salesCreditNotes).values({
        creditNoteNumber: 'SC-1001',
        customerId: acc.customerId,
        totalAmount: '50000.00',
        outstandingAmount: '41072.90',
        currencyCode: 'AUD',
        exchangeRate: '1',
        stateCode: 'partially_paid',
        createdBy: 'system',
      });

      const result = await service.assessCredit(acc.customerId);
      expect(result.totalInvoiceBalance).toBe(0);
      expect(result.overdueInvoiceBalance).toBe(0);
      expect(result.totalCreditNoteBalance).toBe(41072.9);
      expect(result.netOutstandingBalance).toBe(-41072.9);
      expect(result.glBalance).toBe(-41072.9);
      expect(result.isOverdue).toBe(false);

      // Verify batch assessment parity
      const batchResult = await service.assessCreditBatch([acc.customerId]);
      expect(batchResult[acc.customerId]).toBeDefined();
      expect(batchResult[acc.customerId].totalCreditNoteBalance).toBe(41072.9);
      expect(batchResult[acc.customerId].netOutstandingBalance).toBe(-41072.9);
      expect(batchResult[acc.customerId].glBalance).toBe(-41072.9);
    });
  });
});
