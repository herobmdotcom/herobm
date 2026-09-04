import React from 'react';
import { render, screen } from '@testing-library/react';
import OpportunityCommercialTab from '../OpportunityCommercialTab';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/crm/opportunities/opp-123',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock DetailTabGrid to inspect props
jest.mock('@/components/shared/DetailTabGrid', () => {
  return function MockDetailTabGrid(props: any) {
    return (
      <div
        data-testid="detail-tab-grid-mock"
        data-title={props.title}
        data-endpoint={props.endpoint}
      >
        <span>{props.title}</span>
        {props.headerActions}
      </div>
    );
  };
});

describe('OpportunityCommercialTab', () => {
  const opportunityId = '00000000-0000-0000-0000-000000000099';

  it('renders formatted deal revenue and quote count in stat cards', () => {
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        currencyCode="EUR"
        dealRevenue={12500.5}
        quoteCount={3}
      />,
    );

    expect(screen.getByText('Deal Revenue')).toBeInTheDocument();
    // Currency formatted value check (handles non-breaking spaces across environments)
    expect(screen.getByText(/12[,.]500/)).toBeInTheDocument();
    expect(screen.getByText('Quotes & Orders')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders Create Quote action linking to new sales order with opportunityId', () => {
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        currencyCode="EUR"
        dealRevenue={0}
        quoteCount={0}
      />,
    );

    const createBtn = screen.getByRole('link', { name: /Create Quote/i });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveAttribute(
      'href',
      `/sales-orders/new?opportunityId=${opportunityId}`,
    );
  });

  it('configures DetailTabGrid with the opportunity sales-orders endpoint', () => {
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        currencyCode="EUR"
        dealRevenue={5000}
        quoteCount={1}
      />,
    );

    const grid = screen.getByTestId('detail-tab-grid-mock');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute(
      'data-endpoint',
      `/api/sales-orders?opportunityId=${encodeURIComponent(opportunityId)}&limit=50`,
    );
  });
});
