import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductSelect from '../ProductSelect';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      selectEllipsis: 'Select...',
      noMatchingResults: 'No matching results',
    };
    return translations[key] || key;
  },
}));

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  productsControllerFindAll: jest.fn(),
}));

describe('ProductSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders input with placeholder and handles search query with productType', async () => {
    const mockProducts = [
      {
        productId: 'srv-1',
        productNumber: 'SRV-001',
        name: 'Senior Controls Engineer',
        baseUom: 'HOUR',
        standardCost: '85.00',
        listPrice: '170.00',
        productType: 'service',
      },
    ];

    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({
      data: mockProducts,
    });

    const handleChange = jest.fn();

    render(
      <ProductSelect
        value={null}
        onChange={handleChange}
        placeholder="Select rate card..."
        productType="service"
      />
    );

    const input = screen.getByPlaceholderText('Select rate card...');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Controls' } });

    await waitFor(() => {
      expect(api.productsControllerFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Controls',
          productType: 'service',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('SRV-001')).toBeInTheDocument();
      expect(screen.getByText('Senior Controls Engineer')).toBeInTheDocument();
      expect(screen.getByText('(HOUR)')).toBeInTheDocument();
    });

    // Select the option
    fireEvent.mouseDown(screen.getByText('Senior Controls Engineer'));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'srv-1',
        productNumber: 'SRV-001',
        name: 'Senior Controls Engineer',
      })
    );
  });

  it('displays initial search term and view link correctly', () => {
    render(
      <ProductSelect
        value="srv-1"
        onChange={jest.fn()}
        initialSearchTerm="SRV-001 — Senior Controls Engineer (HOUR)"
      />
    );

    const input = screen.getByDisplayValue('SRV-001 — Senior Controls Engineer (HOUR)');
    expect(input).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/products/srv-1');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

