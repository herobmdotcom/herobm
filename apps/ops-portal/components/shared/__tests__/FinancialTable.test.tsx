import React, { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FinancialTable,
  FinancialTableColumn,
  FinancialTableSection,
  FinancialTableHandle,
} from '../FinancialTable';

import writeXlsxFile from 'write-excel-file/browser';

// Mock write-excel-file/browser
jest.mock('write-excel-file/browser', () => {
  const mockToFile = jest.fn().mockResolvedValue(undefined);
  const mockToBlob = jest.fn().mockResolvedValue(new Blob([]));
  const mockFn = jest.fn().mockReturnValue({
    toFile: mockToFile,
    toBlob: mockToBlob,
  });
  return {
    __esModule: true,
    default: mockFn,
  };
});

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const map: Record<string, string> = {
      export: 'Export',
      exportCsv: 'Export CSV',
      exportExcel: 'Export Excel',
      'grid.export': 'Export',
      'grid.exportCsv': 'Export CSV',
      'grid.exportExcel': 'Export Excel',
      'grid.loadingEllipsis': 'Loading...',
      'grid.noRowsToShow': 'No records found.',
      na: 'N/A',
      totals: 'Totals',
    };
    return map[key] || (namespace ? `${namespace}.${key}` : key);
  },
}));

interface SampleRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
}

const sampleColumns: FinancialTableColumn<SampleRow>[] = [
  { id: 'code', header: 'Account Code', accessor: 'code' },
  { id: 'name', header: 'Account Name', accessor: 'name' },
  {
    id: 'debit',
    header: 'Debit',
    isNumeric: true,
    render: (row) => `$${row.debit.toFixed(2)}`,
    exportValue: (row) => row.debit,
  },
  {
    id: 'credit',
    header: 'Credit',
    isNumeric: true,
    render: (row) => `$${row.credit.toFixed(2)}`,
    exportValue: (row) => row.credit,
  },
  {
    id: 'balance',
    header: 'Balance',
    isNumeric: true,
    render: (row) => `$${row.balance.toFixed(2)}`,
    exportValue: (row) => row.balance,
  },
];

const sampleData: SampleRow[] = [
  { code: '1000', name: 'Cash on Hand', debit: 5000, credit: 0, balance: 5000 },
  { code: '2000', name: 'Accounts Payable', debit: 0, credit: 2000, balance: -2000 },
];

