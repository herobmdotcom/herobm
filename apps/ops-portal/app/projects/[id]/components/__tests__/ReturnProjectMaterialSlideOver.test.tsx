import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReturnProjectMaterialSlideOver } from '../ReturnProjectMaterialSlideOver';
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
  inventoryControllerFindAllLocations: jest.fn(),
  transfersControllerCreate: jest.fn(),
}));

const mockAvailableMaterials = [
  {
    productId: 'prod-1',
    productNumber: 'SKU-001',
    productDescription: 'Timber Post',
    availableQty: 10,
  },
  {
    productId: 'prod-2',
    productNumber: 'SKU-002',
    productDescription: 'Steel Beam',
    availableQty: 0, // Should NOT be selectable for return
  },
];

describe('ReturnProjectMaterialSlideOver', () => {
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.inventoryControllerFindAllLocations as jest.Mock).mockResolvedValue({
      data: [
        { locationId: 'loc-1', name: 'Main Warehouse', code: 'LOC-01' },
        { locationId: 'loc-2', name: 'Site Staging', code: 'LOC-02' },
      ],
    });
    (api.transfersControllerCreate as jest.Mock).mockResolvedValue({
      data: {
        orderId: 'trf-ret-1',
        orderNumber: 'TRF-RET-0001',
      },
    });
  });

  it('renders SlideOver with staged materials only and no task picker', async () => {
    render(
      <ReturnProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-2"
        availableMaterials={mockAvailableMaterials}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByText('From Task *')).not.toBeInTheDocument();
    expect(screen.getByText('Staged Material to Return *')).toBeInTheDocument();
    expect(screen.getByText('Destination Warehouse Location *')).toBeInTheDocument();
  });

  it('selects staged material and submits return transfer order with valid quantity', async () => {
    render(
      <ReturnProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-2"
        availableMaterials={mockAvailableMaterials}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('LOC-01 \u2014 Main Warehouse').length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole('combobox');
    // selects[0] is Staged Materials
    // selects[1] is Destination Location
    fireEvent.change(selects[0], { target: { value: 'prod-1' } });
    fireEvent.change(selects[1], { target: { value: 'loc-1' } });

    // Set custom valid quantity (e.g. 5 out of 10)
    const qtyInput = screen.getByLabelText(/labels\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '5' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'buttons.returnMaterial' });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.transfersControllerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceLocationId: 'loc-2',
          destinationLocationId: 'loc-1',
          projectId: 'prj-1',
          isProjectReturn: true,
          lines: [
            {
              productId: 'prod-1',
              quantity: '5',
            },
          ],
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('disables submit and shows error message when quantity exceeds available stock', async () => {
    render(
      <ReturnProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-2"
        availableMaterials={mockAvailableMaterials}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('LOC-01 \u2014 Main Warehouse').length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'prod-1' } });
    fireEvent.change(selects[1], { target: { value: 'loc-1' } });

    const qtyInput = screen.getByLabelText(/labels\.quantity/i);
    // Exceed available quantity (10)
    fireEvent.change(qtyInput, { target: { value: '15' } });

    expect(screen.getByText(/errors\.quantityExceedsAvailable/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: 'buttons.returnMaterial' });
    expect(submitBtn).toBeDisabled();
  });

  it('disables submit and shows error message when quantity is 0 or negative', async () => {
    render(
      <ReturnProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-2"
        availableMaterials={mockAvailableMaterials}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('LOC-01 \u2014 Main Warehouse').length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'prod-1' } });
    fireEvent.change(selects[1], { target: { value: 'loc-1' } });

    const qtyInput = screen.getByLabelText(/labels\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '0' } });

    expect(screen.getByText('errors.quantityMustBePositive')).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: 'buttons.returnMaterial' });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(qtyInput, { target: { value: '-2' } });
    expect(screen.getByText('errors.quantityMustBePositive')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('sets maximum available quantity when Max button is clicked', async () => {
    render(
      <ReturnProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        stagingLocationId="loc-2"
        availableMaterials={mockAvailableMaterials}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('LOC-01 \u2014 Main Warehouse').length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'prod-1' } });

    const maxBtn = screen.getByRole('button', { name: /labels\.max/i });
    expect(maxBtn).toBeInTheDocument();
    fireEvent.click(maxBtn);

    const qtyInput = screen.getByLabelText(/labels\.quantity/i) as HTMLInputElement;
    expect(qtyInput.value).toBe('10');
  });

  it('displays empty state when no materials are available to return', async () => {
    render(
      <ReturnProjectMaterialSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        stagingLocationId="loc-2"
        availableMaterials={[{ productId: 'prod-2', productNumber: 'SKU-002', productDescription: 'Steel Beam', availableQty: 0 }]}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('No staged materials available to return')).toBeInTheDocument();
  });
});
