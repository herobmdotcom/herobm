import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfitAndLossPage from '../page';
import * as api from '@herobm/sdk';

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

const translations: Record<string, string> = {
  title: 'Profit & Loss',
  subtitle: 'Income statement covering operating revenue, direct costs, operating overhead, and net margin.',
  revenue: 'Revenue',
  costOfGoodsSold: 'Cost of Goods Sold',
  grossProfit: 'Gross Profit',
  grossMargin: 'Gross Margin',
  operatingExpenses: 'Operating Expenses',
  operatingIncome: 'Operating Income (EBIT)',
  otherIncomeExpense: 'Other Income & Expenses',
  netIncome: 'Net Income / (Loss)',
  netMargin: 'Net Margin',
  totalRevenue: 'Total Revenue',
  totalCogs: 'Total Cost of Goods Sold',
  totalOpex: 'Total Operating Expenses',
  totalOther: 'Total Other Income & Expenses',
  account: 'Account',
  periodAmount: 'Period Amount',
  ytdAmount: 'YTD Amount',
  export: 'Export...',
  exportCsv: 'Export CSV',
  exportExcel: 'Export Excel',
  'grid.export': 'Export',
  'grid.exportCsv': 'Export CSV',
  'grid.exportExcel': 'Export Excel',
  exporting: 'Exporting...',
  loading: 'Loading Profit & Loss statement...',
  noData: 'No revenue or expense activity recorded for the selected period.',
  'reporting.fiscalPeriod': 'Fiscal Period',
  'reporting.customRange': 'Custom Range',
  'reporting.closedPeriod': 'Closed Period (Immutable)',
  'reporting.softLocked': 'Soft Locked',
  'reporting.fromDate': 'From',
  'reporting.toDate': 'To',
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
  glControllerGetFiscalPeriods: jest.fn(),
  glControllerGetProfitAndLoss: jest.fn(),
}));

const mockPeriods: api.FiscalPeriodResponseDto[] = [
  {
    periodId: 'p-1',
    periodName: '2026-08',
    fiscalYear: 2026,
    periodNumber: 8,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: 'hard_closed',
    createdOn: '2026-08-01T00:00:00Z',
    modifiedOn: '2026-08-31T23:59:59Z',
  },
];

const mockPnlData: api.ProfitAndLossResponseDto = {
  period: {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    periodName: '2026-08',
    fiscalYear: 2026,
    periodNumber: 8,
  },
  revenue: {
    title: 'Revenue',
    lines: [
      {
        accountCode: '4000',
        accountName: 'Product Sales',
        amount: 50000,
        ytdAmount: 150000,
      },
    ],
    total: 50000,
    ytdTotal: 150000,
  },
  costOfGoodsSold: {
    title: 'Cost of Goods Sold',
    lines: [
      {
        accountCode: '5000',
        accountName: 'Raw Materials Consumed',
        amount: 20000,
        ytdAmount: 60000,
      },
    ],
    total: 20000,
    ytdTotal: 60000,
  },
  operatingExpenses: {
    title: 'Operating Expenses',
    lines: [
      {
        accountCode: '6000',
        accountName: 'Salaries & Wages',
        amount: 10000,
        ytdAmount: 30000,
      },
    ],
    total: 10000,
    ytdTotal: 30000,
  },
  otherIncomeExpense: {
    title: 'Other Income & Expenses',
    lines: [],
    total: 0,
    ytdTotal: 0,
  },
  summary: {
    totalRevenue: 50000,
    totalCogs: 20000,
    grossProfit: 30000,
    grossMarginPercentage: 60.0,
    totalOperatingExpenses: 10000,
    operatingIncome: 20000,
    totalOtherIncomeExpense: 0,
    netIncome: 20000,
    netMarginPercentage: 40.0,
  },
};

describe('ProfitAndLossPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetFiscalPeriods as jest.Mock).mockResolvedValue({
      data: mockPeriods,
    });
    (api.glControllerGetProfitAndLoss as jest.Mock).mockResolvedValue({
      data: mockPnlData,
    });
  });

  it('renders report header, KPI summary cards and financial statement sections', async () => {
    render(<ProfitAndLossPage />);

    expect(screen.getByText('Profit & Loss')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.glControllerGetProfitAndLoss).toHaveBeenCalledWith({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        periodName: '2026-08',
        fiscalYear: 2026,
        periodNumber: 8,
      });
    });

    // Check KPI summary values
    await waitFor(() => {
      expect(screen.getAllByText('$50,000.00').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$30,000.00').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$20,000.00').length).toBeGreaterThan(0);
    });

    // Check table line items
    expect(screen.getByText('Product Sales')).toBeInTheDocument();
    expect(screen.getByText('Raw Materials Consumed')).toBeInTheDocument();
    expect(screen.getByText('Salaries & Wages')).toBeInTheDocument();

    // Check Gross Profit and Operating Income lines
    expect(screen.getByText('Gross Profit (60.0%)')).toBeInTheDocument();
    expect(screen.getByText('Operating Income (EBIT)')).toBeInTheDocument();
  });

  it('renders Export menu and options', async () => {
    const user = userEvent.setup();
    render(<ProfitAndLossPage />);

    const exportBtn = screen.getByRole('button', { name: /Export/i });
    expect(exportBtn).toBeInTheDocument();

    await user.click(exportBtn);
    expect(screen.getByRole('menuitem', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Export Excel' })).toBeInTheDocument();
  });

  it('handles empty state gracefully', async () => {
    (api.glControllerGetProfitAndLoss as jest.Mock).mockResolvedValue({
      data: {
        period: { startDate: '2026-08-01', endDate: '2026-08-31' },
        revenue: { title: 'Revenue', lines: [], total: 0, ytdTotal: 0 },
        costOfGoodsSold: { title: 'COGS', lines: [], total: 0, ytdTotal: 0 },
        operatingExpenses: { title: 'OPEX', lines: [], total: 0, ytdTotal: 0 },
        otherIncomeExpense: { title: 'Other', lines: [], total: 0, ytdTotal: 0 },
        summary: {
          totalRevenue: 0,
          totalCogs: 0,
          grossProfit: 0,
          grossMarginPercentage: 0,
          totalOperatingExpenses: 0,
          operatingIncome: 0,
          totalOtherIncomeExpense: 0,
          netIncome: 0,
          netMarginPercentage: 0,
        },
      },
    });

    render(<ProfitAndLossPage />);

    await waitFor(() => {
      expect(
        screen.getByText('No revenue or expense activity recorded for the selected period.'),
      ).toBeInTheDocument();
    });
  });
});
