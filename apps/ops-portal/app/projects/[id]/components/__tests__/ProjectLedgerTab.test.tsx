import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectLedgerTab } from '../ProjectLedgerTab';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'tabs.accounts': 'Accounts',
      'tabs.allTransactions': 'All Transactions',
      'tabs.unbilledWip': 'Unbilled (WIP)',
      'tabs.billed': 'Billed',
      'tabs.nonBillable': 'Non-Billable',
      'sections.kpis': 'Project KPIs',
      'sections.invoices': 'Project Sales Invoices',
      'columns.entryDate': 'Date',
      'columns.entryType': 'Entry Type',
      'columns.taskCode': 'Task Code',
      'columns.lineType': 'Line Type',
      'columns.billing': 'Billing',
      'columns.total': 'Total',
      'columns.customer': 'Customer',
      'columns.date': 'Date',
      'columns.dueDate': 'Due Date',
      'columns.invoiceNumber': 'Invoice #',
      'columns.tax': 'Tax',
      'columns.balanceDue': 'Balance Due',
      'columns.endDate': 'End Date',
      'columns.orderNumber': 'Order Number',
      'columns.status': 'Status',
      'labels.task': 'Target Task',
      'labels.description': 'Description',
      'labels.noInvoices': 'No sales invoices have been issued for this project yet.',
      'columns.quantity': 'Quantity',
      'columns.actualCost': 'Actual Cost',
      'columns.actualRevenue': 'Actual Revenue',
      'columns.sourceRef': 'Source Reference',
      'labels.billedBadge': 'Billed',
      'labels.unbilledBadge': 'Unbilled',
      'labels.nonBillableBadge': 'Non-Billable',
      'labels.unbilledWip': 'Unbilled',
      'labels.unassignedTask': 'General / Unassigned',
      'entryTypes.usage': 'Usage',
      'entryTypes.sale': 'Sale',
      'entryTypes.return': 'Stock Return',
      'sourceTypes.timesheet': 'Timesheet',
      'sourceTypes.inventory_issue': 'Stock Issue',
      'sourceTypes.inventory_return': 'Stock Return',
      'sourceTypes.manual_journal': 'Manual Journal',
      'sourceTypes.purchase_invoice': 'Vendor Bill',
      'buttons.createInvoice': 'Create Invoice',
      'buttons.recordExpense': 'Record Expense',
      'buttons.markBillable': 'Mark Billable',
      'buttons.markNonBillable': 'Mark Non-Billable',
      noTransactions: 'No ledger transactions posted yet.',
    };
    const t = (key: string, values?: Record<string, unknown>) => {
      if (key === 'labels.itemsCount' && values?.count !== undefined) {
        return `${values.count} ${values.count === 1 ? 'item' : 'items'}`;
      }
      return translations[key] || (namespace ? `${namespace}.${key}` : key);
    };
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
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
    taskCode: '2.1',
    name: 'Electrical Cabling',
    stateCode: 'completed',
    isMilestone: false,
    isBillable: true,
  },
];

const mockLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
  {
    ledgerId: 'led-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'resource',
    sourceType: 'timesheet',
    sourceId: 'src-1',
    resourceId: 'res-1',
    description: 'Labor: Site prep 8 hrs',
    quantity: '8',
    unitCostBase: '80.00',
    totalCostBase: '640.00',
    unitPriceBase: '150.00',
    totalPriceBase: '1200.00',
    isBilled: false,
    postingDate: '2026-03-01T10:00:00Z',
    createdBy: 'admin',
    createdOn: '2026-03-01T10:00:00Z',
  },
  {
    ledgerId: 'led-2',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    entryType: 'sale',
    lineType: 'item',
    sourceType: 'inventory_issue',
    sourceId: 'src-2-long-id-12345',
    inventoryEntryId: 'inv-entry-2',
    description: 'Materials: High-voltage cable',
    quantity: '50',
    unitCostBase: '10.00',
    totalCostBase: '500.00',
    unitPriceBase: '15.00',
    totalPriceBase: '750.00',
    isBilled: true,
    salesInvoiceNumber: 'INV-2026-0001',
    salesInvoiceId: 'inv-12345678',
    postingDate: '2026-03-02T11:00:00Z',
    createdBy: 'admin',
    createdOn: '2026-03-02T11:00:00Z',
  },
  {
    ledgerId: 'led-3',
    projectId: 'prj-1',
    projectTaskId: 'task-unknown',
    entryType: 'usage',
    lineType: 'expense',
    sourceType: 'manual_journal',
    sourceId: 'je-33333333',
    description: 'Unassigned expense',
    quantity: '1',
    unitCostBase: '250.00',
    totalCostBase: '250.00',
    unitPriceBase: '300.00',
    totalPriceBase: '300.00',
    isBilled: false,
    postingDate: '2026-03-03T09:00:00Z',
    createdBy: 'admin',
    createdOn: '2026-03-03T09:00:00Z',
  },
  {
    ledgerId: 'led-4',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_return',
    sourceId: 'ret-12345678',
    inventoryEntryId: 'ret-12345678',
    description: 'Returned 2x Couplings (Ref: TRC-001)',
    quantity: '-2',
    unitCostBase: '40.00',
    totalCostBase: '-80.00',
    unitPriceBase: '60.00',
    totalPriceBase: '-120.00',
    isBilled: false,
    postingDate: '2026-03-04T09:00:00Z',
    createdBy: 'admin',
    createdOn: '2026-03-04T09:00:00Z',
  },
  {
    ledgerId: 'led-5',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_issue',
    description: 'Reallocated from staging to Task for 50x Cable',
    quantity: '-50',
    unitCostBase: '10.00',
    totalCostBase: '-500.00',
    unitPriceBase: '15.00',
    totalPriceBase: '-750.00',
    isBilled: false,
    postingDate: '2026-03-02T11:00:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'led-6',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_issue',
    description: 'Staged 100x Cable (Ref: Transfer Staging Putaway)',
    quantity: '100',
    unitCostBase: '10.00',
    totalCostBase: '1000.00',
    unitPriceBase: '15.00',
    totalPriceBase: '1500.00',
    isBilled: false,
    postingDate: '2026-03-01T10:00:00Z',
    createdBy: 'admin',
  },
];

const mockProfitability: api.ProjectProfitabilityResponseDto = {
  projectId: 'prj-1',
  totalBudgetCost: 2000,
  totalBudgetPrice: 3500,
  totalActualCost: 1310,
  totalBillablePrice: 2130,
  totalBilledPrice: 750,
  costVariance: 690,
  estimatedMarginPercent: 42.9,
  actualMarginPercent: 38.5,
  laborActualCost: 640,
  materialActualCost: 420,
  expenseActualCost: 250,
};

const mockInvoices: api.SalesInvoiceResponseDto[] = [
  {
    invoiceId: 'inv-12345678',
    invoiceNumber: 'INV-2026-0001',
    customerId: 'cust-1',
    customerName: 'Acme Corporation',
    totalAmount: '1200.00',
    outstandingAmount: '600.00',
    taxAmount: '100.00',
    currencyCode: 'USD',
    stateCode: 'issued',
    createdBy: 'admin',
    createdOn: '2026-03-02T11:00:00Z',
    invoiceDate: '2026-03-02T11:00:00Z',
    dueDate: '2026-04-01T11:00:00Z',
    lines: [],
  },
];