describe('FinancialTable', () => {
  let createdObjectURLs: string[] = [];

  beforeEach(() => {
    createdObjectURLs = [];
    window.URL.createObjectURL = jest.fn((blob: Blob) => {
      const url = `blob:http://localhost/mock-blob-${createdObjectURLs.length}`;
      createdObjectURLs.push(url);
      return url;
    });
    window.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders column headers and flat rows correctly', () => {
    render(
      <FinancialTable
        columns={sampleColumns}
        data={sampleData}
        keyExtractor={(r) => r.code}
        totals={{
          label: 'Grand Total',
          colSpanLabel: 2,
          values: {
            debit: '$5,000.00',
            credit: '$2,000.00',
            balance: '$3,000.00',
          },
        }}
      />,
    );

    expect(screen.getByText('Account Code')).toBeInTheDocument();
    expect(screen.getByText('Account Name')).toBeInTheDocument();
    expect(screen.getByText('Debit')).toBeInTheDocument();
    expect(screen.getByText('Credit')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();

    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Cash on Hand')).toBeInTheDocument();
    expect(screen.getAllByText('$5000.00')).toHaveLength(2);

    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument();

    expect(screen.getByText('Grand Total')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('$2,000.00')).toBeInTheDocument();
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
  });

  it('renders sectioned data with subtitles and subtotals', () => {
    const sections: FinancialTableSection<SampleRow>[] = [
      {
        id: 'assets',
        title: 'Assets',
        rows: [sampleData[0]],
        subtotal: {
          label: 'Asset Subtotal',
          colSpanLabel: 2,
          values: { debit: '$5,000.00', credit: '$0.00', balance: '$5,000.00' },
        },
      },
      {
        id: 'liabilities',
        title: 'Liabilities',
        rows: [sampleData[1]],
        subtotal: {
          label: 'Liability Subtotal',
          colSpanLabel: 2,
          values: { debit: '$0.00', credit: '$2,000.00', balance: '$-2,000.00' },
        },
      },
    ];

    render(
      <FinancialTable
        columns={sampleColumns}
        sections={sections}
        keyExtractor={(r) => r.code}
      />,
    );

    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Asset Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Liabilities')).toBeInTheDocument();
    expect(screen.getByText('Liability Subtotal')).toBeInTheDocument();
  });

  it('automatically calculates colSpanLabel when omitted to span columns before the first value column', () => {
    const sections: FinancialTableSection<SampleRow>[] = [
      {
        id: 'assets',
        title: 'Current Assets',
        rows: [sampleData[0]],
        subtotal: {
          label: 'Total Current Assets',
          // colSpanLabel is omitted -> sampleColumns has 'code' (0), 'name' (1), 'debit' (2)...
          // values starts at 'debit' (index 2), so it should auto-span 2 columns
          values: { debit: '$5,000.00' },
        },
      },
    ];

    render(
      <FinancialTable
        columns={sampleColumns}
        sections={sections}
        totals={{
          label: 'Total Liabilities & Equity',
          // colSpanLabel is omitted -> should auto-span 2 columns
          values: { debit: '$5,000.00' },
        }}
        keyExtractor={(r) => r.code}
      />,
    );

    const subtotalLabelCell = screen.getByText('Total Current Assets').closest('td');
    expect(subtotalLabelCell).toHaveAttribute('colspan', '2');

    const grandTotalLabelCell = screen.getByText('Total Liabilities & Equity').closest('td');
    expect(grandTotalLabelCell).toHaveAttribute('colspan', '2');
  });

  it('displays loading indicator when loading is true', () => {
    render(
      <FinancialTable
        columns={sampleColumns}
        data={[]}
        loading={true}
        loadingMessage="Loading trial balance..."
        keyExtractor={(r) => r.code}
      />,
    );

    expect(screen.getByText('Loading trial balance...')).toBeInTheDocument();
  });

  it('displays empty message when data is empty', () => {
    render(
      <FinancialTable
        columns={sampleColumns}
        data={[]}
        loading={false}
        emptyMessage="No accounts found."
        keyExtractor={(r) => r.code}
      />,
    );

    expect(screen.getByText('No accounts found.')).toBeInTheDocument();
  });

  it('generates CSV and Excel export with metadata headers and row contents', async () => {
    const tableRef = createRef<FinancialTableHandle>();
    const onExportCsvSpy = jest.fn();
    const onExportExcelSpy = jest.fn();

    render(
      <FinancialTable
        ref={tableRef}
        columns={sampleColumns}
        data={sampleData}
        keyExtractor={(r) => r.code}
        exportFileName="trial-balance-test"
        showExportButton={true}
        reportMetadata={{
          title: 'Trial Balance Report',
          organization: 'Test Org Pty Ltd',
          period: '2026-08',
          currency: 'AUD',
        }}
        totals={{
          label: 'Totals',
          colSpanLabel: 2,
          values: { debit: '$5000.00', credit: '$2000.00', balance: '$3000.00' },
          exportValues: { debit: 5000, credit: 2000, balance: 3000 },
        }}
        onExportCsv={onExportCsvSpy}
        onExportExcel={onExportExcelSpy}
      />,
    );

    const user = userEvent.setup();
    const exportMenuBtn = screen.getByRole('button', { name: /Export/i });
    expect(exportMenuBtn).toBeInTheDocument();
    await user.click(exportMenuBtn);

    const exportCsvBtn = screen.getByRole('menuitem', { name: 'Export CSV' });
    expect(exportCsvBtn).toBeInTheDocument();
    await user.click(exportCsvBtn);

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(onExportCsvSpy).toHaveBeenCalledTimes(1);

    // Also test imperative ref export for CSV
    tableRef.current?.exportCsv();
    expect(onExportCsvSpy).toHaveBeenCalledTimes(2);

    // Test imperative ref export for Excel
    await tableRef.current?.exportExcel();
    expect(writeXlsxFile).toHaveBeenCalled();
    expect(onExportExcelSpy).toHaveBeenCalledTimes(1);
  });
});
