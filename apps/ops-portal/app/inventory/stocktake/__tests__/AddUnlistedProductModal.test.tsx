import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddUnlistedProductModal from '../components/AddUnlistedProductModal';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  productsControllerFindAll: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.bin !== undefined) return `${key}:${params.bin}`;
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

describe('AddUnlistedProductModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters product search results to inventory tracked products only', async () => {
    const user = userEvent.setup();

    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        {
          productId: 'prod-inv-1',
          productNumber: 'SKU-INV-1',
          name: 'Inventory Tracked Widget',
          productType: 'inventory',
        },
        {
          productId: 'prod-srv-1',
          productNumber: 'SRV-CONSULT',
          name: 'Consulting Service',
          productType: 'service',
        },
        {
          productId: 'prod-frt-1',
          productNumber: 'FRT-EXPRESS',
          name: 'Express Freight',
          productType: 'freight',
        },
        {
          productId: 'prod-non-1',
          productNumber: 'NON-STOCK-1',
          name: 'Non Stock Consumable',
          productType: 'non-stock',
        },
      ],
    });

    render(
      <AddUnlistedProductModal
        isOpen={true}
        onClose={jest.fn()}
        activeBin={{ binId: 'bin-1', binNumber: 'A-01-01' }}
        onAddProduct={jest.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('addUnlisted.searchPlaceholder');
    await user.type(searchInput, 'widget');

    // Wait for debounced search
    await waitFor(() => {
      expect(api.productsControllerFindAll).toHaveBeenCalled();
    });

    // Only inventory tracked item should be rendered
    await waitFor(() => {
      expect(screen.getByText('SKU-INV-1')).toBeInTheDocument();
      expect(screen.getByText('Inventory Tracked Widget')).toBeInTheDocument();
      expect(screen.queryByText('SRV-CONSULT')).not.toBeInTheDocument();
      expect(screen.queryByText('FRT-EXPRESS')).not.toBeInTheDocument();
      expect(screen.queryByText('NON-STOCK-1')).not.toBeInTheDocument();
    });
  });
});