describe('ProjectLedgerTab', () => {
  it('renders exact KPI metrics matching Project Overview tab', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
        profitability={mockProfitability}
      />
    );

    // KPI Headers & Values
    expect(screen.getByText('Project KPIs')).toBeInTheDocument();
    expect(screen.getByText('Total Budget Cost')).toBeInTheDocument();
    expect(screen.getByText('Total Actual Cost')).toBeInTheDocument();
    expect(screen.getByText('Budget Revenue')).toBeInTheDocument();
    expect(screen.getByText('Billable Revenue')).toBeInTheDocument();
    expect(screen.getByText('Billed Revenue')).toBeInTheDocument();
    expect(screen.getByText('Actual Margin %')).toBeInTheDocument();

    // Removed items
    expect(screen.queryByText('Cost Variance')).not.toBeInTheDocument();
    expect(screen.queryByText(/Actual Cost Breakdown:/)).not.toBeInTheDocument();
  });

  it('renders standard Tabs for All vs Unbilled vs Billed vs Non-Billable with counts', () => {
    const entriesWithNonBillable: api.ProjectLedgerEntryResponseDto[] = [
      ...mockLedgerEntries,
      {
        ledgerId: 'led-nonbill',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'item',
        sourceType: 'inventory_return',
        description: 'Non-billable credit adjustment',
        quantity: '-1',
        unitCostBase: '50.00',
        totalCostBase: '-50.00',
        unitPriceBase: '0.00',
        totalPriceBase: '0.00',
        isBilled: false,
        isBillable: false,
        postingDate: '2026-03-05T09:00:00Z',
        createdBy: 'admin',
      },
    ];

    render(
      <ProjectLedgerTab
        ledgerEntries={entriesWithNonBillable}
        tasks={mockTasks}
        currency="USD"
      />
    );

    // Tab buttons (no material icons)
    expect(screen.getByRole('tab', { name: /^All Transactions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Unbilled \(WIP\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Billed/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Non-Billable/i })).toBeInTheDocument();

    // Counts: 5 non-staging entries (3 unbilled billable, 1 billed, 1 non-billable)
    expect(screen.getByText('(5)')).toBeInTheDocument(); // All
    expect(screen.getByText('(3)')).toBeInTheDocument(); // Unbilled
    expect(screen.getAllByText('(1)').length).toBeGreaterThanOrEqual(2); // Billed and Non-Billable
  });

  it('filters entries when clicking Unbilled, Billed, or Non-Billable tabs', () => {
    const entriesWithNonBillable: api.ProjectLedgerEntryResponseDto[] = [
      ...mockLedgerEntries,
      {
        ledgerId: 'led-nonbill',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'item',
        sourceType: 'inventory_return',
        description: 'Non-billable credit adjustment',
        quantity: '-1',
        unitCostBase: '50.00',
        totalCostBase: '-50.00',
        unitPriceBase: '0.00',
        totalPriceBase: '0.00',
        isBilled: false,
        isBillable: false,
        postingDate: '2026-03-05T09:00:00Z',
        createdBy: 'admin',
      },
    ];

    render(
      <ProjectLedgerTab
        ledgerEntries={entriesWithNonBillable}
        tasks={mockTasks}
        currency="USD"
      />
    );

    // In 'All Transactions' tab by default
    expect(screen.getAllByText('Labor: Site prep 8 hrs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Materials: High-voltage cable').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Non-billable credit adjustment').length).toBeGreaterThanOrEqual(1);

    // Click 'Billed' tab
    fireEvent.click(screen.getByRole('tab', { name: /^Billed/i }));

    // Billed entry is present, unbilled/non-billable entries are filtered out
    expect(screen.getAllByText('Materials: High-voltage cable').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Labor: Site prep 8 hrs')).not.toBeInTheDocument();
    expect(screen.queryByText('Non-billable credit adjustment')).not.toBeInTheDocument();

    // Click 'Unbilled (WIP)' tab
    fireEvent.click(screen.getByRole('tab', { name: /^Unbilled \(WIP\)/i }));

    // Unbilled entry is present, billed/non-billable entries are filtered out
    expect(screen.getAllByText('Labor: Site prep 8 hrs').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Materials: High-voltage cable')).not.toBeInTheDocument();
    expect(screen.queryByText('Non-billable credit adjustment')).not.toBeInTheDocument();

    // Click 'Non-Billable' tab
    fireEvent.click(screen.getByRole('tab', { name: /^Non-Billable/i }));

    // Non-billable entry is present, unbilled billable/billed entries are filtered out
    expect(screen.getAllByText('Non-billable credit adjustment').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Labor: Site prep 8 hrs')).not.toBeInTheDocument();
    expect(screen.queryByText('Materials: High-voltage cable')).not.toBeInTheDocument();
  });

  it('renders unified table structured like Budget table with task roll-up lines and Billing column', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
      />
    );

    // Task Summary Roll-up Rows (formatted as "1.0 - Task Name (count)")
    expect(screen.getAllByText('1.0 - Foundation & Framing (2)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2.1 - Electrical Cabling (1)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('General / Unassigned (1)').length).toBeGreaterThanOrEqual(1);

    // Billing column header
    expect(screen.getAllByText('Billing').length).toBeGreaterThanOrEqual(1);

    // Grand totals footer
    expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1);
  });

  it('renders clickable source reference links with correct routes without material icons', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
      />
    );

    // Stock Issue link to inventory ledger
    const stockIssueLinks = screen.getAllByRole('link', { name: /Stock Issue #src-2-lo/i });
    expect(stockIssueLinks.length).toBeGreaterThanOrEqual(1);
    expect(stockIssueLinks[0]).toHaveAttribute('href', '/inventory/ledger?entryId=inv-entry-2');

    // Timesheet link to resource detail
    const timesheetLinks = screen.getAllByRole('link', { name: /Timesheet #src-1/i });
    expect(timesheetLinks.length).toBeGreaterThanOrEqual(1);
    expect(timesheetLinks[0]).toHaveAttribute('href', '/resources/res-1');

    // Manual Journal link to GL
    const journalLinks = screen.getAllByRole('link', { name: /Manual Journal #je-33333/i });
    expect(journalLinks.length).toBeGreaterThanOrEqual(1);
    expect(journalLinks[0]).toHaveAttribute('href', '/general-ledger/journal-entries?entry=je-33333333');
  });

  it('renders Create Invoice button when isEditable and billProject are provided', () => {
    const mockBillProject = jest.fn();
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        billProject={mockBillProject}
      />
    );

    const createInvoiceBtn = screen.getByRole('button', { name: /Create Invoice/i });
    expect(createInvoiceBtn).toBeInTheDocument();

    // Click button to open slideover
    fireEvent.click(createInvoiceBtn);
    expect(screen.getByRole('tab', { name: /^Time & Materials \(WIP\)/i })).toBeInTheDocument();
  });

  it('renders Stock Return entry type for inventory return entries', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
      />
    );

    // Stock Return entry type badge for led-4 (sourceType: inventory_return)
    expect(screen.getAllByText('Stock Return').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Non-Billable select badge for entries where isBillable is false and allows toggling', () => {
    const mockSetBillable = jest.fn();
    const entriesWithNonBillable: api.ProjectLedgerEntryResponseDto[] = [
      ...mockLedgerEntries,
      {
        ledgerId: 'led-nonbill',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'item',
        sourceType: 'inventory_return',
        description: 'Non-billable credit adjustment',
        quantity: '-1',
        unitCostBase: '50.00',
        totalCostBase: '-50.00',
        unitPriceBase: '0.00',
        totalPriceBase: '0.00',
        isBilled: false,
        isBillable: false,
        postingDate: '2026-03-05T09:00:00Z',
        createdBy: 'admin',
      },
    ];

    render(
      <ProjectLedgerTab
        ledgerEntries={entriesWithNonBillable}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        setLedgerEntryBillable={mockSetBillable}
      />
    );

    // Non-Billable option is rendered in the select
    expect(screen.getAllByText('Non-Billable').length).toBeGreaterThanOrEqual(1);

    // Find select elements with aria-label="Billing Status"
    const selects = screen.getAllByRole('combobox', { name: /Billing Status/i }) as HTMLSelectElement[];
    expect(selects.length).toBeGreaterThanOrEqual(1);

    // Change non-billable entry select to 'billable'
    const nonBillableSelect = selects.find((s) => s.value === 'non_billable')!;
    expect(nonBillableSelect).toBeDefined();
    fireEvent.change(nonBillableSelect, { target: { value: 'billable' } });
    expect(mockSetBillable).toHaveBeenCalledWith('led-nonbill', true);

    // Change billable entry select to 'non_billable'
    const billableSelect = selects.find((s) => s.value === 'billable')!;
    expect(billableSelect).toBeDefined();
    fireEvent.change(billableSelect, { target: { value: 'non_billable' } });
    expect(mockSetBillable).toHaveBeenCalledWith('led-1', false);
  });

  it('renders invoice number with link in Billing column for billed lines and falls back to Billed badge if missing', () => {
    const entriesWithBilledVariants: api.ProjectLedgerEntryResponseDto[] = [
      ...mockLedgerEntries,
      {
        ledgerId: 'led-billed-no-inv',
        projectId: 'prj-1',
        projectTaskId: 'task-1',
        entryType: 'usage',
        lineType: 'item',
        sourceType: 'inventory_issue',
        description: 'Legacy billed line without invoice reference',
        quantity: '5',
        unitCostBase: '20.00',
        totalCostBase: '100.00',
        unitPriceBase: '30.00',
        totalPriceBase: '150.00',
        isBilled: true,
        postingDate: '2026-03-02T11:00:00Z',
        createdBy: 'admin',
      },
    ];

    render(
      <ProjectLedgerTab
        ledgerEntries={entriesWithBilledVariants}
        tasks={mockTasks}
        currency="USD"
      />
    );

    // Billed entry with invoice number and ID renders clickable link
    const invLinks = screen.getAllByRole('link', { name: 'INV-2026-0001' });
    expect(invLinks.length).toBeGreaterThanOrEqual(1);
    expect(invLinks[0]).toHaveAttribute('href', '/sales-invoices/inv-12345678');

    // Billed entry without invoice number falls back to Billed badge
    expect(screen.getAllByText('Billed').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no tasks or ledger entries exist', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={[]}
        tasks={[]}
        currency="USD"
      />
    );

    expect(
      screen.getAllByText('No ledger transactions posted yet.').length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders Project Sales Invoices section with invoices table and clickthrough links', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        invoices={mockInvoices}
        currency="USD"
      />
    );

    // Section heading and count
    expect(screen.getByText('Project Sales Invoices')).toBeInTheDocument();
    expect(screen.getAllByText('(1)').length).toBeGreaterThanOrEqual(1);

    // Column Headers
    expect(screen.getAllByText('Invoice #').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Due Date').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tax').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Balance Due').length).toBeGreaterThanOrEqual(1);

    // Invoice Number link to invoice details
    const invLinks = screen.getAllByRole('link', { name: 'INV-2026-0001' });
    expect(invLinks.length).toBeGreaterThanOrEqual(1);
    expect(invLinks[0]).toHaveAttribute('href', '/sales-invoices/inv-12345678');

    // Customer name
    expect(screen.getAllByText('Acme Corporation').length).toBeGreaterThanOrEqual(1);

    // Amounts
    expect(screen.getAllByText('$1,200.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$600.00').length).toBeGreaterThanOrEqual(1);

    // View action link in mobile view
    const viewLinks = screen.getAllByRole('link', { name: /View/i });
    expect(viewLinks.some((l) => l.getAttribute('href') === '/sales-invoices/inv-12345678')).toBe(true);
  });

  it('renders empty state when no invoices exist for the project', () => {
    render(
      <ProjectLedgerTab
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        invoices={[]}
        currency="USD"
      />
    );

    expect(
      screen.getAllByText('No sales invoices have been issued for this project yet.').length
    ).toBeGreaterThanOrEqual(1);
  });
});
