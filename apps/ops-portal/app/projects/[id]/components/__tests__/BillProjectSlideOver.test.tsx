import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BillProjectSlideOver } from '../BillProjectSlideOver';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translations: Record<string, string> = {
      createInvoiceTitle: 'Create Sales Invoice',
      createInvoiceSubtitle: 'Generate a sales invoice for project billing',
      'buttons.deselectAll': 'Deselect All',
      'buttons.selectAll': 'Select All',
      'buttons.createInvoice': 'Create Invoice',
      'buttons.creatingInvoice': 'Creating Invoice...',
      'labels.unassignedTask': 'General / Unassigned',
      'columns.entryDate': 'Invoice Date',
      'columns.discount': 'Discount',
      'buttons.remove': 'Remove',
      tax: 'Tax',
      subtotal: 'Subtotal',
      total: 'Total',
    };
    const t = (key: string, values?: Record<string, unknown>) => {
      if (values) {
        return `${translations[key] || key}:${JSON.stringify(values)}`;
      }
      return translations[key] || key;
    };
    t.has = () => true;
    return t;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@herobm/sdk', () => ({
  taxCategoriesControllerFindAll: jest.fn().mockResolvedValue({
    data: [
      { taxCategoryId: 'tax-std', name: 'Standard Rate (10%)', title: 'Standard Rate', rate: '10' },
      { taxCategoryId: 'tax-zero', name: 'Zero Rated', title: 'Zero Rated', rate: '0' },
    ],
  }),
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
    budgetLineId: 'bud-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    lineType: 'resource',
    description: 'Engineering Labor',
    plannedQuantity: '40',
    unitCost: '50',
    totalCost: '2000',
    unitPrice: '100',
    totalPrice: '4000',
  },
];

const mockUnbilledEntries: api.ProjectLedgerEntryResponseDto[] = [
  {
    ledgerId: 'led-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'resource',
    sourceType: 'timesheet',
    description: 'Labor: Site prep 8 hrs',
    quantity: '8',
    unitCostBase: '80.00',
    totalCostBase: '640.00',
    unitPriceBase: '150.00',
    totalPriceBase: '1200.00',
    isBilled: false,
    postingDate: '2026-03-01T10:00:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'led-2',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    entryType: 'sale',
    lineType: 'item',
    sourceType: 'inventory_issue',
    description: 'Materials: High-voltage cable',
    quantity: '50',
    unitCostBase: '10.00',
    totalCostBase: '500.00',
    unitPriceBase: '15.00',
    totalPriceBase: '750.00',
    isBilled: false,
    postingDate: '2026-03-02T11:00:00Z',
    createdBy: 'admin',
  },
];

