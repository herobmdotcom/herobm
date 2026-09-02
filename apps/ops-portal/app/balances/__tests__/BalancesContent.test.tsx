import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import BalancesContent from '../BalancesContent';
import * as api from '@herobm/sdk';

function renderWithSwr(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>,
  );
};

// ── Mocks ────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock the local DataGrid wrapper component rather than using raw AG Grid
jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid({ rowData, headerActions }: any) {
    return (
      <div data-testid="datagrid-mock">
        <div data-testid="header-actions">{headerActions}</div>
        <div data-testid="row-count">{rowData?.length || 0}</div>
        <div data-testid="rows">
          {rowData?.map((row: any, i: number) => (
            <div key={i} data-testid={`row-${row.customerId}`} className="customer-row">
              <span data-testid={`name-${row.customerId}`}>{row.customerName}</span>
              <span data-testid={`outstanding-${row.customerId}`}>{row.totalOutstanding}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
});

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/lib/currency', () => ({
  formatAmount: (v: number, cc: string) => `${cc} ${v}`,
}));

jest.mock('@herobm/sdk', () => ({
  customersControllerGetAgedBalances: jest.fn(),
}));

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAgedBalances = [
  {
    customerId: 'cust-1',
    customerName: 'Healthy Corp',
    accountNumber: 'C001',
    creditLimit: '10000',
    isOnCreditHold: false,
    glBalance: 1000,
    totalOutstanding: 1000,
    discrepancyAmount: 0,
    current: 1000,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    days90Plus: 0,
    currencyCode: 'USD',
  },
  {
    customerId: 'cust-2',
    customerName: 'Late Ltd',
    accountNumber: 'C002',
    creditLimit: '5000',
    isOnCreditHold: false,
    glBalance: 2000,
    totalOutstanding: 2000,
    discrepancyAmount: 0,
    current: 500,
    days1To30: 1500,
    days31To60: 0,
    days61To90: 0,
    days90Plus: 0,
    currencyCode: 'USD',
  },
  {
    customerId: 'cust-3',
    customerName: 'Diff Inc',
    accountNumber: 'C003',
    creditLimit: '8000',
    isOnCreditHold: false,
    glBalance: 1500,
    totalOutstanding: 1500,
    discrepancyAmount: 200,
    current: 1500,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    days90Plus: 0,
    currencyCode: 'USD',
  },
  {
    customerId: 'cust-4',
    customerName: 'Maxed SA',
    accountNumber: 'C004',
    creditLimit: '3000',
    isOnCreditHold: false,
    glBalance: 4000,
    totalOutstanding: 4000,
    discrepancyAmount: 0,
    current: 4000,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    days90Plus: 0,
    currencyCode: 'USD',
  },
];

// ── Tests ────────────────────────────────────────────────────────────

describe('BalancesContent — client-side filtering and loading', () => {
  const mockGetBalances = api.customersControllerGetAgedBalances as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBalances.mockResolvedValue({ data: mockAgedBalances });
  });

  it('fetches aged balances on mount and renders all items', async () => {
    renderWithSwr(<BalancesContent />);

    await waitFor(() => {
      expect(mockGetBalances).toHaveBeenCalledWith({ agingBasis: 'dueDate' });
      expect(screen.getByTestId('row-count')).toHaveTextContent('4');
    });

    expect(screen.getByTestId('name-cust-1')).toHaveTextContent('Healthy Corp');
    expect(screen.getByTestId('name-cust-2')).toHaveTextContent('Late Ltd');
    expect(screen.getByTestId('name-cust-3')).toHaveTextContent('Diff Inc');
    expect(screen.getByTestId('name-cust-4')).toHaveTextContent('Maxed SA');
  });

  it('filters by "Has Discrepancy" correctly', async () => {
    const user = userEvent.setup();
    renderWithSwr(<BalancesContent />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('4');
    });

    const selectOptions = screen.getAllByRole('combobox');
    const filterSelect = selectOptions[0];
    await user.selectOptions(filterSelect, 'discrepancy');

    // Only 'Diff Inc' (cust-3) has discrepancyAmount > 0.01
    expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    expect(screen.getByTestId('name-cust-3')).toBeInTheDocument();
    expect(screen.queryByTestId('name-cust-1')).not.toBeInTheDocument();
  });

  it('filters by "Overdue Only" correctly', async () => {
    const user = userEvent.setup();
    renderWithSwr(<BalancesContent />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('4');
    });

    const selectOptions = screen.getAllByRole('combobox');
    const filterSelect = selectOptions[0];
    await user.selectOptions(filterSelect, 'overdue');

    // Only 'Late Ltd' (cust-2) has totalOutstanding (2000) - current (500) = 1500 > 0.01
    expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    expect(screen.getByTestId('name-cust-2')).toBeInTheDocument();
    expect(screen.queryByTestId('name-cust-1')).not.toBeInTheDocument();
  });

  it('filters by "Over Credit Limit" correctly', async () => {
    const user = userEvent.setup();
    renderWithSwr(<BalancesContent />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('4');
    });

    const selectOptions = screen.getAllByRole('combobox');
    const filterSelect = selectOptions[0];
    await user.selectOptions(filterSelect, 'overLimit');

    // Only 'Maxed SA' (cust-4) has totalOutstanding (4000) > creditLimit (3000)
    // 'Healthy Corp' has 1000 < 10000
    // 'Late Ltd' has 2000 < 5000
    // 'Diff Inc' has 1500 < 8000
    expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    expect(screen.getByTestId('name-cust-4')).toBeInTheDocument();
    expect(screen.queryByTestId('name-cust-1')).not.toBeInTheDocument();
  });

  it('refetches aged balances when changing the agingBasis select option', async () => {
    const user = userEvent.setup();
    renderWithSwr(<BalancesContent />);

    await waitFor(() => {
      expect(mockGetBalances).toHaveBeenCalledTimes(1);
    });

    // Find the second select, which controls agingBasis
    const selectOptions = screen.getAllByRole('combobox');
    const basisSelect = selectOptions[1]; // Second dropdown is the basis dropdown

    await user.selectOptions(basisSelect, 'invoiceDate');

    await waitFor(() => {
      expect(mockGetBalances).toHaveBeenCalledTimes(2);
      expect(mockGetBalances).toHaveBeenLastCalledWith({ agingBasis: 'invoiceDate' });
    });
  });
});
