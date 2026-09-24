import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateBudgetLineSlideOver } from '../CreateBudgetLineSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      createBudgetLineTitle: 'Add Budget Line',
      createBudgetLineSubtitle: 'Define estimated resource hours, item materials, or expenses for a task.',
      'buttons.addBudgetLine': 'Add Budget Line',
      'buttons.saving': 'Saving...',
      'labels.task': 'Target Task',
      'labels.description': 'Description',
      'labels.prefillRateCard': 'Service / Rate Card',
      'labels.prefillService': 'Service / Rate Card',
      'labels.prefillProduct': 'Pre-fill from Inventory SKU',
      'labels.totalBudgetCost': 'Total Planned Cost',
      'labels.totalBudgetRevenue': 'Total Planned Revenue',
      'columns.lineType': 'Line Type',
      'columns.quantity': 'Quantity',
      'columns.uom': 'UoM',
      'columns.unitCost': 'Unit Cost',
      'columns.unitPrice': 'Unit Price',
      'columns.margin': 'Margin %',
      'placeholders.selectTaskPlaceholder': 'Select target task...',
      'placeholders.selectServiceRateCard': '— Select Service / Rate Card —',
      'placeholders.selectRateCard': 'Select a service role rate card...',
      'placeholders.selectProductSku': 'Select a product SKU...',
      'placeholders.budgetDescription': 'e.g. Controls Engineering',
      cancel: 'Cancel',
    };
    const t = (key: string) => translations[key] || (namespace ? `${namespace}.${key}` : key);
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  productsControllerFindAll: jest.fn(),
  projectsControllerFindAllResources: jest.fn(),
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
    name: 'Electrical Cabling',
    stateCode: 'not_started',
    isMilestone: false,
    isBillable: true,
  },
];

const mockResources: api.ProjectResourceResponseDto[] = [
  {
    resourceId: 'res-1',
    resourceNumber: 'RES-001',
    name: 'Senior Controls Engineer',
    resourceType: 'person',
    baseUom: 'HR',
    directUnitCost: '75',
    unitPrice: '150',
    isActive: true,
  },
] as unknown as api.ProjectResourceResponseDto[];

const mockProducts = [
  {
    productId: 'prod-1',
    productNumber: 'SKU-001',
    name: 'Industrial Ethernet Switch',
    productType: 'standard',
    standardCost: '200',
    listPrice: '350',
  },
  {
    productId: 'prod-srv-1',
    productNumber: 'SRV-001',
    name: 'Consulting Service',
    productType: 'service',
    baseUom: 'HR',
    standardCost: '80',
    listPrice: '160',
  },
] as unknown as api.ProductResponseDto[];

describe('CreateBudgetLineSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({ data: mockProducts });
    (api.projectsControllerFindAllResources as jest.Mock).mockResolvedValue({ data: mockResources });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CreateBudgetLineSlideOver
        isOpen={false}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders SlideOver with form fields and tasks dropdown when open', async () => {
    render(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    // Verify slide-over title
    expect(screen.getByRole('heading', { name: 'Add Budget Line' })).toBeInTheDocument();

    // Verify task options
    expect(screen.getByText('1.0 — Foundation & Framing')).toBeInTheDocument();
    expect(screen.getByText('2.0 — Electrical Cabling')).toBeInTheDocument();

    // Verify inputs
    expect(screen.getByText('Line Type')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('UoM')).toBeInTheDocument();
    expect(screen.getByText('Unit Cost')).toBeInTheDocument();
    expect(screen.getByText('Unit Price')).toBeInTheDocument();

    // Verify product search-select input
    expect(screen.getByPlaceholderText('Select a product SKU...')).toBeInTheDocument();
  });

  it('pre-fills description and rates when switching to Service and selecting a Service rate card', async () => {
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({
      data: mockProducts.filter((p) => p.productType === 'service'),
    });

    render(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    // Switch Line Type to Service
    const lineTypeSelect = screen.getByDisplayValue('Material');
    fireEvent.change(lineTypeSelect, { target: { value: 'resource' } });

    const searchInput = screen.getByPlaceholderText('Select a service role rate card...');
    fireEvent.change(searchInput, { target: { value: 'Consulting' } });

    await waitFor(() => {
      expect(screen.getByText(/SRV-001/)).toBeInTheDocument();
    });

    const option = screen.getByText(/SRV-001/);
    fireEvent.mouseDown(option);

    expect(screen.getByDisplayValue('Consulting Service')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HR')).toBeInTheDocument();
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    expect(screen.getByDisplayValue('160')).toBeInTheDocument();
  });

  it('pre-fills description and rates when selecting a Product SKU for Material', async () => {
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({
      data: mockProducts.filter((p) => p.productType !== 'service'),
    });

    render(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    const searchInput = screen.getByPlaceholderText('Select a product SKU...');
    fireEvent.change(searchInput, { target: { value: 'Ethernet' } });

    await waitFor(() => {
      expect(screen.getByText(/SKU-001/)).toBeInTheDocument();
    });

    const option = screen.getByText(/SKU-001/);
    fireEvent.mouseDown(option);

    expect(screen.getByDisplayValue('Industrial Ethernet Switch')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
    expect(screen.getByDisplayValue('350')).toBeInTheDocument();
  });

  it('submits valid budget line payload and calls onClose', async () => {
    render(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add Budget Line' })).toBeInTheDocument();
    });

    const descInput = screen.getByPlaceholderText('e.g. Controls Engineering');
    fireEvent.change(descInput, { target: { value: 'PLC Logic & HMI Configuration' } });

    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '40' } });

    const costInputs = screen.getAllByDisplayValue('0');
    fireEvent.change(costInputs[0], { target: { value: '80' } }); // unit cost
    fireEvent.change(costInputs[1], { target: { value: '160' } }); // unit price

    const submitBtn = screen.getByRole('button', { name: 'Add Budget Line' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          lineType: 'item',
          description: 'PLC Logic & HMI Configuration',
          plannedQuantity: 40,
          unitCost: 80,
          unitPrice: 160,
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when clicking Cancel', async () => {
    render(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add Budget Line' })).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('remembers the last selected Target Task when closed and reopened', async () => {
    const { rerender } = render(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add Budget Line' })).toBeInTheDocument();
    });

    // Change target task to task-2
    const taskSelect = screen.getByDisplayValue('1.0 — Foundation & Framing');
    fireEvent.change(taskSelect, { target: { value: 'task-2' } });
    expect(screen.getByDisplayValue('2.0 — Electrical Cabling')).toBeInTheDocument();

    // Close slide-over
    rerender(
      <CreateBudgetLineSlideOver
        isOpen={false}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    // Reopen slide-over
    rerender(
      <CreateBudgetLineSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        currency="USD"
        onSubmit={mockOnSubmit}
      />
    );

    // Verify task-2 is still selected
    expect(screen.getByDisplayValue('2.0 — Electrical Cabling')).toBeInTheDocument();
  });
});
