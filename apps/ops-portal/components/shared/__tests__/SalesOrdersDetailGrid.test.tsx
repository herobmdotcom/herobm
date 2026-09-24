import React from 'react';
import { render, screen } from '@testing-library/react';
import { SalesOrdersDetailGrid } from '../SalesOrdersDetailGrid';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => {
    const fn = (key: string) => key;
    fn.has = () => true;
    return fn;
  },
}));

// Mock DetailTabGrid to inspect props
jest.mock('@/components/shared/DetailTabGrid', () => {
  return function MockDetailTabGrid(props: any) {
    return (
      <div
        data-testid="detail-tab-grid-mock"
        data-title={props.title}
        data-endpoint={props.endpoint}
        data-gridkey={props.gridKey}
      >
        <span>{props.title}</span>
        {props.headerActions}
      </div>
    );
  };
});

describe('SalesOrdersDetailGrid', () => {
  it('renders correctly with customerId endpoint and create button', () => {
    const customerId = 'cust-123';
    render(<SalesOrdersDetailGrid customerId={customerId} title="Orders" />);

    const grid = screen.getByTestId('detail-tab-grid-mock');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('data-endpoint', `/api/sales-orders?customerId=${customerId}&limit=50`);
    expect(grid).toHaveAttribute('data-title', 'Orders');

    const createBtn = screen.getByRole('link');
    expect(createBtn).toHaveAttribute('href', `/sales-orders/new?customerId=${customerId}`);
  });

  it('renders correctly with productId endpoint without default create button', () => {
    const productId = 'prod-789';
    render(<SalesOrdersDetailGrid productId={productId} title="Sales" />);

    const grid = screen.getByTestId('detail-tab-grid-mock');
    expect(grid).toHaveAttribute('data-endpoint', `/api/sales-orders?productId=${productId}&limit=50`);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders correctly with opportunityId endpoint and combined query params', () => {
    const opportunityId = 'opp-456';
    const customerId = 'cust-123';
    render(
      <SalesOrdersDetailGrid
        opportunityId={opportunityId}
        customerId={customerId}
        createButtonLabel="Create Quote"
      />
    );

    const grid = screen.getByTestId('detail-tab-grid-mock');
    expect(grid).toHaveAttribute(
      'data-endpoint',
      `/api/sales-orders?customerId=${customerId}&opportunityId=${opportunityId}&limit=50`,
    );

    const createBtn = screen.getByRole('link', { name: /Create Quote/i });
    expect(createBtn).toHaveAttribute(
      'href',
      `/sales-orders/new?opportunityId=${opportunityId}&customerId=${customerId}`,
    );
  });
});
