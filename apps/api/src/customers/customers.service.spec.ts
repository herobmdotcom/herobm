import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  customers,
  masterDataEvents,
  customerGroups,
  taxPositions,
  salesOrders,
  salesInvoices,
  glJournalEntries,
  glJournalLines,
  glAccounts,
  actors,
} from '@herobm/db-schema';
import { sql } from 'drizzle-orm';
import {
  CUSTOMER_STATE,
  SALES_ORDER_STATE,
  SALES_INVOICE_STATE,
  ACTOR_STATE,
} from '@herobm/shared';

import { CreditAssessmentService } from './credit-assessment.service';
import { AppConfigService } from '../settings/app-config.service';

describe('CustomersService', () => {
  const pg = setupPgliteSuite();
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: CreditAssessmentService,
          useValue: {
            assessCreditBatch: jest.fn().mockResolvedValue({}),
            assessCredit: jest.fn().mockResolvedValue({
              glBalance: 0,
              totalInvoiceBalance: 0,
              overdueInvoiceBalance: 0,
              isOverdue: false,
            }),
          },
        },
        { provide: AppConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);

    // Clean tables
    await pg.db.delete(masterDataEvents);
    await pg.db.delete(customers);
    await pg.db.delete(customerGroups);
    await pg.db.delete(taxPositions);
  });

  describe('findAll', () => {
    it('should return paginated customers', async () => {
      const acts = await pg.db
        .insert(actors)
        .values([
          {
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Customer A',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          },
          {
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Customer B',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          },
        ])
        .returning();

      await pg.db.insert(customers).values([
        {
          actorId: acts[0].actorId,
          customerNumber: 'A1',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        },
        {
          actorId: acts[1].actorId,
          customerNumber: 'B1',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should apply search filter (ilike)', async () => {
      const acts = await pg.db
        .insert(actors)
        .values([
          {
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Acme Corp',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          },
          {
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Other Inc',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          },
        ])
        .returning();

      await pg.db.insert(customers).values([
        {
          actorId: acts[0].actorId,
          customerNumber: 'ACME',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        },
        {
          actorId: acts[1].actorId,
          customerNumber: 'OTHER',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        },
      ]);

      const result = await service.findAll({ q: 'acme' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Acme Corp');
    });

    it('should join with customer groups and tax positions', async () => {
      const [tc] = await pg.db
        .insert(taxPositions)
        .values({
          code: 'GST',
          title: 'GST',
        })
        .returning();

      const [ag] = await pg.db
        .insert(customerGroups)
        .values({
          name: 'VIP',
          groupCode: 'VIP01',
          isOnCreditHold: false,
          stateCode: CUSTOMER_STATE.DRAFT,
        })
        .returning();

      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'VIP Client',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(customers).values({
        actorId: act.actorId,
        customerNumber: 'VIP-001',
        currencyCode: 'AUD',
        customerGroupId: ag.customerGroupId,
        taxPositionId: tc.taxPositionId,
        stateCode: CUSTOMER_STATE.DRAFT,
        source: 'app',
        createdBy: 'system',
      });

      const result = await service.findAll();
      expect(result.data[0]).toMatchObject({
        customerGroupName: 'VIP',
        gstCategoryName: 'GST',
      });
    });

    it('should exclude archived customers by default', async () => {
      const acts = await pg.db
        .insert(actors)
        .values([
          {
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Active',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          },
          {
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Archived',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          },
        ])
        .returning();

      await pg.db.insert(customers).values([
        {
          actorId: acts[0].actorId,
          customerNumber: 'ACT',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        },
        {
          actorId: acts[1].actorId,
          customerNumber: 'ARC',
          currencyCode: 'USD',
          stateCode: CUSTOMER_STATE.ARCHIVED,
          source: 'app',
          createdBy: 'system',
        },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Active');

      const resultWithArchived = await service.findAll({
        includeArchived: true,
      });
      expect(resultWithArchived.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return customer by UUID with its events', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Main Customer',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId: act.actorId,
          customerNumber: 'MAIN',
          currencyCode: 'GBP',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      await pg.db.insert(masterDataEvents).values({
        entityType: 'customer',
        entityId: acc.customerId,
        eventType: 'created',
        payload: { created: true },
        actor: 'user',
      });

      const result = await service.findOne(acc.customerId);
      expect(result.name).toBe('Main Customer');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('created');
    });

    it('should return customer by sourceId (legacy)', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Legacy Customer',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(customers).values({
        actorId: act.actorId,
        customerNumber: 'LEG1',
        currencyCode: 'USD',
        sourceId: 'ABM-999',
        stateCode: CUSTOMER_STATE.DRAFT,
        source: 'app',
        createdBy: 'system',
      });

      const result = await service.findOne('ABM-999');
      expect(result.name).toBe('Legacy Customer');
    });

    it('should return customerGroupTaxPositionId when customer belongs to a group with a tax position', async () => {
      const [tp] = await pg.db
        .insert(taxPositions)
        .values({
          code: 'GST-POS',
          title: 'GST Tax Position',
        })
        .returning();

      const [ag] = await pg.db
        .insert(customerGroups)
        .values({
          name: 'Group with Tax Position',
          groupCode: 'GRP-TP',
          taxPositionId: tp.taxPositionId,
          isOnCreditHold: false,
          stateCode: CUSTOMER_STATE.ACTIVE,
        })
        .returning();

      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Group Customer',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: true,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId: act.actorId,
          customerNumber: 'GRP-CUST-1',
          currencyCode: 'AUD',
          customerGroupId: ag.customerGroupId,
          taxPositionId: null,
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const result = await service.findOne(acc.customerId);
      expect(result.customerGroupTaxPositionId).toBe(tp.taxPositionId);
    });

    it('should throw NotFoundException if not found', async () => {
      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAgedBalances', () => {
    it('should compute total outstanding, GL balance, discrepancy, and credit metrics', async () => {
      // 1. Seed Customer
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Balance Test Customer',
          headquartersAddressLine1: 'US',
          isTaxRegistered: false,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId: act.actorId,
          customerNumber: 'BAL1',
          currencyCode: 'USD',
          isOnCreditHold: true,
          creditLimit: '5000.00',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const locRes = await pg.db.execute(
        sql`SELECT location_id FROM herobm_core.locations WHERE code = 'MAIN' LIMIT 1`,
      );
      const locId = (locRes as any).rows
        ? (locRes as any).rows[0].location_id
        : (locRes as any)[0].location_id;

      // 2. Seed Sales Order
      const [so] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'SO-123',
          name: 'Test Order',
          customerId: acc.customerId,
          fulfillmentLocationId: locId,
          currencyCode: 'USD',
          stateCode: SALES_ORDER_STATE.DRAFT,
          baseTotalAmount: '0',
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      // 3. Seed Sales Invoices (AR)
      // One current invoice (100) and one overdue invoice (300)
      const now = new Date();
      const currentDue = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days future
      const overdueDue = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days past

      await pg.db.insert(salesInvoices).values([
        {
          invoiceNumber: 'INV-1',
          salesOrderId: so.salesOrderId,
          stateCode: SALES_INVOICE_STATE.INVOICED,
          outstandingAmount: '100.00',
          totalAmount: '100.00',
          currencyCode: 'USD',
          dueDate: currentDue,
          exchangeRate: '1',
          baseTotalAmount: '0',
          taxAmount: '0',
          baseOutstandingAmount: '0',
          createdBy: 'system',
        },
        {
          invoiceNumber: 'INV-2',
          salesOrderId: so.salesOrderId,
          stateCode: SALES_INVOICE_STATE.INVOICED,
          outstandingAmount: '300.00',
          totalAmount: '300.00',
          currencyCode: 'USD',
          dueDate: overdueDue,
          exchangeRate: '1',
          baseTotalAmount: '0',
          taxAmount: '0',
          baseOutstandingAmount: '0',
          createdBy: 'system',
        },
      ]);

      // 4. Seed GL Journal (GL)
      // Simulating a GL balance of 350.00 (discrepancy of 50.00 vs the 400.00 in AR)
      const [je] = await pg.db
        .insert(glJournalEntries)
        .values({
          entryNumber: 'JE-1',
          entryDate: new Date().toISOString().split('T')[0],
          sourceType: 'manual',
          isReversed: false,
          createdBy: 'system',
        })
        .returning();

      const [glAcc] = await pg.db
        .insert(glAccounts)
        .values({
          accountCode: '8888-AR',
          name: 'Test AR',
          accountType: 'asset',
          currencyCode: 'USD',
          isGroup: false,
          isSystem: false,
          isBankAccount: false,
          isActive: true,
        })
        .returning();

      await pg.db.insert(glJournalLines).values({
        journalEntryId: je.journalEntryId,
        glAccountId: glAcc.glAccountId,
        partyType: 'customer',
        partyId: acc.customerId,
        debit: '350.00',
        credit: '0.00',
        foreignDebit: '350.00',
        foreignCredit: '0.00',
        exchangeRate: '1',
        isReconciled: false,
      });

      // 5. Assert getAgedBalances
      const results = await service.getAgedBalances('dueDate');

      expect(results.data).toHaveLength(1);
      const row = results.data[0];
      expect(row.customerName).toBe('Balance Test Customer');
      expect(row.isOnCreditHold).toBe(true);
      expect(row.creditLimit).toBe('5000.00');

      // Totals
      expect(row.totalOutstanding).toBe(400); // 100 + 300
      expect(row.glBalance).toBe(350);
      expect(row.discrepancyAmount).toBe(50); // |400 - 350|

      // Buckets
      expect(row.current).toBe(100);
      expect(row.days31To60).toBe(300); // 40 days past
      expect(row.days1To30).toBe(0);
      expect(row.days61To90).toBe(0);
      expect(row.days90Plus).toBe(0);
    });
  });
});
