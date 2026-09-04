import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OpportunitiesContent from '../OpportunitiesContent';
import * as api from '@herobm/sdk';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    app: {
      opportunityStages: [
        { value: 'prospect', order: 1 },
        { value: 'won', order: 2 },
      ],
    },
    baseCurrency: 'USD',
  }),
}));

jest.mock('@herobm/sdk', () => ({
  opportunitiesControllerFindAll: jest.fn(),
  opportunitiesControllerUpdate: jest.fn(),
}));

jest.mock('@/components/shared/DataGrid', () => {
  return function DummyDataGrid(props: any) {
    return (
      <div data-testid="datagrid-mock">
        <div data-testid="datagrid-page-title">{props.pageTitle}</div>
        <div data-testid="datagrid-header-actions">{props.headerActions}</div>
        <div data-testid="datagrid-endpoint">{props.endpoint}</div>
      </div>
    );
  };
});

describe('OpportunitiesContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.opportunitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            opportunityId: 'opp-1',
            name: 'Deal Alpha',
            status: 'prospect',
            estimatedValue: '50000',
          },
        ],
      },
    });
  });

  it('renders Kanban board by default in standard card wrapper', async () => {
    render(<OpportunitiesContent />);

    expect(screen.getByRole('heading', { level: 2, name: 'Opportunities' })).toBeInTheDocument();
    expect(screen.getAllByText('New Opportunity')[0]).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Deal Alpha')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('datagrid-mock')).not.toBeInTheDocument();
  });

  it('switches to standard DataGrid list view when List button is clicked', async () => {
    render(<OpportunitiesContent />);
    await waitFor(() => {
      expect(screen.getByText('Deal Alpha')).toBeInTheDocument();
    });

    const listBtn = screen.getAllByRole('button', { name: /list/i })[0];
    fireEvent.click(listBtn);

    expect(screen.getByTestId('datagrid-mock')).toBeInTheDocument();
    expect(screen.getByTestId('datagrid-page-title')).toHaveTextContent('Opportunities');
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/opportunities');
    expect(screen.getAllByText('New Opportunity')[0]).toBeInTheDocument();
  });

  it('switches back to Kanban view when Kanban button is clicked', async () => {
    render(<OpportunitiesContent />);
    await waitFor(() => {
      expect(screen.getByText('Deal Alpha')).toBeInTheDocument();
    });

    // Switch to List
    fireEvent.click(screen.getAllByRole('button', { name: /list/i })[0]);
    expect(screen.getByTestId('datagrid-mock')).toBeInTheDocument();

    // Switch back to Kanban
    fireEvent.click(screen.getAllByRole('button', { name: /kanban/i })[0]);
    expect(screen.queryByTestId('datagrid-mock')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Opportunities' })).toBeInTheDocument();
  });
});
