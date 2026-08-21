import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardData } from '../useDashboardData';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@herobm/sdk', () => ({
  userSettingsControllerGetSettings: jest.fn(),
  userSettingsControllerUpdateSettings: jest.fn(),
  businessReportsControllerGetReports: jest.fn(),
  setSdkConfig: jest.fn(),
}));

describe('useDashboardData', () => {
  const mockGetSettings = api.userSettingsControllerGetSettings as jest.Mock;
  const mockUpdateSettings = api.userSettingsControllerUpdateSettings as jest.Mock;
  const mockGetReports = api.businessReportsControllerGetReports as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads dashboard settings and reports successfully', async () => {
    mockGetSettings.mockResolvedValue({
      data: {
        dashboardConfig: {
          timelineEvents: ['sales-order.created'],
          pinnedReports: [{ slug: 'sales-summary', configId: 'cfg-1', name: 'Sales' }],
        },
      },
    });
    mockGetReports.mockResolvedValue({
      data: [{ slug: 'sales-summary', name: 'Sales Summary' }],
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.enabledEvents).toEqual(['sales-order.created']);
    expect(result.current.dashboardConfig?.pinnedReports).toHaveLength(1);
    expect(result.current.reports).toEqual([{ slug: 'sales-summary', name: 'Sales Summary' }]);
  });

  it('handles timeline preferences change and persists updates', async () => {
    mockGetSettings.mockResolvedValue({ data: {} });
    mockGetReports.mockResolvedValue({ data: [] });
    mockUpdateSettings.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    act(() => {
      result.current.handlePreferencesChange(['purchase-order.received']);
    });

    expect(result.current.enabledEvents).toEqual(['purchase-order.received']);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      dashboardConfig: { timelineEvents: ['purchase-order.received'] },
    });
  });

  it('handles pinned reports change and persists updates', async () => {
    mockGetSettings.mockResolvedValue({ data: {} });
    mockGetReports.mockResolvedValue({ data: [] });
    mockUpdateSettings.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    const newPinned = [{ slug: 'inventory-valuation', configId: 'cfg-2', name: 'Inventory' }];
    act(() => {
      result.current.handlePinnedReportsChange(newPinned);
    });

    expect(result.current.dashboardConfig?.pinnedReports).toEqual(newPinned);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      dashboardConfig: { pinnedReports: newPinned },
    });
  });
});
