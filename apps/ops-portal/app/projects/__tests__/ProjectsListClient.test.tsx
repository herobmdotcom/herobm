import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectsListClient from '../ProjectsListClient';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Projects',
      'columns.projectCode': 'Code',
      'columns.name': 'Project Name',
      'columns.customer': 'Customer',
      'columns.billingType': 'Billing Type',
      'columns.stage': 'Delivery Stage',
      'columns.status': 'Status',
      'columns.wipMethod': 'WIP Method',
      'columns.startDate': 'Start Date',
      'columns.endDate': 'End Date',
      'columns.manager': 'Manager',
      'placeholders.searchProjects': 'Search projects...',
      'buttons.createProject': 'Create Project',
    };
    return translations[key] || key;
  },
}));

jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid(props: any) {
    return (
      <div data-testid="datagrid-mock">
        <div data-testid="datagrid-page-title">{props.pageTitle}</div>
        <div data-testid="datagrid-endpoint">{props.endpoint}</div>
        <div data-testid="datagrid-header-filters">{props.headerFilters}</div>
        <div data-testid="datagrid-header-actions">{props.headerActions}</div>
      </div>
    );
  };
});

describe('ProjectsListClient', () => {
  it('renders the DataGrid with default endpoint and header actions', () => {
    render(<ProjectsListClient />);

    expect(screen.getByTestId('datagrid-mock')).toBeInTheDocument();
    expect(screen.getByTestId('datagrid-page-title')).toHaveTextContent('Projects');
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/projects');
    expect(screen.getByRole('link', { name: 'Create Project' })).toHaveAttribute('href', '/projects/new');
  });

  it('updates the endpoint query parameter to stateCode when status filter changes', () => {
    render(<ProjectsListClient />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('all');

    fireEvent.change(select, { target: { value: 'active' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/projects?stateCode=active');

    fireEvent.change(select, { target: { value: 'closed' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/projects?stateCode=closed');

    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/projects');
  });
});