describe('BillProjectSlideOver', () => {
  const mockBillProject = jest.fn().mockResolvedValue({
    invoiceId: 'inv-123',
    invoiceNumber: 'INV-2026-0001',
    totalAmount: '1950.00',
    taxAmount: '0.00',
    currencyCode: 'USD',
    stateCode: 'draft',
    billedCount: 2,
  });
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SlideOver header with formatted billing type in brackets and tabs at top', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Test Tower Construction"
        projectBillingType="time_and_materials"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Title & subtitle formatted with brackets
    expect(screen.getByText('Create Sales Invoice')).toBeInTheDocument();
    expect(screen.getByText('PRJ-001 — Test Tower Construction (Time & Materials)')).toBeInTheDocument();

    // Redundant labels removed
    expect(screen.queryByText('Billing Method')).not.toBeInTheDocument();
    expect(screen.queryByText(/Project Contract:/i)).not.toBeInTheDocument();

    // Tabs rendered at top
    expect(screen.getByRole('tab', { name: /^Time & Materials \(WIP\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Milestone Task/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Progress Drawdown/i })).toBeInTheDocument();

    // Editable invoice lines table rendered
    expect(screen.getByText('Invoice Lines (2)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Labor: Site prep 8 hrs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Materials: High-voltage cable')).toBeInTheDocument();

    // Default total sum ($1200 + $750 = $1,950.00)
    expect(screen.getAllByText('$1,950.00').length).toBeGreaterThanOrEqual(1);
  });

  it('allows deselecting and selecting WIP items in T&M mode', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Deselect all
    const deselectBtn = screen.getByRole('button', { name: /buttons\.deselectAll|Deselect All/i });
    fireEvent.click(deselectBtn);

    // Invoice lines drop to 0
    expect(screen.getByText('Invoice Lines (0)')).toBeInTheDocument();
    expect(
      screen.getByText(/No line items selected for billing/i)
    ).toBeInTheDocument();

    // Select all back
    const selectAllBtn = screen.getByRole('button', { name: /buttons\.selectAll|Select All/i });
    fireEvent.click(selectAllBtn);

    // Invoice lines back to 2
    expect(screen.getByText('Invoice Lines (2)')).toBeInTheDocument();
    expect(screen.getAllByText('$1,950.00').length).toBeGreaterThanOrEqual(1);
  });

  it('allows adjusting discount and removing a line in the editable invoice table', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Initial total is $1,950.00
    expect(screen.getByText('Invoice Lines (2)')).toBeInTheDocument();

    // Find discount inputs (rendered as spinbuttons or placeholders)
    const discountInputs = screen.getAllByPlaceholderText('0');
    expect(discountInputs.length).toBe(2);

    // Apply 10% discount to first line (Labor: $1200 -> $1080, save $120)
    fireEvent.change(discountInputs[0], { target: { value: '10' } });

    // Net total is now $1,080 + $750 = $1,830.00
    expect(screen.getAllByText('$1,830.00').length).toBeGreaterThanOrEqual(1);

    // Remove the second line item using remove line button
    const removeButtons = screen.getAllByTitle('Remove');
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[1]);

    // Now only 1 invoice line remains (amount = $1,080.00)
    expect(screen.getByText('Invoice Lines (1)')).toBeInTheDocument();
    expect(screen.getAllByText('$1,080.00').length).toBeGreaterThanOrEqual(1);

    // Submit the edited invoice
    const submitBtn = screen.getByRole('button', { name: /Create Invoice/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBillProject).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              projectLedgerEntryId: 'led-1',
              quantity: 8,
              pricePerUnit: 150,
              discountPercentage: 10,
              amount: 1080,
            }),
          ],
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Sales invoice INV-2026-0001 created successfully');
    });
  });

  it('switches to Milestone mode and submits a milestone task line', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Switch to Milestone tab
    fireEvent.click(screen.getByRole('tab', { name: /^Milestone Task/i }));

    expect(screen.getByText('Invoice Lines (1)')).toBeInTheDocument();

    // Fill in unit price in the invoice line table
    const priceInputs = screen.getAllByRole('spinbutton');
    // Price input is one of the spinbuttons in the editable table
    fireEvent.change(priceInputs[1], { target: { value: '2500' } });

    // Click submit button
    const submitBtn = screen.getByRole('button', { name: /Create Invoice/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBillProject).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              projectTaskId: 'task-1',
              amount: 2500,
            }),
          ]),
        })
      );
    });
  });

  it('switches to Progress Drawdown mode and calculates percentage claim', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        budgetLines={mockBudgetLines} // $4,000 budget
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Switch to Progress tab
    fireEvent.click(screen.getByRole('tab', { name: /^Progress Drawdown/i }));

    expect(screen.getByText('Progress Claim Setup')).toBeInTheDocument();
    // Default 20% of $4,000 budget = $800.00
    expect(screen.getAllByText('$800.00').length).toBeGreaterThanOrEqual(1);

    // Change claim percentage to 50%
    const percentInput = screen.getByDisplayValue('20');
    fireEvent.change(percentInput, { target: { value: '50' } });

    // Recalculated 50% = $2,000.00
    expect(screen.getAllByText('$2,000.00').length).toBeGreaterThanOrEqual(1);

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Create Invoice/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBillProject).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              amount: 2000,
            }),
          ]),
        })
      );
    });
  });

  it('respects project-level Cost Plus billing type and calculates markup correctly', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Commercial Complex"
        projectBillingType="cost_plus"
        customerPaymentTerms="14 Days (NET14)"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Header has subtitle with (Cost Plus)
    expect(screen.getByText('PRJ-001 — Commercial Complex (Cost Plus)')).toBeInTheDocument();
    expect(screen.getByText('Cost Plus Pricing Engine')).toBeInTheDocument();
    expect(screen.getByText('14 Days (NET14)')).toBeInTheDocument();

    // Default 15% markup on total cost ($640 + $500 = $1,140 cost -> $1,140 * 1.15 = $1,311.00)
    // Unit costs: $80 * 1.15 = $92/unit for 8 units = $736.00
    // $10 * 1.15 = $11.50/unit for 50 units = $575.00
    // Total = $736 + $575 = $1,311.00
    expect(screen.getAllByText('$1,311.00').length).toBeGreaterThanOrEqual(1);

    // Submit cost plus invoice
    const submitBtn = screen.getByRole('button', { name: /Create Invoice/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBillProject).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              projectLedgerEntryId: 'led-1',
              pricePerUnit: 92,
              amount: 736,
            }),
            expect.objectContaining({
              projectLedgerEntryId: 'led-2',
              pricePerUnit: 11.5,
              amount: 575,
            }),
          ]),
        })
      );
    });
  });

  it('excludes isBillable: false entries from eligible billing list', async () => {
    const mixedEntries: api.ProjectLedgerEntryResponseDto[] = [
      ...mockUnbilledEntries,
      {
        ledgerId: 'led-nonbillable',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'item',
        sourceType: 'inventory_return',
        description: 'Returned materials',
        quantity: '-1',
        unitCostBase: '50.00',
        totalCostBase: '-50.00',
        unitPriceBase: '0.00',
        totalPriceBase: '0.00',
        isBilled: false,
        isBillable: false,
        postingDate: '2026-03-03T10:00:00Z',
        createdBy: 'admin',
      },
    ];

    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mixedEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Non-billable entry should not be rendered in the unbilled list
    expect(screen.queryByText('Returned materials')).not.toBeInTheDocument();
  });

  it('maintains invoice line ordering matching the selection table above when items are selected or toggled', async () => {
    const multiTaskEntries: api.ProjectLedgerEntryResponseDto[] = [
      {
        ledgerId: 'led-t2',
        projectId: 'prj-1',
        projectTaskId: 'task-2',
        entryType: 'usage',
        lineType: 'resource',
        sourceType: 'timesheet',
        description: 'Task 2 Electrical Work',
        quantity: '5',
        unitCostBase: '50.00',
        totalCostBase: '250.00',
        unitPriceBase: '100.00',
        totalPriceBase: '500.00',
        isBilled: false,
        postingDate: '2026-03-02T10:00:00Z',
        createdBy: 'admin',
      },
      {
        ledgerId: 'led-t1-a',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'resource',
        sourceType: 'timesheet',
        description: 'Task 1 Foundation Digging',
        quantity: '10',
        unitCostBase: '25.00',
        totalCostBase: '250.00',
        unitPriceBase: '50.00',
        totalPriceBase: '500.00',
        isBilled: false,
        postingDate: '2026-03-01T10:00:00Z',
        createdBy: 'admin',
      },
      {
        ledgerId: 'led-t1-b',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'resource',
        sourceType: 'timesheet',
        description: 'Task 1 Concrete Pouring',
        quantity: '8',
        unitCostBase: '35.00',
        totalCostBase: '280.00',
        unitPriceBase: '75.00',
        totalPriceBase: '600.00',
        isBilled: false,
        postingDate: '2026-03-01T12:00:00Z',
        createdBy: 'admin',
      },
    ];

    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={multiTaskEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Get input descriptions in the invoice table
    const getInvoiceLineDescriptions = () => {
      const inputs = screen.getAllByPlaceholderText('Line item description') as HTMLInputElement[];
      return inputs.map((input) => input.value);
    };

    // The order in the table above is Task 2 first (since led-t2 is encountered first), or Task 1 if grouped:
    // led-t2, then led-t1-a, led-t1-b (grouped as task-2 then task-1)
    expect(getInvoiceLineDescriptions()).toEqual([
      'Task 2 Electrical Work',
      'Task 1 Foundation Digging',
      'Task 1 Concrete Pouring',
    ]);

    // Deselect all
    const deselectBtn = screen.getByRole('button', { name: /buttons\.deselectAll|Deselect All/i });
    fireEvent.click(deselectBtn);
    expect(screen.queryByPlaceholderText('Line item description')).not.toBeInTheDocument();

    // Now select Task 1 Concrete Pouring (third item in checklist), then Task 2 Electrical Work (first item)
    const checkboxes = screen.getAllByRole('checkbox');
    // checkbox 0 is Task 2 Electrical Work, 1 is Task 1 Digging, 2 is Task 1 Pouring
    fireEvent.click(checkboxes[2]); // select Concrete Pouring
    fireEvent.click(checkboxes[0]); // select Electrical Work

    // Order in invoice lines must follow the selection table above (Task 2 Electrical first, Task 1 Concrete second)
    expect(getInvoiceLineDescriptions()).toEqual([
      'Task 2 Electrical Work',
      'Task 1 Concrete Pouring',
    ]);
  });

  it('displays "Material" instead of "Item" and "Labor" instead of "Resource" in WIP transaction lists', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // led-1 is resource -> Labor
    expect(screen.getByText('• Labor')).toBeInTheDocument();
    // led-2 is item -> Material
    expect(screen.getByText('• Material')).toBeInTheDocument();
    // Verify "Item" is not displayed as a line type
    expect(screen.queryByText('• Item')).not.toBeInTheDocument();
  });

  it('dynamically recalculates tax and grand total when tax category is changed', async () => {
    render(
      <BillProjectSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        tasks={mockTasks}
        budgetLines={mockBudgetLines}
        unbilledEntries={mockUnbilledEntries}
        currency="USD"
        billProject={mockBillProject}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for tax categories to load
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: /Standard Rate \(10%\)/i }).length).toBeGreaterThanOrEqual(1);
    });

    // Subtotal is $1,950.00, Tax is $0.00 initially
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();

    // Select Default Tax Category = 10% Standard Rate
    const defaultTaxSelect = screen.getByLabelText(/Default Tax Category/i);
    fireEvent.change(defaultTaxSelect, { target: { value: 'tax-std' } });

    // 10% of $1,950 = $195.00 tax, Grand Total = $2,145.00
    await waitFor(() => {
      expect(screen.getByText('$195.00')).toBeInTheDocument();
      expect(screen.getByText('$2,145.00')).toBeInTheDocument();
    });
  });
});

