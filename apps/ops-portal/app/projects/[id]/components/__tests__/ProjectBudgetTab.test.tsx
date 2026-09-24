import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectBudgetTab } from '../ProjectBudgetTab';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'tabs.budget': 'Budget',
      createBudgetLineTitle: 'Add Budget Line',
      editBudgetLineTitle: 'Edit Budget Line',
      'buttons.addBudgetLine': 'Add Budget Line',
      'buttons.editBudgetLine': 'Edit Line',
      'buttons.deleteBudgetLine': 'Delete Line',
      'labels.task': 'Target Task',
      'columns.lineType': 'Type',
      'columns.description': 'Description',
      'columns.quantity': 'Quantity',
      'columns.uom': 'UoM',
      'columns.unitCost': 'Unit Cost',
      'columns.budgetCost': 'Budget Cost',
      'columns.actualCost': 'Actual Cost',
      'columns.unitPrice': 'Unit Price',
      'columns.budgetRevenue': 'Budget Revenue',
      'columns.actualRevenue': 'Actual Revenue',
      'columns.actions': 'Actions',
      'columns.total': 'Total',
      'labels.unbudgetedLine': 'Other / Unbudgeted Actuals',
      unbudgetedLine: 'Other / Unbudgeted Actuals',
      other: 'Other',
      confirmDeleteBudgetLine: 'Are you sure you want to delete this budget line?',
    };
    const t = (key: string) => translations[key] || (namespace ? `${namespace}.${key}` : key);
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  productsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  projectsControllerFindAllResources: jest.fn().mockResolvedValue({ data: [] }),
}));

const mockTasks: api.ProjectTaskResponseDto[] = [
  {
    projectTaskId: 'task-1',
    projectId: 'prj-1',
    taskCode: '1.0',
    name: 'Foundation & Framing',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'Electrical Installation',
    stateCode: 'completed',
    isMilestone: false,
    isBillable: true,
  },
];

const mockBudgetLines: api.ProjectBudgetLineResponseDto[] = [
  {
    budgetLineId: 'bud-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    lineType: 'resource',
    resourceId: 'res-1',
    description: 'Senior Electrician Labor',
    plannedQuantity: '40',
    unitCost: '80',
    totalCost: '3200',
    unitPrice: '150',
    totalPrice: '6000',
  },
  {
    budgetLineId: 'bud-2',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    lineType: 'item',
    productId: 'prod-1',
    description: 'Control Panel Enclosure',
    plannedQuantity: '2',
    unitCost: '500',
    totalCost: '1000',
    unitPrice: '900',
    totalPrice: '1800',
  },
  {
    budgetLineId: 'bud-3',
    projectId: 'prj-1',
    projectTaskId: 'task-non-existent',
    lineType: 'expense',
    description: 'Travel Expenses',
    plannedQuantity: '1',
    unitCost: '300',
    totalCost: '300',
    unitPrice: '300',
    totalPrice: '300',
  },
];

const mockLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
  {
    ledgerId: 'l-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    resourceId: 'res-1',
    entryType: 'usage',
    lineType: 'resource',
    sourceType: 'timesheet',
    quantity: '20',
    unitCostBase: '80',
    totalCostBase: '1600',
    unitPriceBase: '150',
    totalPriceBase: '3000',
    isBilled: false,
    postingDate: '2026-03-01T10:00:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'l-2',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    productId: 'prod-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory',
    quantity: '3',
    unitCostBase: '500',
    totalCostBase: '1500',
    unitPriceBase: '900',
    totalPriceBase: '2700',
    isBilled: false,
    postingDate: '2026-03-02T10:00:00Z',
    createdBy: 'admin',
  },
];

