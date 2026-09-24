import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConsumeProjectMaterialSlideOver } from '../ConsumeProjectMaterialSlideOver';
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

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  inventoryControllerFindByProductIdsBulk: jest.fn(),
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
    name: 'Framing & Structures',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

const mockAvailableMaterials = [
  {
    productId: 'prod-1',
    productNumber: 'MAT-001',
    productDescription: 'Cement Bags (50kg)',
    availableQty: 25,
  },
  {
    productId: 'prod-2',
    productNumber: 'MAT-002',
    productDescription: 'Steel Rebar 12mm',
    availableQty: 50,
  },
];

describe('ConsumeProjectMaterialSlideOver', () => {
  const mockIssueInventory = jest.fn().mockResolvedValue(undefined);
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerFindByProductIdsBulk as jest.Mock).mockResolvedValue({
      data: [
        {
          productId: 'prod-1',
          stockOnHand: 25,
          stockAvailable: 25,
        },
      ],
    });
  });

  it('renders SlideOver with tasks and staged materials selection', async () => {
    render(
      <ConsumeProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-site"
        stagingBinId="bin-stage"
        tasks={mockTasks}
        availableMaterials={mockAvailableMaterials}
        issueInventory={mockIssueInventory}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('labels.task')).toBeInTheDocument();
    expect(screen.getByText('labels.stagedMaterials')).toBeInTheDocument();
    expect(screen.getByText('1.0 — Foundation Construction')).toBeInTheDocument();
    expect(screen.getByText('2.0 — Framing & Structures')).toBeInTheDocument();
    expect(screen.getByText(/MAT-001/)).toBeInTheDocument();
  });

  it('submits material consumption against task with correct payload', async () => {
    render(
      <ConsumeProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-site"
        stagingBinId="bin-stage"
        tasks={mockTasks}
        availableMaterials={mockAvailableMaterials}
        issueInventory={mockIssueInventory}
        onSuccess={mockOnSuccess}
      />
    );

    // Select product from staged dropdown
    const productSelect = screen.getByDisplayValue('placeholders.selectStagedStock');
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });

    // Fill in quantity and description
    const qtyInput = screen.getByLabelText(/(columns|labels)\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '5' } });

    const memoInput = screen.getByPlaceholderText('placeholders.reference');
    fireEvent.change(memoInput, { target: { value: 'Foundation pour day 1' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'buttons.consumeMaterial' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockIssueInventory).toHaveBeenCalledWith({
        locationId: 'loc-site',
        binId: 'bin-stage',
        projectTaskId: 'task-1',
        productId: 'prod-1',
        quantity: 5,
        memo: 'Foundation pour day 1',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('validates quantity does not exceed available staged stock', async () => {
    render(
      <ConsumeProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-site"
        stagingBinId="bin-stage"
        tasks={mockTasks}
        availableMaterials={mockAvailableMaterials}
        issueInventory={mockIssueInventory}
        onSuccess={mockOnSuccess}
      />
    );

    const productSelect = screen.getByDisplayValue('placeholders.selectStagedStock');
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });

    const qtyInput = screen.getByLabelText(/(columns|labels)\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '100' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.consumeMaterial' });
    expect(submitBtn).toBeDisabled();
    expect(mockIssueInventory).not.toHaveBeenCalled();
  });
});
