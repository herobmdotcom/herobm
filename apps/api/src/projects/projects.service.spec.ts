import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { ProjectsResourcesService } from './projects-resources.service';
import { ProjectsInventoryService } from './projects-inventory.service';
import { ProjectsTasksService } from './projects-tasks.service';
import { ProjectsBudgetService } from './projects-budget.service';
import { ProjectsLedgerService } from './projects-ledger.service';
import { ProjectsNotesService } from './projects-notes.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  projects,
  projectTasks,
  projectResources,
  projectResourceAssignments,
  projectBudgetLines,
  projectLedgerEntries,
  projectNotes,
  customers,
  opportunities,
  users,
  suppliers,
  productSuppliers,
  products,
  inventoryEntries,
  inventoryLedger,
  binContents,
  bins,
  zones,
  locations,
  uomDictionary,
  salesInvoices,
  salesInvoiceLines,
} from '@herobm/db-schema';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import {
  PROJECT_STATE,
  PROJECT_RESOURCE_STATE,
  PROJECT_TASK_STATE,
  PROJECT_BILLING_TYPE,
  RESOURCE_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_SOURCE_TYPE,
  CUSTOMER_STATE,
  SUPPLIER_STATE,
  OPPORTUNITY_STATE,
  PRODUCT_STATE,
  BIN_TYPE,
  SALES_INVOICE_STATE,
} from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { UomService } from '../inventory/uom.service';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { WorkOrdersWriteService } from '../manufacturing/work-orders-write.service';
import { BackordersService } from '../orders/backorders.service';
import { ReturnsWriteService } from '../orders/returns-write.service';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.setTimeout(60000);

