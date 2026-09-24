import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProjectMaterialsTab } from '../ProjectMaterialsTab';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'tabs.materials': 'Materials',
      'sections.inventory': 'Inventory',
      'sections.transferOrders': 'Transfer Orders',
      'sections.materialUsage': 'Material Usage',
      'columns.product': 'Product',
      'columns.description': 'Description',
      'columns.staged': 'Staged',
      'columns.arriving': 'Arriving',
      'columns.returning': 'Returning',
      'columns.available': 'Available',
      'columns.consumed': 'Consumed',
      'columns.returned': 'Returned',
      'columns.actualCost': 'Actual Cost',
      'columns.actualRevenue': 'Actual Revenue',
      'columns.orderNumber': 'Order Number',
      'columns.status': 'Status',
      'columns.sourceLocation': 'From (Source)',
      'columns.destinationLocation': 'To (Destination)',
      'columns.items': 'Items',
      'columns.entryDate': 'Date',
      'columns.date': 'Date',
      'columns.quantity': 'Quantity',
      'columns.unitCost': 'Unit Cost',
      'columns.notes': 'Notes',
      'labels.stagingLocation': 'Staging Warehouse / Location',
      'labels.stagingBin': 'Staging Bin',
      'labels.task': 'Target Task',
      'labels.itemsCount': '{count} items',
      'buttons.stageStock': 'Stage',
      'buttons.consumeMaterial': 'Consume',
      'buttons.returnMaterial': 'Return',
      'placeholders.noMaterials': 'No materials recorded on this project yet.',
      'placeholders.noTransferOrders': 'No transfer orders linked to this project yet.',
      'placeholders.noMaterialUsage': 'No material consumption entries recorded.',
      'placeholders.loadingTransferOrders': 'Loading transfer orders...',
      'placeholders.selectStagingLocation': 'Select staging warehouse / location...',
      'placeholders.unassignedBin': '— Unassigned / Default —',
    };
    const t = (key: string, values?: Record<string, unknown>) => {
      let msg = translations[key] || (namespace ? `${namespace}.${key}` : key);
      if (values) {
        Object.entries(values).forEach(([k, v]) => {
          msg = msg.replace(`{${k}}`, String(v));
        });
      }
      return msg;
    };
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  transfersControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  projectsControllerGetLedgerEntries: jest.fn().mockResolvedValue({ data: [] }),
  inventoryControllerFindBinsByLocation: jest.fn().mockResolvedValue({ data: [] }),
  inventoryControllerFindAllLocations: jest.fn().mockResolvedValue({ data: [] }),
  productsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  taxCategoriesControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
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
    name: 'Electrical Installation',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

const mockStagingInventory: api.ProjectStagingInventoryItemDto[] = [
  {
    productId: 'prod-1',
    productNumber: 'MAT-001',
    productName: 'Heavy Steel Beam',
    actualQuantity: 10,
    baseUom: 'EA',
  },
];

const mockLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
  {
    ledgerId: 'led-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_issue',
    productId: 'prod-1',
    description: 'Heavy Steel Beam',
    quantity: '4',
    unitCostBase: '125.00',
    totalCostBase: '500.00',
    unitPriceBase: '200.00',
    totalPriceBase: '800.00',
    isBilled: false,
    postingDate: '2026-03-10T09:00:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'led-2',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_issue',
    productId: 'prod-2',
    description: 'Copper Wire 100m Spool',
    quantity: '2',
    unitCostBase: '50.00',
    totalCostBase: '100.00',
    unitPriceBase: '80.00',
    totalPriceBase: '160.00',
    isBilled: false,
    postingDate: '2026-03-11T14:30:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'led-3',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'resource',
    sourceType: 'timesheet',
    description: 'Site Prep Labor',
    quantity: '8',
    unitCostBase: '80.00',
    totalCostBase: '640.00',
    unitPriceBase: '150.00',
    totalPriceBase: '1200.00',
    isBilled: false,
    postingDate: '2026-03-12T10:00:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'led-4',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_issue',
    productId: 'prod-1',
    description: 'Reallocated from staging to Task for 4x Heavy Steel Beam',
    quantity: '-4',
    unitCostBase: '125.00',
    totalCostBase: '-500.00',
    unitPriceBase: '200.00',
    totalPriceBase: '-800.00',
    isBilled: false,
    postingDate: '2026-03-10T09:00:00Z',
    createdBy: 'admin',
  },
  {
    ledgerId: 'led-5',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    entryType: 'usage',
    lineType: 'item',
    sourceType: 'inventory_issue',
    productId: 'prod-1',
    description: 'Staged 10x Heavy Steel Beam (Ref: Transfer Staging Putaway)',
    quantity: '10',
    unitCostBase: '125.00',
    totalCostBase: '1250.00',
    unitPriceBase: '200.00',
    totalPriceBase: '2000.00',
    isBilled: false,
    postingDate: '2026-03-01T10:00:00Z',
    createdBy: 'admin',
  },
];

