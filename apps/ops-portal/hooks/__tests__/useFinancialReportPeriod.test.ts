import { renderHook, act, waitFor } from '@testing-library/react';
import { useFinancialReportPeriod } from '../useFinancialReportPeriod';
import * as api from '@herobm/sdk';

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  glControllerGetFiscalPeriods: jest.fn(),
}));

describe('useFinancialReportPeriod', () => {
  const mockPeriods = [
    {
      periodId: 'p1',
      periodName: '2026-08',
      fiscalYear: 2026,
      periodNumber: 8,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      isClosed: false,
      isAdjustment: false,
    },
    {
      periodId: 'p2',
      periodName: '2026-09',
      fiscalYear: 2026,
      periodNumber: 9,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      isClosed: false,
      isAdjustment: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetFiscalPeriods as jest.Mock).mockResolvedValue({
      data: mockPeriods,
    });
  });

  it('loads fiscal periods and initializes defaults', async () => {
    const { result } = renderHook(() => useFinancialReportPeriod());

    expect(result.current.loadingPeriods).toBe(true);

    await waitFor(() => {
      expect(result.current.loadingPeriods).toBe(false);
    });

    expect(result.current.periods).toHaveLength(2);
    expect(result.current.selectedPeriodId).toBe('p1');
    expect(result.current.startDate).toBe('2026-08-01');
    expect(result.current.endDate).toBe('2026-08-31');
    expect(result.current.asOfDate).toBe('2026-08-31');
    expect(result.current.formattedSubtitle).toBe('2026-08 (2026-08-01 to 2026-08-31)');
  });

  it('updates dates when period is switched', async () => {
    const { result } = renderHook(() => useFinancialReportPeriod());

    await waitFor(() => {
      expect(result.current.loadingPeriods).toBe(false);
    });

    act(() => {
      result.current.setPeriodId('p2');
    });

    expect(result.current.selectedPeriodId).toBe('p2');
    expect(result.current.startDate).toBe('2026-09-01');
    expect(result.current.endDate).toBe('2026-09-30');
    expect(result.current.asOfDate).toBe('2026-09-30');
    expect(result.current.formattedSubtitle).toBe('2026-09 (2026-09-01 to 2026-09-30)');
  });

  it('handles point in time mode formatting and dates', async () => {
    const { result } = renderHook(() =>
      useFinancialReportPeriod({ defaultMode: 'point_in_time' }),
    );

    await waitFor(() => {
      expect(result.current.loadingPeriods).toBe(false);
    });

    expect(result.current.mode).toBe('point_in_time');

    act(() => {
      result.current.setAsOfDate('2026-10-15');
    });

    expect(result.current.asOfDate).toBe('2026-10-15');
    expect(result.current.formattedSubtitle).toBe('As of 2026-10-15');
  });

  it('supports custom date range mode', async () => {
    const { result } = renderHook(() =>
      useFinancialReportPeriod({ defaultMode: 'custom_range' }),
    );

    await waitFor(() => {
      expect(result.current.loadingPeriods).toBe(false);
    });

    act(() => {
      result.current.setStartDate('2026-01-01');
      result.current.setEndDate('2026-06-30');
    });

    expect(result.current.startDate).toBe('2026-01-01');
    expect(result.current.endDate).toBe('2026-06-30');
    expect(result.current.formattedSubtitle).toBe('2026-01-01 to 2026-06-30');
  });
});
