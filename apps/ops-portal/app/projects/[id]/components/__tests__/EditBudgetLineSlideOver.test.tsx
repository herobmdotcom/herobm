import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditBudgetLineSlideOver } from '../EditBudgetLineSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      editBudgetLineTitle: 'Edit Budget Line',
      'labels.task': 'Target Task',
      'labels.description': 'Description',
      'columns.lineType': 'Line Type',
      'columns.quantity': 'Quantity',
      'columns.uom': 'UoM',
      'columns.unitCost': 'Unit Cost',
      'columns.unitPrice': 'Unit Price',
      'labels.totalBudgetCost': 'Total Cost',
      'labels.totalBudgetRevenue': 'Total Revenue',
      'columns.margin': 'Margin %',
      'placeholders.budgetDescription': 'e.g. Controls Engineering',
      'placeholders.selectTaskPlaceholder': 'Select target task...',
      'buttons.saveChanges': 'Save Changes',
      'buttons.saving': 'Saving...',
      cancel: 'Cancel',
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
];

const mockBudgetLine: api.ProjectBudgetLineResponseDto = {
  budgetLineId: 'bud-1',
  projectId: 'prj-1',
  projectTaskId: 'task-1',
  lineType: 'resource',
  description: 'Structural Engineering',
  plannedQuantity: '10',
  unitCost: '100',
  unitPrice: '150',
  totalCost: '1000',
  totalPrice: '1500',
};

describe('EditBudgetLineSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <EditBudgetLineSlideOver
        isOpen={false}
        onClose={mockOnClose}
        line={mockBudgetLine}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders preloaded budget line details and computes live margin', () => {
    render(
      <EditBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        line={mockBudgetLine}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByRole('heading', { name: 'Edit Budget Line' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Service')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Structural Engineering')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
  });

  it('submits updated values correctly', async () => {
    render(
      <EditBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        line={mockBudgetLine}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    const qtyInput = screen.getByDisplayValue('10');
    fireEvent.change(qtyInput, { target: { value: '20' } });

    const submitBtn = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          lineType: 'resource',
          description: 'Structural Engineering',
          plannedQuantity: 20,
          unitCost: 100,
          unitPrice: 150,
        }),
        'bud-1'
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
