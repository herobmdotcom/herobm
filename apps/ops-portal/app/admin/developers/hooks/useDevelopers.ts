'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';

export interface ApiKey {
  apiKeyId: string;
  name: string;
  prefix: string;
  role: string;
  createdOn: string;
}

export interface Webhook {
  webhookId: string;
  targetUrl: string;
  eventTypes: string[];
  isActive: boolean;
  secretKey: string;
  createdOn: string;
}

export function useDevelopers() {
  // ── Rate Limits State ───────────────────────────────────────────────────────
  const [appForm, setAppForm] = useState<Partial<api.AppConfigResponseDto>>({});
  const [appLoading, setAppLoading] = useState(true);

  // ── API Keys State ──────────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [roles, setRoles] = useState<api.RoleDetailsDto[]>([]);

  // ── Webhooks State ──────────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);

  // ── Data Loading ────────────────────────────────────────────────────────────

  const loadAppConfig = useCallback(async () => {
    try {
      setAppLoading(true);
      const res = await api.appConfigControllerGet();
      setAppForm(res.data || {});
    } catch (err: unknown) {
      toast.error('Failed to load settings: ' + getErrorMessage(err));
    } finally {
      setAppLoading(false);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic field updates from input components bypass strict type checking
  const updateAppField = useCallback(async (field: string, value: any) => {
    try {
      setAppForm((prev: unknown) => ({ ...((prev as Record<string, unknown>) || {}), [field]: value }));
      await api.appConfigControllerUpdate({ [field]: value });
      toast.success('Updated successfully');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  }, []);

  const loadKeys = useCallback(async () => {
    try {
      setKeysLoading(true);
      const res = await api.apiKeysControllerList();
      setApiKeys((res.data as ApiKey[]) || []);
    } catch (err: unknown) {
      toast.error('Failed to load API keys: ' + (err as Error).message);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const createApiKey = useCallback(async (name: string, role: string) => {
    const res = await api.apiKeysControllerCreate({ name, role });
    setNewSecret(res.data.secretKey);
    toast.success('API Key created');
    await loadKeys();
  }, [loadKeys]);

  const revokeApiKey = useCallback(async (apiKeyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    await api.apiKeysControllerRevoke(apiKeyId);
    toast.success('API Key revoked');
    await loadKeys();
  }, [loadKeys]);

  const loadWebhooks = useCallback(async () => {
    try {
      setWebhooksLoading(true);
      const res = await api.webhooksControllerList();
      setWebhooks((res.data as Webhook[]) || []);
    } catch (err: unknown) {
      toast.error('Failed to load Webhooks: ' + (err as Error).message);
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  const createWebhook = useCallback(async (targetUrl: string, eventTypesString: string) => {
    const res = await api.webhooksControllerCreate({
      targetUrl,
      eventTypes: (eventTypesString || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    });
    setNewSecret(res.data.secretKey);
    toast.success('Webhook created');
    await loadWebhooks();
  }, [loadWebhooks]);

  const deleteWebhook = useCallback(async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    await api.webhooksControllerRemove(webhookId);
    toast.success('Webhook deleted');
    await loadWebhooks();
  }, [loadWebhooks]);

  const loadRoles = useCallback(async () => {
    try {
      const res = await api.rolesControllerFindAll();
      setRoles((res.data as api.RoleDetailsDto[]) || []);
    } catch (err: unknown) {
      reportError(err, 'DevelopersPage_loadRoles');
      toast.error('Failed to load roles: ' + getErrorMessage(err));
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.webhooksControllerListEvents();
      setAvailableEvents((res.data as string[]) || []);
    } catch (err: unknown) {
      reportError(err, 'DevelopersPage_loadEvents');
    }
  }, []);

  useEffect(() => {
    loadAppConfig();
    loadKeys();
    loadWebhooks();
    loadRoles();
    loadEvents();
  }, [loadAppConfig, loadKeys, loadWebhooks, loadRoles, loadEvents]);

  return {
    appForm,
    setAppForm,
    appLoading,
    updateAppField,
    apiKeys,
    keysLoading,
    newSecret,
    setNewSecret,
    roles,
    createApiKey,
    revokeApiKey,
    webhooks,
    webhooksLoading,
    availableEvents,
    createWebhook,
    deleteWebhook,
  };
}
