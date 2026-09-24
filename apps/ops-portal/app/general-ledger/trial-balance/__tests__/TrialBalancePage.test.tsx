import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrialBalancePage from '../page';
import * as api from '@herobm/sdk';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';

// Mocks
jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

const glTranslations: Record<string, string> = {
  'trialBalance.title': 'Trial Balance',
  'trialBalance.asOfDate': 'As of Date',
  'trialBalance.fromDate': 'From',
  'trialBalance.toDate': 'To',
  'trialBalance.export': 'Export...',
  'trialBalance.exportAuditPdf': 'Audit PDF',
  'trialBalance.exportCsv': 'Export CSV',
  'trialBalance.exportExcel': 'Export Excel',
  'trialBalance.exporting': 'Exporting...',
  'trialBalance.noData': 'No transactions found for this period.',
  'trialBalance.closedPeriod': 'Closed Period (Immutable)',
  'trialBalance.softLocked': 'Soft Locked',
  'trialBalance.subledgerReconAllBalanced': 'Continuous Subledger Reconciliation: All Accounts in Balance',
  'trialBalance.subledgerReconDiscrepancy': 'Continuous Subledger Reconciliation: Discrepancy Detected',
  'trialBalance.zeroSumNet': 'Trial Balance Zero-Sum Net',
  'trialBalance.columns.accountCode': 'Code',
  'trialBalance.columns.accountName': 'Account Name',
  'trialBalance.columns.accountType': 'Type',
  'trialBalance.columns.balance': 'Balance',
  'trialBalance.columns.credit': 'Credit',
  'trialBalance.columns.debit': 'Debit',
  'trialBalance.columns.openingBalance': 'Opening Bal',
  'trialBalance.columns.periodCredit': 'Period Cr',
  'trialBalance.columns.periodDebit': 'Period Dr',
  'trialBalance.columns.closingBalance': 'Closing Bal',
  'trialBalance.columns.ytdBalance': 'YTD Bal',
  'trialBalance.columns.ytdCredit': 'YTD Cr',
  'trialBalance.columns.ytdDebit': 'YTD Dr',
  'trialBalance.modes.fiscalPeriod': 'Fiscal Period',
  'trialBalance.modes.periodic': 'Periodic',
  'trialBalance.modes.pointInTime': 'Point in Time',
  loading: 'Loading general ledger...',
};

const commonTranslations: Record<string, string> = {
  na: 'N/A',
  totals: 'Totals',
  'grid.export': 'Export',
  'grid.exportCsv': 'Export CSV',
  'grid.exportExcel': 'Export Excel',
  'grid.loadingEllipsis': 'Loading...',
  'grid.noRowsToShow': 'No records found.',
  'reporting.asOfDate': 'As of Date',
  'reporting.closedPeriod': 'Closed Period (Immutable)',
  'reporting.customRange': 'Custom Range',
  'reporting.exportCsv': 'Export CSV',
  'reporting.fiscalPeriod': 'Fiscal Period',
  'reporting.fromDate': 'From',
  'reporting.periodic': 'Periodic',
  'reporting.pointInTime': 'Point in Time',
  'reporting.refresh': 'Refresh',
  'reporting.softLocked': 'Soft Locked',
  'reporting.toDate': 'To',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    if (namespace === 'gl') {
      return glTranslations[key] || key;
    }
    if (namespace === 'gl.trialBalance') {
      return glTranslations[`trialBalance.${key}`] || key;
    }
    if (namespace === 'common') {
      return commonTranslations[key] || key;
    }
    if (namespace === 'common.grid') {
      return commonTranslations[`grid.${key}`] || commonTranslations[key] || key;
    }
    return key;
  },
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
  glControllerGetSubledgerReconciliation: jest.fn(),
  glControllerGetTrialBalance: jest.fn(),
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

const mockReconReport: api.SubledgerReconciliationResponseDto = {
  timestamp: '2026-08-31T23:59:59Z',
  isOverallBalanced: true,
  trialBalanceZeroSum: {
    totalDebit: 150000,
    totalCredit: 150000,
    netDifference: 0,
    isBalanced: true,
  },
  accountsReceivable: {
    controlAccountCode: '1100',
    controlAccountName: 'Accounts Receivable',
    glBalance: 45000,
    subledgerBalance: 45000,
    drift: 0,
    isMatched: true,
  },
  accountsPayable: {
    controlAccountCode: '2000',
    controlAccountName: 'Accounts Payable',
    glBalance: -25000,
    subledgerBalance: -25000,
    drift: 0,
    isMatched: true,
  },
  goodsReceivedNotInvoiced: {
    controlAccountCode: '2100',
    controlAccountName: 'GRNI Control',
    glBalance: 0,
    subledgerBalance: 0,
    drift: 0,
    isMatched: true,
  },
  perpetualInventory: {
    controlAccountCode: '1300',
    controlAccountName: 'Perpetual Inventory',
    glBalance: 60000,
    subledgerBalance: 60000,
    drift: 0,
    isMatched: true,
  },
};

