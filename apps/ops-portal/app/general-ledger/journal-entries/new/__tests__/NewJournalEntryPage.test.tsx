import { render, screen, fireEvent } from '@testing-library/react';
import NewJournalEntryPage from '../page';
import * as api from '@herobm/sdk';

// ── Mocks ────────────────────────────────────────────────────────────

const translations: Record<string, string> = {
  newManualEntry: 'New Manual Journal Entry',
  entryType: 'Entry Type',
  'columns.date': 'Date',
  'columns.memo': 'Memo',
  'placeholders.memo': 'Reason for journal entry...',
  'sourceTypes.manual': 'General Journal',
  'sourceTypes.opening_balance': 'Opening Balance / Take-On',
  'sourceTypes.adjustment': 'Periodic / Audit Adjustment',
  'sourceTypes.payroll': 'Manual Payroll',
  'sourceTypes.tax_settlement': 'Tax Settlement',
  lines: 'Lines',
  postEntry: 'Post Journal Entry',
  cancel: 'Cancel',
  saving: 'Saving...',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => translations[key] || key,
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({ baseCurrency: 'AUD' }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  glControllerGetAccounts: jest.fn(),
  costCentersControllerFindAll: jest.fn(),
  activitiesControllerFindAll: jest.fn(),
  glControllerCreateManualJournalEntry: jest.fn(),
}));

const mockAccounts = [
  { accountCode: '0501', name: 'ANZ Bank', isGroup: false, isActive: true, accountType: 'asset' },
  { accountCode: '0010', name: 'Sales', isGroup: false, isActive: true, accountType: 'revenue' },
];

describe('NewJournalEntryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetAccounts as jest.Mock).mockResolvedValue({ data: mockAccounts });
    (api.costCentersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.activitiesControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.glControllerCreateManualJournalEntry as jest.Mock).mockResolvedValue({ data: { entryNumber: 'JE-001' } });
  });

  it('renders date, memo, and Entry Type dropdown with all 5 selectable sourceTypes', async () => {
    render(<NewJournalEntryPage />);

    expect(screen.getByText('New Manual Journal Entry')).toBeInTheDocument();
    expect(screen.getByText('Entry Type *')).toBeInTheDocument();

    const select = screen.getByDisplayValue('General Journal');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('manual');

    // Verify all 5 options are present
    expect(screen.getByRole('option', { name: 'General Journal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Opening Balance / Take-On' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Periodic / Audit Adjustment' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Manual Payroll' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tax Settlement' })).toBeInTheDocument();
  });

  it('allows user to change Entry Type to Opening Balance Take-On', async () => {
    render(<NewJournalEntryPage />);

    const select = screen.getByDisplayValue('General Journal');
    fireEvent.change(select, { target: { value: 'opening_balance' } });

    expect(select).toHaveValue('opening_balance');
  });
});
