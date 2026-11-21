import { render, screen, fireEvent, act } from '@testing-library/react';
import CustomersContent from '../CustomersContent';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockPermissions = [{ resource: 'bulk_write', action: 'write', effect: 'allow' }];
jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    permissions: mockPermissions,
  }),
}));

jest.mock('@/hooks/useReferenceData', () => ({
  useCustomerGroups: () => ({ customerGroups: [{ customerGroupId: 'cg-1', name: 'Retail' }] }),
  useTradingTerms: () => ({ tradingTerms: [{ tradingTermsId: 'tt-1', termsCode: 'NET30' }] }),
  useTaxPositions: () => ({ taxPositions: [{ taxPositionId: 'tp-1', title: 'GST Free' }] }),
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

let capturedGridProps: any = {};
jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid(props: any) {
    capturedGridProps = props;
    return (
      <div data-testid="datagrid-mock">
        {props.headerActions}
        {props.secondaryHeader}
      </div>
    );
  };
});

describe('CustomersContent', () => {
  beforeEach(() => {
    mockPermissions = [{ resource: 'bulk_write', action: 'write', effect: 'allow' }];
    capturedGridProps = {};
  });

  it('renders and configures status column enabled by default near the front', () => {
    render(<CustomersContent />);

    expect(capturedGridProps.columns.length).toBeGreaterThan(0);
    const statusCol = capturedGridProps.columns.find((c: any) => c.colId === 'status');
    expect(statusCol).toBeDefined();
    expect(statusCol.hide).toBeFalsy();

    // Verify status is near the front (index 2, after customerNumber and name)
    const statusIndex = capturedGridProps.columns.findIndex((c: any) => c.colId === 'status');
    expect(statusIndex).toBe(2);

    // Test valueGetter logic
    const creditHoldVal = statusCol.valueGetter({
      data: { stateCode: 'active', isSalesBlocked: true },
    });
    expect(creditHoldVal).toBe('common.columns.creditHold');

    const activeVal = statusCol.valueGetter({
      data: { stateCode: 'active', isSalesBlocked: false },
    });
    expect(activeVal).toBe('common.states.active');
  });

  it('renders Bulk Edit toggle button and toggles multi-select mode', () => {
    render(<CustomersContent />);

    const toggleBtn = screen.getByRole('button', { name: 'common.bulkEdit.toggle' });
    expect(toggleBtn).toBeInTheDocument();

    // Click toggle to enter bulk edit mode
    fireEvent.click(toggleBtn);

    // Now in bulk edit mode:
    expect(capturedGridProps.rowSelection).toBe('multiple');
    expect(capturedGridProps.fetchAll).toBe(true);
    expect(capturedGridProps.columns[0].colId).toBe('__select');

    // Simulate selecting 2 rows via onSelectionChanged
    act(() => {
      capturedGridProps.onSelectionChanged([
        { customerId: 'c-1', name: 'Cust 1' },
        { customerId: 'c-2', name: 'Cust 2' },
      ]);
    });

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: 'Edit Selected (2)' });
    expect(editBtn).not.toBeDisabled();
  });

  it('hides Bulk Edit toggle button when user lacks bulk_write permission', () => {
    mockPermissions = [{ resource: 'customers', action: 'write', effect: 'allow' }];
    render(<CustomersContent />);

    expect(screen.queryByRole('button', { name: 'common.bulkEdit.toggle' })).not.toBeInTheDocument();
  });
});
