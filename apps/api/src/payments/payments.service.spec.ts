import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { GlService } from '../gl/gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { AbaGeneratorService } from './aba-generator.service';
import { NachaGeneratorService } from './nacha-generator.service';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  glAccounts,
  glSettings,
  paymentEntries,
  paymentAllocations,
  salesInvoices,
  purchaseInvoices,
  customers,
  customerGroups,
  suppliers,
  supplierGroups,
  salesOrders,
  locations,
  costCenters,
  activities,
  glJournalEntries,
  glJournalLines,
} from '../drizzle/modbm-core-schema';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  PAYMENT_STATE,
  SALES_INVOICE_STATE,
  SALES_ORDER_STATE,
} from '@modbm/shared';

describe('PaymentsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PaymentsService;
  let glService: GlService;

  // Shared GL customers
  let bankAccountId: string;
  let arAccountId: string;
  let apAccountId: string;

  // Shared dimension IDs
  let defaultCcId: string;
  let defaultActId: string;

  // Shared party IDs
  let customerId: string;
  let supplierId: string;
  let customerGroupId: string;
  let supplierGroupId: string;
  let locationId: string;

  async function seedFixtures() {
    // 1. Default dimensions
    defaultCcId = randomUUID();
    defaultActId = randomUUID();
    await pg.db
      .insert(costCenters)
      .values({
        costCenterId: defaultCcId,
        code: '00',
        name: 'Default',
        isSystem: true,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: costCenters.code,
        set: { costCenterId: defaultCcId },
      });
    await pg.db
      .insert(activities)
      .values({
        activityId: defaultActId,
        code: '00',
        name: 'Default',
        isSystem: true,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: activities.code,
        set: { activityId: defaultActId },
      });

    // 2. GL Customers
    bankAccountId = randomUUID();
    arAccountId = randomUUID();
    apAccountId = randomUUID();

    await pg.db.insert(glAccounts).values([
      {
        glAccountId: bankAccountId,
        accountCode: '1000',
        name: 'Bank Customer',
        accountType: 'asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      },
      {
        glAccountId: arAccountId,
        accountCode: '1100',
        name: 'Customers Receivable',
        accountType: 'asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      },
      {
        glAccountId: apAccountId,
        accountCode: '2100',
        name: 'Customers Payable',
        accountType: 'liability',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      },
    ]);

    // 3. GL Settings
    await pg.db.insert(glSettings).values({
      fiscalYearStartMonth: 7,
      defaultArAccountId: arAccountId,
      defaultApAccountId: apAccountId,
      baseCurrency: 'AUD',
    });

    // 4. Location (needed for salesOrders FK)
    locationId = randomUUID();
    await pg.db.insert(locations).values({
      locationId,
      code: 'TEST-LOC',
      name: 'Test Location',
    });

    // 5. Customer Group with AR routing
    customerGroupId = randomUUID();
    await pg.db.insert(customerGroups).values({
      customerGroupId,
      groupCode: 'TEST-GRP',
      name: 'Test Customer Group',
      defaultArAccountId: arAccountId,
    });

    // 6. Customer
    customerId = randomUUID();
    await pg.db.insert(customers).values({
      customerId: customerId,
      customerNumber: 'ACCT-001',
      externalId: 'CUST-001',
      name: 'Test Customer',
      currencyCode: 'AUD',
      customerGroupId,
      address1Country: 'AU',
    });

    // 6. Supplier Group with AP routing
    supplierGroupId = randomUUID();
    await pg.db.insert(supplierGroups).values({
      supplierGroupId,
      groupCode: 'TEST-SGRP',
      name: 'Test Supplier Group',
      defaultApAccountId: apAccountId,
    });

    // 7. Supplier
    supplierId = randomUUID();
    await pg.db.insert(suppliers).values({
      vendorId: supplierId,
      vendorNumber: 'VEND-001',
      externalId: 'SUPP-001',
      name: 'Test Supplier',
      currencyCode: 'AUD',
      supplierGroupId,
      address1Country: 'AU',
    });
  }

  beforeEach(async () => {
    // Clean tables for isolation
    await pg.db.delete(paymentAllocations);
    await pg.db.delete(paymentEntries);
    await pg.db.delete(glJournalLines);
    await pg.db.delete(glJournalEntries);
    await pg.db.delete(salesInvoices);
    await pg.db.delete(purchaseInvoices);
    await pg.db.delete(salesOrders);
    await pg.db.delete(customers);
    await pg.db.delete(customerGroups);
    await pg.db.delete(suppliers);
    await pg.db.delete(supplierGroups);
    await pg.db.delete(glSettings);
    await pg.db.delete(glAccounts);
    await pg.db.delete(locations);
    await pg.db.delete(costCenters);
    await pg.db.delete(activities);

    await seedFixtures();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        GlService,
        {
          provide: DataSourcesRegistry,
          useValue: { registerReport: jest.fn(), getReport: jest.fn() },
        },
        { provide: AbaGeneratorService, useValue: { generateAba: jest.fn() } },
        {
          provide: NachaGeneratorService,
          useValue: { generateNacha: jest.fn() },
        },
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            homeCurrency: jest.fn().mockReturnValue('AUD'),
            inventoryAccountingMode: () => 'perpetual',
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    glService = module.get<GlService>(GlService);
  });

  // -----------------------------------------------------------------------
  // createPaymentEntry
  // -----------------------------------------------------------------------

  describe('createPaymentEntry', () => {
    it('should create a draft payment with correct PAY-YYYYMMDD-NNNN number', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 1000,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      expect(payment.stateCode).toBe(PAYMENT_STATE.DRAFT);
      expect(payment.paymentNumber).toMatch(/^PAY-\d{8}-\d{4}$/);
      expect(parseFloat(payment.totalAmount)).toBe(1000);
      expect(parseFloat(payment.unallocatedAmount)).toBe(1000);
    });

    it('should increment sequence number for payments on the same day', async () => {
      const p1 = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'Cash',
          totalAmount: 500,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const p2 = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000002',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'Cash',
          totalAmount: 300,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const seq1 = parseInt(p1.paymentNumber.split('-').pop()!, 10);
      const seq2 = parseInt(p2.paymentNumber.split('-').pop()!, 10);
      expect(seq2).toBe(seq1 + 1);
    });
  });

  // -----------------------------------------------------------------------
  // submitPaymentEntry
  // -----------------------------------------------------------------------

  describe('submitPaymentEntry', () => {
    it('should submit and post GL journal with group-routed AR for customer receipt', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 1000,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const submitted = await service.submitPaymentEntry(
        payment.paymentId,
        'admin',
      );
      expect(submitted.stateCode).toBe(PAYMENT_STATE.SUBMITTED);

      // Verify GL journal was posted
      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      expect(entries).toHaveLength(1);
      expect(entries[0].sourceType).toBe('payment_entry');

      // Verify lines: Debit Bank, Credit AR
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l) => parseFloat(l.debit) > 0);
      const creditLine = lines.find((l) => parseFloat(l.credit) > 0);
      expect(debitLine?.glAccountId).toBe(bankAccountId);
      expect(creditLine?.glAccountId).toBe(arAccountId);
    });

    it('should submit and post GL journal with group-routed AP for supplier payment', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'pay',
          partyType: 'supplier',
          partyId: supplierId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 500,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const submitted = await service.submitPaymentEntry(
        payment.paymentId,
        'admin',
      );
      expect(submitted.stateCode).toBe(PAYMENT_STATE.SUBMITTED);

      // Verify lines: Debit AP, Credit Bank
      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l) => parseFloat(l.debit) > 0);
      const creditLine = lines.find((l) => parseFloat(l.credit) > 0);
      expect(debitLine?.glAccountId).toBe(apAccountId);
      expect(creditLine?.glAccountId).toBe(bankAccountId);
    });

    it('should reject submitting a non-draft payment', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'Cash',
          totalAmount: 100,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.submitPaymentEntry(payment.paymentId, 'admin');

      await expect(
        service.submitPaymentEntry(payment.paymentId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fall back to glSettings when group has no AR/AP override', async () => {
      // Create a customer with no customer group
      const ungroupedId = randomUUID();
      await pg.db.insert(customers).values({
        customerId: ungroupedId,
        customerNumber: 'ACCT-UNGROUPED',
        externalId: 'UNGROUPED-001',
        name: 'Ungrouped Customer',
        currencyCode: 'AUD',
        address1Country: 'AU',
        // No customerGroupId
      });

      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: ungroupedId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 200,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      // Should still succeed using glSettings.defaultArAccountId
      const submitted = await service.submitPaymentEntry(
        payment.paymentId,
        'admin',
      );
      expect(submitted.stateCode).toBe(PAYMENT_STATE.SUBMITTED);
    });

    it('should process Customer Refund (pay to customer) with correct GL subledger type', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: 'pay',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 150,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );
      await service.submitPaymentEntry(payment.paymentId, 'admin');

      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));

      const debitLine = lines.find((l) => parseFloat(l.debit) > 0); // Should debit AR
      expect(debitLine?.glAccountId).toBe(arAccountId);
      expect(debitLine?.partyType).toBe('customer'); // Verify it correctly applied the subledger type
      expect(debitLine?.partyId).toBe(customerId);
    });

    it('should process Supplier Refund (receive from supplier) with correct GL subledger type', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: 'receive',
          partyType: 'supplier',
          partyId: supplierId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 250,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );
      await service.submitPaymentEntry(payment.paymentId, 'admin');

      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));

      const creditLine = lines.find((l) => parseFloat(l.credit) > 0); // Should credit AP
      expect(creditLine?.glAccountId).toBe(apAccountId);
      expect(creditLine?.partyType).toBe('supplier'); // Verify it correctly applied the subledger type
      expect(creditLine?.partyId).toBe(supplierId);
    });

    it('should process Direct Payment (pay to gl_account) with no subledger type', async () => {
      // Create a dummy expense account
      const expenseGlId = randomUUID();
      await pg.db.insert(glAccounts).values({
        glAccountId: expenseGlId,
        accountCode: '6000',
        name: 'Direct Expense',
        accountType: 'expense',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      });

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: 'pay',
          partyType: 'gl_account',
          partyId: expenseGlId, // offset account
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 50,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );
      await service.submitPaymentEntry(payment.paymentId, 'admin');

      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));

      const debitLine = lines.find((l) => parseFloat(l.debit) > 0); // Should debit expense account
      expect(debitLine?.glAccountId).toBe(expenseGlId);
      expect(debitLine?.partyType).toBeNull();
      expect(debitLine?.partyId).toBeNull();
    });

    it('should process Direct Receipt (receive to gl_account) with no subledger type', async () => {
      // Create a dummy revenue account
      const revenueGlId = randomUUID();
      await pg.db.insert(glAccounts).values({
        glAccountId: revenueGlId,
        accountCode: '4000',
        name: 'Direct Revenue',
        accountType: 'revenue',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      });

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: 'receive',
          partyType: 'gl_account',
          partyId: revenueGlId, // offset account
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 75,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );
      await service.submitPaymentEntry(payment.paymentId, 'admin');

      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));

      const creditLine = lines.find((l) => parseFloat(l.credit) > 0); // Should credit revenue account
      expect(creditLine?.glAccountId).toBe(revenueGlId);
      expect(creditLine?.partyType).toBeNull();
      expect(creditLine?.partyId).toBeNull();
    });

    it('should process split Direct Payment across multiple GL accounts', async () => {
      const expense1Id = randomUUID();
      const expense2Id = randomUUID();
      await pg.db.insert(glAccounts).values([
        {
          glAccountId: expense1Id,
          accountCode: '6001',
          name: 'Expense 1',
          accountType: 'expense',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
        },
        {
          glAccountId: expense2Id,
          accountCode: '6002',
          name: 'Expense 2',
          accountType: 'expense',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
        },
      ]);

      const paymentId = randomUUID();
      await service.createPaymentEntry(
        {
          paymentId,
          paymentType: 'pay',
          partyType: 'gl_account',
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 500,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
          lines: [
            { accountId: expense1Id, amount: 545, memo: 'Gross Wages' },
            { accountId: expense2Id, amount: -45, memo: 'PAYG Liability' },
          ],
        },
        'admin',
      );

      await service.submitPaymentEntry(paymentId, 'admin');

      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, paymentId));
      const lines = await pg.db
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalEntryId, entries[0].journalEntryId));

      expect(lines.length).toBe(3); // 1 Bank, 2 Splits

      const bankLine = lines.find((l) => l.glAccountId === bankAccountId);
      expect(parseFloat(bankLine!.credit)).toBe(500);

      const exp1Line = lines.find((l) => l.glAccountId === expense1Id);
      expect(parseFloat(exp1Line!.debit)).toBe(545);
      expect(parseFloat(exp1Line!.credit)).toBe(0);
      expect(exp1Line!.memo).toBe('Gross Wages');

      const exp2Line = lines.find((l) => l.glAccountId === expense2Id);
      expect(parseFloat(exp2Line!.debit)).toBe(0);
      expect(parseFloat(exp2Line!.credit)).toBe(45); // Negative line amount becomes a credit for a 'pay' transaction
      expect(exp2Line!.memo).toBe('PAYG Liability');
    });
  });

  // -----------------------------------------------------------------------
  // allocatePayment
  // -----------------------------------------------------------------------

  describe('allocatePayment', () => {
    let salesOrderId: string;
    let invoiceId: string;
    let submittedPaymentId: string;

    async function seedInvoiceAndPayment(
      invoiceAmount = 1000,
      paymentAmount = 1000,
    ) {
      // Create a sales order for the invoice FK
      salesOrderId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId,
        orderNumber: 'SO-TEST-001',
        customerId,
        currencyCode: 'AUD',
        fulfillmentLocationId: locationId,
        stateCode: SALES_ORDER_STATE.SHIPPED as any,
      });

      // Create an invoiced sales invoice
      invoiceId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId,
        invoiceNumber: 'INV-TEST-001',
        salesOrderId,
        totalAmount: String(invoiceAmount),
        outstandingAmount: String(invoiceAmount),
        taxAmount: '0',
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.INVOICED,
      });

      // Create and submit a payment
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: paymentAmount,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.submitPaymentEntry(payment.paymentId, 'admin');
      submittedPaymentId = payment.paymentId;
    }

    it('should allocate payment fully and mark invoice as paid', async () => {
      await seedInvoiceAndPayment(1000, 1000);

      const result = await service.allocatePayment(
        submittedPaymentId,
        {
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: invoiceId,
              allocatedAmount: 1000,
            },
          ],
        },
        'admin',
      );

      // Payment should be fully allocated
      expect(parseFloat(result.unallocatedAmount)).toBe(0);

      // Invoice should be paid
      const [inv] = await pg.db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId));
      expect(parseFloat(inv.outstandingAmount)).toBe(0);
      expect(inv.stateCode).toBe(SALES_INVOICE_STATE.PAID);
    });

    it('should allocate partial amount and mark invoice as partially_paid', async () => {
      await seedInvoiceAndPayment(1000, 500);

      const result = await service.allocatePayment(
        submittedPaymentId,
        {
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: invoiceId,
              allocatedAmount: 500,
            },
          ],
        },
        'admin',
      );

      expect(parseFloat(result.unallocatedAmount)).toBe(0);

      // Invoice should be partially paid
      const [inv] = await pg.db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId));
      expect(parseFloat(inv.outstandingAmount)).toBe(500);
      expect(inv.stateCode).toBe(SALES_INVOICE_STATE.PARTIALLY_PAID);
    });

    it('should reject over-allocation beyond unallocated amount', async () => {
      await seedInvoiceAndPayment(2000, 500);

      await expect(
        service.allocatePayment(
          submittedPaymentId,
          {
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invoiceId,
                allocatedAmount: 600,
              },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow('Cannot allocate more than the unallocated amount');
    });

    it('should reject over-allocation beyond invoice outstanding', async () => {
      await seedInvoiceAndPayment(500, 1000);

      await expect(
        service.allocatePayment(
          submittedPaymentId,
          {
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invoiceId,
                allocatedAmount: 600,
              },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow('Cannot allocate more than outstanding');
    });

    it('should reject allocation against a draft invoice', async () => {
      await seedInvoiceAndPayment(1000, 1000);

      // Force invoice back to draft for the test
      await pg.db
        .update(salesInvoices)
        .set({ stateCode: SALES_INVOICE_STATE.DRAFT })
        .where(eq(salesInvoices.invoiceId, invoiceId));

      await expect(
        service.allocatePayment(
          submittedPaymentId,
          {
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invoiceId,
                allocatedAmount: 1000,
              },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow('Cannot allocate to invoice in state draft');
    });
  });

  // -----------------------------------------------------------------------
  // cancelPayment
  // -----------------------------------------------------------------------

  describe('cancelPayment', () => {
    it('should cancel a submitted payment with no allocations', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 500,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.submitPaymentEntry(payment.paymentId, 'admin');

      const cancelled = await service.cancelPayment(payment.paymentId, 'admin');
      expect(cancelled.stateCode).toBe(PAYMENT_STATE.CANCELLED);

      // Verify reversal GL journal was posted (2 entries: original + reversal)
      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      expect(entries).toHaveLength(2);
    });

    it('should reject cancelling a draft payment', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'Cash',
          totalAmount: 100,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await expect(
        service.cancelPayment(payment.paymentId, 'admin'),
      ).rejects.toThrow('Only submitted payments can be cancelled');
    });

    it('should reject cancelling a payment with allocations', async () => {
      // Seed invoice + payment + allocate
      const soId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId: soId,
        orderNumber: 'SO-CANCEL-TEST',
        customerId,
        currencyCode: 'AUD',
        fulfillmentLocationId: locationId,
        stateCode: SALES_ORDER_STATE.SHIPPED as any,
      });

      const invId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-CANCEL-TEST',
        salesOrderId: soId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        taxAmount: '0',
        currencyCode: 'AUD',
        stateCode: 'invoiced',
      });

      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 1000,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.submitPaymentEntry(payment.paymentId, 'admin');
      await service.allocatePayment(
        payment.paymentId,
        {
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: invId,
              allocatedAmount: 500,
            },
          ],
        },
        'admin',
      );

      await expect(
        service.cancelPayment(payment.paymentId, 'admin'),
      ).rejects.toThrow('Cannot cancel a payment that has allocations');
    });

    it('should successfully reverse a Direct Payment and net out to 0', async () => {
      // Create a dummy expense account
      const expenseGlId = randomUUID();
      await pg.db.insert(glAccounts).values({
        glAccountId: expenseGlId,
        accountCode: '6001',
        name: 'Direct Expense Reversal',
        accountType: 'expense',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
      });

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: 'pay',
          partyType: 'gl_account',
          partyId: expenseGlId, // offset account
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 85,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );
      await service.submitPaymentEntry(payment.paymentId, 'admin');

      // Forward GL verified
      const beforeCancelEntries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      expect(beforeCancelEntries).toHaveLength(1);

      // Reverse it
      await service.cancelPayment(payment.paymentId, 'admin');

      // Check all GL lines for this payment to ensure net is 0 for both bank and offset
      const allEntries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(eq(glJournalEntries.sourceId, payment.paymentId));
      expect(allEntries).toHaveLength(2); // Original + Reversal

      const allLines = await pg.db
        .select()
        .from(glJournalLines)
        .where(
          inArray(
            glJournalLines.journalEntryId,
            allEntries.map((e) => e.journalEntryId),
          ),
        );

      // Sum by account
      const netBalances = allLines.reduce(
        (acc, line) => {
          if (!acc[line.glAccountId]) acc[line.glAccountId] = 0;
          acc[line.glAccountId] +=
            parseFloat(line.debit) - parseFloat(line.credit);
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(netBalances[bankAccountId]).toBe(0);
      expect(netBalances[expenseGlId]).toBe(0);

      // Reversal lines should also have null partyType/partyId
      const reversalLines = allLines.filter(
        (l) => l.journalEntryId === allEntries[1].journalEntryId,
      );
      for (const line of reversalLines) {
        expect(line.partyType).toBeNull();
        expect(line.partyId).toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // findAll — party name resolution
  // -----------------------------------------------------------------------

  describe('findAll', () => {
    it('should return partyName for customer payments', async () => {
      await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'Cash',
          totalAmount: 100,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].partyName).toBe('Test Customer');
    });

    it('should return partyName for supplier payments', async () => {
      await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'pay',
          partyType: 'supplier',
          partyId: supplierId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 200,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].partyName).toBe('Test Supplier');
    });
  });

  // -----------------------------------------------------------------------
  // findOne — enriched allocations
  // -----------------------------------------------------------------------

  describe('findOne', () => {
    it('should return payment with enriched allocation invoice numbers', async () => {
      const soId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId: soId,
        orderNumber: 'SO-FINDONE',
        customerId,
        currencyCode: 'AUD',
        fulfillmentLocationId: locationId,
        stateCode: SALES_ORDER_STATE.SHIPPED as any,
      });

      const invId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-FINDONE-001',
        salesOrderId: soId,
        totalAmount: '500',
        outstandingAmount: '500',
        taxAmount: '0',
        currencyCode: 'AUD',
        stateCode: SALES_INVOICE_STATE.INVOICED,
      });

      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-0000-0000-000000000001',
          paymentType: 'receive',
          partyType: 'customer',
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 500,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.submitPaymentEntry(payment.paymentId, 'admin');
      await service.allocatePayment(
        payment.paymentId,
        {
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: invId,
              allocatedAmount: 500,
            },
          ],
        },
        'admin',
      );

      const detail = await service.findOne(payment.paymentId);
      expect(detail.partyName).toBe('Test Customer');
      expect(detail.allocations).toHaveLength(1);
      expect(detail.allocations[0].invoiceNumber).toBe('INV-FINDONE-001');
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      await expect(service.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
