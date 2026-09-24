import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaxBalancesContent from '../TaxBalancesContent';
import * as api from '@herobm/sdk';

// ── Mocks ────────────────────────────────────────────────────────────

const translations: Record<string, string> = {
  export: 'Export...',
  exportCsv: 'Export CSV',
  exportExcel: 'Export Excel',
  'reporting.export': 'Export...',
  'reporting.exportCsv': 'Export CSV',
  'reporting.exportExcel': 'Export Excel',
  'reporting.refresh': 'Refresh',
  'reporting.fiscalPeriod': 'Fiscal Period',
  'reporting.customRange': 'Custom Range',
  'reporting.pointInTime': 'Point in Time',
  'reporting.periodic': 'Periodic',
  'reporting.closedPeriod': 'Closed Period (Immutable)',
  'reporting.softLocked': 'Soft Locked',
  'reporting.fromDate': 'From',
  'reporting.toDate': 'To',
  'reporting.asOfDate': 'As of Date',
  'grid.export': 'Export',
  'grid.exportCsv': 'Export CSV',
  'grid.exportExcel': 'Export Excel',
  'grid.noRowsToShow': 'No records found.',
  'grid.loadingEllipsis': 'Loading...',
  refresh: 'Refresh',
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
  taxReportsControllerGetTaxReport: jest.fn(),
  glControllerGetFiscalPeriods: jest.fn(),
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

const mockGenericTaxReport: api.TaxReportResponseDto = {
  reportType: 'generic',
  title: 'Tax Balances',
  subtitle: 'Tax Liability & Statutory Reporting',
  genericSummary: {
    currencyCode: 'USD',
    totalGrossSales: 137500,
    taxableSales: 125000,
    exemptSales: 0,
    taxablePurchases: 45000,
    totalOutputTax: 12500,
    totalInputTax: 4500,
    netTaxLiability: 8000,
    netStatus: 'payable' as api.GenericTaxSummaryDtoNetStatus,
    totalNetSales: 125000,
    totalNetPurchases: 45000,
    categories: [
      {
        taxCategoryId: 'cat-1',
        title: 'Standard Rated Supplies (10%)',
        code: 'GST-STD',
        type: 'standard',
        rate: 10,
        salesBase: 100000,
        outputTax: 10000,
        purchaseBase: 35000,
        inputTax: 3500,
        netTax: 6500,
      },
      {
        taxCategoryId: 'cat-2',
        title: 'Reduced Rated Supplies (5%)',
        code: 'GST-RED',
        type: 'reduced',
        rate: 5,
        salesBase: 25000,
        outputTax: 2500,
        purchaseBase: 10000,
        inputTax: 1000,
        netTax: 1500,
      },
    ],
  },
};

const mockStatutoryReport: api.TaxReportResponseDto = {
  reportType: 'au_bas',
  title: 'Australia — ATO BAS',
  subtitle: 'Business Activity Statement',
  genericSummary: mockGenericTaxReport.genericSummary,
  boxes: [
    {
      id: 'box-g1',
      code: 'G1',
      description: 'Total sales (including GST)',
      section: 'GST',
      amount: 137500,
    },
    {
      id: 'box-1a',
      code: '1A',
      description: 'GST on sales',
      section: 'GST',
      amount: 12500,
    },
    {
      id: 'box-1b',
      code: '1B',
      description: 'GST on purchases',
      section: 'GST',
      amount: 4500,
    },
  ],
};

describe('TaxBalancesContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetFiscalPeriods as jest.Mock).mockResolvedValue({
      data: mockPeriods,
    });
    (api.taxReportsControllerGetTaxReport as jest.Mock).mockResolvedValue({
      data: mockGenericTaxReport,
    });
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/fake-csv');
    window.URL.revokeObjectURL = jest.fn();
  });

  it('renders generic tax summary schedule with totals and KPI banner', async () => {
    render(<TaxBalancesContent />);

    await waitFor(() => {
      expect(screen.getByText('Tax Balances')).toBeInTheDocument();
      expect(screen.getByText('Standard Rated Supplies (10%)')).toBeInTheDocument();
      expect(screen.getByText('Reduced Rated Supplies (5%)')).toBeInTheDocument();
      expect(screen.getByText('Net Payable')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('renders statutory tax return boxes when a country template is selected', async () => {
    (api.taxReportsControllerGetTaxReport as jest.Mock).mockResolvedValue({
      data: mockStatutoryReport,
    });

    const user = userEvent.setup();
    render(<TaxBalancesContent />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Generic Tax Summary (Global)')).toBeInTheDocument();
    });

    const templateSelect = screen.getByDisplayValue('Generic Tax Summary (Global)');
    await user.selectOptions(templateSelect, 'au_bas');

    await waitFor(() => {
      expect(screen.getByText('G1')).toBeInTheDocument();
      expect(screen.getByText('Total sales (including GST)')).toBeInTheDocument();
      expect(screen.getByText('1A')).toBeInTheDocument();
      expect(screen.getByText('GST on sales')).toBeInTheDocument();
    });
  });

  it('triggers CSV export when Export CSV is clicked from Export menu', async () => {
    const user = userEvent.setup();
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    render(<TaxBalancesContent />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });

    const exportMenuBtn = screen.getByRole('button', { name: /Export/i });
    await user.click(exportMenuBtn);

    const exportCsvBtn = screen.getByRole('menuitem', { name: 'Export CSV' });
    await user.click(exportCsvBtn);

    expect(mockClick).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
