import { render } from '@testing-library/react';
import CustomersContent from '../CustomersContent';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const fn = (key: string) => `${ns}.${key}`;
    fn.has = () => true;
    return fn;
  },
}));

let capturedColumns: any[] = [];
jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid({ columns }: { columns: any[] }) {
    capturedColumns = columns;
    return <div data-testid="datagrid-mock">DataGrid</div>;
  };
});

describe('CustomersContent', () => {
  beforeEach(() => {
    capturedColumns = [];
  });

  it('renders and configures status column enabled by default near the front', () => {
    render(<CustomersContent />);

    expect(capturedColumns.length).toBeGreaterThan(0);
    const statusCol = capturedColumns.find((c) => c.colId === 'status');
    expect(statusCol).toBeDefined();
    expect(statusCol.hide).toBeFalsy();

    // Verify status is near the front (index 2, after customerNumber and name)
    const statusIndex = capturedColumns.findIndex((c) => c.colId === 'status');
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
});
