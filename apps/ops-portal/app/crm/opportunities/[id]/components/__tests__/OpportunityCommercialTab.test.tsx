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

  it('renders formatted deal revenue, quote count, and project count in stat cards', () => {
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        currencyCode="EUR"
        dealRevenue={12500.5}
        quoteCount={3}
        projectCount={2}
      />,
    );

    expect(screen.getByText('Deal Revenue')).toBeInTheDocument();
    // Currency formatted value check (handles non-breaking spaces across environments)
    expect(screen.getByText(/12[,.]500/)).toBeInTheDocument();
    expect(screen.getByText('Quotes & Orders')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Delivery Projects').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Create Quote and Create Project actions linking to new creation pages with opportunityId', () => {
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        currencyCode="EUR"
        dealRevenue={0}
        quoteCount={0}
        projectCount={0}
      />,
    );

    const createQuoteBtn = screen.getByRole('link', { name: /Create Quote/i });
    expect(createQuoteBtn).toBeInTheDocument();
    expect(createQuoteBtn).toHaveAttribute(
      'href',
      `/sales-orders/new?opportunityId=${opportunityId}`,
    );

    const createProjectBtn = screen.getByRole('link', { name: /Create Project/i });
    expect(createProjectBtn).toBeInTheDocument();
    expect(createProjectBtn).toHaveAttribute(
      'href',
      `/projects/new?opportunityId=${opportunityId}`,
    );
  });

  it('includes customerId in Create Quote and Create Project links when customerId is provided', () => {
    const customerId = '00000000-0000-0000-0000-000000000088';
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        customerId={customerId}
        currencyCode="EUR"
        dealRevenue={0}
        quoteCount={0}
        projectCount={0}
      />,
    );

    const createQuoteBtn = screen.getByRole('link', { name: /Create Quote/i });
    expect(createQuoteBtn).toHaveAttribute(
      'href',
      `/sales-orders/new?opportunityId=${opportunityId}&customerId=${customerId}`,
    );

    const createProjectBtn = screen.getByRole('link', { name: /Create Project/i });
    expect(createProjectBtn).toHaveAttribute(
      'href',
      `/projects/new?opportunityId=${opportunityId}&customerId=${customerId}`,
    );
  });

  it('configures DetailTabGrid with both sales-orders and projects endpoints', () => {
    render(
      <OpportunityCommercialTab
        opportunityId={opportunityId}
        currencyCode="EUR"
        dealRevenue={5000}
        quoteCount={1}
        projectCount={1}
      />,
    );

    const grids = screen.getAllByTestId('detail-tab-grid-mock');
    expect(grids).toHaveLength(2);

    expect(grids[0]).toHaveAttribute(
      'data-endpoint',
      `/api/sales-orders?opportunityId=${encodeURIComponent(opportunityId)}&limit=50`,
    );
    expect(grids[0]).toHaveAttribute('data-title', 'Sales Quotes & Orders');

    expect(grids[1]).toHaveAttribute(
      'data-endpoint',
      `/api/projects?opportunityId=${encodeURIComponent(opportunityId)}&limit=50`,
    );
    expect(grids[1]).toHaveAttribute('data-title', 'Delivery Projects');
  });
});
