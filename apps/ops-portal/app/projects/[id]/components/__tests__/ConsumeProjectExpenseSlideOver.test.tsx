import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConsumeProjectExpenseSlideOver } from '../ConsumeProjectExpenseSlideOver';
import * as api from '@herobm/sdk';

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
    name: 'Foundation Construction',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'Electrical Installation',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

const mockBudgetLines: api.ProjectBudgetLineResponseDto[] = [
  {
    budgetLineId: 'bud-exp-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    lineType: 'expense',
    description: 'Site Permits & Inspection Fees',
    plannedQuantity: '1',
    unitCost: '500',
    totalCost: '500',
    unitPrice: '600',
    totalPrice: '600',
  },
];

const mockLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
  {
    ledgerId: 'led-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    budgetLineId: 'bud-exp-1',
    entryType: 'usage',
    lineType: 'expense',
    sourceType: 'manual_journal',
    description: 'Initial permit application',
    quantity: '1',
    unitCostBase: '200',
    totalCostBase: '200',
    unitPriceBase: '250',
    totalPriceBase: '250',
    isBilled: false,
    postingDate: '2026-03-01T10:00:00Z',
    createdBy: 'admin',
  },
];

describe('ConsumeProjectExpenseSlideOver', () => {
  const mockConsumeExpense = jest.fn().mockResolvedValue(undefined);
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SlideOver with tasks, budget allocation dropdown, and input fields', () => {
    render(
      <ConsumeProjectExpenseSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        consumeExpense={mockConsumeExpense}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('labels.task')).toBeInTheDocument();
    expect(screen.getByText('1.0 — Foundation Construction')).toBeInTheDocument();
    expect(screen.getByLabelText(/labels\.budgetAllocation/i)).toBeInTheDocument();
    expect(screen.getByText(/Site Permits & Inspection Fees/)).toBeInTheDocument();
  });

  it('submits expense with selected budget line and payload values', async () => {
    render(
      <ConsumeProjectExpenseSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        consumeExpense={mockConsumeExpense}
        onSuccess={mockOnSuccess}
      />
    );

    const budgetSelect = screen.getByLabelText(/labels\.budgetAllocation/i);
    fireEvent.change(budgetSelect, { target: { value: 'bud-exp-1' } });

    const descInput = screen.getByPlaceholderText('placeholders.expenseDescription');
    fireEvent.change(descInput, { target: { value: 'Soil Testing Permit' } });

    const qtyInput = screen.getByLabelText(/columns\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '2' } });

    const costInput = screen.getByLabelText(/columns\.unitCost/i);
    fireEvent.change(costInput, { target: { value: '150' } });

    const priceInput = screen.getByLabelText(/columns\.unitPrice/i);
    fireEvent.change(priceInput, { target: { value: '200' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.recordExpense' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConsumeExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          budgetLineId: 'bud-exp-1',
          description: 'Soil Testing Permit',
          quantity: 2,
          unitCost: 150,
          unitPrice: 200,
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('allows unbudgeted selection', async () => {
    render(
      <ConsumeProjectExpenseSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        consumeExpense={mockConsumeExpense}
        onSuccess={mockOnSuccess}
      />
    );

    const budgetSelect = screen.getByLabelText(/labels\.budgetAllocation/i);
    fireEvent.change(budgetSelect, { target: { value: '__unbudgeted__' } });

    const descInput = screen.getByPlaceholderText('placeholders.expenseDescription');
    fireEvent.change(descInput, { target: { value: 'Unbudgeted Courier Fee' } });

    const costInput = screen.getByLabelText(/columns\.unitCost/i);
    fireEvent.change(costInput, { target: { value: '45' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.recordExpense' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConsumeExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          budgetLineId: undefined,
          description: 'Unbudgeted Courier Fee',
          quantity: 1,
          unitCost: 45,
        })
      );
    });
  });
});
