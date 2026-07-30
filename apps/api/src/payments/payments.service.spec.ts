import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { GlService } from '../gl/gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { SuppliersService } from '../suppliers/suppliers.service';
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
  exchangeRates,
  actors,
} from '@herobm/db-schema';
import { eq, inArray, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  PAYMENT_TYPE,
  PAYMENT_STATE,
  SALES_INVOICE_STATE,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  SUPPLIER_STATE,
} from '@herobm/shared';

describe('PaymentsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PaymentsService;
  let glService: GlService;
  let mockSuppliersService: { assessRisk: jest.Mock };

  // Shared GL customers
  let bankAccountId: string;
  let arAccountId: string;
  let apAccountId: string;

  // Shared dimension IDs
  let defaultCcId: string;
  let defaultActId: string;

  // Shared party IDs
  let customerId: string;
  let usdCustomerId: string;
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
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: arAccountId,
        accountCode: '1100',
        name: 'Customers Receivable',
        accountType: 'asset',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
        isSystem: false,
        isBankAccount: false,
      },
      {
        glAccountId: apAccountId,
        accountCode: '2100',
        name: 'Customers Payable',
        accountType: 'liability',
        isGroup: false,
        isActive: true,
        currencyCode: 'AUD',
        isSystem: false,
        isBankAccount: false,
      },
    ] as any);

    // 3. GL Settings
    await pg.db.insert(glSettings).values({
      fiscalYearStartMonth: 7,
      defaultArAccountId: arAccountId,
      defaultApAccountId: apAccountId,
      baseCurrency: 'AUD',
      revenueRoutingPrecedence: 'product_first',
      expenseRoutingPrecedence: 'product_first',
      bankMatchDateToleranceDays: 3,
    });

    // 4. Location (needed for salesOrders FK)
    locationId = randomUUID();
    await pg.db.insert(locations).values({
      locationId,
      code: 'TEST-LOC',
      name: 'Test Location',
      source: 'system',
    });

    // 5. Customer Group with AR routing
    customerGroupId = randomUUID();
    await pg.db.insert(customerGroups).values({
      customerGroupId,
      groupCode: 'TEST-GRP',
      name: 'Test Customer Group',
      stateCode: CUSTOMER_STATE.ACTIVE,
      defaultArAccountId: arAccountId,
      isOnCreditHold: false,
    } as any);

    // 6. Customer Actor
    customerId = randomUUID();
    usdCustomerId = randomUUID();
    const customerActorId = randomUUID();
    await pg.db.insert(actors).values({
      actorId: customerActorId,
      name: 'Test Customer',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    } as any);

    await pg.db.insert(customers).values({
      customerId: customerId,
      actorId: customerActorId,
      customerNumber: 'ACCT-001',
      externalId: 'CUST-001',
      currencyCode: 'AUD',
      customerGroupId,
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'system',
    } as any);

    const cActorId = randomUUID();
    await pg.db.insert(actors).values({
      actorId: cActorId,
      name: 'FX Customer',
      headquartersAddressLine1: 'US',
      isTaxRegistered: false,
    } as any);
    await pg.db.insert(customers).values({
      customerId: usdCustomerId,
      actorId: cActorId,
      customerNumber: 'FX-CUST-001',
      currencyCode: 'USD',
      customerGroupId,
      stateCode: CUSTOMER_STATE.ACTIVE,
      source: 'system',
    } as any);

    // 6. Supplier Group with AP routing
    supplierGroupId = randomUUID();
    await pg.db.insert(supplierGroups).values({
      supplierGroupId,
      groupCode: 'TEST-SGRP',
      name: 'Test Supplier Group',
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
      defaultApAccountId: apAccountId,
    } as any);

    // 7. Supplier Actor
    supplierId = randomUUID();
    const supplierActorId = randomUUID();
    await pg.db.insert(actors).values({
      actorId: supplierActorId,
      name: 'Test Supplier',
      headquartersAddressLine1: 'AU',
      isTaxRegistered: false,
    } as any);

    await pg.db.insert(suppliers).values({
      vendorId: supplierId,
      actorId: supplierActorId,
      vendorNumber: 'VEND-001',
      externalId: 'SUPP-001',
      currencyCode: 'AUD',
      supplierGroupId,
      stateCode: SUPPLIER_STATE.ACTIVE,
      isPurchasingBlocked: false,
      source: 'system',
    } as any);
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
          provide: SuppliersService,
          useValue: {
            assessRisk: jest.fn().mockResolvedValue({
              isPaymentBlocked: false,
              paymentBlockReasons: [],
            }),
          },
        },
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
    mockSuppliersService = module.get(SuppliersService);
  });

  // -----------------------------------------------------------------------
  // createPaymentEntry
  // -----------------------------------------------------------------------

  describe('createPaymentEntry', () => {
    it('should create a draft payment with correct PAY-YYYYMMDD-NNNN number', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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

    it('should correctly decrement unallocatedAmount if allocations are provided', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000010',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 1000,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: '00000000-0000-4000-8000-111111111111',
              allocatedAmount: 400,
            },
          ],
        },
        'admin',
      );

      expect(parseFloat(payment.totalAmount)).toBe(1000);
      expect(parseFloat(payment.unallocatedAmount)).toBe(600);
    });

    it('should throw BadRequestException if supplier is blocked for payment', async () => {
      mockSuppliersService.assessRisk.mockResolvedValueOnce({
        isPaymentBlocked: true,
        paymentBlockReasons: ['supplier_inactive'],
      });

      await expect(
        service.createPaymentEntry(
          {
            paymentId: '00000000-0000-4000-8000-000000000009',
            paymentType: PAYMENT_TYPE.SUPPLIER_PAYMENT,
            partyId: supplierId,
            paymentDate: new Date().toISOString(),
            modeOfPayment: 'EFT',
            totalAmount: 1000,
            glAccountBank: bankAccountId,
            currencyCode: 'AUD',
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment sequence number for payments on the same day', async () => {
      const p1 = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
          paymentId: '00000000-0000-4000-8000-000000000002',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.SUPPLIER_PAYMENT,
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
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
      const unActorId = randomUUID();
      await pg.db.insert(actors).values({
        actorId: unActorId,
        name: 'Ungrouped Customer',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      } as any);
      await pg.db.insert(customers).values({
        customerId: ungroupedId,
        actorId: unActorId,
        customerNumber: 'ACCT-UNGROUPED',
        externalId: 'UNGROUPED-001',
        currencyCode: 'AUD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'system',
        // No customerGroupId
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
          paymentType: PAYMENT_TYPE.CUSTOMER_REFUND,
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
          paymentType: PAYMENT_TYPE.SUPPLIER_REFUND,
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
        isSystem: false,
        isBankAccount: false,
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: PAYMENT_TYPE.DIRECT_PAYMENT,
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
        isSystem: false,
        isBankAccount: false,
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: PAYMENT_TYPE.DIRECT_RECEIPT,
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
          isSystem: false,
          isBankAccount: false,
        },
        {
          glAccountId: expense2Id,
          accountCode: '6002',
          name: 'Expense 2',
          accountType: 'expense',
          isGroup: false,
          isActive: true,
          currencyCode: 'AUD',
          isSystem: false,
          isBankAccount: false,
        },
      ] as any);

      const paymentId = randomUUID();
      await service.createPaymentEntry(
        {
          paymentId,
          paymentType: PAYMENT_TYPE.DIRECT_PAYMENT,
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
    let draftPaymentId: string;

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
        stateCode: SALES_ORDER_STATE.SHIPPED,
        source: 'system',
        discrepanciesAcknowledged: false,
        exchangeRate: '1',
      } as any);

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
        exchangeRate: '1',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        source: 'system',
      } as any);

      // Create and submit a payment
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: paymentAmount,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      draftPaymentId = payment.paymentId;
    }

    it('should allocate payment fully and mark invoice as paid', async () => {
      await seedInvoiceAndPayment(1000, 1000);

      const result = await service.allocatePayment(
        draftPaymentId,
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

      // Now submit the payment to apply allocations to invoices
      await service.submitPaymentEntry(draftPaymentId, 'admin');

      // Invoice should be paid
      const [inv] = await pg.db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId));
      expect(parseFloat(inv.outstandingAmount)).toBe(0);
      expect(inv.stateCode).toBe(SALES_INVOICE_STATE.PAID);
    });

    it('should allow allocating a SUBMITTED payment (late allocation) sequentially', async () => {
      await seedInvoiceAndPayment(1000, 1000);

      // Submit the payment BEFORE allocating
      await service.submitPaymentEntry(draftPaymentId, 'admin');

      // 1st late allocation: 400
      let result = await service.allocatePayment(
        draftPaymentId,
        {
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: invoiceId,
              allocatedAmount: 400,
            },
          ],
        },
        'admin',
      );

      // Unallocated amount should drop from 1000 to 600
      expect(parseFloat(result.unallocatedAmount)).toBe(600);

      // 2nd late allocation: 600
      result = await service.allocatePayment(
        draftPaymentId,
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
      );

      // Payment should be fully allocated now
      expect(parseFloat(result.unallocatedAmount)).toBe(0);

      // Invoice should be paid
      const [inv] = await pg.db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId));
      expect(parseFloat(inv.outstandingAmount)).toBe(0);
      expect(inv.stateCode).toBe(SALES_INVOICE_STATE.PAID);

      // Verify GL entries - should have an extra one for the allocation
      const entries = await pg.db
        .select()
        .from(glJournalEntries)
        .where(
          and(
            eq(glJournalEntries.sourceType, 'payment_entry'),
            eq(glJournalEntries.sourceId, draftPaymentId),
          ),
        );
      // It should have the original receipt entry. No FX variance means no additional entries.
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it('should allocate partial amount and mark invoice as partially_paid', async () => {
      await seedInvoiceAndPayment(1000, 500);

      const result = await service.allocatePayment(
        draftPaymentId,
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

      // Submit
      await service.submitPaymentEntry(draftPaymentId, 'admin');

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
          draftPaymentId,
          {
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invoiceId,
                allocatedAmount: 600, // 600 > 500
              },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow(
        'Cannot allocate more than the available unallocated amount',
      );
    });

    it('should reject over-allocation beyond invoice outstanding', async () => {
      await seedInvoiceAndPayment(500, 1000);

      await expect(
        service.allocatePayment(
          draftPaymentId,
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
      ).rejects.toThrow(
        'Cannot allocate more than remaining outstanding amount on invoice',
      );
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
          draftPaymentId,
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
    it('should validate early payment discount successfully', async () => {
      const discCustomerId = randomUUID();
      const dActorId = randomUUID();
      await pg.db.insert(actors).values({
        actorId: dActorId,
        name: 'Discount Customer',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      } as any);
      await pg.db.insert(customers).values({
        customerId: discCustomerId,
        actorId: dActorId,
        customerNumber: 'CUST-DISC-001',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'system',
        currencyCode: 'AUD',
        earlyPaymentDiscount: '5', // 5%
        earlyPaymentDiscountDays: 14,
      } as any);

      const soId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId: soId,
        orderNumber: 'SO-DISC-001',
        customerId: discCustomerId,
        currencyCode: 'AUD',
        fulfillmentLocationId: locationId,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        source: 'system',
        discrepanciesAcknowledged: false,
        exchangeRate: '1',
      } as any);

      const invId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-DISC-001',
        salesOrderId: soId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        taxAmount: '0',
        currencyCode: 'AUD',
        exchangeRate: '1',
        stateCode: SALES_INVOICE_STATE.DRAFT,
        source: 'system',
        invoiceDate: new Date(),
      } as any);

      await pg.db
        .update(salesInvoices)
        .set({ stateCode: SALES_INVOICE_STATE.INVOICED })
        .where(eq(salesInvoices.invoiceId, invId));

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
          partyId: discCustomerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 950,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const result = await service.allocatePayment(
        payment.paymentId,
        {
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: invId,
              allocatedAmount: 950,
              discountAmount: 50,
            },
          ],
        },
        'admin',
      );

      expect(result).toBeDefined();
      expect(result.unallocatedAmount).toBe('0');
    });

    it('should reject early payment discount if past the allowed days', async () => {
      const discCustomerId = randomUUID();
      const dActorId2 = randomUUID();
      await pg.db.insert(actors).values({
        actorId: dActorId2,
        name: 'Discount Customer 2',
        headquartersAddressLine1: 'AU',
        isTaxRegistered: false,
      } as any);
      await pg.db.insert(customers).values({
        customerId: discCustomerId,
        actorId: dActorId2,
        customerNumber: 'CUST-DISC-002',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'system',
        currencyCode: 'AUD',
        earlyPaymentDiscount: '5', // 5%
        earlyPaymentDiscountDays: 14,
      } as any);

      const soId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId: soId,
        orderNumber: 'SO-DISC-002',
        customerId: discCustomerId,
        currencyCode: 'AUD',
        fulfillmentLocationId: locationId,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        source: 'system',
        discrepanciesAcknowledged: false,
        exchangeRate: '1',
      } as any);

      const invId = randomUUID();
      const pastInvoiceDate = new Date();
      pastInvoiceDate.setDate(pastInvoiceDate.getDate() - 20); // 20 days ago (past 14 days)

      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-DISC-002',
        salesOrderId: soId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        taxAmount: '0',
        currencyCode: 'AUD',
        exchangeRate: '1',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        source: 'system',
        invoiceDate: pastInvoiceDate,
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
          partyId: discCustomerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 950,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await expect(
        service.allocatePayment(
          payment.paymentId,
          {
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invId,
                allocatedAmount: 950,
                discountAmount: 50,
              },
            ],
          },
          'admin',
        ),
      ).rejects.toThrow(/is past the allowed early payment discount period/);
    });
  });

  // -----------------------------------------------------------------------
  // cancelPayment
  // -----------------------------------------------------------------------

  describe('cancelPayment', () => {
    it('should cancel a submitted payment with no allocations', async () => {
      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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

    it('should successfully cancel a payment with allocations and restore outstanding balance', async () => {
      // Seed invoice + payment + allocate
      const soId = randomUUID();
      await pg.db.insert(salesOrders).values({
        salesOrderId: soId,
        orderNumber: 'SO-CANCEL-TEST',
        customerId,
        currencyCode: 'AUD',
        fulfillmentLocationId: locationId,
        stateCode: SALES_ORDER_STATE.SHIPPED,
        source: 'system',
        discrepanciesAcknowledged: false,
        exchangeRate: '1',
      } as any);

      const invId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-CANCEL-TEST',
        salesOrderId: soId,
        totalAmount: '1000',
        outstandingAmount: '1000',
        taxAmount: '0',
        currencyCode: 'AUD',
        exchangeRate: '1',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        source: 'system',
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 1000,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

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
      await service.submitPaymentEntry(payment.paymentId, 'admin');

      // Now cancel it
      await service.cancelPayment(payment.paymentId, 'admin');

      // Verify invoice outstanding amount was restored to 1000
      const [inv] = await pg.db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invId));
      expect(parseFloat(inv.outstandingAmount)).toBe(1000);
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
        isSystem: false,
        isBankAccount: false,
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: randomUUID(),
          paymentType: PAYMENT_TYPE.DIRECT_PAYMENT,
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
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
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
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.SUPPLIER_PAYMENT,
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
        stateCode: SALES_ORDER_STATE.SHIPPED,
        source: 'system',
        discrepanciesAcknowledged: false,
        exchangeRate: '1',
      } as any);

      const invId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-FINDONE-001',
        salesOrderId: soId,
        totalAmount: '500',
        outstandingAmount: '500',
        taxAmount: '0',
        currencyCode: 'AUD',
        exchangeRate: '1',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        source: 'system',
      } as any);

      const payment = await service.createPaymentEntry(
        {
          paymentId: '00000000-0000-4000-8000-000000000001',
          paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
          partyId: customerId,
          paymentDate: new Date().toISOString(),
          modeOfPayment: 'EFT',
          totalAmount: 500,
          glAccountBank: bankAccountId,
          currencyCode: 'AUD',
        },
        'admin',
      );

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
      await service.submitPaymentEntry(payment.paymentId, 'admin');

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
    describe('Realized FX on Payments', () => {
      it('should calculate and book Realized FX Gain/Loss based on invoice rate vs payment rate', async () => {
        // Create dummy FX accounts
        const fxGainId = randomUUID();
        const fxLossId = randomUUID();
        await pg.db.insert(glAccounts).values([
          {
            glAccountId: fxGainId,
            accountCode: 'FX-GAIN-01',
            name: 'FX Gain',
            accountType: 'revenue',
            isGroup: false,
            isActive: true,
            currencyCode: 'AUD',
            isSystem: false,
            isBankAccount: false,
          },
          {
            glAccountId: fxLossId,
            accountCode: 'FX-LOSS-01',
            name: 'FX Loss',
            accountType: 'expense',
            isGroup: false,
            isActive: true,
            currencyCode: 'AUD',
            isSystem: false,
            isBankAccount: false,
          },
        ] as any);

        // Update GL settings
        await pg.db.update(glSettings).set({
          realisedFxGainAccountId: fxGainId,
          realisedFxLossAccountId: fxLossId,
        });

        // Setup exchange rates
        await pg.db
          .insert(exchangeRates)
          .values([
            {
              currencyCode: 'AUD',
              currencyName: 'Australian Dollar',
              effectiveDate: new Date('2020-01-01'),
              buyRate: '1.0',
              sellRate: '1.0',
            },
            {
              currencyCode: 'EUR',
              currencyName: 'Euro',
              effectiveDate: new Date('2020-01-01'),
              buyRate: '1.2',
              sellRate: '1.2',
            },
          ])
          .onConflictDoNothing();

        // Create a foreign currency sales invoice
        const soId = randomUUID();
        await pg.db.insert(salesOrders).values({
          salesOrderId: soId,
          orderNumber: 'SO-FX-TEST',
          customerId,
          currencyCode: 'EUR',
          exchangeRate: '1.1',
          fulfillmentLocationId: locationId,
          stateCode: SALES_ORDER_STATE.SHIPPED,
          source: 'system',
          discrepanciesAcknowledged: false,
        } as any);

        const invId = randomUUID();
        await pg.db.insert(salesInvoices).values({
          invoiceId: invId,
          invoiceNumber: 'INV-FX-001',
          salesOrderId: soId,
          totalAmount: '100', // 100 EUR
          outstandingAmount: '100', // 100 EUR
          taxAmount: '0',
          currencyCode: 'EUR',
          exchangeRate: '1.1', // 100 EUR = 110 AUD Base
          stateCode: SALES_INVOICE_STATE.INVOICED,
          source: 'system',
        } as any);

        // Create a payment at a different rate
        const paymentId = randomUUID();
        const payment = await service.createPaymentEntry(
          {
            paymentId,
            paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
            partyId: customerId,
            paymentDate: new Date().toISOString(),
            modeOfPayment: 'EFT',
            totalAmount: 100, // 100 EUR
            glAccountBank: bankAccountId,
            currencyCode: 'EUR',
          },
          'admin',
        );

        // Allocate the payment fully to the invoice
        await service.allocatePayment(
          payment.paymentId,
          {
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invId,
                allocatedAmount: 100,
              },
            ],
          },
          'admin',
        );

        // Submit payment
        await service.submitPaymentEntry(payment.paymentId, 'admin');

        // Check Journal lines for Realized FX Gain (Credit)
        // AR debited originally 110. Payment base is 120. AR cleared with 110.
        // 120 Base Bank - 110 Base AR = 10 Base Gain (Credit).
        const allEntries = await pg.db
          .select()
          .from(glJournalEntries)
          .where(eq(glJournalEntries.sourceId, payment.paymentId));
        expect(allEntries).toHaveLength(1);

        const allLines = await pg.db
          .select()
          .from(glJournalLines)
          .where(
            eq(glJournalLines.journalEntryId, allEntries[0].journalEntryId),
          );

        // We should have 3 lines: Bank, AR, and FX Gain
        expect(allLines).toHaveLength(3);

        const fxGainLine = allLines.find(
          (l) => Math.abs(parseFloat(l.credit) - 10) < 0.01,
        );
        expect(fxGainLine).toBeDefined();
        expect(fxGainLine!.memo).toContain('Realised FX Gain for');
      });
    });
  });
});