describe('ProjectBudgetTab', () => {
  const mockCreate = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders table columns in order with Target Task first, Actual Cost next to Budget Cost, and Actual Revenue next to Budget Revenue', () => {
    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Target Task',
      'Type',
      'Description',
      'Quantity',
      'UoM',
      'Unit Cost',
      'Budget Cost',
      'Actual Cost',
      'Unit Price',
      'Disc %',
      'Budget Revenue',
      'Actual Revenue',
      'Actions',
    ]);
  });

  it('renders task roll-up rows with sum of budget cost, actual cost, budget revenue, and actual revenue', () => {
    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    // Task 1 Roll-up: $3,200.00 budget cost, $1,600.00 actual cost, $6,000.00 budget revenue, $3,000.00 actual revenue
    expect(screen.getAllByText('1.0 — Foundation & Framing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$3,200.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,600.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$6,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$3,000.00').length).toBeGreaterThanOrEqual(1);

    // Task 2 Roll-up (Over budget): $1,000.00 budget cost, $1,500.00 actual cost, $1,800.00 budget revenue, $2,700.00 actual revenue
    expect(screen.getAllByText('2.0 — Electrical Installation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,500.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,800.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$2,700.00').length).toBeGreaterThanOrEqual(1);

    // Budget Line Details under tasks
    expect(screen.getAllByText('Senior Electrician Labor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Control Panel Enclosure').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Travel Expenses').length).toBeGreaterThanOrEqual(1);

    // Line Type Badges: resource -> service, item -> material, expense -> expense
    expect(screen.getAllByText('service').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('material').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('expense').length).toBeGreaterThanOrEqual(1);
  });

  it('opens create slide-over when clicking Add Budget Line', () => {
    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    const addBtn = screen.getByRole('button', { name: 'Add Budget Line' });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: 'Add Budget Line' })).toBeInTheDocument();
  });

  it('opens edit slide-over when clicking edit on an editable task line', () => {
    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    const editBtns = screen.getAllByTitle('Edit Line');
    expect(editBtns.length).toBeGreaterThan(0);
    fireEvent.click(editBtns[0]);

    expect(screen.getByDisplayValue('Senior Electrician Labor')).toBeInTheDocument();
  });

  it('disables edit and delete buttons on completed task budget lines', () => {
    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    const disabledEdits = screen.getAllByTitle('Cannot edit budget allocations on a completed task');
    const disabledDeletes = screen.getAllByTitle('Cannot delete budget allocations on a completed task');

    expect(disabledEdits.length).toBeGreaterThan(0);
    expect(disabledEdits[0]).toBeDisabled();
    expect(disabledDeletes.length).toBeGreaterThan(0);
    expect(disabledDeletes[0]).toBeDisabled();
  });

  it('triggers delete confirmation when clicking delete button', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    const deleteBtns = screen.getAllByTitle('Delete Line');
    fireEvent.click(deleteBtns[0]);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this budget line?');
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('bud-1');
    });

    confirmSpy.mockRestore();
  });

  it('renders synthetic Other / Unbudgeted Actuals line when unmatched entries exist on a task', () => {
    const unbudgetedLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
      {
        ledgerId: 'l-unbudgeted-1',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'expense',
        sourceType: 'manual_journal',
        isBilled: false,
        createdBy: 'admin',
        description: 'Unplanned Crane Rental',
        quantity: '1',
        unitCostBase: '750',
        totalCostBase: '750',
        unitPriceBase: '900',
        totalPriceBase: '900',
        postingDate: '2026-03-05T10:00:00Z',
      },
    ];

    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        ledgerEntries={[...mockLedgerEntries, ...unbudgetedLedgerEntries]}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    // Unbudgeted line should be rendered under task 1
    expect(screen.getAllByText('Other / Unbudgeted Actuals').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$750.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$900.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders unassigned orphan entries in Unassigned Tasks section with Other / Unbudgeted Actuals', () => {
    const orphanEntries: api.ProjectLedgerEntryResponseDto[] = [
      {
        ledgerId: 'l-orphan-1',
        projectId: 'prj-1',
        projectTaskId: undefined as unknown as string,
        entryType: 'usage',
        lineType: 'expense',
        sourceType: 'manual_journal',
        isBilled: false,
        createdBy: 'admin',
        postingDate: '2026-03-05T10:00:00Z',
        description: 'Orphan General Expense',
        quantity: '1',
        unitCostBase: '120',
        totalCostBase: '120',
        unitPriceBase: '150',
        totalPriceBase: '150',
      },
    ];

    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        ledgerEntries={orphanEntries}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    expect(screen.getAllByText('Other / Unbudgeted Actuals').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$120.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$150.00').length).toBeGreaterThanOrEqual(1);
  });

  it('matches subledger entry directly when budgetLineId is present', () => {
    const directMatchedLedger: api.ProjectLedgerEntryResponseDto[] = [
      {
        ledgerId: 'l-direct-1',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        budgetLineId: 'bud-1',
        entryType: 'usage',
        lineType: 'resource',
        sourceType: 'timesheet',
        isBilled: false,
        createdBy: 'admin',
        postingDate: '2026-03-05T10:00:00Z',
        quantity: '10',
        unitCostBase: '80',
        totalCostBase: '800',
        unitPriceBase: '150',
        totalPriceBase: '1500',
      },
    ];

    render(
      <ProjectBudgetTab
        budgetLines={mockBudgetLines}
        tasks={mockTasks}
        ledgerEntries={directMatchedLedger}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    // Line 1: Budget cost $3,200, Actual cost $800
    expect(screen.getAllByText('$3,200.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$800.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,500.00').length).toBeGreaterThanOrEqual(1);
  });

  it('aggregates both employee and contractor hours into the same service line when sharing productId', () => {
    const serviceBudgetLines: api.ProjectBudgetLineResponseDto[] = [
      {
        budgetLineId: 'bud-svc-1',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        lineType: 'resource',
        productId: 'prod-svc-eng',
        description: 'Electrical Engineering Service',
        plannedQuantity: '100',
        unitCost: '100',
        totalCost: '10000',
        unitPrice: '180',
        totalPrice: '18000',
      },
    ];

    const aggregatedLedger: api.ProjectLedgerEntryResponseDto[] = [
      {
        ledgerId: 'l-emp-1',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        productId: 'prod-svc-eng',
        resourceId: 'res-emp-1',
        entryType: 'usage',
        lineType: 'resource',
        sourceType: 'timesheet',
        isBilled: false,
        createdBy: 'admin',
        postingDate: '2026-03-05T10:00:00Z',
        quantity: '40',
        unitCostBase: '90',
        totalCostBase: '3600',
        unitPriceBase: '180',
        totalPriceBase: '7200',
      },
      {
        ledgerId: 'l-sub-1',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        productId: 'prod-svc-eng',
        resourceId: 'res-sub-1',
        entryType: 'usage',
        lineType: 'resource',
        sourceType: 'timesheet',
        isBilled: false,
        createdBy: 'admin',
        postingDate: '2026-03-05T10:00:00Z',
        quantity: '20',
        unitCostBase: '110',
        totalCostBase: '2200',
        unitPriceBase: '180',
        totalPriceBase: '3600',
      },
    ];

    render(
      <ProjectBudgetTab
        budgetLines={serviceBudgetLines}
        tasks={mockTasks}
        ledgerEntries={aggregatedLedger}
        currency="USD"
        isEditable={true}
        createBudgetLine={mockCreate}
        updateBudgetLine={mockUpdate}
        deleteBudgetLine={mockDelete}
      />
    );

    // Total aggregated actual cost: 3600 + 2200 = 5800
    // Total aggregated actual revenue: 7200 + 3600 = 10800
    expect(screen.getAllByText('$5,800.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$10,800.00').length).toBeGreaterThanOrEqual(1);
  });
});
