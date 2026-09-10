import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CsvImportPage from '../page';
import * as api from '@herobm/sdk';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const translationsMap: Record<string, string> = {
  titleConfig: 'Import Data (CSV)',
  descConfig: 'Upload CSV files to bulk insert or update records.',
  titlePreview: 'Configure Import',
  descPreview: 'Upload a CSV file and select a merge strategy.',
  targetTable: 'Target Table',
  searchTables: 'Search entities...',
  continue: 'Continue',
  downloadTemplate: 'Download CSV Header Template',
  fileUpload: 'Upload CSV File',
  chooseFile: 'Choose File',
  noFileChosen: 'No file selected',
  mergeStrategy: 'Merge Strategy',
  insertOnly: 'Insert Only',
  insertOnlyDesc: 'Fastest. Fails on duplicate keys.',
  insertNewOnly: 'Ignore (Skip duplicates)',
  insertNewOnlyDesc: 'Inserts new records and skips duplicates.',
  upsertMerge: 'Upsert (Insert or Update)',
  upsertMergeDesc: 'Inserts new records and updates existing ones.',
  startImport: 'Start Import',
};

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (params?.count !== undefined) {
    return `${params.count} ${key}`;
  }
  return translationsMap[key] || key;
};

jest.mock('next-intl', () => ({
  useTranslations: () => mockT,
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setupControllerGetCsvMetadata: jest.fn(),
  setupControllerExecuteCsv: jest.fn(),
  setupControllerGetJobProgress: jest.fn(),
}));

const mockTables = [
  {
    id: 'customers',
    name: 'Customers',
    uniqueKey: 'customer_number',
    columns: ['customer_id', 'customer_number*', 'state_code*', 'currency_code*'],
  },
  {
    id: 'customers_extended',
    name: 'Customers (Extended)',
    uniqueKey: 'customer_number',
    columns: ['customer_number', 'customer_name', 'state_code'],
    exportOnly: true,
  },
  {
    id: 'actors',
    name: 'Actors',
    uniqueKey: 'actor_id',
    columns: ['actor_id', 'name*', 'state_code*', 'is_tax_registered*'],
  },
  {
    id: 'products',
    name: 'Products',
    uniqueKey: 'product_number',
    columns: ['product_id', 'product_number*', 'name*', 'state_code*'],
  },
];

describe('CsvImportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.setupControllerGetCsvMetadata as jest.Mock).mockResolvedValue({
      data: mockTables,
    });
  });

  it('renders available tables list on load excluding exportOnly tables', async () => {
    render(<CsvImportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Actors')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.queryByText('Customers (Extended)')).not.toBeInTheDocument();
    });

    expect(api.setupControllerGetCsvMetadata).toHaveBeenCalledTimes(1);
  });

  it('filters tables list when user types in search', async () => {
    render(<CsvImportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search entities...');
    fireEvent.change(searchInput, { target: { value: 'cust' } });

    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.queryByText('Actors')).not.toBeInTheDocument();
    expect(screen.queryByText('Products')).not.toBeInTheDocument();
  });

  it('allows selecting a table and advances to preview step', async () => {
    render(<CsvImportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customers'));

    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
      expect(screen.getByText('Merge Strategy')).toBeInTheDocument();
      expect(screen.getByText('Insert Only')).toBeInTheDocument();
      expect(screen.getByText('Upsert (Insert or Update)')).toBeInTheDocument();
      expect(screen.getByText('Ignore (Skip duplicates)')).toBeInTheDocument();
    });
  });

  it('allows changing merge strategy between insert, upsert, and ignore', async () => {
    render(<CsvImportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText('Merge Strategy')).toBeInTheDocument();
    });

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked(); // default: insert

    // Click ignore (radios[1])
    fireEvent.click(screen.getByText('Ignore (Skip duplicates)'));
    expect(radios[1]).toBeChecked();

    // Click upsert (radios[2])
    fireEvent.click(screen.getByText('Upsert (Insert or Update)'));
    expect(radios[2]).toBeChecked();
  });
});
