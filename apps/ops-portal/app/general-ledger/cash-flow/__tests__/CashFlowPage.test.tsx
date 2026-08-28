import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CashFlowPage from '../page';
import * as api from '@herobm/sdk';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

const translations: Record<string, string> = {
  title: 'Statement of Cash Flows',
  fiscalPeriod: 'Fiscal Period',
  customRange: 'Custom Date Range',
  to: 'to',
  exportPdf: 'Statement PDF',
  exporting: 'Exporting...',
  reconciled: 'General Ledger Cash Parity Verified',
  unreconciled: 'Cash Reconciliation Drift Detected',
  reconciledDesc: 'Calculated net flow matches actual GL bank account movement.',
  unreconciledDesc: 'Discrepancy detected between cash flow activities and GL bank control balances.',
  endingCash: 'Ending Cash Balance',
  beginningCash: 'Beginning Cash',
  operatingCash: 'Operating Cash Flow',
  investingFinancing: 'Investing & Financing',
  netPeriodChange: 'Net Period Change',
  loading: 'Loading Statement of Cash Flows...',
  noData: 'No cash flow data available for the selected period.',
  section1: '1. Cash Flows from Operating Activities',
  section2: '2. Cash Flows from Investing Activities',
  section3: '3. Cash Flows from Financing Activities',
  section4: '4. Summary & Cash Reconciliation Schedule',
  noOperating: 'No operating cash transactions recorded in this period.',
  noInvesting: 'No investing capital transactions recorded in this period.',
  noFinancing: 'No equity or loan financing transactions recorded in this period.',
  netOperating: 'Net Cash Provided by / (Used in) Operating Activities',
  netInvesting: 'Net Cash Provided by / (Used in) Investing Activities',
  netFinancing: 'Net Cash Provided by / (Used in) Financing Activities',
  netOperatingFlow: 'Net Operating Cash Flow',
  netInvestingFlow: 'Net Investing Cash Flow',
  netFinancingFlow: 'Net Financing Cash Flow',
  netChange: 'Net Increase / (Decrease) in Cash and Cash Equivalents',
  begCash: 'Cash and Cash Equivalents at Beginning of Period',
  endCash: 'Cash and Cash Equivalents at End of Period (Calculated)',
  glBalance: 'General Ledger Bank & Cash Balance',
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
  glControllerGetCashFlow: jest.fn(),
  pdfTemplatesControllerRunHook: jest.fn(),
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

const mockCashFlowData: api.CashFlowStatementResponseDto = {
  period: {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    periodName: '2026-08',
  },
  operatingActivities: {
    title: 'Cash Flows from Operating Activities',
    lines: [
      {
        id: 'op-1',
        name: 'Cash Receipts from Customers & Sales',
        category: 'operating',
        amount: 85000,
      },
      {
        id: 'op-2',
        name: 'Cash Paid to Suppliers & Inventory',
        category: 'operating',
        amount: -35000,
      },
    ],
    netCash: 50000,
  },
  investingActivities: {
    title: 'Cash Flows from Investing Activities',
    lines: [
      {
        id: 'inv-1',
        name: 'Purchase of Property, Plant & Equipment (Capex)',
        category: 'investing',
        amount: -12000,
      },
    ],
    netCash: -12000,
  },
  financingActivities: {
    title: 'Cash Flows from Financing Activities',
    lines: [
      {
        id: 'fin-1',
        name: 'Proceeds from Borrowings & Bank Facilities',
        category: 'financing',
        amount: 20000,
      },
    ],
    netCash: 20000,
  },
  reconciliation: {
    beginningCash: 40000,
    netChangeInCash: 58000,
    endingCash: 98000,
    glCashBalance: 98000,
    drift: 0,
    isReconciled: true,
  },
};

describe('CashFlowPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetFiscalPeriods as jest.Mock).mockResolvedValue({
      data: mockPeriods,
    });
    (api.glControllerGetCashFlow as jest.Mock).mockResolvedValue({
      data: mockCashFlowData,
    });
    (api.pdfTemplatesControllerRunHook as jest.Mock).mockResolvedValue({
      data: new Blob(['fake-pdf'], { type: 'application/pdf' }),
    });
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/fake-pdf');
    window.open = jest.fn();
  });

  it('renders statement of cash flows with all sections and reconciliation parity', async () => {
    render(<CashFlowPage />);

    await waitFor(() => {
      expect(screen.getByText('Statement of Cash Flows')).toBeInTheDocument();
      expect(screen.getByText('General Ledger Cash Parity Verified')).toBeInTheDocument();
      expect(screen.getByText('Cash Receipts from Customers & Sales')).toBeInTheDocument();
      expect(screen.getByText('Purchase of Property, Plant & Equipment (Capex)')).toBeInTheDocument();
      expect(screen.getByText('Proceeds from Borrowings & Bank Facilities')).toBeInTheDocument();
    });
  });

  it('triggers PDF export when Statement PDF button is clicked', async () => {
    const user = userEvent.setup();
    render(<CashFlowPage />);

    await waitFor(() => {
      expect(screen.getByText('Statement PDF')).toBeInTheDocument();
    });

    const exportBtn = screen.getByText('Statement PDF');
    await user.click(exportBtn);

    await waitFor(() => {
      expect(api.pdfTemplatesControllerRunHook).toHaveBeenCalledWith(
        'cash-flow-statement',
        {},
        {
          id: 'p-1',
          context: DATA_SOURCE_CONTEXT.CASH_FLOW_STATEMENT,
        },
      );
      expect(window.open).toHaveBeenCalledWith('blob:http://localhost/fake-pdf', '_blank');
    });
  });
});
