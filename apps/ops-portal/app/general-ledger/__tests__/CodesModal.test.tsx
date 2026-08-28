import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodesModal from '../CodesModal';
import * as api from '@herobm/sdk';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';

// ── Mocks ────────────────────────────────────────────────────────────

const translations: Record<string, string> = {
  accountingCodes: 'Accounting Codes',
  button: 'Codes',
  exportCsv: 'Export CSV',
  exportPdf: 'Export PDF',
  exporting: 'Exporting...',
  group: 'Group',
  search: 'Search codes...',
  subtitle: 'Quick reference for customers, cost centers, and activities',
  title: 'Accounting Codes Cheat Sheet',
  'columns.chartOfAccounts': 'Chart of Accounts',
  'columns.costCenters': 'Cost Centers',
  'columns.activities': 'Activities',
  loading: 'Loading...',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => translations[key] || key,
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
  glControllerGetAccounts: jest.fn(),
  costCentersControllerFindAll: jest.fn(),
  activitiesControllerFindAll: jest.fn(),
  pdfTemplatesControllerRunHook: jest.fn(),
}));

const mockCoa = [
  {
    accountId: 'acc-1',
    accountCode: '1000',
    name: 'Current Assets',
    accountType: 'asset',
    isGroup: true,
    children: [
      {
        accountId: 'acc-2',
        accountCode: '1010',
        name: 'Bank Operating Account',
        accountType: 'asset',
        isGroup: false,
        children: [],
      },
    ],
  },
];

const mockCostCenters = [
  {
    costCenterId: 'cc-1',
    code: '00',
    name: 'Head Office',
    isActive: true,
  },
  {
    costCenterId: 'cc-2',
    code: '10',
    name: 'Warehouse Operations',
    isActive: false,
  },
];

const mockActivities = [
  {
    activityId: 'act-1',
    code: '00',
    name: 'General Business',
    isActive: true,
  },
];

describe('CodesModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetAccounts as jest.Mock).mockResolvedValue({
      data: mockCoa,
    });
    (api.costCentersControllerFindAll as jest.Mock).mockResolvedValue({
      data: mockCostCenters,
    });
    (api.activitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: mockActivities,
    });
    (api.pdfTemplatesControllerRunHook as jest.Mock).mockResolvedValue({
      data: new Blob(['fake-pdf'], { type: 'application/pdf' }),
    });

    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/fake-pdf');
    window.URL.revokeObjectURL = jest.fn();
    window.open = jest.fn();
  });

  it('renders modal when open with accounts, cost centers, and activities', async () => {
    render(<CodesModal isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Accounting Codes')).toBeInTheDocument();
      expect(screen.getByText('Current Assets')).toBeInTheDocument();
      expect(screen.getByText('Bank Operating Account')).toBeInTheDocument();
      expect(screen.getByText('Head Office')).toBeInTheDocument();
      expect(screen.getByText('General Business')).toBeInTheDocument();
    });
  });

  it('triggers PDF export when PDF button is clicked', async () => {
    const user = userEvent.setup();
    render(<CodesModal isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTitle('Export PDF')).toBeInTheDocument();
    });

    const pdfBtn = screen.getByTitle('Export PDF');
    await user.click(pdfBtn);

    await waitFor(() => {
      expect(api.pdfTemplatesControllerRunHook).toHaveBeenCalledWith(
        'accounting-codes',
        {},
        {
          id: 'default',
          context: DATA_SOURCE_CONTEXT.ACCOUNTING_CODES,
        },
      );
      expect(window.open).toHaveBeenCalledWith('blob:http://localhost/fake-pdf', '_blank');
    });
  });

  it('triggers CSV export when CSV button is clicked', async () => {
    const user = userEvent.setup();
    render(<CodesModal isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTitle('Export CSV')).toBeInTheDocument();
    });

    const csvBtn = screen.getByTitle('Export CSV');
    await user.click(csvBtn);

    await waitFor(() => {
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
