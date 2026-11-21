import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProductPricingSummary from '../ProductPricingSummary';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  ordersControllerGetProductPricingHistory: jest.fn(),
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

jest.mock('@/components/shared/ProductPricingSlideOver', () => {
  return function MockSlideOver(props: any) {
    if (!props.isOpen) return null;
    return (
      <div data-testid="mock-pricing-slideover">
        <span>Slideover for {props.productNumber}</span>
        <button onClick={props.onClose}>Close Slideover</button>
      </div>
    );
  };
});

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.count !== undefined) return `${namespace ? `${namespace}.` : ''}${key}:${params.count}`;
      return `${namespace ? `${namespace}.` : ''}${key}`;
    };
    t.has = () => true;
    return t;
  },
}));

describe('ProductPricingSummary', () => {
  const mockProductId = 'prod-100';
  const mockProductNumber = 'PRD-100';
  const mockProductName = 'Steel Bolt';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state and then empty message when no orders exist', async () => {
    (api.ordersControllerGetProductPricingHistory as jest.Mock).mockResolvedValue({
      data: {
        data: [],
        total: 0,
      },
    });

    render(
      <ProductPricingSummary
        productId={mockProductId}
        productNumber={mockProductNumber}
        productDescription={mockProductName}
      />
    );

    await waitFor(() => {
      expect(api.ordersControllerGetProductPricingHistory).toHaveBeenCalledWith({
        productId: mockProductId,
        page: 1,
        limit: 3,
      });
      expect(screen.getByText('products.pricingSummary.noHistory')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'products.pricingSummary.viewAllWithCount:0' })).toBeInTheDocument();
  });

  it('renders recent orders and opens slideover on button click', async () => {
    (api.ordersControllerGetProductPricingHistory as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            salesOrderId: 'so-1',
            orderNumber: 'SO-001',
            customerId: 'cust-1',
            customerName: 'Acme Corp',
            stateCode: 'confirmed',
            orderDate: '2026-01-10',
            lineNumber: 1,
            quantity: '50',
            unitOfMeasure: 'EA',
            pricePerUnit: '12.50',
            discountPercentage: '10',
            currencyCode: 'EUR',
          },
        ],
        total: 1,
      },
    });

    render(
      <ProductPricingSummary
        productId={mockProductId}
        productNumber={mockProductNumber}
        productDescription={mockProductName}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp:')).toBeInTheDocument();
      expect(screen.getByText('EUR 12.50 @ 50 EA')).toBeInTheDocument();
      expect(screen.getByText('(-10%)')).toBeInTheDocument();
      expect(screen.getByText('SO-001')).toBeInTheDocument();
      expect(screen.getByText('2026-01-10')).toBeInTheDocument();
    });

    const viewAllBtn = screen.getByRole('button', { name: 'products.pricingSummary.viewAllWithCount:1' });
    expect(viewAllBtn).toBeInTheDocument();

    expect(screen.queryByTestId('mock-pricing-slideover')).not.toBeInTheDocument();

    fireEvent.click(viewAllBtn);

    expect(screen.getByTestId('mock-pricing-slideover')).toBeInTheDocument();
    expect(screen.getByText(`Slideover for ${mockProductNumber}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Slideover' }));
    expect(screen.queryByTestId('mock-pricing-slideover')).not.toBeInTheDocument();
  });
});