describe('ProjectMaterialsTab', () => {
  const mockLoadBins = jest.fn().mockResolvedValue([]);
  const mockIssueInventory = jest.fn().mockResolvedValue(undefined);
  const mockReturnInventory = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (api.transfersControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'to-1',
          transferOrderId: 'to-1',
          orderNumber: 'TO-2026-001',
          stateCode: 'received',
          sourceLocationName: 'Main Warehouse',
          destinationLocationName: 'Job Site Staging',
          lines: [{ productId: 'prod-1', productNumber: 'MAT-001', quantity: '10' }],
          createdOn: '2026-03-01T10:00:00Z',
          notes: 'Initial material staging',
        },
      ],
    });
  });

  it('renders Staging Inventory, Transfer Orders, and Material Usage sections', async () => {
    render(
      <ProjectMaterialsTab
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Test Project"
        stagingInventory={mockStagingInventory}
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        loadBins={mockLoadBins}
        issueInventory={mockIssueInventory}
        returnInventory={mockReturnInventory}
      />
    );

    // Check headings
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Transfer Orders')).toBeInTheDocument();
    expect(screen.getByText('Material Usage')).toBeInTheDocument();

    // Verify transfer orders are rendered
    await waitFor(() => {
      expect(screen.getAllByText('TO-2026-001').length).toBeGreaterThanOrEqual(1);
    });

    // Verify Material Usage table renders item ledger entries and filters out resource timesheet entries
    expect(screen.getAllByText('Heavy Steel Beam').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Copper Wire 100m Spool').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Site Prep Labor')).not.toBeInTheDocument();

    // Verify internal staging-balance offsets and staging charges are filtered out
    expect(screen.queryByText(/Reallocated from staging/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Staged 10x Heavy Steel Beam/)).not.toBeInTheDocument();

    // Verify task label association in Material Usage
    expect(screen.getByText('1.0 Foundation & Framing')).toBeInTheDocument();
    expect(screen.getByText('2.1 Electrical Installation')).toBeInTheDocument();
  });

  it('renders empty message when no material usage entries exist', async () => {
    render(
      <ProjectMaterialsTab
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Test Project"
        stagingInventory={[]}
        ledgerEntries={[]}
        tasks={mockTasks}
        currency="USD"
        isEditable={false}
        loadBins={mockLoadBins}
        issueInventory={mockIssueInventory}
        returnInventory={mockReturnInventory}
      />
    );

    expect(
      screen.getAllByText('No material consumption entries recorded.').length
    ).toBeGreaterThan(0);
  });

  it('refreshes material usage entries when consuming material', async () => {
    const mockReloadProject = jest.fn().mockResolvedValue(undefined);

    (api.projectsControllerGetLedgerEntries as jest.Mock).mockResolvedValue({
      data: {
        data: [
          ...mockLedgerEntries,
          {
            ledgerId: 'led-new-mat',
            projectId: 'prj-1',
            projectTaskId: 'task-1',
            entryType: 'usage',
            lineType: 'item',
            sourceType: 'inventory_issue',
            productId: 'prod-1',
            description: 'Heavy Steel Beam Consumed on Site',
            quantity: '3',
            unitCostBase: '125.00',
            totalCostBase: '375.00',
            unitPriceBase: '200.00',
            totalPriceBase: '600.00',
            isBilled: false,
            postingDate: '2026-03-25T11:00:00Z',
            createdBy: 'admin',
          },
        ],
        total: 5,
        hasMore: false,
      },
    });

    render(
      <ProjectMaterialsTab
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Test Project"
        stagingInventory={mockStagingInventory}
        ledgerEntries={mockLedgerEntries}
        tasks={mockTasks}
        currency="USD"
        isEditable={true}
        loadBins={mockLoadBins}
        issueInventory={mockIssueInventory}
        returnInventory={mockReturnInventory}
        reloadProject={mockReloadProject}
      />
    );

    // Open Consume Material SlideOver
    const consumeBtn = screen.getByRole('button', { name: 'Consume' });
    fireEvent.click(consumeBtn);

    // Select staged material from dropdown
    const productSelect = document.getElementById('select-staged-material') as HTMLSelectElement;
    expect(productSelect).toBeInTheDocument();
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });

    // Submit consumption
    const submitBtns = screen.getAllByRole('button', { name: 'Consume' });
    const modalSubmitBtn = submitBtns[submitBtns.length - 1];
    fireEvent.click(modalSubmitBtn);

    await waitFor(() => {
      expect(mockIssueInventory).toHaveBeenCalled();
      expect(mockReloadProject).toHaveBeenCalled();
      expect(api.projectsControllerGetLedgerEntries).toHaveBeenCalledWith('prj-1', {
        lineType: 'item',
        cursor: undefined,
        limit: 50,
      });
      expect(api.transfersControllerFindAll).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Heavy Steel Beam Consumed on Site').length).toBeGreaterThanOrEqual(1);
    });
  });
});
