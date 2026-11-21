import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import ProductsContent from '../ProductsContent';

let passedGridProps: any = null;
jest.mock('@/components/DataGrid', () => {
  return function MockDataGrid(props: any) {
    passedGridProps = props;
    return (
      <div data-testid="data-grid-mock">
        {props.headerActions}
        {props.secondaryHeader}
      </div>
    );
  };
});

jest.mock('@/components/shared/ProductPricingSlideOver', () => {
  return function MockProductPricingSlideOver(props: any) {
    if (!props.isOpen) return null;
    return (
      <div data-testid="mock-pricing-slideover">
        <span>Pricing for {props.productNumber}</span>
        <button onClick={props.onClose}>Close Pricing</button>
      </div>
    );
  };
});

let mockPermissions = [{ resource: 'bulk_write', action: 'write', effect: 'allow' }];
jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    permissions: mockPermissions,
  }),
}));

jest.mock('@/hooks/useReferenceData', () => ({
  useProductGroups: () => ({
    productGroups: [{ productGroupId: 'pg-1', name: 'Widgets' }],
  }),
  useTaxCategories: () => ({
    taxCategories: [{ taxCategoryId: 'tc-1', name: 'Standard Rate' }],
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const fn = (key: string, values?: Record<string, string | number>) => {
      if (key === 'bulkEdit.selectedCount') return `${values?.count} selected`;
      if (key === 'bulkEdit.editSelected') return `Edit Selected (${values?.count})`;
      return `${ns}.${key}`;
    };
    fn.has = () => true;
    return fn;
  },
}));

describe('ProductsContent', () => {
  beforeEach(() => {
    mockPermissions = [{ resource: 'bulk_write', action: 'write', effect: 'allow' }];
    passedGridProps = null;
    jest.clearAllMocks();
  });

  it('renders DataGrid with customFieldEntityType="products"', async () => {
    render(<ProductsContent />);

    await waitFor(() => {
      expect(passedGridProps).not.toBeNull();
      expect(passedGridProps.customFieldEntityType).toBe('products');
      expect(passedGridProps.columns).toBeDefined();
    });
  });

  it('renders Bulk Edit toggle button and toggles multi-select mode', async () => {
    render(<ProductsContent />);

    const toggleBtn = screen.getByRole('button', { name: 'common.bulkEdit.toggle' });
    expect(toggleBtn).toBeInTheDocument();

    // Toggle bulk edit mode
    fireEvent.click(toggleBtn);

    expect(passedGridProps.rowSelection).toBe('multiple');
    expect(passedGridProps.fetchAll).toBe(true);
    expect(passedGridProps.columns[0].colId).toBe('__select');

    // Simulate selecting 2 products
    act(() => {
      passedGridProps.onSelectionChanged([
        { productId: 'prod-1', name: 'Product 1' },
        { productId: 'prod-2', name: 'Product 2' },
      ]);
    });

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: 'Edit Selected (2)' });
    expect(editBtn).not.toBeDisabled();
  });

  it('hides Bulk Edit toggle button when user lacks bulk_write permission', () => {
    mockPermissions = [{ resource: 'products', action: 'write', effect: 'allow' }];
    render(<ProductsContent />);

    expect(screen.queryByRole('button', { name: 'common.bulkEdit.toggle' })).not.toBeInTheDocument();
  });

  it('renders pricing history column and opens slideover on button click', async () => {
    render(<ProductsContent />);

    await waitFor(() => {
      expect(passedGridProps).not.toBeNull();
    });

    const pricingCol = passedGridProps.columns.find((c: any) => c.colId === 'pricingHistory');
    expect(pricingCol).toBeDefined();

    // Verify it is placed immediately after the pricing columns
    const colIds = passedGridProps.columns.map((c: any) => c.colId || c.field);
    const priceLevel4Index = colIds.indexOf('priceLevel4');
    const pricingHistoryIndex = colIds.indexOf('pricingHistory');
    expect(pricingHistoryIndex).toBe(priceLevel4Index + 1);

    const rowData = {
      productId: 'prod-123',
      productNumber: 'P-123',
      name: 'Test Product',
    };

    const renderedCell = render(pricingCol.cellRenderer({ data: rowData }));
    const viewHistoryBtn = renderedCell.getByRole('button', { name: /products\.buttons\.viewHistory/i });
    expect(viewHistoryBtn).toBeInTheDocument();
    // Verify no icon is present inside the button
    expect(viewHistoryBtn.querySelector('.material-symbols-outlined')).toBeNull();

    fireEvent.click(viewHistoryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-pricing-slideover')).toBeInTheDocument();
      expect(screen.getByText('Pricing for P-123')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close Pricing' }));
    expect(screen.queryByTestId('mock-pricing-slideover')).not.toBeInTheDocument();
  });
});
