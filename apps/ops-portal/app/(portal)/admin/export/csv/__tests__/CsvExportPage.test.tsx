import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CsvExportPage from '../page';
import * as api from '@herobm/sdk';

const mockSearchParams = {
  get: jest.fn().mockReturnValue(null),
};
const mockRouter = {
  push: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}));

const translationsMap: Record<string, string> = {
  title: 'Export Data (CSV)',
  subtitle: 'Download database records as CSV files.',
  targetTable: 'Target Table',
  searchTables: 'Search entities...',
  downloadCsv: 'Download CSV Export',
  downloading: 'Exporting...',
  options: 'Export Options',
  includeArchived: 'Include Archived / Inactive records',
  includeArchivedDesc: 'Export all records regardless of status',
  limitLabel: 'Record Limit (Optional)',
  limitPlaceholder: 'All records',
  columnsPreview: 'Columns included in export',
  exportSuccess: 'Export completed successfully',
  exportFailed: 'Failed to export data',
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
  setupControllerExportCsv: jest.fn(),
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

describe('CsvExportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.setupControllerGetCsvMetadata as jest.Mock).mockResolvedValue({
      data: mockTables,
    });
    (api.setupControllerExportCsv as jest.Mock).mockResolvedValue({
      data: 'customer_id,customer_number,state_code,currency_code\n1,C-1,active,AUD',
    });
    // Mock URL methods for downloading
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  it('renders table list returned from metadata API including extended projections', async () => {
    render(<CsvExportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Customers (Extended)')).toBeInTheDocument();
      expect(screen.getByText('Actors')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
    });

    expect(api.setupControllerGetCsvMetadata).toHaveBeenCalledTimes(1);
  });

  it('filters table list by search query', async () => {
    render(<CsvExportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search entities...');
    fireEvent.change(searchInput, { target: { value: 'act' } });

    expect(screen.getByText('Actors')).toBeInTheDocument();
    expect(screen.queryByText('Customers')).not.toBeInTheDocument();
    expect(screen.queryByText('Products')).not.toBeInTheDocument();
  });

  it('selects table when clicked and updates options preview', async () => {
    render(<CsvExportPage />);

    await waitFor(() => {
      expect(screen.getByText('Actors')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Actors'));

    expect(screen.getByText('Key: actor_id')).toBeInTheDocument();
  });

  it('toggles column preview accordion', async () => {
    render(<CsvExportPage />);

    await waitFor(() => {
      expect(screen.getByText('Actors')).toBeInTheDocument();
    });

    const previewButton = screen.getByText(/Columns included in export/i);
    expect(screen.queryByText('actor_id')).not.toBeInTheDocument();

    fireEvent.click(previewButton);

    expect(screen.getByText('actor_id')).toBeInTheDocument();
    expect(screen.getByText('name*')).toBeInTheDocument();
  });

  it('calls export API with selected options and triggers download', async () => {
    render(<CsvExportPage />);

    await waitFor(() => {
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Customers'));
    await waitFor(() => {
      expect(screen.getAllByText('Key: customer_number')[0]).toBeInTheDocument();
    });

    const includeArchivedCheckbox = screen.getByRole('checkbox');
    fireEvent.click(includeArchivedCheckbox);

    const limitInput = screen.getByPlaceholderText('All records');
    fireEvent.change(limitInput, { target: { value: '50' } });

    const downloadBtn = screen.getByRole('button', { name: /Download CSV Export/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(api.setupControllerExportCsv).toHaveBeenCalledWith(
        'customers',
        expect.objectContaining({
          includeArchived: true,
          limit: 50,
        }),
      );
    });
  });
});
