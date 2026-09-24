import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsBillingService } from './projects-billing.service';
import { SalesInvoiceService } from '../invoices/sales-invoice.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  projects,
  projectTasks,
  projectLedgerEntries,
  salesInvoices,
  salesInvoiceLines,
  customers,
  users,
} from '@herobm/db-schema';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import {
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
  PROJECT_TASK_STATE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_SOURCE_TYPE,
  SALES_INVOICE_STATE,
  CUSTOMER_STATE,
} from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('ProjectsBillingService', () => {
  let service: ProjectsBillingService;
  let mockSalesInvoiceService: Partial<SalesInvoiceService>;
  const pg = setupPgliteSuite({ skipSeeds: true });
  let mockUserId: string;
  let mockCustomerId: string;

  beforeEach(async () => {
    mockUserId = randomUUID();
    await pg.db.delete(salesInvoiceLines);
    await pg.db.delete(salesInvoices);
    await pg.db.delete(projectLedgerEntries);
    await pg.db.delete(projectTasks);
    await pg.db.delete(projects);
    await pg.db.delete(customers);
    await pg.db.delete(users);

    await pg.db.insert(users).values({
      userId: mockUserId,
      username: 'test_user',
      displayName: 'Test User',
      email: 'test@example.com',
      // eslint-disable-next-line no-restricted-syntax -- Mocking a test user password
      passwordHash: 'hash', // TEST_CREDENTIAL
      role: 'admin',
      isActive: true,
    });

    mockCustomerId = randomUUID();
    await pg.db.insert(customers).values({
      customerId: mockCustomerId,
      customerNumber: 'CUST-001',
      stateCode: CUSTOMER_STATE.ACTIVE,
      currencyCode: 'AUD',
      source: 'manual',
      createdBy: 'test_user',
    });

    mockSalesInvoiceService = {
      createProjectInvoice: jest
        .fn()
        .mockImplementation(async (project, dto, _actor) => {
          const invId = randomUUID();
          const invoiceLines = dto.lines.map((l: any) => ({
            invoiceLineId: randomUUID(),
            invoiceId: invId,
            description: l.description,
            quantityInvoiced: String(l.quantity),
            pricePerUnit: String(l.pricePerUnit),
            amount: String(l.amount),
            projectLedgerEntryId: l.projectLedgerEntryId || null,
          }));
          return {
            invoiceId: invId,
            invoiceNumber: 'INV-20260922-0001',
            projectId: project.projectId,
            salesOrderId: null,
            customerId: project.customerId,
            totalAmount: '550.00',
            taxAmount: '50.00',
            currencyCode: project.currencyCode,
            stateCode: SALES_INVOICE_STATE.INVOICED,
            lines: invoiceLines,
          };
        }),
      findByProject: jest.fn().mockImplementation(async (projectId: string) => {
        return [
          {
            invoiceId: randomUUID(),
            invoiceNumber: 'INV-20260922-0001',
            projectId,
            totalAmount: '550.00',
            stateCode: SALES_INVOICE_STATE.INVOICED,
          },
        ];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsBillingService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: SalesInvoiceService, useValue: mockSalesInvoiceService },
      ],
    }).compile();

    service = module.get<ProjectsBillingService>(ProjectsBillingService);
  });

  it('successfully bills unbilled Time & Materials project ledger entries', async () => {
    const [project] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-BILL-001',
        name: 'T&M Billing Project',
        customerId: mockCustomerId,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'AUD',
        createdBy: 'test_user',
      })
      .returning();

    const [task] = await pg.db
      .insert(projectTasks)
      .values({
        projectId: project.projectId,
        taskCode: '1.0',
        name: 'Development Task',
        stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
        isMilestone: false,
        isBillable: true,
        createdBy: 'test_user',
      })
      .returning();

    const [entry1] = await pg.db
      .insert(projectLedgerEntries)
      .values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.RESOURCE,
        sourceType: PROJECT_SOURCE_TYPE.TIMESHEET,
        description: '4 hours backend work',
        quantity: '4',
        unitCostBase: '50.00',
        totalCostBase: '200.00',
        unitPriceBase: '100.00',
        totalPriceBase: '400.00',
        isBillable: true,
        isBilled: false,
        postingDate: new Date(),
        createdBy: 'test_user',
      })
      .returning();

    const result = await service.billProject(
      project.projectId,
      {
        invoiceDate: '2026-09-22',
        notes: 'Monthly billing for September',
        lines: [
          {
            projectTaskId: task.projectTaskId,
            description: '4 hours backend work',
            quantity: 4,
            pricePerUnit: 100,
            amount: 400,
            projectLedgerEntryId: entry1.ledgerId,
          },
        ],
      },
      'test_user',
    );

    expect(result.invoiceNumber).toBe('INV-20260922-0001');
    expect(result.billedCount).toBe(1);
    expect(mockSalesInvoiceService.createProjectInvoice).toHaveBeenCalled();

    // Verify subledger entry is marked as billed and has salesInvoiceLineId
    const [updatedEntry] = await pg.db
      .select()
      .from(projectLedgerEntries)
      .where(eq(projectLedgerEntries.ledgerId, entry1.ledgerId));

    expect(updatedEntry.isBilled).toBe(true);
    expect(updatedEntry.salesInvoiceLineId).toBeDefined();
  });

  it('successfully bills Cost Plus project ledger entries with markup and updates ledger entry', async () => {
    const [project] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-COSTPLUS-001',
        name: 'Cost Plus Project',
        customerId: mockCustomerId,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.COST_PLUS,
        currencyCode: 'AUD',
        createdBy: 'test_user',
      })
      .returning();

    const [task] = await pg.db
      .insert(projectTasks)
      .values({
        projectId: project.projectId,
        taskCode: '1.0',
        name: 'Cost Plus Task',
        stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
        isMilestone: false,
        isBillable: true,
        createdBy: 'test_user',
      })
      .returning();

    const [costEntry] = await pg.db
      .insert(projectLedgerEntries)
      .values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.ITEM,
        sourceType: PROJECT_SOURCE_TYPE.INVENTORY_ISSUE,
        description: 'Direct Material Cost',
        quantity: '10',
        unitCostBase: '100.00',
        totalCostBase: '1000.00',
        unitPriceBase: '100.00',
        totalPriceBase: '1000.00',
        isBilled: false,
        isBillable: true,
        postingDate: new Date(),
        createdBy: 'test_user',
      })
      .returning();

    // Bill with 15% markup ($115 unit price, $1150 total)
    const result = await service.billProject(
      project.projectId,
      {
        invoiceDate: '2026-09-22',
        lines: [
          {
            projectTaskId: task.projectTaskId,
            description: 'Direct Material Cost (+15% Markup)',
            quantity: 10,
            pricePerUnit: 115,
            amount: 1150,
            projectLedgerEntryId: costEntry.ledgerId,
          },
        ],
      },
      'test_user',
    );

    expect(result.invoiceNumber).toBe('INV-20260922-0001');
    expect(result.billedCount).toBe(1);

    const [updatedCostEntry] = await pg.db
      .select()
      .from(projectLedgerEntries)
      .where(eq(projectLedgerEntries.ledgerId, costEntry.ledgerId));

    expect(updatedCostEntry.isBilled).toBe(true);
    expect(updatedCostEntry.salesInvoiceLineId).toBeDefined();
  });

  it('successfully bills milestone / fixed-price progress drawdown', async () => {
    const [project] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-BILL-002',
        name: 'Milestone Project',
        customerId: mockCustomerId,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.MILESTONE,
        currencyCode: 'AUD',
        createdBy: 'test_user',
      })
      .returning();

    const [milestoneTask] = await pg.db
      .insert(projectTasks)
      .values({
        projectId: project.projectId,
        taskCode: '2.0',
        name: 'Phase 1 Delivery Milestone',
        stateCode: PROJECT_TASK_STATE.COMPLETED,
        isMilestone: true,
        isBillable: true,
        createdBy: 'test_user',
      })
      .returning();

    const result = await service.billProject(
      project.projectId,
      {
        invoiceDate: '2026-09-22',
        lines: [
          {
            projectTaskId: milestoneTask.projectTaskId,
            description: 'Phase 1 Delivery Milestone Completion',
            quantity: 1,
            pricePerUnit: 5000,
            amount: 5000,
          },
        ],
      },
      'test_user',
    );

    expect(result.invoiceNumber).toBe('INV-20260922-0001');
    expect(result.billedCount).toBe(1);

    // Verify a SALE ledger entry was created on the milestone task
    const saleEntries = await pg.db
      .select()
      .from(projectLedgerEntries)
      .where(eq(projectLedgerEntries.projectId, project.projectId));

    expect(saleEntries.length).toBe(1);
    expect(saleEntries[0].entryType).toBe(PROJECT_LEDGER_ENTRY_TYPE.SALE);
    expect(saleEntries[0].isBilled).toBe(true);
    expect(Number(saleEntries[0].totalPriceBase)).toBe(5000);
  });

  it('rejects billing when project is closed', async () => {
    const [project] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-BILL-003',
        name: 'Closed Project',
        customerId: mockCustomerId,
        stateCode: PROJECT_STATE.CLOSED,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'AUD',
        createdBy: 'test_user',
      })
      .returning();

    await expect(
      service.billProject(
        project.projectId,
        {
          lines: [
            {
              projectTaskId: randomUUID(),
              description: 'Item',
              quantity: 1,
              pricePerUnit: 100,
              amount: 100,
            },
          ],
        },
        'test_user',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects billing when project is not found', async () => {
    await expect(
      service.billProject(
        randomUUID(),
        {
          lines: [
            {
              projectTaskId: randomUUID(),
              description: 'Item',
              quantity: 1,
              pricePerUnit: 100,
              amount: 100,
            },
          ],
        },
        'test_user',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects billing when lines array is empty', async () => {
    const [project] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-BILL-004',
        name: 'Active Project',
        customerId: mockCustomerId,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'AUD',
        createdBy: 'test_user',
      })
      .returning();

    await expect(
      service.billProject(project.projectId, { lines: [] }, 'test_user'),
    ).rejects.toThrow(BadRequestException);
  });

  it('retrieves project invoices using getProjectInvoices', async () => {
    const [project] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-BILL-005',
        name: 'Invoiced Project',
        customerId: mockCustomerId,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'AUD',
        createdBy: 'test_user',
      })
      .returning();

    const invoices = await service.getProjectInvoices(project.projectId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].projectId).toBe(project.projectId);
    expect(mockSalesInvoiceService.findByProject).toHaveBeenCalledWith(
      project.projectId,
    );
  });

  it('throws NotFoundException when retrieving invoices for non-existent project', async () => {
    await expect(service.getProjectInvoices(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('unbillProjectInvoice', () => {
    it('reverts billed Time & Materials project ledger entries back to unbilled', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          projectNumber: 'PRJ-UNBILL-001',
          name: 'Unbill T&M Project',
          customerId: mockCustomerId,
          stateCode: PROJECT_STATE.ACTIVE,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
          createdBy: 'test_user',
        })
        .returning();

      const [task] = await pg.db
        .insert(projectTasks)
        .values({
          projectId: project.projectId,
          taskCode: '1.0',
          name: 'Development Task',
          stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
          isMilestone: false,
          isBillable: true,
          createdBy: 'test_user',
        })
        .returning();

      const invId = randomUUID();
      const invLineId1 = randomUUID();
      const invLineId2 = randomUUID();

      const [inv] = await pg.db
        .insert(salesInvoices)
        .values({
          invoiceId: invId,
          invoiceNumber: 'INV-20260923-0001',
          projectId: project.projectId,
          customerId: mockCustomerId,
          totalAmount: '450.00',
          outstandingAmount: '450.00',
          taxAmount: '0.00',
          baseTotalAmount: '450.00',
          baseOutstandingAmount: '450.00',
          currencyCode: 'AUD',
          exchangeRate: '1.000000',
          stateCode: SALES_INVOICE_STATE.INVOICED,
          createdBy: 'test_user',
        })
        .returning();

      const [entry1] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          sourceType: PROJECT_SOURCE_TYPE.TIMESHEET,
          description: 'Consulting Hours 1',
          quantity: '2',
          unitCostBase: '50.00',
          totalCostBase: '100.00',
          unitPriceBase: '100.00',
          totalPriceBase: '200.00',
          isBillable: true,
          isBilled: true,
          salesInvoiceLineId: invLineId1,
          postingDate: new Date(),
          createdBy: 'test_user',
        })
        .returning();

      const [entry2] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          sourceType: PROJECT_SOURCE_TYPE.TIMESHEET,
          description: 'Consulting Hours 2',
          quantity: '2.5',
          unitCostBase: '50.00',
          totalCostBase: '125.00',
          unitPriceBase: '100.00',
          totalPriceBase: '250.00',
          isBillable: true,
          isBilled: true,
          salesInvoiceLineId: invLineId2,
          postingDate: new Date(),
          createdBy: 'test_user',
        })
        .returning();

      await pg.db.execute(sql`
        INSERT INTO herobm_core.sales_invoice_lines (invoice_line_id, invoice_id, project_ledger_entry_id, description, quantity_invoiced, price_per_unit, amount, discount_percentage, tax_amount)
        VALUES (${invLineId1}, ${invId}, ${entry1.ledgerId}, 'Consulting Hours 1', 2, 100.00, 200.00, 0, 0),
               (${invLineId2}, ${invId}, ${entry2.ledgerId}, 'Consulting Hours 2', 2.5, 100.00, 250.00, 0, 0)
      `);

      const result = await service.unbillProjectInvoice(invId, 'test_user');
      expect(result.unbilledCount).toBe(2);
      expect(result.removedSaleCount).toBe(0);

      const [updated1] = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.ledgerId, entry1.ledgerId));
      expect(updated1.isBilled).toBe(false);
      expect(updated1.salesInvoiceLineId).toBeNull();

      const [updated2] = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.ledgerId, entry2.ledgerId));
      expect(updated2.isBilled).toBe(false);
      expect(updated2.salesInvoiceLineId).toBeNull();
    });

    it('deletes synthetic milestone/fixed-price sale entries upon unbilling', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          projectNumber: 'PRJ-UNBILL-002',
          name: 'Unbill Milestone Project',
          customerId: mockCustomerId,
          stateCode: PROJECT_STATE.ACTIVE,
          billingType: PROJECT_BILLING_TYPE.MILESTONE,
          currencyCode: 'AUD',
          createdBy: 'test_user',
        })
        .returning();

      const [task] = await pg.db
        .insert(projectTasks)
        .values({
          projectId: project.projectId,
          taskCode: '1.0',
          name: 'Milestone 1',
          stateCode: PROJECT_TASK_STATE.COMPLETED,
          isMilestone: true,
          isBillable: true,
          createdBy: 'test_user',
        })
        .returning();

      const invId = randomUUID();
      const invLineId = randomUUID();

      await pg.db.insert(salesInvoices).values({
        invoiceId: invId,
        invoiceNumber: 'INV-20260923-0002',
        projectId: project.projectId,
        customerId: mockCustomerId,
        totalAmount: '1000.00',
        outstandingAmount: '1000.00',
        taxAmount: '0.00',
        baseTotalAmount: '1000.00',
        baseOutstandingAmount: '1000.00',
        currencyCode: 'AUD',
        exchangeRate: '1.000000',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        createdBy: 'test_user',
      });

      const [saleEntry] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.SALE,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          sourceType: PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
          description: 'Milestone 1 Completion Billing',
          quantity: '1',
          unitCostBase: '0.00',
          totalCostBase: '0.00',
          unitPriceBase: '1000.00',
          totalPriceBase: '1000.00',
          isBillable: true,
          isBilled: true,
          salesInvoiceLineId: invLineId,
          postingDate: new Date(),
          createdBy: 'test_user',
        })
        .returning();

      await pg.db.execute(sql`
        INSERT INTO herobm_core.sales_invoice_lines (invoice_line_id, invoice_id, description, quantity_invoiced, price_per_unit, amount, discount_percentage, tax_amount)
        VALUES (${invLineId}, ${invId}, 'Milestone 1 Completion Billing', 1, 1000.00, 1000.00, 0, 0)
      `);

      const result = await service.unbillProjectInvoice(invId, 'test_user');
      expect(result.unbilledCount).toBe(0);
      expect(result.removedSaleCount).toBe(1);

      const entries = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.ledgerId, saleEntry.ledgerId));
      expect(entries).toHaveLength(0);
    });

    it('handles non-project invoice or invoice with no linked entries gracefully', async () => {
      const nonLinkedInvId = randomUUID();
      const result = await service.unbillProjectInvoice(
        nonLinkedInvId,
        'test_user',
      );
      expect(result.unbilledCount).toBe(0);
      expect(result.removedSaleCount).toBe(0);
    });
  });
});
