import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialReportLayout } from '../FinancialReportLayout';
import type { FinancialPeriodState } from '@/hooks/useFinancialReportPeriod';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      'reporting.fiscalPeriod': 'Fiscal Period',
      'reporting.periodic': 'Periodic',
      'reporting.customRange': 'Custom Range',
      'reporting.pointInTime': 'Point in Time',
      'reporting.fromDate': 'From',
      'reporting.toDate': 'To',
      'reporting.asOfDate': 'As of Date',
      'reporting.closedPeriod': 'Closed Period (Immutable)',
      'reporting.softLocked': 'Soft Locked',
    };
    return map[key] || key;
  },
}));

describe('FinancialReportLayout', () => {
  const mockSetMode = jest.fn();
  const mockSetPeriodId = jest.fn();
  const mockSetStartDate = jest.fn();
  const mockSetEndDate = jest.fn();
  const mockSetAsOfDate = jest.fn();

  const mockPeriodState: FinancialPeriodState = {
    periods: [
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
      {
        periodId: 'p-2',
        periodName: '2026-09',
        fiscalYear: 2026,
        periodNumber: 9,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        status: 'soft_locked',
        createdOn: '2026-09-01T00:00:00Z',
        modifiedOn: '2026-09-30T23:59:59Z',
      },
    ],
    selectedPeriodId: 'p-1',
    selectedPeriod: {
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
    mode: 'fiscal_period',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    asOfDate: '2026-08-31',
    loadingPeriods: false,
    setMode: mockSetMode,
    setPeriodId: mockSetPeriodId,
    setStartDate: mockSetStartDate,
    setEndDate: mockSetEndDate,
    setAsOfDate: mockSetAsOfDate,
    formattedSubtitle: '2026-08 (2026-08-01 to 2026-08-31)',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders report title, auto subtitle, period selector, and lock badge in fiscal_period mode', () => {
    render(
      <FinancialReportLayout
        title="Statement of Cash Flows"
        periodState={mockPeriodState}
        supportedModes={['fiscal_period', 'custom_range']}
        actions={<button>Export CSV</button>}
        banner={<div data-testid="test-banner">Reconciliation OK</div>}
      >
        <div data-testid="report-content">Report Table Content</div>
      </FinancialReportLayout>,
    );

    expect(screen.getByText('Statement of Cash Flows')).toBeInTheDocument();
    expect(screen.getByText('2026-08 (2026-08-01 to 2026-08-31)')).toBeInTheDocument();
    expect(screen.getByText('Closed Period (Immutable)')).toBeInTheDocument();
    expect(screen.getByTestId('test-banner')).toBeInTheDocument();
    expect(screen.getByTestId('report-content')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders date inputs when in custom_range / periodic mode', () => {
    const periodicState: FinancialPeriodState = {
      ...mockPeriodState,
      mode: 'custom_range',
      formattedSubtitle: '2026-08-01 to 2026-08-31',
    };

    render(
      <FinancialReportLayout
        title="Tax Balances"
        periodState={periodicState}
        supportedModes={['fiscal_period', 'custom_range']}
      >
        <div>Tax Table</div>
      </FinancialReportLayout>,
    );

    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
  });

  it('renders As of Date input when in point_in_time mode', () => {
    const pointInTimeState: FinancialPeriodState = {
      ...mockPeriodState,
      mode: 'point_in_time',
      formattedSubtitle: 'As of 2026-08-31',
    };

    render(
      <FinancialReportLayout
        title="Trial Balance"
        periodState={pointInTimeState}
        supportedModes={['point_in_time', 'periodic', 'fiscal_period']}
      >
        <div>Trial Balance Table</div>
      </FinancialReportLayout>,
    );

    expect(screen.getByText('As of Date')).toBeInTheDocument();
  });

  it('handles mode changes', () => {
    render(
      <FinancialReportLayout
        title="Trial Balance"
        periodState={mockPeriodState}
        supportedModes={['point_in_time', 'periodic', 'fiscal_period']}
      >
        <div>Content</div>
      </FinancialReportLayout>,
    );

    const select = screen.getByDisplayValue('Fiscal Period');
    fireEvent.change(select, { target: { value: 'point_in_time' } });
    expect(mockSetMode).toHaveBeenCalledWith('point_in_time');
  });
});
