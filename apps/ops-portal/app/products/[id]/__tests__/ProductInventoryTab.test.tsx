import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductInventoryTab } from '../ProductInventoryTab';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => {
  const actual = jest.requireActual('@herobm/sdk');
  return {
    ...actual,
    inventoryControllerFindByProductIdsBulk: jest.fn().mockResolvedValue({ data: [] }),
    inventoryControllerFindAllLocations: jest.fn().mockResolvedValue({
      data: [{ locationId: 'loc-1', name: 'Main Warehouse', code: 'WH-1' }],
    }),
    inventoryControllerFindBinsByLocation: jest.fn().mockResolvedValue({
      data: [{ binId: 'bin-1', binNumber: 'A-01' }],
    }),
    productsControllerLinkDefaultBin: jest.fn().mockResolvedValue({}),
    productsControllerRemoveDefaultBin: jest.fn().mockResolvedValue({}),
    productsControllerGetComponents: jest.fn().mockResolvedValue({ data: [] }),
  };
});

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProductInventoryTab', () => {
  const mockProduct: any = {
    productId: 'prod-123',
    productNumber: 'P-100',
    name: 'Test Product',
    structureType: 'standard',
    productType: 'inventory',
    defaultBins: [
      {
        productDefaultBinId: 'pdb-1',
        productId: 'prod-123',
        locationId: 'loc-1',
        locationName: 'Main Warehouse',
        locationNo: 'WH-1',
        binId: 'bin-1',
        binNumber: 'A-01',
        isPrimaryPerLocation: true,
        minQuantity: '5',
        maxQuantity: '10',
        quantityOnHand: 20,
      },
    ],
  };

  it('renders default bin minQuantity and maxQuantity correctly', async () => {
    render(
      <ProductInventoryTab
        productId="prod-123"
        product={mockProduct}
        isEditable={true}
        onRefresh={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('A-01')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('submits minQuantity and maxQuantity to linkDefaultBin API when adding a bin', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();

    render(
      <ProductInventoryTab
        productId="prod-123"
        product={{ ...mockProduct, defaultBins: [] }}
        isEditable={true}
        onRefresh={onRefresh}
      />
    );

    // Click "Add Default Bin" button
    const addBtn = await screen.findByText('products.storage.addBinLink');
    await user.click(addBtn);

    // Select location and bin
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'loc-1');

    await waitFor(() => {
      expect(api.inventoryControllerFindBinsByLocation).toHaveBeenCalledWith('loc-1');
    });

    const binSelects = screen.getAllByRole('combobox');
    await user.selectOptions(binSelects[1], 'bin-1');

    // Fill min and max quantities
    const inputs = screen.getAllByRole('spinbutton');
    await user.type(inputs[0], '7');
    await user.type(inputs[1], '15');

    // Click Save
    const saveBtn = screen.getByText('buttons.save');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(api.productsControllerLinkDefaultBin).toHaveBeenCalledWith('prod-123', {
        locationId: 'loc-1',
        binId: 'bin-1',
        isPrimaryPerLocation: true,
        minQuantity: '7',
        maxQuantity: '15',
      });
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
