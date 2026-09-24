import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EditResourceUsageSlideOver } from '../EditResourceUsageSlideOver';
import * as api from '@herobm/sdk';
import { RESOURCE_TYPE } from '@herobm/shared';
import type { ProjectResource } from '../../useProject';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) => {
      if (values) {
        return `${key}:${JSON.stringify(values)}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

const mockTasks: api.ProjectTaskResponseDto[] = [
  {
    projectTaskId: 'task-1',
    projectId: 'prj-1',
    taskCode: '1.0',
    name: 'Automation Architecture',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'PLC Commissioning',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

const mockResources: ProjectResource[] = [
  {
    resourceId: 'res-1',
    resourceCode: 'RES-ENG-01',
    name: 'Senior Controls Engineer',
    resourceType: RESOURCE_TYPE.PERSON,
    baseUom: 'Hours',
    directUnitCost: '75',
    unitPrice: '150',
    isActive: true,
  },
];

const mockBudgetLines: api.ProjectBudgetLineResponseDto[] = [
  {
    budgetLineId: 'bud-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    lineType: 'resource',
    resourceId: 'res-1',
    description: 'Controls Engineering Labor',
    plannedQuantity: '40',
    unitCost: '75',
    totalCost: '3000',
    unitPrice: '150',
    totalPrice: '6000',
  },
];

const mockEntry: api.ProjectLedgerEntryResponseDto = {
  ledgerId: 'led-1',
  projectId: 'prj-1',
  projectTaskId: 'task-1',
  resourceId: 'res-1',
  budgetLineId: 'bud-1',
  entryType: 'usage',
  lineType: 'resource',
  sourceType: 'timesheet',
  quantity: '8',
  unitCostBase: '75',
  totalCostBase: '600',
  unitPriceBase: '150',
  totalPriceBase: '1200',
  isBilled: false,
  createdBy: 'usr-1',
  postingDate: '2026-03-01T10:00:00Z',
  description: 'Initial architectural review',
};

const mockLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
  mockEntry,
  {
    ledgerId: 'led-2',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    resourceId: 'res-1',
    budgetLineId: 'bud-1',
    entryType: 'usage',
    lineType: 'resource',
    sourceType: 'timesheet',
    quantity: '12',
    unitCostBase: '75',
    totalCostBase: '900',
    unitPriceBase: '150',
    totalPriceBase: '1800',
    isBilled: false,
    createdBy: 'usr-1',
    postingDate: '2026-03-02T10:00:00Z',
  },
];

describe('EditResourceUsageSlideOver', () => {
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with prefilled entry details, budget allocation, and headroom calculation', () => {
    render(
      <EditResourceUsageSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entry={mockEntry}
        tasks={mockTasks}
        resources={mockResources}
        budgetLines={mockBudgetLines}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        onSubmit={mockOnSubmit}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Senior Controls Engineer')).toBeInTheDocument();
    expect(screen.getByLabelText(/labels\.budgetAllocation/i)).toBeInTheDocument();
    expect(screen.getByText(/Controls Engineering Labor/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Initial architectural review')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByDisplayValue('75')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    expect(screen.getByText('labels.budgetHeadroom')).toBeInTheDocument();
  });

  it('submits updated values including modified budgetLineId', async () => {
    render(
      <EditResourceUsageSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entry={mockEntry}
        tasks={mockTasks}
        resources={mockResources}
        budgetLines={mockBudgetLines}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        onSubmit={mockOnSubmit}
        onSuccess={mockOnSuccess}
      />
    );

    const qtyInput = screen.getByLabelText(/columns\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '16' } });

    const descInput = screen.getByLabelText(/columns\.notes/i);
    fireEvent.change(descInput, { target: { value: 'Deep dive architecture & SCADA specs' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.saveChanges' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'led-1',
        expect.objectContaining({
          projectTaskId: 'task-1',
          resourceId: 'res-1',
          budgetLineId: 'bud-1',
          quantity: 16,
          unitCost: 75,
          unitPrice: 150,
          description: 'Deep dive architecture & SCADA specs',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('allows unallocating budget line by selecting None (Unbudgeted / Other)', async () => {
    render(
      <EditResourceUsageSlideOver
        isOpen={true}
        onClose={mockOnClose}
        entry={mockEntry}
        tasks={mockTasks}
        resources={mockResources}
        budgetLines={mockBudgetLines}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        onSubmit={mockOnSubmit}
        onSuccess={mockOnSuccess}
      />
    );

    const budgetSelect = screen.getByLabelText(/labels\.budgetAllocation/i);
    fireEvent.change(budgetSelect, { target: { value: '__unbudgeted__' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.saveChanges' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'led-1',
        expect.objectContaining({
          budgetLineId: null,
        })
      );
    });
  });
});
