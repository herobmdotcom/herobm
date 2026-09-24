import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectsDetailGrid } from '../ProjectsDetailGrid';

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

describe('ProjectsDetailGrid', () => {
  it('renders correctly with customerId endpoint and create button', () => {
    const customerId = 'cust-123';
    render(<ProjectsDetailGrid customerId={customerId} title="Projects" />);

    const grid = screen.getByTestId('detail-tab-grid-mock');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('data-endpoint', `/api/projects?customerId=${customerId}&limit=50`);
    expect(grid).toHaveAttribute('data-title', 'Projects');

    const createBtn = screen.getByRole('link');
    expect(createBtn).toHaveAttribute('href', `/projects/new?customerId=${customerId}`);
  });

  it('renders correctly with opportunityId endpoint and combined query params', () => {
    const opportunityId = 'opp-456';
    const customerId = 'cust-123';
    render(
      <ProjectsDetailGrid
        opportunityId={opportunityId}
        customerId={customerId}
        createButtonLabel="Create Project"
      />
    );

    const grid = screen.getByTestId('detail-tab-grid-mock');
    expect(grid).toHaveAttribute(
      'data-endpoint',
      `/api/projects?customerId=${customerId}&opportunityId=${opportunityId}&limit=50`,
    );

    const createBtn = screen.getByRole('link', { name: /Create Project/i });
    expect(createBtn).toHaveAttribute(
      'href',
      `/projects/new?opportunityId=${opportunityId}&customerId=${customerId}`,
    );
  });
});