describe('ProjectsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ProjectsService;
  let tasksService: ProjectsTasksService;
  let resourcesService: ProjectsResourcesService;
  let budgetService: ProjectsBudgetService;
  let inventoryService: ProjectsInventoryService;
  let ledgerService: ProjectsLedgerService;
  let notesService: ProjectsNotesService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';
  let mockCustomerId: string;
  let mockOpportunityId: string;
  let mockLocationId: string;
  let mockZoneId: string;
  let mockBinId: string;
  let mockProjectBinId: string;
  let mockOtherLocationId: string;
  let mockOtherZoneId: string;
  let mockOtherProjectBinId: string;
  let mockProductId: string;

  beforeEach(async () => {
    // Clear project tables in FK order
    await pg.db.delete(projectNotes);
    await pg.db.delete(projectLedgerEntries);
    await pg.db.delete(projectBudgetLines);
    await pg.db.delete(projectResourceAssignments);
    await pg.db.delete(projectTasks);
    await pg.db.delete(projectResources);
    await pg.db.delete(projects);
    await pg.db.delete(binContents);
    await pg.db.delete(inventoryLedger);
    await pg.db.delete(inventoryEntries);
    await pg.db.delete(bins);
    await pg.db.delete(zones);
    await pg.db.delete(locations);
    await pg.db.delete(productSuppliers);
    await pg.db.delete(products);
    await pg.db.delete(suppliers);
    await pg.db.delete(uomDictionary);
    await pg.db.delete(opportunities);
    await pg.db.delete(customers);
    await pg.db.delete(users);

    // Setup base mock data
    await pg.db
      .insert(users)
      .values({
        userId: mockUserId,
        username: 'admin',
        // eslint-disable-next-line no-restricted-syntax -- Mocking a test user password
        passwordHash: 'hash',
        role: 'admin',
        displayName: 'Admin User',
        email: 'admin@example.com',
        isActive: true,
      })
      .onConflictDoNothing();

    mockCustomerId = randomUUID();
    await pg.db.insert(customers).values({
      customerId: mockCustomerId,
      customerNumber: 'CUST-001',
      stateCode: CUSTOMER_STATE.ACTIVE,
      currencyCode: 'AUD',
      source: 'manual',
    });

    mockOpportunityId = randomUUID();
    await pg.db.insert(opportunities).values({
      opportunityId: mockOpportunityId,
      name: 'Server Overhaul Opportunity',
      stateCode: OPPORTUNITY_STATE.ACTIVE,
      status: 'won',
      type: 'consulting',
      currencyCode: 'AUD',
      estimatedValue: '50000.00',
    });

    await pg.db.insert(uomDictionary).values({
      uomCode: 'HOUR',
      description: 'Hours',
      category: 'service',
    });

    await pg.db.insert(uomDictionary).values({
      uomCode: 'EA',
      description: 'Each',
      category: 'goods',
    });

    await pg.db.insert(uomDictionary).values({
      uomCode: 'DAY',
      description: 'Days',
      category: 'service',
    });

    mockProductId = randomUUID();
    await pg.db.insert(products).values({
      productId: mockProductId,
      productNumber: 'PROD-CABLE-01',
      name: 'Cat6 Cable 50m Roll',
      productType: 'inventory',
      structureType: 'standard',
      stateCode: PRODUCT_STATE.ACTIVE,
      source: 'manual',
      baseUom: 'EA',
      standardCost: '50.00',
      listPrice: '90.00',
    });

    mockLocationId = randomUUID();
    await pg.db.insert(locations).values({
      locationId: mockLocationId,
      code: 'SYD-WH1',
      name: 'Sydney Main Warehouse',
      source: 'manual',
    });

    mockZoneId = randomUUID();
    await pg.db.insert(zones).values({
      zoneId: mockZoneId,
      locationId: mockLocationId,
      code: 'ZONE-A',
      name: 'Zone A',
      source: 'manual',
    });

    mockBinId = randomUUID();
    await pg.db.insert(bins).values({
      binId: mockBinId,
      binNumber: 'BIN-A-01',
      zoneId: mockZoneId,
      binType: 'storage',
      source: 'manual',
    });

    mockProjectBinId = randomUUID();
    await pg.db.insert(bins).values({
      binId: mockProjectBinId,
      binNumber: 'BIN-PROJ-01',
      zoneId: mockZoneId,
      binType: BIN_TYPE.PROJECT,
      source: 'manual',
    });

    mockOtherLocationId = randomUUID();
    await pg.db.insert(locations).values({
      locationId: mockOtherLocationId,
      code: 'MEL-WH1',
      name: 'Melbourne Warehouse',
      source: 'manual',
    });

    mockOtherZoneId = randomUUID();
    await pg.db.insert(zones).values({
      zoneId: mockOtherZoneId,
      locationId: mockOtherLocationId,
      code: 'ZONE-B',
      name: 'Zone B',
      source: 'manual',
    });

    mockOtherProjectBinId = randomUUID();
    await pg.db.insert(bins).values({
      binId: mockOtherProjectBinId,
      binNumber: 'BIN-PROJ-02',
      zoneId: mockOtherZoneId,
      binType: BIN_TYPE.PROJECT,
      source: 'manual',
    });

    // Seed initial stock in bin (100 units)
    await pg.db.insert(binContents).values({
      binId: mockBinId,
      productId: mockProductId,
      actualQuantity: '100',
    });

    // Seed initial stock in project bin (100 units)
    await pg.db.insert(binContents).values({
      binId: mockProjectBinId,
      productId: mockProductId,
      actualQuantity: '100',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        ProjectsResourcesService,
        ProjectsInventoryService,
        ProjectsTasksService,
        ProjectsBudgetService,
        ProjectsLedgerService,
        ProjectsNotesService,
        InventoryMovementService,
        UomService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
        {
          provide: AppConfigService,
          useValue: {
            valuationMethod: jest.fn().mockReturnValue('standard'),
            inventoryAccountingMode: jest.fn().mockReturnValue('perpetual'),
            defaultInventoryAccountId: jest.fn().mockReturnValue(null),
            defaultGrniAccountId: jest.fn().mockReturnValue(null),
            defaultCogsAccountId: jest.fn().mockReturnValue(null),
            defaultShrinkageAccountId: jest.fn().mockReturnValue(null),
            defaultPpvAccountId: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: GlService,
          useValue: {
            postJournalEntry: jest
              .fn()
              .mockResolvedValue({ journalEntryId: 'je-001' }),
          },
        },
        {
          provide: WorkOrdersWriteService,
          useValue: {
            updatePutawayStatus: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BackordersService,
          useValue: {
            fulfillWorkOrderDemand: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReturnsWriteService,
          useValue: {
            updateReturnLinePutawayStatus: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    tasksService = module.get<ProjectsTasksService>(ProjectsTasksService);
    resourcesService = module.get<ProjectsResourcesService>(
      ProjectsResourcesService,
    );
    budgetService = module.get<ProjectsBudgetService>(ProjectsBudgetService);
    inventoryService = module.get<ProjectsInventoryService>(
      ProjectsInventoryService,
    );
    ledgerService = module.get<ProjectsLedgerService>(ProjectsLedgerService);
    notesService = module.get<ProjectsNotesService>(ProjectsNotesService);
  });

  describe('Project Creation & Querying', () => {
    it('should create a project in draft state with generated projectNumber', async () => {
      const res = await service.createProject(
        {
          name: 'ACME Network Installation',
          description: 'Turnkey network deployment for office',
          customerId: mockCustomerId,
          opportunityId: mockOpportunityId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
          projectManagerId: mockUserId,
        },
        'admin',
      );

      expect(res).toBeDefined();
      expect(res.name).toBe('ACME Network Installation');
      expect(res.projectNumber).toMatch(/^PRJ-\d{8}-[A-Z0-9]{4}$/);
      expect(res.stateCode).toBe(PROJECT_STATE.DRAFT);
      expect(res.billingType).toBe(PROJECT_BILLING_TYPE.TIME_AND_MATERIALS);
      expect(res.customerId).toBe(mockCustomerId);
      expect(res.opportunityId).toBe(mockOpportunityId);
    });

    it('should find all projects with pagination and filters', async () => {
      const p1 = await service.createProject(
        {
          name: 'Project Alpha',
          projectNumber: 'PRJ-ALPHA-01',
          description: 'High priority alpha rollout',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.FIXED_PRICE,
          currencyCode: 'AUD',
          projectManagerId: mockUserId,
        },
        'admin',
      );

      await service.createProject(
        {
          name: 'Project Beta',
          projectNumber: 'PRJ-BETA-02',
          description: 'Secondary beta project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const paginated = await service.findAll({ page: 1, limit: 10 });
      expect(paginated.total).toBe(2);
      expect(paginated.data.length).toBe(2);

      // Search by term q
      const searchRes = await service.findAll({ q: 'alpha' });
      expect(searchRes.total).toBe(1);
      expect(searchRes.data[0].projectId).toBe(p1.projectId);

      // Filter by customerId
      const custRes = await service.findAll({ customerId: mockCustomerId });
      expect(custRes.total).toBe(2);

      // Filter by stateCode
      const stateRes = await service.findAll({
        stateCode: PROJECT_STATE.DRAFT,
      });
      expect(stateRes.total).toBe(2);

      // Filter by status alias
      const statusRes = await service.findAll({ status: PROJECT_STATE.DRAFT });
      expect(statusRes.total).toBe(2);

      // Filter by projectManagerId
      const pmRes = await service.findAll({ projectManagerId: mockUserId });
      expect(pmRes.total).toBe(1);
    });

    it('should update project header fields', async () => {
      const p = await service.createProject(
        {
          name: 'Original Name',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const updated = await service.updateProject(
        p.projectId,
        {
          name: 'Renamed Project',
          description: 'Updated Scope',
          billingType: PROJECT_BILLING_TYPE.FIXED_PRICE,
          notes: 'Updated project notes',
          startDate: '2026-10-01T00:00:00.000Z',
          targetEndDate: '2026-12-31T00:00:00.000Z',
        },
        'admin',
      );

      expect(updated.name).toBe('Renamed Project');
      expect(updated.description).toBe('Updated Scope');
      expect(updated.billingType).toBe(PROJECT_BILLING_TYPE.FIXED_PRICE);
      expect(updated.notes).toBe('Updated project notes');
    });

    it('should throw NotFoundException when project does not exist', async () => {
      await expect(service.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Project Lifecycle & State Transitions', () => {
    it('should allow valid transitions (DRAFT -> PLANNING -> IN_PROGRESS)', async () => {
      const project = await service.createProject(
        {
          name: 'Deployment Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      // Transition to ACTIVE
      const active = await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );
      expect(active.stateCode).toBe(PROJECT_STATE.ACTIVE);

      // Transition to CLOSED
      const closed = await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.CLOSED },
        'admin',
      );
      expect(closed.stateCode).toBe(PROJECT_STATE.CLOSED);
      expect(closed.actualEndDate).toBeDefined();

      // Reopen to ACTIVE
      const reopened = await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );
      expect(reopened.stateCode).toBe(PROJECT_STATE.ACTIVE);
    });

    it('should reject invalid state transitions', async () => {
      const project = await service.createProject(
        {
          name: 'Strict State Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      // Transition to ACTIVE
      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      // Cannot transition from ACTIVE to DRAFT
      await expect(
        service.transitionState(
          project.projectId,
          { stateCode: PROJECT_STATE.DRAFT },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set actualEndDate when transitioning to CLOSED', async () => {
      const project = await service.createProject(
        {
          name: 'End Date Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      const closed = await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.CLOSED },
        'admin',
      );
      expect(closed.actualEndDate).toBeDefined();
    });
  });

  describe('WBS Task Management', () => {
    it('should create tasks and subtasks for a project', async () => {
      const project = await service.createProject(
        {
          name: 'Engineering Job',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const phase1 = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Phase 1: Discovery & Planning',
          isMilestone: false,
          isBillable: true,
        },
        'admin',
      );

      expect(phase1.projectTaskId).toBeDefined();
      expect(phase1.stateCode).toBe(PROJECT_TASK_STATE.NOT_STARTED);

      const subtask = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.1',
          name: 'Site Survey',
          parentTaskId: phase1.projectTaskId,
          isMilestone: true,
          isBillable: true,
        },
        'admin',
      );

      expect(subtask.parentTaskId).toBe(phase1.projectTaskId);

      // Attempting to start task while project is in DRAFT should throw BadRequestException
      await expect(
        tasksService.updateTask(
          subtask.projectTaskId,
          { stateCode: PROJECT_TASK_STATE.IN_PROGRESS },
          'admin',
        ),
      ).rejects.toThrow('Cannot start a task unless the project is active');

      // Activate project first
      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      // Update task state once active
      const updatedSubtask = await tasksService.updateTask(
        subtask.projectTaskId,
        {
          taskCode: '1.1-A',
          name: 'Site Survey Revised',
          description: 'Detailed survey notes',
          stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
          plannedStartDate: '2026-10-01T00:00:00.000Z',
          plannedEndDate: '2026-10-05T00:00:00.000Z',
          isMilestone: false,
          isBillable: true,
        },
        'admin',
      );
      expect(updatedSubtask.stateCode).toBe(PROJECT_TASK_STATE.IN_PROGRESS);
      expect(updatedSubtask.taskCode).toBe('1.1-A');
    });

    it('should throw NotFoundException on non-existent task update', async () => {
      await expect(
        tasksService.updateTask(randomUUID(), { name: 'Foo' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on invalid task state transition', async () => {
      const project = await service.createProject(
        {
          name: 'Task State Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Task' },
        'admin',
      );

      // Cannot jump from NOT_STARTED to COMPLETED directly
      await expect(
        tasksService.updateTask(
          task.projectTaskId,
          { stateCode: PROJECT_TASK_STATE.COMPLETED },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete unreferenced tasks and reject deletion if child tasks or budget lines exist', async () => {
      const project = await service.createProject(
        {
          name: 'Task Delete Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const parentTask = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Parent Task' },
        'admin',
      );

      const childTask = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.1',
          name: 'Child Task',
          parentTaskId: parentTask.projectTaskId,
        },
        'admin',
      );

      // Cannot delete parent while child exists
      await expect(
        tasksService.deleteTask(
          project.projectId,
          parentTask.projectTaskId,
          'admin',
        ),
      ).rejects.toThrow('Cannot delete a task that has child subtasks');

      // Add a budget line to child task
      const budgetLine = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: childTask.projectTaskId,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          description: 'Travel expenses',
          plannedQuantity: 1,
          unitCost: 200,
          unitPrice: 250,
        },
        'admin',
      );

      // Cannot delete child while budget line exists
      await expect(
        tasksService.deleteTask(
          project.projectId,
          childTask.projectTaskId,
          'admin',
        ),
      ).rejects.toThrow(
        'Cannot delete a task that has budget line allocations',
      );

      // Delete budget line first
      const deleteBudgetRes = await budgetService.deleteBudgetLine(
        project.projectId,
        budgetLine.budgetLineId,
        'admin',
      );
      expect(deleteBudgetRes.deleted).toBe(true);

      // Now delete child task
      const deleteChildRes = await tasksService.deleteTask(
        project.projectId,
        childTask.projectTaskId,
        'admin',
      );
      expect(deleteChildRes.deleted).toBe(true);

      // Now delete parent task
      const deleteParentRes = await tasksService.deleteTask(
        project.projectId,
        parentTask.projectTaskId,
        'admin',
      );
      expect(deleteParentRes.deleted).toBe(true);
    });

    it('should complete task without auto-posting, allowing explicit actuals logging until project closed', async () => {
      const project = await service.createProject(
        {
          name: 'Task Completion Operational Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Senior Systems Architect',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 120,
          unitPrice: 200,
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Architecture Design' },
        'admin',
      );

      // Allocate 10 hours of Senior Systems Architect
      await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          resourceId: resource.resourceId,
          plannedQuantity: 10,
          unitCost: 120,
          unitPrice: 200,
          description: 'Architecture Design Sessions',
        },
        'admin',
      );

      // Start task
      await tasksService.updateTask(
        task.projectTaskId,
        { stateCode: PROJECT_TASK_STATE.IN_PROGRESS },
        'admin',
      );

      // Verify no ledger entries yet
      const preLedger = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.projectTaskId, task.projectTaskId));
      expect(preLedger.length).toBe(0);

      // Complete task
      const completedTask = await tasksService.updateTask(
        task.projectTaskId,
        { stateCode: PROJECT_TASK_STATE.COMPLETED },
        'admin',
      );

      expect(completedTask.stateCode).toBe(PROJECT_TASK_STATE.COMPLETED);
      expect(completedTask.actualEndDate).toBeDefined();

      // Verify NO auto-posted ledger entries were created
      const postLedger = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.projectTaskId, task.projectTaskId));
      expect(postLedger.length).toBe(0);

      // Explicit trailing resource consumption on completed task is supported while project is active
      const loggedUsage = await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          quantity: 8,
          unitCost: 120,
          unitPrice: 200,
          description: 'Actual architecture hours worked',
        },
        'admin',
      );
      expect(loggedUsage.quantity).toBe('8');

      const ledgerAfterConsumption = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.projectTaskId, task.projectTaskId));
      expect(ledgerAfterConsumption.length).toBe(1);
      expect(Number(ledgerAfterConsumption[0].quantity)).toBe(8);
      expect(Number(ledgerAfterConsumption[0].totalCostBase)).toBe(960);
      expect(Number(ledgerAfterConsumption[0].totalPriceBase)).toBe(1600);

      // Profitability reflects explicit actuals
      const profitability = await inventoryService.getProfitability(
        project.projectId,
      );
      expect(profitability.laborActualCost).toBe(960);
      expect(profitability.totalActualCost).toBe(960);
      expect(profitability.totalBillablePrice).toBe(1600);
    });

    it('should reject editing completed tasks', async () => {
      const project = await service.createProject(
        {
          name: 'Immutable Completed Task Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Task to Complete' },
        'admin',
      );

      await tasksService.updateTask(
        task.projectTaskId,
        { stateCode: PROJECT_TASK_STATE.IN_PROGRESS },
        'admin',
      );

      await tasksService.updateTask(
        task.projectTaskId,
        { stateCode: PROJECT_TASK_STATE.COMPLETED },
        'admin',
      );

      // Attempting to edit name or anything else must throw BadRequestException
      await expect(
        tasksService.updateTask(
          task.projectTaskId,
          { name: 'Renamed Task' },
          'admin',
        ),
      ).rejects.toThrow(
        'Completed tasks are finalized and cannot be modified.',
      );

      // Attempting to delete completed task must throw BadRequestException
      await expect(
        tasksService.deleteTask(project.projectId, task.projectTaskId, 'admin'),
      ).rejects.toThrow('Completed tasks cannot be deleted.');
    });

    it('should reject deleting tasks that have WIP (material or resource ledger entries)', async () => {
      const project = await service.createProject(
        {
          name: 'Task WIP Deletion Protection Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Cable Installation' },
        'admin',
      );

      // Issue material to task
      await inventoryService.issueInventoryToProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          locationId: mockLocationId,
          binId: mockBinId,
          quantity: 2,
        },
        'admin',
      );

      // Attempting to delete task with WIP must throw BadRequestException
      await expect(
        tasksService.deleteTask(project.projectId, task.projectTaskId, 'admin'),
      ).rejects.toThrow(
        'Cannot delete a task with posted actual ledger transactions.',
      );
    });
  });

  describe('Project Budget Lines Management', () => {
    it('should create, update, and delete budget lines with calculated totals', async () => {
      const project = await service.createProject(
        {
          name: 'Budget Test Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Dev Task' },
        'admin',
      );

      // Create budget line
      const created = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          description: 'Initial Travel',
          plannedQuantity: 2,
          unitCost: 100,
          unitPrice: 150,
        },
        'admin',
      );

      expect(Number(created.totalCost)).toBe(200);
      expect(Number(created.totalPrice)).toBe(300);

      // Update budget line
      const updated = await budgetService.updateBudgetLine(
        project.projectId,
        created.budgetLineId,
        {
          description: 'Updated Flight & Hotel',
          plannedQuantity: 4,
          unitCost: 120,
          unitPrice: 180,
        },
        'admin',
      );

      expect(updated.description).toBe('Updated Flight & Hotel');
      expect(Number(updated.plannedQuantity)).toBe(4);
      expect(Number(updated.unitCost)).toBe(120);
      expect(Number(updated.totalCost)).toBe(480);
      expect(Number(updated.unitPrice)).toBe(180);
      expect(Number(updated.totalPrice)).toBe(720);

      // Delete budget line
      const deleted = await budgetService.deleteBudgetLine(
        project.projectId,
        created.budgetLineId,
        'admin',
      );
      expect(deleted.deleted).toBe(true);

      // Updating deleted or non-existent budget line should throw NotFoundException
      await expect(
        budgetService.updateBudgetLine(
          project.projectId,
          created.budgetLineId,
          { description: 'Foo' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject adding, modifying, or deleting budget lines on completed tasks', async () => {
      const project = await service.createProject(
        {
          name: 'Budget Line Completed Task Protection Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.ACTIVE },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Completed Task' },
        'admin',
      );

      const bLine = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          description: 'Consulting fees',
          plannedQuantity: 1,
          unitCost: 500,
          unitPrice: 800,
        },
        'admin',
      );

      await tasksService.updateTask(
        task.projectTaskId,
        { stateCode: PROJECT_TASK_STATE.IN_PROGRESS },
        'admin',
      );

      await tasksService.updateTask(
        task.projectTaskId,
        { stateCode: PROJECT_TASK_STATE.COMPLETED },
        'admin',
      );

      // Attempt to add new budget line
      await expect(
        budgetService.createBudgetLine(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            lineType: PROJECT_LINE_TYPE.EXPENSE,
            description: 'Extra fee',
            plannedQuantity: 1,
            unitCost: 100,
            unitPrice: 150,
          },
          'admin',
        ),
      ).rejects.toThrow('Cannot add budget allocations to a completed task.');

      // Attempt to update budget line
      await expect(
        budgetService.updateBudgetLine(
          project.projectId,
          bLine.budgetLineId,
          { unitPrice: 900 },
          'admin',
        ),
      ).rejects.toThrow(
        'Cannot modify budget allocations on a completed task.',
      );

      // Attempt to delete budget line
      await expect(
        budgetService.deleteBudgetLine(
          project.projectId,
          bLine.budgetLineId,
          'admin',
        ),
      ).rejects.toThrow(
        'Cannot delete budget allocations on a completed task.',
      );
    });
  });

  describe('Project Resources & Rate Cards', () => {
    it('should create labor profiles, contractors, and equipment rate cards', async () => {
      const resource = await resourcesService.createResource(
        {
          name: 'Senior Systems Architect',
          resourceType: RESOURCE_TYPE.PERSON,
          userId: mockUserId,
          baseUom: 'HOUR',
          directUnitCost: 95.0,
          unitPrice: 190.0,
          isActive: true,
        },
        'admin',
      );

      expect(resource.resourceId).toBeDefined();
      expect(resource.resourceNumber).toMatch(/^RES-[A-Z0-9]{4}$/);
      expect(Number(resource.directUnitCost)).toBe(95.0);
      expect(Number(resource.unitPrice)).toBe(190.0);
      expect(resource.isActive).toBe(true);
      expect(resource.user?.userId).toBe(mockUserId);

      const allResources = await resourcesService.findAllResources();
      expect(allResources.length).toBeGreaterThanOrEqual(1);
    });

    it('should find resource by ID or throw NotFoundException', async () => {
      const resource = await resourcesService.createResource(
        {
          name: 'Control Panel Wireman',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 50.0,
          unitPrice: 110.0,
        },
        'admin',
      );

      const found = await resourcesService.findResourceById(
        resource.resourceId,
      );
      expect(found.resourceId).toBe(resource.resourceId);
      expect(found.name).toBe('Control Panel Wireman');

      await expect(
        resourcesService.findResourceById(
          '00000000-0000-0000-0000-000000000999',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter resources by search term, resourceType, and status (active/archived)', async () => {
      const r1 = await resourcesService.createResource(
        {
          name: 'Field Technician Lead',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 60.0,
          unitPrice: 120.0,
          isActive: true,
        },
        'admin',
      );

      const r2 = await resourcesService.createResource(
        {
          name: 'Heavy Hydraulic Excavator',
          resourceType: RESOURCE_TYPE.EQUIPMENT,
          baseUom: 'DAY',
          directUnitCost: 500.0,
          unitPrice: 1200.0,
          isActive: false,
        },
        'admin',
      );

      // Search by name
      const searchRes = await resourcesService.findAllResources({
        q: 'Technician',
      });
      expect(searchRes.some((r) => r.resourceId === r1.resourceId)).toBe(true);
      expect(searchRes.some((r) => r.resourceId === r2.resourceId)).toBe(false);

      // Filter by resourceType
      const typeRes = await resourcesService.findAllResources({
        resourceType: RESOURCE_TYPE.EQUIPMENT,
      });
      expect(typeRes.some((r) => r.resourceId === r2.resourceId)).toBe(true);
      expect(typeRes.some((r) => r.resourceId === r1.resourceId)).toBe(false);

      // Filter by active status
      const activeRes = await resourcesService.findAllResources({
        status: PROJECT_RESOURCE_STATE.ACTIVE,
      });
      expect(activeRes.some((r) => r.resourceId === r1.resourceId)).toBe(true);
      expect(activeRes.some((r) => r.resourceId === r2.resourceId)).toBe(false);

      // Filter by archived status
      const archivedRes = await resourcesService.findAllResources({
        status: PROJECT_RESOURCE_STATE.ARCHIVED,
      });
      expect(archivedRes.some((r) => r.resourceId === r2.resourceId)).toBe(
        true,
      );
      expect(archivedRes.some((r) => r.resourceId === r1.resourceId)).toBe(
        false,
      );
    });

    it('should update resource details, rates, and status', async () => {
      const resource = await resourcesService.createResource(
        {
          name: 'Junior Drafter',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 40.0,
          unitPrice: 85.0,
        },
        'admin',
      );

      const updated = await resourcesService.updateResource(
        resource.resourceId,
        {
          name: 'Senior CAD Specialist',
          directUnitCost: 65.0,
          unitPrice: 140.0,
        },
        'admin',
      );

      expect(updated.name).toBe('Senior CAD Specialist');
      expect(Number(updated.directUnitCost)).toBe(65.0);
      expect(Number(updated.unitPrice)).toBe(140.0);
    });

    it('should archive and unarchive resources', async () => {
      const resource = await resourcesService.createResource(
        {
          name: 'Temporary Contractor Profile',
          resourceType: RESOURCE_TYPE.CONTRACTOR,
          baseUom: 'HOUR',
          directUnitCost: 80.0,
          unitPrice: 150.0,
          isActive: true,
        },
        'admin',
      );

      const archived = await resourcesService.archiveResource(
        resource.resourceId,
        'admin',
      );
      expect(archived.isActive).toBe(false);

      const unarchived = await resourcesService.unarchiveResource(
        resource.resourceId,
        'admin',
      );
      expect(unarchived.isActive).toBe(true);
    });

    it('should delete unreferenced resource and reject deletion if referenced by budget lines', async () => {
      const resource1 = await resourcesService.createResource(
        {
          name: 'Unused Test Resource',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 50.0,
          unitPrice: 100.0,
        },
        'admin',
      );

      const delRes = await resourcesService.deleteResource(
        resource1.resourceId,
        'admin',
      );
      expect(delRes.deleted).toBe(true);
      await expect(
        resourcesService.findResourceById(resource1.resourceId),
      ).rejects.toThrow(NotFoundException);

      // Now test referenced resource delete protection
      const project = await service.createProject(
        {
          name: 'Integration Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Design' },
        'admin',
      );

      const resource2 = await resourcesService.createResource(
        {
          name: 'Key Project Architect',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 100.0,
          unitPrice: 200.0,
        },
        'admin',
      );

      await budgetService.createBudgetLine(project.projectId, {
        projectTaskId: task.projectTaskId,
        lineType: PROJECT_LINE_TYPE.RESOURCE,
        resourceId: resource2.resourceId,
        plannedQuantity: 10,
        unitCost: 100.0,
        unitPrice: 200.0,
      });

      await expect(
        resourcesService.deleteResource(resource2.resourceId, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Material Consumption (Inventory Issue & Return)', () => {
    it('should issue stock from bin to project task, decrement inventory, and record project cost', async () => {
      const project = await service.createProject(
        {
          name: 'Cabling Job',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '2.0',
          name: 'Cable Pulling',
        },
        'admin',
      );

      // Issue 10 cables from BIN-A-01 to task
      const issueLine = await inventoryService.issueInventoryToProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          locationId: mockLocationId,
          binId: mockBinId,
          quantity: 10,
          memo: 'Issued 10 cables for floor 2',
        },
        'admin',
      );

      expect(issueLine.ledgerId).toBeDefined();
      expect(Number(issueLine.quantity)).toBe(10);
      expect(Number(issueLine.unitCostBase)).toBe(50.0);
      expect(Number(issueLine.totalCostBase)).toBe(500.0); // 10 * $50

      // Check Bin Contents cache decremented from 100 to 90
      const [binStock] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, mockBinId),
            eq(binContents.productId, mockProductId),
          ),
        );
      expect(Number(binStock.actualQuantity)).toBe(90);

      // Check Stock Movement Ledger recorded negative movement
      const [invMovement] = await pg.db
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.productId, mockProductId));
      expect(Number(invMovement.quantity)).toBe(-10);
    });

    it('should return unused stock from project back to warehouse bin with compensating credit', async () => {
      const project = await service.createProject(
        {
          name: 'Cabling Return Job',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '2.0',
          name: 'Cable Pulling',
        },
        'admin',
      );

      // Issue 10 cables
      await inventoryService.issueInventoryToProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          locationId: mockLocationId,
          binId: mockBinId,
          quantity: 10,
        },
        'admin',
      );

      // Return 2 unused cables back to bin
      const returnLine = await inventoryService.returnInventoryFromProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          locationId: mockLocationId,
          binId: mockBinId,
          quantity: 2,
          memo: 'Returned 2 unused cable rolls',
        },
        'admin',
      );

      expect(Number(returnLine.quantity)).toBe(-2);
      expect(Number(returnLine.totalCostBase)).toBe(-100.0); // -2 * $50

      // Check Bin Contents cache restored to 92 (100 - 10 + 2)
      const [binStock] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, mockBinId),
            eq(binContents.productId, mockProductId),
          ),
        );
      expect(Number(binStock.actualQuantity)).toBe(92);
    });

    it('should throw error on missing product or invalid bin during issue', async () => {
      const project = await service.createProject(
        {
          name: 'Error Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Task' },
        'admin',
      );

      // Missing product
      await expect(
        inventoryService.issueInventoryToProject(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            productId: randomUUID(),
            locationId: mockLocationId,
            binId: mockBinId,
            quantity: 5,
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);

      // Bin not found in location
      await expect(
        inventoryService.issueInventoryToProject(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            productId: mockProductId,
            locationId: randomUUID(),
            binId: mockBinId,
            quantity: 5,
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error on missing product or invalid bin during return', async () => {
      const project = await service.createProject(
        {
          name: 'Return Error Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Task' },
        'admin',
      );

      // Missing product
      await expect(
        inventoryService.returnInventoryFromProject(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            productId: randomUUID(),
            locationId: mockLocationId,
            binId: mockBinId,
            quantity: 5,
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);

      // Invalid bin
      await expect(
        inventoryService.returnInventoryFromProject(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            productId: mockProductId,
            locationId: randomUUID(),
            binId: randomUUID(),
            quantity: 5,
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create project with staging location/bin and fall back to project staging bin when issuing inventory without specifying bin', async () => {
      const project = await service.createProject(
        {
          name: 'Staging Bin Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
          stagingLocationId: mockLocationId,
          stagingBinId: mockProjectBinId,
        },
        'admin',
      );

      expect(project.stagingLocationId).toBe(mockLocationId);
      expect(project.stagingBinId).toBe(mockProjectBinId);

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Assembly' },
        'admin',
      );

      // Issue inventory WITHOUT specifying locationId / binId (uses seeded 100 stock)
      const ledgerLine = await inventoryService.issueInventoryToProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          quantity: 15,
        },
        'admin',
      );

      expect(Number(ledgerLine.quantity)).toBe(15);
      expect(Number(ledgerLine.totalCostBase)).toBe(750.0); // 15 * $50

      // Verify stock in bin decreased from 100 to 85
      const [binStock] = await pg.db
        .select()
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, mockProjectBinId),
            eq(binContents.productId, mockProductId),
          ),
        );
      expect(Number(binStock.actualQuantity)).toBe(85);
    });

    it('should record compensating return credit using recordProjectReturnCredit method', async () => {
      const project = await service.createProject(
        {
          name: 'Return Credit Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { taskCode: '1.0', name: 'Task 1' },
        'admin',
      );

      // Issue 10 units first
      await inventoryService.issueInventoryToProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          locationId: mockLocationId,
          binId: mockBinId,
          quantity: 10,
          unitCost: 50.0,
          unitPrice: 80.0,
        },
        'admin',
      );

      // Call recordProjectReturnCredit directly in a transaction
      const returnCredit = await pg.db.transaction(async (tx) => {
        return inventoryService.recordProjectReturnCredit(tx, {
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          quantity: 4,
          referenceNumber: 'TRF-RET-001',
          actor: 'admin',
        });
      });

      expect(Number(returnCredit.quantity)).toBe(-4);
      expect(Number(returnCredit.totalCostBase)).toBe(-200.0); // -4 * 50
      expect(Number(returnCredit.totalPriceBase)).toBe(-320.0); // -4 * 80

      const profitability = await inventoryService.getProfitability(
        project.projectId,
      );
      // Net actual cost: (10 * 50) - (4 * 50) = 300
      expect(profitability.materialActualCost).toBe(300.0);
      expect(profitability.totalActualCost).toBe(300.0);
    });

    it('should charge project upon staging putaway and cleanly reverse net out upon return putaway', async () => {
      const project = await service.createProject(
        {
          name: 'Staging At Cost Lifecycle',
          customerId: mockCustomerId,
          stagingLocationId: mockLocationId,
          stagingBinId: mockProjectBinId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      // 1. Staging charge: Putaway 5 units @ $20.79 = $103.95
      const stagingCharge = await pg.db.transaction(async (tx) => {
        return inventoryService.recordProjectStagingCharge(tx, {
          projectId: project.projectId,
          productId: mockProductId,
          quantity: 5,
          unitCost: 20.79,
          unitPrice: 30.0,
          referenceNumber: 'TRF-STG-001',
          actor: 'admin',
        });
      });

      expect(Number(stagingCharge.quantity)).toBe(5);
      expect(Number(stagingCharge.totalCostBase)).toBe(103.95);

      let prof = await inventoryService.getProfitability(project.projectId);
      expect(prof.materialActualCost).toBe(103.95);
      expect(prof.totalActualCost).toBe(103.95);

      // 2. Partial return: Return 2 units @ $20.79 = -$41.58
      const returnCredit = await pg.db.transaction(async (tx) => {
        return inventoryService.recordProjectReturnCredit(tx, {
          projectId: project.projectId,
          productId: mockProductId,
          quantity: 2,
          unitCost: 20.79,
          unitPrice: 30.0,
          referenceNumber: 'TRF-RET-001',
          actor: 'admin',
        });
      });

      expect(Number(returnCredit.quantity)).toBe(-2);
      expect(Number(returnCredit.totalCostBase)).toBe(-41.58);

      prof = await inventoryService.getProfitability(project.projectId);
      // 103.95 - 41.58 = 62.37 (3 remaining units * 20.79)
      expect(prof.materialActualCost).toBe(62.37);
      expect(prof.totalActualCost).toBe(62.37);

      // 3. Return remaining 3 units -> Full reverse net out to $0.00
      await pg.db.transaction(async (tx) => {
        return inventoryService.recordProjectReturnCredit(tx, {
          projectId: project.projectId,
          productId: mockProductId,
          quantity: 3,
          unitCost: 20.79,
          unitPrice: 30.0,
          referenceNumber: 'TRF-RET-002',
          actor: 'admin',
        });
      });

      prof = await inventoryService.getProfitability(project.projectId);
      expect(prof.materialActualCost).toBe(0.0);
      expect(prof.totalActualCost).toBe(0.0);
    });
  });

  describe('Profitability & Variance Calculation', () => {
    it('should accurately calculate budget vs actual costs and margin percentages across labor, material, and expenses', async () => {
      const project = await service.createProject(
        {
          name: 'Profitability Test Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Implementation',
        },
        'admin',
      );

      const resource = await resourcesService.createResource({
        name: 'Lead Developer',
        resourceType: RESOURCE_TYPE.PERSON,
        userId: mockUserId,
        baseUom: 'HOUR',
        directUnitCost: 100.0,
        unitPrice: 200.0,
      });

      // Add budget lines:
      // 1. Material: 20 items @ $50 cost ($1,000 cost, $1,800 price)
      await budgetService.createBudgetLine(project.projectId, {
        projectTaskId: task.projectTaskId,
        lineType: PROJECT_LINE_TYPE.ITEM,
        productId: mockProductId,
        plannedQuantity: 20,
        unitCost: 50.0,
        unitPrice: 90.0,
      });

      // 2. Labor: 10 hours @ $100 cost ($1,000 cost, $2,000 price)
      await budgetService.createBudgetLine(project.projectId, {
        projectTaskId: task.projectTaskId,
        lineType: PROJECT_LINE_TYPE.RESOURCE,
        resourceId: resource.resourceId,
        plannedQuantity: 10,
        unitCost: 100.0,
        unitPrice: 200.0,
      });

      // Incur actuals:
      // 1. Issue 10 items ($500 cost, $900 price)
      await inventoryService.issueInventoryToProject(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          productId: mockProductId,
          locationId: mockLocationId,
          binId: mockBinId,
          quantity: 10,
          unitCost: 50.0,
          unitPrice: 90.0,
        },
        'admin',
      );

      // 2. Direct ledger entry for Labor ($200 cost, $400 price, isBilled = true)
      await pg.db.insert(projectLedgerEntries).values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: 'usage',
        lineType: PROJECT_LINE_TYPE.RESOURCE,
        sourceType: 'timesheet',
        resourceId: resource.resourceId,
        quantity: '2',
        unitCostBase: '100.00',
        totalCostBase: '200.00',
        unitPriceBase: '200.00',
        totalPriceBase: '400.00',
        isBillable: true,
        isBilled: true,
        postingDate: new Date(),
        createdBy: 'admin',
      });

      // 3. Direct ledger entry for Expense ($150 cost, $200 price, isBilled = false)
      await pg.db.insert(projectLedgerEntries).values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: 'usage',
        lineType: PROJECT_LINE_TYPE.EXPENSE,
        sourceType: 'manual_journal',
        description: 'Site travel and lodging',
        quantity: '1',
        unitCostBase: '150.00',
        totalCostBase: '150.00',
        unitPriceBase: '200.00',
        totalPriceBase: '200.00',
        isBillable: true,
        isBilled: false,
        postingDate: new Date(),
        createdBy: 'admin',
      });

      const profitability = await inventoryService.getProfitability(
        project.projectId,
      );

      expect(profitability.totalBudgetCost).toBe(2000.0);
      expect(profitability.totalBudgetPrice).toBe(3800.0);
      expect(profitability.totalActualCost).toBe(850.0); // 500 + 200 + 150
      expect(profitability.totalBillablePrice).toBe(1500.0); // 900 + 400 + 200
      expect(profitability.totalBilledPrice).toBe(400.0);
      expect(profitability.materialActualCost).toBe(500.0);
      expect(profitability.laborActualCost).toBe(200.0);
      expect(profitability.expenseActualCost).toBe(150.0);
      expect(profitability.costVariance).toBe(1150.0); // 2000 - 850
      expect(profitability.estimatedMarginPercent).toBe(47.4); // (3800-2000)/3800 = 47.36% -> 47.4%
      expect(profitability.actualMarginPercent).toBe(43.3); // (1500-850)/1500 = 43.33% -> 43.3%
    });
  });

  describe('Project Notes', () => {
    it('adds, retrieves, and deletes project notes with author attribution and audit events', async () => {
      const project = await service.createProject(
        {
          name: 'Notes Test Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        },
        'admin',
      );

      // 1. Add note
      const note1 = await notesService.addProjectNote(
        project.projectId,
        { content: 'First milestone achieved ahead of schedule.' },
        mockUserId,
      );

      expect(note1.noteId).toBeDefined();
      expect(note1.content).toBe('First milestone achieved ahead of schedule.');
      expect(note1.createdById).toBe(mockUserId);
      expect(note1.createdBy?.displayName).toBe('Admin User');

      // 2. Add second note
      const note2 = await notesService.addProjectNote(
        project.projectId,
        { content: 'Second milestone: pending client inspection.' },
        mockUserId,
      );

      // 3. Retrieve notes list
      const notes = await notesService.getProjectNotes(project.projectId);
      expect(notes.length).toBe(2);
      expect(notes[0].noteId).toBe(note2.noteId); // Sorted desc
      expect(notes[1].noteId).toBe(note1.noteId);

      // 4. Also check findOne eagerly populates projectNotes
      const loadedProject = await service.findOne(project.projectId);
      expect(loadedProject.projectNotes).toBeDefined();
      expect(loadedProject.projectNotes?.length).toBe(2);

      // 5. Delete a note
      const deleteRes = await notesService.deleteProjectNote(
        project.projectId,
        note1.noteId,
        mockUserId,
      );
      expect(deleteRes.success).toBe(true);

      const remainingNotes = await notesService.getProjectNotes(
        project.projectId,
      );
      expect(remainingNotes.length).toBe(1);
      expect(remainingNotes[0].noteId).toBe(note2.noteId);
    });

    it('throws NotFoundException when deleting non-existent note', async () => {
      const project = await service.createProject(
        {
          name: 'Notes NotFound Test Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        },
        'admin',
      );

      await expect(
        notesService.deleteProjectNote(
          project.projectId,
          randomUUID(),
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Contractor Resource Supplier Cost Resolution', () => {
    it('automatically defaults directUnitCost from linked productSuppliers when not provided', async () => {
      // 1. Create a supplier
      const vendorId = randomUUID();
      await pg.db.insert(suppliers).values({
        vendorId,
        vendorNumber: 'V-BOSCH',
        stateCode: SUPPLIER_STATE.ACTIVE,
        isPurchasingBlocked: false,
        isPaymentBlocked: false,
        currencyCode: 'USD',
        source: 'manual',
      });

      // 2. Create a service product
      const serviceProductId = randomUUID();
      await pg.db.insert(products).values({
        productId: serviceProductId,
        productNumber: 'SERV-ENG-SNR',
        name: 'Senior Service Engineer',
        productType: 'service',
        structureType: 'standard',
        baseUom: 'HOUR',
        standardCost: '500.00',
        listPrice: '800.00',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'manual',
      });

      // 3. Link supplier to product in product_suppliers with $600.00 cost price
      await pg.db.insert(productSuppliers).values({
        productSupplierId: randomUUID(),
        productId: serviceProductId,
        vendorId,
        supplierPartNumber: 'RR-SERV-SNR',
        costPrice: '600.00',
        discountPercent: '0',
        isPreferred: true,
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'manual',
      });

      // 4. Create contractor resource with vendorId and serviceProductId, but no directUnitCost
      const resource = await resourcesService.createResource(
        {
          name: 'Bosch Senior Engineer',
          resourceType: RESOURCE_TYPE.CONTRACTOR,
          vendorId,
          serviceProductId,
          baseUom: 'HOUR',
          unitPrice: 800,
        },
        'admin',
      );

      expect(resource.resourceId).toBeDefined();
      expect(resource.directUnitCost).toBe('600.00');
    });

    it('applies discount percentage from productSuppliers when computing default unit cost', async () => {
      const vendorId = randomUUID();
      await pg.db.insert(suppliers).values({
        vendorId,
        vendorNumber: 'V-REXROTH',
        stateCode: SUPPLIER_STATE.ACTIVE,
        isPurchasingBlocked: false,
        isPaymentBlocked: false,
        currencyCode: 'USD',
        source: 'manual',
      });

      const serviceProductId = randomUUID();
      await pg.db.insert(products).values({
        productId: serviceProductId,
        productNumber: 'SERV-FIELD-TECH',
        name: 'Field Technician',
        productType: 'service',
        structureType: 'standard',
        baseUom: 'HOUR',
        standardCost: '400.00',
        listPrice: '650.00',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'manual',
      });

      // Link supplier with 10% discount on $600.00 -> $540.00
      await pg.db.insert(productSuppliers).values({
        productSupplierId: randomUUID(),
        productId: serviceProductId,
        vendorId,
        costPrice: '600.00',
        discountPercent: '10',
        isPreferred: true,
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'manual',
      });

      const resource = await resourcesService.createResource(
        {
          name: 'Rexroth Field Tech',
          resourceType: RESOURCE_TYPE.CONTRACTOR,
          vendorId,
          serviceProductId,
          baseUom: 'HOUR',
          unitPrice: 650,
        },
        'admin',
      );

      expect(resource.directUnitCost).toBe('540.00');
    });
  });

  describe('consumeResource', () => {
    it('should successfully record resource usage in project ledger and update profitability', async () => {
      const project = await service.createProject(
        {
          name: 'Factory Upgrade',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          name: 'PLC Commissioning',
          taskCode: '1.0',
        },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Senior Systems Engineer',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 95.0,
          unitPrice: 180.0,
        },
        'admin',
      );

      const entry = await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          quantity: 8,
          description: 'Full day onsite commissioning',
        },
        'engineer_user',
      );

      expect(entry).toBeDefined();
      expect(entry.entryType).toBe(PROJECT_LEDGER_ENTRY_TYPE.USAGE);
      expect(entry.lineType).toBe(PROJECT_LINE_TYPE.RESOURCE);
      expect(entry.sourceType).toBe(PROJECT_SOURCE_TYPE.TIMESHEET);
      expect(entry.resourceId).toBe(resource.resourceId);
      expect(entry.quantity).toBe('8');
      expect(Number(entry.unitCostBase)).toBe(95);
      expect(Number(entry.totalCostBase)).toBe(760);
      expect(Number(entry.unitPriceBase)).toBe(180);
      expect(Number(entry.totalPriceBase)).toBe(1440);
      expect(entry.description).toBe('Full day onsite commissioning');

      // Check profitability reflection
      const prof = await inventoryService.getProfitability(project.projectId);
      expect(prof.laborActualCost).toBe(760);
      expect(prof.totalActualCost).toBe(760);
      expect(prof.totalBillablePrice).toBe(1440);
    });

    it('should support override rates and custom postingDate', async () => {
      const project = await service.createProject(
        {
          name: 'Substation Build',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          name: 'HV Switching',
          taskCode: '2.0',
        },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Crane Operator',
          resourceType: RESOURCE_TYPE.EQUIPMENT,
          baseUom: 'HOUR',
          directUnitCost: 150.0,
          unitPrice: 300.0,
        },
        'admin',
      );

      const customDate = new Date('2026-04-15T08:00:00Z').toISOString();
      const entry = await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          quantity: 4,
          unitCost: 175.0, // Overtime rate
          unitPrice: 350.0,
          postingDate: customDate,
          description: 'Night shift emergency crane operation',
        },
        'site_mgr',
      );

      expect(Number(entry.unitCostBase)).toBe(175);
      expect(Number(entry.totalCostBase)).toBe(700);
      expect(Number(entry.unitPriceBase)).toBe(350);
      expect(Number(entry.totalPriceBase)).toBe(1400);
    });

    it('should throw BadRequestException if task does not belong to project', async () => {
      const p1 = await service.createProject(
        {
          name: 'P1',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );
      const p2 = await service.createProject(
        {
          name: 'P2',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const taskInP2 = await tasksService.createTask(
        p2.projectId,
        { name: 'P2 Task', taskCode: '1.0' },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Tech 1',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 50,
          unitPrice: 100,
        },
        'admin',
      );

      await expect(
        resourcesService.consumeResource(
          p1.projectId,
          {
            projectTaskId: taskInP2.projectTaskId,
            resourceId: resource.resourceId,
            quantity: 5,
          },
          'admin',
        ),
      ).rejects.toThrow('not found on project');
    });

    it('should throw BadRequestException on closed projects', async () => {
      const project = await service.createProject(
        {
          name: 'Archived Plant',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { name: 'Old Task', taskCode: '1.0' },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Worker',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 50,
          unitPrice: 100,
        },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        {
          stateCode: PROJECT_STATE.CLOSED,
        },
        'admin',
      );

      await expect(
        resourcesService.consumeResource(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            resourceId: resource.resourceId,
            quantity: 2,
          },
          'admin',
        ),
      ).rejects.toThrow('Cannot consume resources on a closed project');
    });
  });

  describe('consumeExpense', () => {
    it('should successfully record expense ledger entry with costs and billable amount', async () => {
      const project = await service.createProject(
        {
          name: 'Site Commissioning',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { name: 'Travel & Accommodation', taskCode: '3.1' },
        'admin',
      );

      const entry = await ledgerService.consumeExpense(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          description: 'Flight tickets & hotel booking',
          quantity: 2,
          unitCost: 450,
          unitBillablePrice: 500,
          expenseDate: '2026-03-15',
          referenceNumber: 'REC-99881',
          notes: 'Approved by project sponsor',
        },
        'admin',
      );

      expect(entry).toBeDefined();
      expect(entry.projectId).toBe(project.projectId);
      expect(entry.projectTaskId).toBe(task.projectTaskId);
      expect(entry.lineType).toBe(PROJECT_LINE_TYPE.EXPENSE);
      expect(entry.entryType).toBe(PROJECT_LEDGER_ENTRY_TYPE.USAGE);
      expect(entry.sourceType).toBe(PROJECT_SOURCE_TYPE.MANUAL_JOURNAL);
      expect(entry.description).toBe(
        'Flight tickets & hotel booking [Ref: REC-99881]',
      );
      expect(Number(entry.quantity)).toBe(2);
      expect(Number(entry.unitCostBase)).toBe(450);
      expect(Number(entry.totalCostBase)).toBe(900);
      expect(Number(entry.unitPriceBase)).toBe(500);
      expect(Number(entry.totalPriceBase)).toBe(1000);
    });

    it('should throw BadRequestException when trying to record expense on a closed project', async () => {
      const project = await service.createProject(
        {
          name: 'Completed Site',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { name: 'Final Review', taskCode: '4.0' },
        'admin',
      );

      await service.transitionState(
        project.projectId,
        { stateCode: PROJECT_STATE.CLOSED },
        'admin',
      );

      await expect(
        ledgerService.consumeExpense(
          project.projectId,
          {
            projectTaskId: task.projectTaskId,
            description: 'Late Taxi Fare',
            quantity: 1,
            unitCost: 50,
          },
          'admin',
        ),
      ).rejects.toThrow('Cannot record expenses on a closed project');
    });

    it('should throw BadRequestException when task belongs to a different project', async () => {
      const project1 = await service.createProject(
        {
          name: 'Project 1',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const project2 = await service.createProject(
        {
          name: 'Project 2',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task2 = await tasksService.createTask(
        project2.projectId,
        { name: 'Task of Project 2', taskCode: '1.0' },
        'admin',
      );

      await expect(
        ledgerService.consumeExpense(
          project1.projectId,
          {
            projectTaskId: task2.projectTaskId,
            description: 'Cross-project expense',
            quantity: 1,
            unitCost: 100,
          },
          'admin',
        ),
      ).rejects.toThrow('not found on project');
    });

    it('should store budgetLineId when explicitly provided in consumeExpense and consumeResource', async () => {
      const project = await service.createProject(
        {
          name: 'Budget Allocated Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        { name: 'Execution Task', taskCode: '1.0' },
        'admin',
      );

      const bLineExpense = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          description: 'Travel Budget',
          plannedQuantity: 1,
          unitCost: 1000,
          unitPrice: 1200,
        },
        'admin',
      );

      const expenseEntry = await ledgerService.consumeExpense(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          budgetLineId: bLineExpense.budgetLineId,
          description: 'Hotel stay',
          quantity: 1,
          unitCost: 800,
          unitPrice: 950,
        },
        'admin',
      );

      expect(expenseEntry.budgetLineId).toBe(bLineExpense.budgetLineId);

      const resource = await resourcesService.createResource(
        {
          name: 'Lead Consultant',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 100.0,
          unitPrice: 200.0,
        },
        'admin',
      );

      const bLineResource = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          resourceId: resource.resourceId,
          plannedQuantity: 40,
          unitCost: 100,
          unitPrice: 200,
        },
        'admin',
      );

      const resourceEntry = await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          budgetLineId: bLineResource.budgetLineId,
          quantity: 10,
          description: '10h consulting delivered',
        },
        'admin',
      );

      expect(resourceEntry.budgetLineId).toBe(bLineResource.budgetLineId);
    });

    it('updates and deletes unbilled project ledger entries', async () => {
      const project = await service.createProject(
        {
          name: 'Ledger Update/Delete Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Task Alpha',
          isBillable: true,
        },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Field Engineer',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 80.0,
          unitPrice: 150.0,
        },
        'admin',
      );

      // Consume resource -> creates ledger entry
      const entry = await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          quantity: 4,
          unitCost: 80,
          unitPrice: 150,
          description: 'Initial site setup',
        },
        'admin',
      );

      expect(entry.ledgerId).toBeDefined();
      expect(Number(entry.quantity)).toBe(4);
      expect(Number(entry.totalCostBase)).toBe(320);
      expect(Number(entry.totalPriceBase)).toBe(600);

      const bLine = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: 'resource',
          description: 'Field Engineering Planned Labor',
          plannedQuantity: 40,
          unitCost: 80,
          unitPrice: 150,
        },
        'admin',
      );

      // 1. Update ledger entry including budgetLineId
      const updated = await ledgerService.updateLedgerEntry(
        project.projectId,
        entry.ledgerId,
        {
          quantity: 6,
          unitCost: 90,
          unitPrice: 160,
          description: 'Revised site setup (6 hours)',
          budgetLineId: bLine.budgetLineId,
        },
        'admin',
      );

      expect(Number(updated.quantity)).toBe(6);
      expect(Number(updated.unitCostBase)).toBe(90);
      expect(Number(updated.totalCostBase)).toBe(540);
      expect(Number(updated.unitPriceBase)).toBe(160);
      expect(Number(updated.totalPriceBase)).toBe(960);
      expect(updated.description).toBe('Revised site setup (6 hours)');
      expect(updated.budgetLineId).toBe(bLine.budgetLineId);

      // 2. Delete ledger entry
      const delRes = await ledgerService.deleteLedgerEntry(
        project.projectId,
        entry.ledgerId,
        'admin',
      );
      expect(delRes.deleted).toBe(true);

      // Verify it was removed
      const remaining = await pg.db
        .select()
        .from(projectLedgerEntries)
        .where(eq(projectLedgerEntries.ledgerId, entry.ledgerId));
      expect(remaining.length).toBe(0);
    });

    it('rejects update or delete on billed ledger entries', async () => {
      const project = await service.createProject(
        {
          name: 'Billed Ledger Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Task Beta',
          isBillable: true,
        },
        'admin',
      );

      const [billedEntry] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          entryType: 'usage',
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          sourceType: 'timesheet',
          quantity: '5',
          unitCostBase: '100',
          totalCostBase: '500',
          unitPriceBase: '200',
          totalPriceBase: '1000',
          isBillable: true,
          isBilled: true,
          postingDate: new Date(),
          createdBy: 'admin',
        })
        .returning();

      await expect(
        ledgerService.updateLedgerEntry(
          project.projectId,
          billedEntry.ledgerId,
          { quantity: 10 },
          'admin',
        ),
      ).rejects.toThrow('Cannot modify a billed ledger entry');

      await expect(
        ledgerService.deleteLedgerEntry(
          project.projectId,
          billedEntry.ledgerId,
          'admin',
        ),
      ).rejects.toThrow('Cannot delete a billed ledger entry');
    });
  });

  describe('Project Resource Assignments', () => {
    it('should assign a resource to project roster, list assigned resources with consumed quantities, and remove assignment', async () => {
      const project = await service.createProject(
        {
          name: 'Mining Facility Overhaul',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          name: 'Site Inspection',
          taskCode: '1.0',
        },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Bob the Builder',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 80,
          unitPrice: 150,
        },
        'admin',
      );

      // 1. Assign resource to project
      const assignment = await resourcesService.assignResourceToProject(
        project.projectId,
        {
          resourceId: resource.resourceId,
          notes: 'Lead site supervisor',
        },
        'admin',
      );

      expect(assignment).toBeDefined();
      expect(assignment.projectId).toBe(project.projectId);
      expect(assignment.resourceId).toBe(resource.resourceId);
      expect(assignment.notes).toBe('Lead site supervisor');
      expect(assignment.consumedQuantity).toBe(0);

      // 2. Reject duplicate assignment
      await expect(
        resourcesService.assignResourceToProject(
          project.projectId,
          { resourceId: resource.resourceId },
          'admin',
        ),
      ).rejects.toThrow('already assigned');

      // 3. Consume resource hours on task
      await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          quantity: 12,
        },
        'admin',
      );

      // 4. List assigned resources and verify aggregated consumption
      const list = await resourcesService.findAssignedResources(
        project.projectId,
      );
      expect(list.length).toBe(1);
      expect(list[0].resourceId).toBe(resource.resourceId);
      expect(list[0].resource?.name).toBe('Bob the Builder');
      expect(list[0].consumedQuantity).toBe(12);
      expect(list[0].totalCost).toBe(960); // 12 * 80

      // 5. Remove resource assignment from project
      const removeResult = await resourcesService.removeResourceFromProject(
        project.projectId,
        resource.resourceId,
        'admin',
      );
      expect(removeResult.unassigned).toBe(true);

      const listAfter = await resourcesService.findAssignedResources(
        project.projectId,
      );
      expect(listAfter.length).toBe(0);
    });

    it('should automatically assign an unassigned resource to the project upon resource consumption', async () => {
      const project = await service.createProject(
        {
          name: 'Auto Assign Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          name: 'Installation Task',
          taskCode: '1.0',
        },
        'admin',
      );

      const resource = await resourcesService.createResource(
        {
          name: 'Alice Wonder',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'HOUR',
          directUnitCost: 100,
          unitPrice: 200,
        },
        'admin',
      );

      // Verify resource is not initially assigned
      const listBefore = await resourcesService.findAssignedResources(
        project.projectId,
      );
      expect(listBefore.length).toBe(0);

      // Consume resource directly without prior assignment
      const entry = await resourcesService.consumeResource(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          resourceId: resource.resourceId,
          quantity: 5,
          description: 'Initial site electrical work',
        },
        'admin',
      );

      expect(entry).toBeDefined();
      expect(Number(entry.quantity)).toBe(5);

      // Verify resource has now been automatically assigned to project
      const listAfter = await resourcesService.findAssignedResources(
        project.projectId,
      );
      expect(listAfter.length).toBe(1);
      expect(listAfter[0].resourceId).toBe(resource.resourceId);
      expect(listAfter[0].resource?.name).toBe('Alice Wonder');
      expect(listAfter[0].consumedQuantity).toBe(5);
      expect(listAfter[0].totalCost).toBe(500);
      expect(listAfter[0].notes).toBe('Auto-assigned via resource consumption');
    });
  });

  describe('Project stagingBinId and project bin validation (ADV-208)', () => {
    it('should successfully create a project with a valid project bin', async () => {
      const project = await service.createProject(
        {
          name: 'Valid Project Bin Test',
          customerId: mockCustomerId,
          currencyCode: 'AUD',
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          stagingLocationId: mockLocationId,
          stagingBinId: mockProjectBinId,
        },
        'admin',
      );

      expect(project).toBeDefined();
      expect(project.stagingLocationId).toBe(mockLocationId);
      expect(project.stagingBinId).toBe(mockProjectBinId);
    });

    it('should throw BadRequestException if stagingBinId is not of type project on creation', async () => {
      await expect(
        service.createProject(
          {
            name: 'Invalid Project Bin Test',
            customerId: mockCustomerId,
            currencyCode: 'AUD',
            billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
            stagingLocationId: mockLocationId,
            stagingBinId: mockBinId, // storage bin
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stagingBinId belongs to a different location on creation', async () => {
      await expect(
        service.createProject(
          {
            name: 'Cross Location Project Bin Test',
            customerId: mockCustomerId,
            currencyCode: 'AUD',
            billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
            stagingLocationId: mockLocationId,
            stagingBinId: mockOtherProjectBinId, // project bin in mockOtherLocationId
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if updateProject sets a non-project stagingBinId', async () => {
      const project = await service.createProject(
        {
          name: 'Update Project Bin Test',
          customerId: mockCustomerId,
          currencyCode: 'AUD',
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          stagingLocationId: mockLocationId,
          stagingBinId: mockProjectBinId,
        },
        'admin',
      );

      await expect(
        service.updateProject(
          project.projectId,
          {
            stagingBinId: mockBinId, // storage bin
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if updateProject sets a stagingBinId from another location', async () => {
      const project = await service.createProject(
        {
          name: 'Update Cross Location Bin Test',
          customerId: mockCustomerId,
          currencyCode: 'AUD',
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          stagingLocationId: mockLocationId,
          stagingBinId: mockProjectBinId,
        },
        'admin',
      );

      await expect(
        service.updateProject(
          project.projectId,
          {
            stagingBinId: mockOtherProjectBinId,
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update stagingLocationId and stagingBinId together to valid project bin', async () => {
      const project = await service.createProject(
        {
          name: 'Update Location and Bin Test',
          customerId: mockCustomerId,
          currencyCode: 'AUD',
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          stagingLocationId: mockLocationId,
          stagingBinId: mockProjectBinId,
        },
        'admin',
      );

      const updated = await service.updateProject(
        project.projectId,
        {
          stagingLocationId: mockOtherLocationId,
          stagingBinId: mockOtherProjectBinId,
        },
        'admin',
      );

      expect(updated.stagingLocationId).toBe(mockOtherLocationId);
      expect(updated.stagingBinId).toBe(mockOtherProjectBinId);
    });
  });

  describe('findOne - Ledger Entry Invoice Details', () => {
    it('should populate salesInvoiceNumber and salesInvoiceId when ledger entry is linked to sales invoice line', async () => {
      const project = await service.createProject(
        {
          name: 'Project With Invoiced Entries',
          customerId: mockCustomerId,
          currencyCode: 'AUD',
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Consulting',
        },
        'admin',
      );

      // Create Sales Invoice and Sales Invoice Line
      const mockInvoiceId = randomUUID();
      const mockInvoiceLineId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: mockInvoiceId,
        invoiceNumber: 'INV-20260923-0099',
        projectId: project.projectId,
        customerId: mockCustomerId,
        customerNameDisplay: 'Test Customer',
        totalAmount: '500.00',
        outstandingAmount: '500.00',
        taxAmount: '0.00',
        baseTotalAmount: '500.00',
        baseOutstandingAmount: '500.00',
        currencyCode: 'AUD',
        exchangeRate: '1.0',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        invoiceDate: new Date(),
        dueDate: new Date(),
        createdBy: 'admin',
      });

      await pg.db.insert(salesInvoiceLines).values({
        invoiceLineId: mockInvoiceLineId,
        invoiceId: mockInvoiceId,
        description: 'Consulting services invoiced',
        quantityInvoiced: '5',
        pricePerUnit: '100.00',
        discountPercentage: '0',
        amount: '500.00',
        taxAmount: '0',
      });

      // Insert billed ledger entry with salesInvoiceLineId
      const [billedEntry] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          sourceType: PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
          description: 'Consulting 5 hrs',
          quantity: '5',
          unitCostBase: '50.00',
          totalCostBase: '250.00',
          unitPriceBase: '100.00',
          totalPriceBase: '500.00',
          isBillable: true,
          isBilled: true,
          salesInvoiceLineId: mockInvoiceLineId,
          postingDate: new Date(),
          createdBy: 'admin',
        })
        .returning();

      // Insert unbilled ledger entry
      await pg.db.insert(projectLedgerEntries).values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.EXPENSE,
        sourceType: PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
        description: 'Unbilled materials',
        quantity: '1',
        unitCostBase: '30.00',
        totalCostBase: '30.00',
        unitPriceBase: '60.00',
        totalPriceBase: '60.00',
        isBillable: true,
        isBilled: false,
        postingDate: new Date(),
        createdBy: 'admin',
      });

      const found = await service.findOne(project.projectId);
      expect(found).toBeDefined();
      expect(found.ledgerEntries).toBeDefined();
      expect(found.ledgerEntries!.length).toBe(2);

      const foundBilled = found.ledgerEntries!.find(
        (e) => e.ledgerId === billedEntry.ledgerId,
      );
      expect(foundBilled).toBeDefined();
      expect(foundBilled!.isBilled).toBe(true);
      expect(foundBilled!.salesInvoiceNumber).toBe('INV-20260923-0099');
      expect(foundBilled!.salesInvoiceId).toBe(mockInvoiceId);

      const foundUnbilled = found.ledgerEntries!.find(
        (e) => e.ledgerId !== billedEntry.ledgerId,
      );
      expect(foundUnbilled).toBeDefined();
      expect(foundUnbilled!.isBilled).toBe(false);
      expect(foundUnbilled!.salesInvoiceNumber).toBeNull();
      expect(foundUnbilled!.salesInvoiceId).toBeNull();
    });
  });

  describe('ProjectsLedgerService.findLedgerEntries (ADV-212)', () => {
    it('should throw NotFoundException when querying non-existent project', async () => {
      await expect(
        ledgerService.findLedgerEntries(randomUUID(), {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated subledger entries with filtering and invoice resolution', async () => {
      const project = await service.createProject(
        {
          name: 'Ledger Test Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Phase 1',
        },
        'admin',
      );

      // Create mock invoice
      const mockInvoiceId = randomUUID();
      const mockInvoiceLineId = randomUUID();
      await pg.db.insert(salesInvoices).values({
        invoiceId: mockInvoiceId,
        invoiceNumber: 'INV-20260923-0100',
        customerId: mockCustomerId,
        currencyCode: 'AUD',
        exchangeRate: '1.0',
        stateCode: SALES_INVOICE_STATE.INVOICED,
        totalAmount: '500.00',
        outstandingAmount: '500.00',
        baseTotalAmount: '500.00',
        baseOutstandingAmount: '500.00',
        taxAmount: '0.00',
        invoiceDate: new Date(),
        dueDate: new Date(),
        createdBy: 'admin',
      });

      await pg.db.insert(salesInvoiceLines).values({
        invoiceLineId: mockInvoiceLineId,
        invoiceId: mockInvoiceId,
        description: 'Billed Work',
        quantityInvoiced: '5',
        pricePerUnit: '100.00',
        discountPercentage: '0',
        amount: '500.00',
        taxAmount: '0',
      });

      // Insert multiple ledger entries
      const [billedEntry] = await pg.db
        .insert(projectLedgerEntries)
        .values({
          projectId: project.projectId,
          projectTaskId: task.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          sourceType: PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
          description: 'Architect Hours',
          quantity: '5',
          unitCostBase: '50.00',
          totalCostBase: '250.00',
          unitPriceBase: '100.00',
          totalPriceBase: '500.00',
          isBillable: true,
          isBilled: true,
          salesInvoiceLineId: mockInvoiceLineId,
          postingDate: new Date('2026-09-01'),
          createdBy: 'admin',
        })
        .returning();

      await pg.db.insert(projectLedgerEntries).values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.ITEM,
        sourceType: PROJECT_SOURCE_TYPE.INVENTORY_ISSUE,
        description: 'Material Consumption',
        quantity: '10',
        unitCostBase: '20.00',
        totalCostBase: '200.00',
        unitPriceBase: '30.00',
        totalPriceBase: '300.00',
        isBillable: true,
        isBilled: false,
        postingDate: new Date('2026-09-02'),
        createdBy: 'admin',
      });

      await pg.db.insert(projectLedgerEntries).values({
        projectId: project.projectId,
        projectTaskId: task.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.EXPENSE,
        sourceType: PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
        description: 'Travel Expense',
        quantity: '1',
        unitCostBase: '80.00',
        totalCostBase: '80.00',
        unitPriceBase: '80.00',
        totalPriceBase: '80.00',
        isBillable: false,
        isBilled: false,
        postingDate: new Date('2026-09-03'),
        createdBy: 'admin',
      });

      // 1. Fetch all entries
      const allEntries = await ledgerService.findLedgerEntries(
        project.projectId,
        {},
      );
      expect(allEntries.data.length).toBe(3);
      expect(allEntries.total).toBe(3);

      const billedItem = allEntries.data.find(
        (e) => e.ledgerId === billedEntry.ledgerId,
      );
      expect(billedItem).toBeDefined();
      expect(billedItem!.isBilled).toBe(true);
      expect(billedItem!.salesInvoiceNumber).toBe('INV-20260923-0100');
      expect(billedItem!.salesInvoiceId).toBe(mockInvoiceId);

      // 2. Filter by lineType = 'resource'
      const resourceEntries = await ledgerService.findLedgerEntries(
        project.projectId,
        { lineType: PROJECT_LINE_TYPE.RESOURCE },
      );
      expect(resourceEntries.data.length).toBe(1);
      expect(resourceEntries.data[0].lineType).toBe(PROJECT_LINE_TYPE.RESOURCE);

      // 3. Filter by isBilled = false
      const unbilledEntries = await ledgerService.findLedgerEntries(
        project.projectId,
        { isBilled: false },
      );
      expect(unbilledEntries.data.length).toBe(2);

      // 4. Filter by isBillable = false
      const nonBillableEntries = await ledgerService.findLedgerEntries(
        project.projectId,
        { isBillable: false },
      );
      expect(nonBillableEntries.data.length).toBe(1);
      expect(nonBillableEntries.data[0].description).toBe('Travel Expense');

      // 5. Test cursor pagination limit = 1
      const paged = await ledgerService.findLedgerEntries(project.projectId, {
        limit: 1,
      });
      expect(paged.data.length).toBe(1);
      expect(paged.total).toBe(3);
      expect(paged.nextCursor).toBeDefined();

      const nextPage = await ledgerService.findLedgerEntries(
        project.projectId,
        {
          limit: 1,
          cursor: paged.nextCursor,
        },
      );
      expect(nextPage.data.length).toBe(1);
      expect(nextPage.data[0].ledgerId).not.toBe(paged.data[0].ledgerId);
    });
  });

  describe('findOne - Budget Line Server-Side Actuals Aggregations', () => {
    it('should aggregate actualCost, actualRevenue, actualQuantity, and isOverBudget directly onto project.budgetLines', async () => {
      const project = await service.createProject(
        {
          name: 'Budget Actuals Project',
          customerId: mockCustomerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
        },
        'admin',
      );

      const task = await tasksService.createTask(
        project.projectId,
        {
          taskCode: '1.0',
          name: 'Budget Task',
        },
        'admin',
      );

      const budgetLine = await budgetService.createBudgetLine(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          lineType: PROJECT_LINE_TYPE.EXPENSE,
          description: 'Travel & Accomodation',
          plannedQuantity: 1,
          unitCost: 200,
          unitPrice: 250,
        },
        'admin',
      );

      // Log 2 ledger entries targeting this budget line
      await ledgerService.consumeExpense(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          budgetLineId: budgetLine.budgetLineId,
          description: 'Flight ticket',
          quantity: 1,
          unitCost: 150,
          unitPrice: 180,
        },
        'admin',
      );

      await ledgerService.consumeExpense(
        project.projectId,
        {
          projectTaskId: task.projectTaskId,
          budgetLineId: budgetLine.budgetLineId,
          description: 'Hotel stay',
          quantity: 1,
          unitCost: 100,
          unitPrice: 120,
        },
        'admin',
      );

      const found = await service.findOne(project.projectId);
      expect(found.budgetLines).toBeDefined();
      expect(found.budgetLines!.length).toBe(1);

      const foundLine = found.budgetLines![0];
      expect(foundLine.budgetLineId).toBe(budgetLine.budgetLineId);
      expect(foundLine.actualCost).toBe(250); // 150 + 100
      expect(foundLine.actualRevenue).toBe(300); // 180 + 120
      expect(foundLine.actualQuantity).toBe(2); // 1 + 1
      expect(foundLine.isOverBudget).toBe(true); // actualCost 250 > plannedCost 200
    });
  });
});
