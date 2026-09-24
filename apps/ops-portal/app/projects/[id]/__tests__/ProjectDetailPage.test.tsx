import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProjectDetailsPage from '../page';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

const mockProjectData: api.ProjectResponseDto = {
  projectId: 'prj-123',
  projectNumber: 'PRJ-2026-001',
  name: 'Automation Overhaul Project',
  description: 'Full plant PLC and SCADA retrofit',
  customerId: 'cust-1',
  opportunityId: 'opp-1',
  stateCode: 'draft',
  stage: 'Planning',
  billingType: 'time_and_materials',
  currencyCode: 'USD',
  startDate: '2026-03-01T00:00:00Z',
  targetEndDate: '2026-08-30T00:00:00Z',
  notes: 'Priority phase 1 delivery',
  projectNotes: [
    {
      noteId: 'note-1',
      projectId: 'prj-123',
      content: 'Priority phase 1 delivery',
      createdById: 'user-1',
      createdBy: {
        userId: 'user-1',
        displayName: 'Lead Architect',
        username: 'lead_arch',
        email: 'lead@example.com',
      },
      createdOn: '2026-01-12T10:00:00Z',
    },
  ],
  createdOn: '2026-01-10T10:00:00Z',
  modifiedOn: '2026-01-15T12:00:00Z',
  customer: {
    customerId: 'cust-1',
    customerNumber: 'CUST-001',
    customerName: 'Acme Heavy Industries',
    currencyCode: 'USD',
  },
  opportunity: {
    opportunityId: 'opp-1',
    name: 'Acme Automation Deal',
    currencyCode: 'USD',
  },
  tasks: [
    {
      projectTaskId: 'task-1',
      projectId: 'prj-123',
      taskCode: '1.0',
      name: 'System Architecture & Design',
      stateCode: 'in_progress',
      isMilestone: true,
      isBillable: true,
      createdOn: '2026-01-10T10:00:00Z',
      modifiedOn: '2026-01-10T10:00:00Z',
    },
  ],
  budgetLines: [
    {
      budgetLineId: 'bud-1',
      projectId: 'prj-123',
      projectTaskId: 'task-1',
      lineType: 'resource',
      description: 'Controls Engineering',
      plannedQuantity: '40',
      unitCost: '80',
      totalCost: '3200',
      unitPrice: '150',
      totalPrice: '6000',
    },
  ],
  ledgerEntries: [
    {
      ledgerId: 'led-1',
      projectId: 'prj-123',
      projectTaskId: 'task-1',
      entryType: 'usage',
      lineType: 'resource',
      sourceType: 'timesheet',
      description: 'PLC Logic Programming',
      quantity: '8',
      unitCostBase: '80',
      totalCostBase: '640',
      unitPriceBase: '150',
      totalPriceBase: '1200',
      isBilled: false,
      postingDate: '2026-03-05T00:00:00Z',
      createdBy: 'test-user',
    },
  ],
};

const mockProfitability: api.ProjectProfitabilityResponseDto = {
  projectId: 'prj-123',
  totalBudgetCost: 3200,
  totalBudgetPrice: 6000,
  totalActualCost: 640,
  totalBillablePrice: 1200,
  totalBilledPrice: 0,
  costVariance: -2560,
  estimatedMarginPercent: 46.7,
  actualMarginPercent: 46.7,
  laborActualCost: 640,
  materialActualCost: 0,
  expenseActualCost: 0,
};

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  projectsControllerFindOne: jest.fn(),
  projectsControllerGetProfitability: jest.fn(),
  projectsControllerFindAllResources: jest.fn(),
  projectsControllerFindAssignedResources: jest.fn(),
  projectsControllerAssignResource: jest.fn(),
  projectsControllerRemoveResource: jest.fn(),
  projectsControllerUpdate: jest.fn(),
  projectsControllerTransitionState: jest.fn(),
  projectsControllerCreateTask: jest.fn(),
  projectsControllerUpdateTask: jest.fn(),
  projectsControllerDeleteTask: jest.fn(),
  projectsControllerCreateBudgetLine: jest.fn(),
  projectsControllerUpdateBudgetLine: jest.fn(),
  projectsControllerDeleteBudgetLine: jest.fn(),
  projectsControllerCreateResource: jest.fn(),
  projectsControllerConsumeResource: jest.fn(),
  projectsControllerConsumeExpense: jest.fn(),
  projectsControllerUpdateLedgerEntry: jest.fn(),
  projectsControllerDeleteLedgerEntry: jest.fn(),
  projectsControllerIssueInventory: jest.fn(),
  projectsControllerReturnInventory: jest.fn(),
  projectsControllerAddNote: jest.fn(),
  projectsControllerDeleteNote: jest.fn(),
  projectsControllerGetSettings: jest.fn(),
  productsControllerFindAll: jest.fn(),
  inventoryControllerFindBinsByLocation: jest.fn(),
  inventoryControllerFindAllLocations: jest.fn(),
  inventoryControllerFindByProductIdsBulk: jest.fn(),
  taxCategoriesControllerFindAll: jest.fn(),
  usersControllerFindAll: jest.fn(),
  transfersControllerFindAll: jest.fn(),
  tradingTermsControllerFindAll: jest.fn(),
  invoiceDetailControllerGetSalesInvoicesGlobal: jest.fn(),
}));

