import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import BalanceSheetPage from '../page';
import * as api from '@herobm/sdk';

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock hooks
jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/hooks/useFinancialReportPeriod', () => ({
  useFinancialReportPeriod: () => ({
    asOfDate: '2026-08-31',
    selectedPeriodId: 'p-1',
    periods: [
      {
        periodId: 'p-1',
        periodName: '2026-08',
        fiscalYear: 2026,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'open',
      },
    ],
    mode: 'point_in_time',
    setMode: jest.fn(),
    setPeriodId: jest.fn(),
    setStartDate: jest.fn(),
    setEndDate: jest.fn(),
    setAsOfDate: jest.fn(),
    formattedSubtitle: 'As of 2026-08-31',
    loadingPeriods: false,
  }),
}));

// Mock SDK
jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  glControllerGetBalanceSheet: jest.fn(),
}));

describe('BalanceSheetPage', () => {
  const mockBalanceSheetData: api.BalanceSheetResponseDto = {
    period: {
      asOfDate: '2026-08-31',
      periodName: '2026-08',
      fiscalYear: 2026,
    },
    currentAssets: {
      title: 'Current Assets',
      lines: [
        {
          accountCode: '1010',
          accountName: 'Operating Cash',
          balance: 10000,
          movementMtd: 5000,
          movementYtd: 5000,
          movementLastYtd: 2500,
        },
      ],
      total: 10000,
      totalMovementMtd: 5000,
      totalMovementYtd: 5000,
      totalMovementLastYtd: 2500,
    },
    nonCurrentAssets: {
      title: 'Non-Current Assets',
      lines: [
        {
          accountCode: '1500',
          accountName: 'Plant & Equipment',
          balance: 20000,
          movementMtd: 0,
          movementYtd: 20000,
          movementLastYtd: 0,
        },
      ],
      total: 20000,
      totalMovementMtd: 0,
      totalMovementYtd: 20000,
      totalMovementLastYtd: 0,
    },
    currentLiabilities: {
      title: 'Current Liabilities',
      lines: [
        {
          accountCode: '2000',
          accountName: 'Trade Payables',
          balance: 12000,
          movementMtd: 0,
          movementYtd: 12000,
          movementLastYtd: 0,
        },
      ],
      total: 12000,
      totalMovementMtd: 0,
      totalMovementYtd: 12000,
      totalMovementLastYtd: 0,
    },
    nonCurrentLiabilities: {
      title: 'Non-Current Liabilities',
      lines: [],
      total: 0,
      totalMovementMtd: 0,
      totalMovementYtd: 0,
      totalMovementLastYtd: 0,
    },
    equity: {
      title: 'Equity',
      lines: [
        {
          accountCode: '3000',
          accountName: 'Share Capital',
          balance: 13000,
          movementMtd: 0,
          movementYtd: 0,
          movementLastYtd: 2500,
        },
        {
          accountCode: '',
          accountName: 'Current Period Earnings / Net Income',
          balance: 5000,
          movementMtd: 5000,
          movementYtd: 13000,
          movementLastYtd: 0,
        },
      ],
      total: 18000,
      totalMovementMtd: 5000,
      totalMovementYtd: 13000,
      totalMovementLastYtd: 2500,
    },
    validation: {
      totalAssets: 30000,
      totalLiabilities: 12000,
      totalEquity: 18000,
      totalLiabilitiesAndEquity: 30000,
      drift: 0,
      isBalanced: true,
      totalAssetsMovementMtd: 5000,
      totalLiabilitiesAndEquityMovementMtd: 5000,
      totalAssetsMovementYtd: 25000,
      totalLiabilitiesAndEquityMovementYtd: 25000,
      totalAssetsMovementLastYtd: 2500,
      totalLiabilitiesAndEquityMovementLastYtd: 2500,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetBalanceSheet as jest.Mock).mockResolvedValue({
      data: mockBalanceSheetData,
    });
  });

  it('renders table columns for Code, Account, Amount, Movement MTD, YTD, and Last YTD', async () => {
    render(<BalanceSheetPage />);

    await waitFor(() => {
      expect(screen.getByText('Operating Cash')).toBeInTheDocument();
    });

    // Check Column Headers
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('account')).toBeInTheDocument();
    expect(screen.getByText('amount')).toBeInTheDocument();
    expect(screen.getByText('movementMtd')).toBeInTheDocument();
    expect(screen.getByText('movementYtd')).toBeInTheDocument();
    expect(screen.getByText('movementLastYtd')).toBeInTheDocument();

    // Check Account Rows and Movement Values
    expect(screen.getByText('1010')).toBeInTheDocument();
    expect(screen.getByText('Operating Cash')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('Plant & Equipment')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('Trade Payables')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();
    expect(screen.getByText('Share Capital')).toBeInTheDocument();

    // Check Totals
    expect(screen.getByText('totalLiabilitiesAndEquity')).toBeInTheDocument();
  });
});
