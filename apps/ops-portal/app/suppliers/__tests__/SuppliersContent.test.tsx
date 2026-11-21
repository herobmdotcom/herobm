import { render, screen, fireEvent, act } from '@testing-library/react';
import SuppliersContent from '../SuppliersContent';

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

let mockPermissions = [{ resource: 'bulk_write', action: 'write', effect: 'allow' }];
jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    permissions: mockPermissions,
  }),
}));

jest.mock('@/hooks/useReferenceData', () => ({
  useSupplierGroups: () => ({
    supplierGroups: [{ supplierGroupId: 'sg-1', name: 'Raw Materials' }],
  }),
  useTradingTerms: () => ({
    tradingTerms: [{ tradingTermsId: 'tt-1', termsCode: 'NET30' }],
  }),
  useTaxPositions: () => ({
    taxPositions: [{ taxPositionId: 'tp-1', title: 'Standard' }],
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/suppliers',
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

describe('SuppliersContent', () => {
  beforeEach(() => {
    mockPermissions = [{ resource: 'bulk_write', action: 'write', effect: 'allow' }];
    passedGridProps = null;
    jest.clearAllMocks();
  });

  it('renders columns and default configurations', () => {
    render(<SuppliersContent />);

    expect(passedGridProps).not.toBeNull();
    expect(passedGridProps.columns.length).toBeGreaterThan(0);
    expect(passedGridProps.rowSelection).toBe('single');
  });

  it('renders Bulk Edit toggle button and toggles multi-select mode', () => {
    render(<SuppliersContent />);

    const toggleBtn = screen.getByRole('button', { name: 'common.bulkEdit.toggle' });
    expect(toggleBtn).toBeInTheDocument();

    // Toggle bulk edit mode
    fireEvent.click(toggleBtn);

    expect(passedGridProps.rowSelection).toBe('multiple');
    expect(passedGridProps.fetchAll).toBe(true);
    expect(passedGridProps.columns[0].colId).toBe('__select');

    // Simulate selecting 2 suppliers
    act(() => {
      passedGridProps.onSelectionChanged([
        { vendorId: 'sup-1', name: 'Supplier 1' },
        { vendorId: 'sup-2', name: 'Supplier 2' },
      ]);
    });

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: 'Edit Selected (2)' });
    expect(editBtn).not.toBeDisabled();
  });

  it('hides Bulk Edit toggle button when user lacks bulk_write permission', () => {
    mockPermissions = [{ resource: 'suppliers', action: 'write', effect: 'allow' }];
    render(<SuppliersContent />);

    expect(screen.queryByRole('button', { name: 'common.bulkEdit.toggle' })).not.toBeInTheDocument();
  });
});