describe('ProjectDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.tradingTermsControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.projectsControllerFindOne as jest.Mock).mockResolvedValue({ data: mockProjectData });
    (api.projectsControllerGetProfitability as jest.Mock).mockResolvedValue({ data: mockProfitability });
    (api.projectsControllerFindAllResources as jest.Mock).mockResolvedValue({ data: [] });
    (api.projectsControllerFindAssignedResources as jest.Mock).mockResolvedValue({ data: [] });
    (api.invoiceDetailControllerGetSalesInvoicesGlobal as jest.Mock).mockResolvedValue({ data: { data: [] } });
    (api.projectsControllerGetSettings as jest.Mock).mockResolvedValue({ data: {} });
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.transfersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.inventoryControllerFindBinsByLocation as jest.Mock).mockResolvedValue({ data: [] });
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({ data: [] });
    (api.inventoryControllerFindByProductIdsBulk as jest.Mock).mockResolvedValue({ data: [] });
    (api.taxCategoriesControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.projectsControllerUpdate as jest.Mock).mockResolvedValue({ data: mockProjectData });
    (api.projectsControllerTransitionState as jest.Mock).mockResolvedValue({ data: mockProjectData });
    (api.projectsControllerDeleteTask as jest.Mock).mockResolvedValue({ data: { deleted: true, taskId: 'task-1' } });
    (api.projectsControllerUpdateBudgetLine as jest.Mock).mockResolvedValue({ data: { budgetLineId: 'bud-1' } });
    (api.projectsControllerDeleteBudgetLine as jest.Mock).mockResolvedValue({ data: { deleted: true, lineId: 'bud-1' } });
    (api.projectsControllerAddNote as jest.Mock).mockResolvedValue({
      data: {
        noteId: 'note-2',
        projectId: 'prj-123',
        content: 'New site milestone achieved',
        createdOn: new Date().toISOString(),
      },
    });
    (api.projectsControllerDeleteNote as jest.Mock).mockResolvedValue({ data: { success: true } });
  });

  it('renders project header, state badge, and navigation tabs', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    await waitFor(() => {
      expect(screen.getAllByText('Automation Overhaul Project').length).toBeGreaterThan(0);
      expect(screen.getAllByText('PRJ-2026-001').length).toBeGreaterThan(0);
      expect(screen.getByText('buttons.activate')).toBeInTheDocument();
    });
  });

  it('allows in-place editing of fields and auto-saves on blur without an edit modal', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Automation Overhaul Project')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Automation Overhaul Project');
    fireEvent.change(nameInput, { target: { value: 'Automation Overhaul Phase 2' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(api.projectsControllerUpdate).toHaveBeenCalledWith(
        'prj-123',
        expect.objectContaining({
          name: 'Automation Overhaul Phase 2',
        })
      );
    });
  });

  it('transitions state when clicking lifecycle action button', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    await waitFor(() => {
      expect(screen.getByText('buttons.activate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('buttons.activate'));

    await waitFor(() => {
      expect(api.projectsControllerTransitionState).toHaveBeenCalledWith(
        'prj-123',
        expect.objectContaining({
          stateCode: 'active',
        })
      );
    });
  });

  it('switches tabs and displays wbs, budget, materials, and accounts', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.wbs/i })[0]).toBeInTheDocument();
    });

    // Click WBS tab
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.wbs/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByText('System Architecture & Design').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1.0').length).toBeGreaterThanOrEqual(1);
    });

    // Click Budget tab
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.budget/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Controls Engineering').length).toBeGreaterThanOrEqual(1);
    });

    // Click Accounts tab
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.accounts/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/PLC Logic Programming/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/1\.0/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('disables Start task button in WBS when project is draft, and enables it when active', async () => {
    const draftProjectWithUnstartedTask: api.ProjectResponseDto = {
      ...mockProjectData,
      stateCode: 'draft',
      tasks: [
        {
          projectTaskId: 'task-unstarted',
          projectId: 'prj-123',
          taskCode: '1.0',
          name: 'Site Preparation',
          stateCode: 'not_started',
          isMilestone: false,
          isBillable: true,
        },
      ],
    };

    (api.projectsControllerFindOne as jest.Mock).mockResolvedValueOnce({ data: draftProjectWithUnstartedTask });

    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    // Switch to WBS tab
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.wbs/i })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.wbs/i })[0]);

    // Start button should be disabled for draft project
    await waitFor(() => {
      const startBtns = screen.getAllByRole('button', { name: /Start/i });
      expect(startBtns.length).toBeGreaterThan(0);
      expect(startBtns[0]).toBeDisabled();
      expect(startBtns[0]).toHaveAttribute('title', 'Project must be active to start tasks');
    });
  });

  it('opens Stage Stock SlideOver when clicking + Stage Stock button on materials tab', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    // Switch to Materials tab
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.materials/i })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.materials/i })[0]);

    // Find and click Stage Stock button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^buttons\.stageStock$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^buttons\.stageStock$/i }));

    // Verify SlideOver opened with Line Items tab
    await waitFor(() => {
      expect(screen.getByText('Source Warehouse Location *')).toBeInTheDocument();
      expect(screen.getByText('Destination Location (Site Staging) *')).toBeInTheDocument();
    });
  });

  it('opens Add Budget Line SlideOver when clicking Add Budget Line button on budget tab', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    // Switch to Budget tab
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.budget/i })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.budget/i })[0]);

    // Find and click Add Budget Line button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^buttons\.addBudgetLine$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^buttons\.addBudgetLine$/i }));

    // Verify SlideOver opened with task options and form
    await waitFor(() => {
      expect(screen.getByText('createBudgetLineTitle')).toBeInTheDocument();
      expect(screen.getAllByText('1.0 — System Architecture & Design').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens Edit Task SlideOver when clicking edit on WBS tab and submits changes', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    // Switch to WBS tab
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.wbs/i })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.wbs/i })[0]);

    // Find and click Edit Task button
    await waitFor(() => {
      expect(screen.getAllByTitle('buttons.editTask').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByTitle('buttons.editTask')[0]);

    // Verify EditTaskSlideOver opens
    await waitFor(() => {
      expect(screen.getByText('editTaskTitle')).toBeInTheDocument();
      expect(screen.getByDisplayValue('System Architecture & Design')).toBeInTheDocument();
    });

    // Save changes
    fireEvent.click(screen.getByText('buttons.saveChanges'));
    await waitFor(() => {
      expect(api.projectsControllerUpdateTask).toHaveBeenCalledWith(
        'prj-123',
        'task-1',
        expect.objectContaining({
          name: 'System Architecture & Design',
        })
      );
    });
  });

  it('opens Edit Budget Line SlideOver when clicking edit on Budget tab and submits changes', async () => {
    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    // Switch to Budget tab
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.budget/i })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.budget/i })[0]);

    // Find and click Edit Budget Line button
    await waitFor(() => {
      expect(screen.getAllByTitle('buttons.editBudgetLine').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByTitle('buttons.editBudgetLine')[0]);

    // Verify EditBudgetLineSlideOver opens
    await waitFor(() => {
      expect(screen.getByText('editBudgetLineTitle')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Controls Engineering')).toBeInTheDocument();
    });

    // Save changes
    fireEvent.click(screen.getByText('buttons.saveChanges'));
    await waitFor(() => {
      expect(api.projectsControllerUpdateBudgetLine).toHaveBeenCalledWith(
        'prj-123',
        'bud-1',
        expect.objectContaining({
          description: 'Controls Engineering',
        })
      );
    });
  });

  it('renders Inventory, unified Materials, and Transfer Orders sections on Materials tab', async () => {
    const mockTransfers: api.TransferResponseDto[] = [
      {
        transferOrderId: 'to-1',
        orderNumber: 'TO-2026-0001',
        stateCode: 'shipped',
        sourceLocationId: 'loc-main',
        sourceLocationName: 'Main Warehouse',
        destinationLocationId: 'loc-site',
        destinationLocationName: 'Project Staging',
        projectId: 'prj-123',
        createdOn: '2026-03-10T10:00:00Z',
        lines: [
          {
            transferOrderLineId: 'line-1',
            productId: 'prod-1',
            productNumber: 'SKU-PLC-001',
            productDescription: 'Programmable Logic Controller',
            quantity: '10',
            quantityShipped: '10',
            quantityReceived: '0',
          },
        ],
      },
    ];
    (api.transfersControllerFindAll as jest.Mock).mockResolvedValue({ data: mockTransfers });

    render(await ProjectDetailsPage({ params: Promise.resolve({ id: 'prj-123' }) }));

    // Switch to Materials tab
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tabs\.materials/i }).length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByRole('button', { name: /tabs\.materials/i })[0]);

    // Verify Inventory, unified Materials, and Transfer Orders cards are rendered
    await waitFor(() => {
      expect(screen.getByText('sections.inventory')).toBeInTheDocument();
      expect(screen.getAllByText('tabs.materials').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('sections.transferOrders').length).toBeGreaterThan(0);
      expect(screen.getAllByText('TO-2026-0001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Main Warehouse').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Project Staging').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('SKU-PLC-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('columns.staged').length).toBeGreaterThan(0);
      expect(screen.getAllByText('columns.arriving').length).toBeGreaterThan(0);
      expect(screen.getAllByText('columns.returning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('columns.available').length).toBeGreaterThan(0);
      expect(screen.getAllByText('columns.consumed').length).toBeGreaterThan(0);
      expect(screen.getAllByText('columns.returned').length).toBeGreaterThan(0);
      expect(screen.getByText('buttons.stageStock')).toBeInTheDocument();
      expect(screen.getByText('buttons.consumeMaterial')).toBeInTheDocument();
    });

    // Test clicking Consume Material opens modal
    fireEvent.click(screen.getByText('buttons.consumeMaterial'));
    await waitFor(() => {
      expect(screen.getByText('consumeMaterialTitle')).toBeInTheDocument();
    });
  });
});

