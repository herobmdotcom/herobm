import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProductPricingSlideOver from '../ProductPricingSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const fn = (key: string, params?: Record<string, unknown>) => {
      if (params?.product) return `${key}:${params.product}`;
      if (params?.page && params?.totalPages) return `Page ${params.page} of ${params.totalPages}`;
      return `${ns}.${key}`;
    };
    fn.has = () => true;
    return fn;
  },
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/lib/currency', () => ({
  formatAmount: (v: number, cc: string) => `${cc} ${v.toFixed(2)}`,
}));

jest.mock('@/lib/date', () => ({
  formatLocalDate: (d: string) => d,
}));

jest.mock('@herobm/sdk', () => ({
  ordersControllerGetProductPricingHistory: jest.fn(),
}));

describe('ProductPricingSlideOver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not load pricing history when isOpen is false', () => {
    render(
      <ProductPricingSlideOver
        isOpen={false}
        onClose={jest.fn()}
        productId="prod-1"
        productNumber="WDG-001"
      />
    );

    expect(api.ordersControllerGetProductPricingHistory).not.toHaveBeenCalled();
  });

  it('fetches pricing history without customer filter when no customer context is provided', async () => {
    (api.ordersControllerGetProductPricingHistory as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            salesOrderId: 'so-past-1',
            orderNumber: 'SO-PAST-01',
            orderDate: '2024-01-01',
            customerId: 'cust-1',
            customerName: 'ACME Corp',
            stateCode: 'confirmed',
            lineNumber: 1,
            quantity: '10',
            unitOfMeasure: 'EA',
            pricePerUnit: '50.00',
            discountPercentage: '0',
            lineTotal: '500.00',
            currencyCode: 'EUR',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
    });

    render(
      <ProductPricingSlideOver
        isOpen={true}
        onClose={jest.fn()}
        productId="prod-1"
        productNumber="WDG-001"
        productDescription="Widget Alpha"
      />
    );

    await waitFor(() => {
      expect(api.ordersControllerGetProductPricingHistory).toHaveBeenCalledWith({
        productId: 'prod-1',
        customerId: undefined,
        excludeOrderId: undefined,
        page: 1,
        limit: 20,
        customerOnly: undefined,
      });
    });

    // Customer only checkbox should not be rendered
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // Data table displays order info
    expect(screen.getAllByText('SO-PAST-01')[0]).toBeInTheDocument();
    expect(screen.getAllByText('ACME Corp')[0]).toBeInTheDocument();
    expect(screen.getAllByText('EUR 50.00')[0]).toBeInTheDocument();
  });
});
