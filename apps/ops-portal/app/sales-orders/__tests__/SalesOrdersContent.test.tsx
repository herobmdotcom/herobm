import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SalesOrdersContent from '../SalesOrdersContent';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({ baseCurrency: 'USD' }),
}));

jest.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Sales Orders',
      'columns.orderNumber': 'Order #',
      'columns.customer': 'Customer',
      'columns.name': 'Name',
      'columns.status': 'Status',
      'columns.customerPO': 'Customer PO',
      'columns.totalPrice': 'Total Price',
      'columns.currency': 'Currency',
      'columns.date': 'Date',
      'columns.createdBy': 'Created By',
      'filters.openOrders': 'Open Orders',
      'filters.allOrders': 'All Orders',
      'filters.monthToDate': 'Month to Date',
      'filters.last30Days': 'Last 30 Days',
      'filters.last90Days': 'Last 90 Days',
      'filters.last1Year': 'Last 1 Year',
      'filters.allTime': 'All Time',
      'placeholders.searchOrders': 'Search by order number...',
      'buttons.counterSale': 'Counter Sale',
      'buttons.createOrder': 'Create Order',
    };
    return translations[key] || `${ns}.${key}`;
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

describe('SalesOrdersContent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders the DataGrid with default open orders filter and 90 days', () => {
    render(<SalesOrdersContent />);

    expect(screen.getByTestId('datagrid-mock')).toBeInTheDocument();
    expect(screen.getByTestId('datagrid-page-title')).toHaveTextContent('Sales Orders');
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent(
      '/api/sales-orders?days=90&state=confirmed%2Cpicking%2Cshipped',
    );
  });

  it('updates the endpoint when changing between Open Orders and All Orders', () => {
    render(<SalesOrdersContent />);

    const statusSelect = screen.getByLabelText('Order Status Filter');
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect).toHaveValue('open');

    // Switch to All Orders
    fireEvent.change(statusSelect, { target: { value: 'all' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/sales-orders?days=90');

    // Switch back to Open Orders
    fireEvent.change(statusSelect, { target: { value: 'open' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent(
      '/api/sales-orders?days=90&state=confirmed%2Cpicking%2Cshipped',
    );
  });

  it('updates the endpoint when changing date range', () => {
    render(<SalesOrdersContent />);

    const dateSelect = screen.getByLabelText('Date Range Filter');
    expect(dateSelect).toBeInTheDocument();
    expect(dateSelect).toHaveValue('90');

    // Change date range to 30 days
    fireEvent.change(dateSelect, { target: { value: '30' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent(
      '/api/sales-orders?days=30&state=confirmed%2Cpicking%2Cshipped',
    );

    // Switch to All Orders with 30 days
    const statusSelect = screen.getByLabelText('Order Status Filter');
    fireEvent.change(statusSelect, { target: { value: 'all' } });
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/sales-orders?days=30');
  });
});
