import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { IssueProjectMaterialSlideOver } from '../IssueProjectMaterialSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  taxCategoriesControllerFindAll: jest.fn(),
  inventoryControllerFindAllLocations: jest.fn(),
  inventoryControllerFindByProductIdsBulk: jest.fn(),
  transfersControllerCreate: jest.fn(),
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
    name: 'Electrical & Cabling',
    stateCode: 'not_started',
    isMilestone: false,
    isBillable: true,
  },
];

describe('IssueProjectMaterialSlideOver', () => {
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.taxCategoriesControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        { taxCategoryId: 'tax-1', code: 'GST', rate: '10', isDefault: true },
        { taxCategoryId: 'tax-2', code: 'FREIGHT', rate: '0', isDefault: false },
      ],
    });
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: [
        { locationId: 'loc-1', name: 'Main Warehouse', code: 'LOC-01' },
        { locationId: 'loc-2', name: 'Site B', code: 'LOC-02' },
      ],
    });
    (api.inventoryControllerFindByProductIdsBulk as jest.Mock).mockResolvedValue({
      data: [
        {
          productId: 'prod-1',
          locationId: 'loc-1',
          quantityOnHand: 50,
          quantityAvailable: 45,
          quantityReserved: 5,
        },
      ],
    });
    (api.transfersControllerCreate as jest.Mock).mockResolvedValue({
      data: {
        orderId: 'trf-1',
        orderNumber: 'TRF-0001',
      },
    });
  });

  it('renders SlideOver header, defaults controls, and empty lines state', async () => {
    render(
      <IssueProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Test Project"
        tasks={mockTasks}
        currency="USD"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Source Warehouse Location *')).toBeInTheDocument();
    expect(screen.getByText('Destination Location (Site Staging) *')).toBeInTheDocument();
    expect(screen.getAllByText(/No materials added yet/i).length).toBeGreaterThan(0);
  });

  it('allows switching to Stock Availability tab', async () => {
    render(
      <IssueProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        tasks={mockTasks}
        currency="USD"
        onSuccess={mockOnSuccess}
      />
    );

    const availTabBtn = screen.getByRole('tab', { name: /availability/i });
    fireEvent.click(availTabBtn);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Add materials in the Line Items tab to inspect warehouse stock availability/i).length
      ).toBeGreaterThan(0);
    });
  });

  it('selects warehouse locations and configures transfer defaults with project fields', async () => {
    (api.productsControllerFindAll as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      data: {
        data: [
          {
            productId: 'prod-1',
            productNumber: 'SKU-001',
            name: 'Timber Post',
            baseUom: 'EA',
            listPrice: '50',
            standardCost: '30',
          },
        ],
      },
    });

    render(
      <IssueProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        projectName="Test Project"
        tasks={mockTasks}
        currency="USD"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('LOC-01 \u2014 Main Warehouse').length).toBeGreaterThan(0);
    });

    // Select source & destination locations
    const selects = screen.getAllByRole('combobox');
    // Source location select
    fireEvent.change(selects[0], { target: { value: 'loc-1' } });
    // Destination location select
    fireEvent.change(selects[1], { target: { value: 'loc-2' } });

    expect(selects[0]).toHaveValue('loc-1');
    expect(selects[1]).toHaveValue('loc-2');
  });
});

