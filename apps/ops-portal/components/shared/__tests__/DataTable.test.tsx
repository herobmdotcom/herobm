import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataTable, DataTableColumn, MobileCardField } from '../DataTable';

interface TestItem {
  id: string;
  name: string;
  code: string;
  amount: number;
}

const mockData: TestItem[] = [
  { id: '1', name: 'Alpha', code: 'A-01', amount: 100 },
  { id: '2', name: 'Beta', code: 'B-02', amount: 250 },
];

const mockColumns: DataTableColumn<TestItem>[] = [
  {
    id: 'code',
    header: 'Code',
    accessor: 'code',
    align: 'left',
  },
  {
    id: 'name',
    header: 'Item Name',
    render: (row) => <span className="font-bold">{row.name}</span>,
  },
  {
    id: 'amount',
    header: 'Amount',
    accessor: (row) => `$${row.amount}`,
    align: 'right',
  },
  {
    id: 'hiddenCol',
    header: 'Hidden Column',
    accessor: 'id',
    hidden: true,
  },
];

describe('DataTable', () => {
  it('renders desktop table view with columns and data when mobileCard is not provided', () => {
    const { container } = render(
      <DataTable<TestItem>
        columns={mockColumns}
        data={mockData}
        keyExtractor={(row) => row.id}
      />
    );

    // Column headers
    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Item Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Hidden Column' })).toBeNull();

    // Data rows
    expect(screen.getByText('A-01')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();

    expect(screen.getByText('B-02')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('$250')).toBeInTheDocument();

    // Table container should not have hidden classes when no mobileCard
    const tableWrapper = container.querySelector('table')?.parentElement;
    expect(tableWrapper?.className).not.toContain('hidden');
    expect(tableWrapper?.className).not.toContain('lg:block');
  });

  it('includes print:block on desktop table and print:hidden on mobile card container when mobileCard is provided', () => {
    const { container } = render(
      <DataTable<TestItem>
        columns={mockColumns}
        data={mockData}
        keyExtractor={(row) => row.id}
        mobileCard={(row) => (
          <div data-testid={`mobile-card-${row.id}`}>
            <MobileCardField label="Code" value={row.code} />
            <MobileCardField label="Name" value={row.name} />
          </div>
        )}
      />
    );

    // Desktop table container should have hidden lg:block and print:block
    const tableWrapper = container.querySelector('table')?.parentElement;
    expect(tableWrapper).not.toBeNull();
    expect(tableWrapper?.className).toContain('hidden');
    expect(tableWrapper?.className).toContain('lg:block');
    expect(tableWrapper?.className).toContain('print:block');

    // Mobile container should have lg:hidden and print:hidden
    const mobileContainer = container.querySelector('div.lg\\:hidden');
    expect(mobileContainer).not.toBeNull();
    expect(mobileContainer?.className).toContain('lg:hidden');
    expect(mobileContainer?.className).toContain('print:hidden');

    // Content should exist in mobile cards
    expect(screen.getByTestId('mobile-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-card-2')).toBeInTheDocument();
  });

  it('renders emptyMessage when data is empty', () => {
    render(
      <DataTable<TestItem>
        columns={mockColumns}
        data={[]}
        keyExtractor={(row) => row.id}
        emptyMessage="No items found in dataset"
        mobileCard={() => <div>Card</div>}
      />
    );

    expect(screen.getAllByText('No items found in dataset').length).toBe(2);
  });

  it('renders footer in both desktop table and mobile card view when provided', () => {
    render(
      <DataTable<TestItem>
        columns={mockColumns}
        data={mockData}
        keyExtractor={(row) => row.id}
        footer={
          <tr>
            <td colSpan={3} data-testid="custom-footer">
              Total: $350
            </td>
          </tr>
        }
        mobileCard={(row) => <div>{row.name}</div>}
      />
    );

    expect(screen.getAllByTestId('custom-footer').length).toBe(2);
  });

  it('supports expandable rows when isRowExpanded and renderExpandedRow are provided', () => {
    render(
      <DataTable<TestItem>
        columns={mockColumns}
        data={mockData}
        keyExtractor={(row) => row.id}
        isRowExpanded={(row) => row.id === '1'}
        renderExpandedRow={(row) => (
          <div data-testid={`expanded-${row.id}`}>Expanded details for {row.name}</div>
        )}
      />
    );

    expect(screen.getByTestId('expanded-1')).toBeInTheDocument();
    expect(screen.queryByTestId('expanded-2')).toBeNull();
  });

  it('supports renderCustomRow override', () => {
    render(
      <DataTable<TestItem>
        columns={mockColumns}
        data={mockData}
        keyExtractor={(row) => row.id}
        renderCustomRow={(row) => (
          <tr data-testid={`custom-row-${row.id}`}>
            <td colSpan={3}>Custom: {row.name}</td>
          </tr>
        )}
      />
    );

    expect(screen.getByTestId('custom-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('custom-row-2')).toBeInTheDocument();
    expect(screen.getByText('Custom: Alpha')).toBeInTheDocument();
    expect(screen.getByText('Custom: Beta')).toBeInTheDocument();
  });
});