const mockRows: api.TrialBalanceResponseDto[] = [
  {
    accountCode: '1000',
    name: 'Operating Bank Account',
    accountType: 'asset',
    isGroup: false,
    periodDebit: 50000,
    periodCredit: 20000,
    openingBalance: 10000,
    closingBalance: 40000,
    ytdDebit: 120000,
    ytdCredit: 80000,
    ytdBalance: 40000,
  },
  {
    accountCode: '2000',
    name: 'Trade Creditors Control',
    accountType: 'liability',
    isGroup: false,
    periodDebit: 20000,
    periodCredit: 50000,
    openingBalance: -10000,
    closingBalance: -40000,
    ytdDebit: 80000,
    ytdCredit: 120000,
    ytdBalance: -40000,
  },
];

describe('TrialBalancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetFiscalPeriods as jest.Mock).mockResolvedValue({
      data: mockPeriods,
    });
    (api.glControllerGetSubledgerReconciliation as jest.Mock).mockResolvedValue({
      data: mockReconReport,
    });
    (api.glControllerGetTrialBalance as jest.Mock).mockResolvedValue({
      data: mockRows,
    });
    (api.pdfTemplatesControllerRunHook as jest.Mock).mockResolvedValue({
      data: new Blob(['fake-pdf'], { type: 'application/pdf' }),
    });
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/fake-pdf');
    window.URL.revokeObjectURL = jest.fn();
    window.open = jest.fn();
  });

  it('renders trial balance in point-in-time mode with reconciliation banner', async () => {
    render(<TrialBalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Trial Balance')).toBeInTheDocument();
      expect(screen.getByText('Continuous Subledger Reconciliation: All Accounts in Balance')).toBeInTheDocument();
      expect(screen.getByText('Operating Bank Account')).toBeInTheDocument();
      expect(screen.getByText('Trade Creditors Control')).toBeInTheDocument();
      expect(screen.getByText('Audit PDF')).toBeInTheDocument();
      expect(screen.getByText('Export...')).toBeInTheDocument();
    });
  });

  it('switches to fiscal period mode and renders periodic columns', async () => {
    const user = userEvent.setup();
    render(<TrialBalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Point in Time')).toBeInTheDocument();
    });

    const modeSelect = screen.getByDisplayValue('Point in Time');
    await user.selectOptions(modeSelect, 'fiscal_period');

    await waitFor(() => {
      expect(screen.getByText('Opening Bal')).toBeInTheDocument();
      expect(screen.getByText('Period Dr')).toBeInTheDocument();
      expect(screen.getByText('Period Cr')).toBeInTheDocument();
      expect(screen.getByText('Closing Bal')).toBeInTheDocument();
      expect(screen.getByText('YTD Dr')).toBeInTheDocument();
      expect(screen.getByText('YTD Cr')).toBeInTheDocument();
      expect(screen.getByText('YTD Bal')).toBeInTheDocument();
    });
  });

  it('triggers CSV export when Export CSV is selected in Export menu', async () => {
    const user = userEvent.setup();
    render(<TrialBalancePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });

    const exportMenuBtn = screen.getByRole('button', { name: /Export/i });
    await user.click(exportMenuBtn);

    const exportCsvBtn = screen.getByRole('menuitem', { name: 'Export CSV' });
    await user.click(exportCsvBtn);

    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it('triggers Audit PDF export when Audit PDF button is clicked', async () => {
    const user = userEvent.setup();
    render(<TrialBalancePage />);

    await waitFor(() => {
      expect(screen.getByText('Audit PDF')).toBeInTheDocument();
    });

    const auditBtn = screen.getByText('Audit PDF');
    await user.click(auditBtn);

    await waitFor(() => {
      expect(api.pdfTemplatesControllerRunHook).toHaveBeenCalledWith(
        'period-close-audit',
        {},
        {
          id: 'p-1',
          context: DATA_SOURCE_CONTEXT.PERIOD_CLOSE_AUDIT,
        },
      );
      expect(window.open).toHaveBeenCalledWith('blob:http://localhost/fake-pdf', '_blank');
    });
  });
});
