import { render, screen } from '@testing-library/react';
import DetailTabGrid from '../DetailTabGrid';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'grid.rowCountLabel') return 'ROWS';
    if (key === 'rows' && values?.count) return `${values.count} rows`;
    return key;
  },
}));

// Mock DataGrid wrapper to inspect props
jest.mock('@/components/DataGrid', () => {
  return function MockDataGrid(props: any) {
    return (
      <div data-testid="datagrid-mock" data-dom-layout={props.domLayout}>
        {props.renderHeader ? props.renderHeader({ searchInput: <input data-testid="search" />, optionsButton: null, rowCount: 128, loading: false }) : null}
      </div>
    );
  };
});

describe('DetailTabGrid', () => {
  it('renders section title and passes domLayout="normal" by default', () => {
    render(
      <DetailTabGrid<{ orderNumber: string }>
        title="Sales Orders"
        columns={[{ field: 'orderNumber', headerName: 'Order #' }]}
        rowData={[]}
      />
    );

    expect(screen.getByText('Sales Orders')).toBeInTheDocument();
    expect(screen.getByText('ROWS')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    
    const mockGrid = screen.getByTestId('datagrid-mock');
    expect(mockGrid).toHaveAttribute('data-dom-layout', 'normal');
  });

  it('allows domLayout override if explicitly provided', () => {
    render(
      <DetailTabGrid<{ orderNumber: string }>
        title="Sales Orders"
        domLayout="autoHeight"
        columns={[{ field: 'orderNumber', headerName: 'Order #' }]}
        rowData={[]}
      />
    );

    const mockGrid = screen.getByTestId('datagrid-mock');
    expect(mockGrid).toHaveAttribute('data-dom-layout', 'autoHeight');
  });
});
