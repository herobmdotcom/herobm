import { renderHook, waitFor, act } from '@testing-library/react';
import { useDevelopers } from '../hooks/useDevelopers';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  appConfigControllerGet: jest.fn(),
  appConfigControllerUpdate: jest.fn(),
  apiKeysControllerList: jest.fn(),
  apiKeysControllerCreate: jest.fn(),
  apiKeysControllerRevoke: jest.fn(),
  webhooksControllerList: jest.fn(),
  webhooksControllerCreate: jest.fn(),
  webhooksControllerRemove: jest.fn(),
  webhooksControllerListEvents: jest.fn(),
  rolesControllerFindAll: jest.fn(),
  setSdkConfig: jest.fn(),
}));

describe('useDevelopers', () => {
  const mockGetAppConfig = api.appConfigControllerGet as jest.Mock;
  const mockUpdateAppConfig = api.appConfigControllerUpdate as jest.Mock;
  const mockListKeys = api.apiKeysControllerList as jest.Mock;
  const mockCreateKey = api.apiKeysControllerCreate as jest.Mock;
  const mockRevokeKey = api.apiKeysControllerRevoke as jest.Mock;
  const mockListWebhooks = api.webhooksControllerList as jest.Mock;
  const mockCreateWebhook = api.webhooksControllerCreate as jest.Mock;
  const mockRemoveWebhook = api.webhooksControllerRemove as jest.Mock;
  const mockListEvents = api.webhooksControllerListEvents as jest.Mock;
  const mockFindRoles = api.rolesControllerFindAll as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppConfig.mockResolvedValue({ data: { apiRateLimit: '500' } });
    mockListKeys.mockResolvedValue({
      data: [{ apiKeyId: 'k-1', name: 'Test Key', prefix: 'hb_', role: 'agent', createdOn: '2026-08-21T00:00:00Z' }],
    });
    mockListWebhooks.mockResolvedValue({
      data: [{ webhookId: 'w-1', targetUrl: 'https://example.com', eventTypes: ['order.created'], isActive: true, secretKey: 'whsec_123', createdOn: '2026-08-21T00:00:00Z' }],
    });
    mockListEvents.mockResolvedValue({ data: ['order.created', 'order.shipped'] });
    mockFindRoles.mockResolvedValue({ data: [{ role: 'admin', description: 'Admin' }] });
  });

  it('loads all developers data on mount', async () => {
    const { result } = renderHook(() => useDevelopers());

    await waitFor(() => {
      expect(result.current.appLoading).toBe(false);
      expect(result.current.keysLoading).toBe(false);
      expect(result.current.webhooksLoading).toBe(false);
    });

    expect(result.current.appForm.apiRateLimit).toBe('500');
    expect(result.current.apiKeys).toHaveLength(1);
    expect(result.current.webhooks).toHaveLength(1);
    expect(result.current.availableEvents).toEqual(['order.created', 'order.shipped']);
    expect(result.current.roles).toEqual([{ role: 'admin', description: 'Admin' }]);
  });

  it('updates app config field', async () => {
    mockUpdateAppConfig.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useDevelopers());

    await waitFor(() => {
      expect(result.current.appLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateAppField('apiRateLimit', '1200');
    });

    expect(result.current.appForm.apiRateLimit).toBe('1200');
    expect(mockUpdateAppConfig).toHaveBeenCalledWith({ apiRateLimit: '1200' });
  });

  it('creates API key and sets new secret', async () => {
    mockCreateKey.mockResolvedValue({ data: { secretKey: 'hb_live_secret123' } });
    const { result } = renderHook(() => useDevelopers());

    await waitFor(() => {
      expect(result.current.keysLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createApiKey('New Key', 'admin');
    });

    expect(result.current.newSecret).toBe('hb_live_secret123');
    expect(mockCreateKey).toHaveBeenCalledWith({ name: 'New Key', role: 'admin' });
  });

  it('creates webhook and sets new secret', async () => {
    mockCreateWebhook.mockResolvedValue({ data: { secretKey: 'whsec_xyz' } });
    const { result } = renderHook(() => useDevelopers());

    await waitFor(() => {
      expect(result.current.webhooksLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createWebhook('https://webhook.site', 'order.created, order.shipped');
    });

    expect(result.current.newSecret).toBe('whsec_xyz');
    expect(mockCreateWebhook).toHaveBeenCalledWith({
      targetUrl: 'https://webhook.site',
      eventTypes: ['order.created', 'order.shipped'],
    });
  });
});
