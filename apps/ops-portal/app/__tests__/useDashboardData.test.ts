import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardData } from '../useDashboardData';
import { DEFAULT_SEARCH_ENTITIES } from '../SearchSettingsSlideOver';
import { DEFAULT_QUICK_ACTIONS } from '../QuickActionsSettingsSlideOver';
import { DEFAULT_ENABLED_EVENTS } from '../TimelineSettingsSlideOver';
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

  it('loads dashboard settings and reports successfully with custom config', async () => {
    mockGetSettings.mockResolvedValue({
      data: {
        dashboardConfig: {
          searchEntities: ['product', 'customer'],
          quickActions: [
            {
              id: 'create_quote',
              title: 'createQuote',
              href: '/sales-orders/new',
              icon: 'request_quote',
              enabled: true,
            },
          ],
          timelineEvents: ['sales_order.created'],
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

    expect(result.current.enabledSearchEntities).toEqual(['product', 'customer']);
    expect(result.current.quickActions).toHaveLength(1);
    expect(result.current.enabledEvents).toEqual(['sales_order.created']);
    expect(result.current.dashboardConfig?.pinnedReports).toHaveLength(1);
    expect(result.current.reports).toEqual([{ slug: 'sales-summary', name: 'Sales Summary' }]);
  });

  it('falls back to defaults when settings are empty', async () => {
    mockGetSettings.mockResolvedValue({ data: {} });
    mockGetReports.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.enabledSearchEntities).toEqual(DEFAULT_SEARCH_ENTITIES);
    expect(result.current.quickActions).toEqual(DEFAULT_QUICK_ACTIONS);
    expect(result.current.enabledEvents).toEqual(DEFAULT_ENABLED_EVENTS);
  });

  it('handles search entities change and persists updates', async () => {
    mockGetSettings.mockResolvedValue({ data: {} });
    mockGetReports.mockResolvedValue({ data: [] });
    mockUpdateSettings.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    act(() => {
      result.current.handleSearchEntitiesChange(['product', 'customer', 'shipment']);
    });

    expect(result.current.enabledSearchEntities).toEqual(['product', 'customer', 'shipment']);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      dashboardConfig: { searchEntities: ['product', 'customer', 'shipment'] },
    });
  });

  it('handles quick actions change and persists updates', async () => {
    mockGetSettings.mockResolvedValue({ data: {} });
    mockGetReports.mockResolvedValue({ data: [] });
    mockUpdateSettings.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    const customActions = [
      {
        id: 'custom_1',
        title: 'Custom Balances',
        href: '/balances',
        icon: 'payments',
        enabled: true,
        isCustom: true,
      },
    ];

    act(() => {
      result.current.handleQuickActionsChange(customActions);
    });

    expect(result.current.quickActions).toEqual(customActions);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      dashboardConfig: { quickActions: customActions },
    });
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
      result.current.handlePreferencesChange(['purchase_order.created']);
    });

    expect(result.current.enabledEvents).toEqual(['purchase_order.created']);
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      dashboardConfig: { timelineEvents: ['purchase_order.created'] },
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
