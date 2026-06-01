'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@modbm/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  apiKeyId: string;
  name: string;
  prefix: string;
  role: string;
  createdOn: string;
}

interface Webhook {
  webhookId: string;
  targetUrl: string;
  eventTypes: string[];
  isActive: boolean;
  secretKey: string;
  createdOn: string;
}

export default function DevelopersPage() {
  useDocumentTitle('Developers');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  // ── Rate Limits State ───────────────────────────────────────────────────────
  const [appForm, setAppForm] = useState<any>({});
  const [appLoading, setAppLoading] = useState(true);

  // ── API Keys State ──────────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keyCreating, setKeyCreating] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: '', role: 'agent' });
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);

  // ── Webhooks State ──────────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ targetUrl: '', eventTypes: '' });

  // ── Data Loading ────────────────────────────────────────────────────────────

  const loadAppConfig = async () => {
    try {
      setAppLoading(true);
      const res = await api.appConfigControllerGet();
      setAppForm(res.data || {});
    } catch (err: unknown) {
      toast.error('Failed to load settings: ' + getErrorMessage(err));
    } finally {
      setAppLoading(false);
    }
  };

  const updateAppField = async (field: string, value: any) => {
    try {
      setAppForm((prev: unknown) => ({ ...((prev as Record<string, unknown>) || {}), [field]: value }));
      await api.appConfigControllerUpdate({ [field]: value });
      toast.success('Updated successfully');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadKeys = async () => {
    try {
      setKeysLoading(true);
      const res = await api.apiKeysControllerList();
      setApiKeys((res.data as ApiKey[]) || []);
    } catch (err: unknown) {
      toast.error('Failed to load API keys: ' + (err as Error).message);
    } finally {
      setKeysLoading(false);
    }
  };

  const loadWebhooks = async () => {
    try {
      setWebhooksLoading(true);
      const res = await api.webhooksControllerList();
      setWebhooks((res.data as Webhook[]) || []);
    } catch (err: unknown) {
      toast.error('Failed to load Webhooks: ' + (err as Error).message);
    } finally {
      setWebhooksLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const res = await api.rolesControllerFindAll();
      setAvailableRoles((res.data ) || []);
    } catch (err: unknown) {
      console.error('Failed to load roles', err);
    }
  };

  useEffect(() => {
    loadAppConfig();
    loadKeys();
    loadWebhooks();
    loadRoles();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateKey = async () => {
    if (!keyForm.name) {
      toast.error('Please provide a name');
      return;
    }
    try {
      const res = await api.apiKeysControllerCreate(keyForm);
      toast.success('API Key created');
      setNewSecret(res.data.secretKey);
      setKeyCreating(false);
      setKeyForm({ name: '', role: 'agent' });
      loadKeys();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await api.apiKeysControllerRevoke(id);
      toast.success('API Key revoked');
      loadKeys();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookForm.targetUrl || !webhookForm.eventTypes) {
      toast.error('Please provide a URL and at least one event type');
      return;
    }
    try {
      await api.webhooksControllerCreate({
        targetUrl: webhookForm.targetUrl,
        eventTypes: webhookForm.eventTypes.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast.success('Webhook created');
      setWebhookCreating(false);
      setWebhookForm({ targetUrl: '', eventTypes: '' });
      loadWebhooks();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await api.webhooksControllerRemove(id);
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const navSections = useMemo(() => [
    { id: 'rate-limits', label: 'Rate Limits', show: true },
    { id: 'api-keys', label: 'API Keys', show: true },
    { id: 'webhooks', label: 'Webhooks', show: true },
  ], []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="Developers"
          subtitle="Manage API access, webhooks, and rate limits"
          onBack={() => router.push('/admin')}
          actions={<PageNav sections={navSections} />}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Rate Limits ────────────────────────────────────────────────── */}
        <div id="rate-limits" className="card">
          <h3 className="section-heading mb-4">
            <span className="material-symbols-outlined">speed</span>
            API Rate Limits
          </h3>
          <div className="flex flex-col gap-1 max-w-sm">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Max Requests per Minute
            </label>
            <input
              type="number"
              className="input"
              value={appForm?.apiRateLimit || ''}
              onChange={(e) => setAppForm({ ...(appForm || {}), apiRateLimit: e.target.value })}
              onBlur={(e) => updateAppField('apiRateLimit', e.target.value || '1000')}
              placeholder="1000"
              disabled={appLoading}
            />
            <p className="text-xs text-muted mt-1">Applies only to requests authenticated via API Key.</p>
          </div>
        </div>

        {/* ── API Keys ───────────────────────────────────────────────────── */}
        <div id="api-keys" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              <span className="material-symbols-outlined">key</span>
              API Keys
            </h3>
            <button className="btn btn-primary btn-sm" onClick={() => setKeyCreating(true)}>+ Create Key</button>
          </div>

          {newSecret && (
            <div className="mb-4 p-4 rounded-md border border-[var(--warning)] bg-amber-500/10 text-[var(--warning)]">
              <p className="font-medium mb-2">Please copy your API Key now. You will not be able to see it again!</p>
              <div className="flex items-center gap-2">
                <code className="p-2 rounded bg-black/20 text-white font-mono flex-1">{newSecret}</code>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => {
                    navigator.clipboard.writeText(newSecret);
                    toast.success('Copied to clipboard');
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <table className="table-lines w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Created</th>
                <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keyCreating && (
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td>
                    <div className="flex flex-col gap-2">
                      <input
                        className="input"
                        autoFocus
                        placeholder="e.g. Integration Script"
                        value={keyForm.name}
                        onChange={e => setKeyForm({ ...keyForm, name: e.target.value })}
                      />
                      <select
                        className="input text-xs"
                        value={keyForm.role}
                        onChange={e => setKeyForm({ ...keyForm, role: e.target.value })}
                        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                      >
                        <option value="agent">Agent (Read/Write)</option>
                        <option value="webhook">Webhook (Receiver)</option>
                        <option value="viewer">Viewer (Read-only)</option>
                        <option value="admin">Admin (Full Access)</option>
                        <option disabled>──────────</option>
                        {availableRoles
                          .filter(r => !['agent', 'webhook', 'viewer', 'admin'].includes(r.role))
                          .map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.role} (Custom Role)
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td colSpan={2} className="text-muted text-sm">Will be generated...</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => setKeyCreating(false)}>Cancel</button>
                      <button className="btn btn-primary btn-xs" onClick={handleCreateKey}>Save</button>
                    </div>
                  </td>
                </tr>
              )}
              {!keysLoading && (apiKeys?.length || 0) === 0 && !keyCreating && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No API keys found.</td></tr>
              )}
              {(apiKeys || []).map(k => (
                <tr key={k.apiKeyId}>
                  <td className="font-medium">
                    <div>{k.name}</div>
                    <div className="text-xs text-muted font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>Role: {k.role}</div>
                  </td>
                  <td className="font-mono text-sm">{k.prefix}••••••••</td>
                  <td className="text-sm text-muted">{new Date(k.createdOn).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteKey(k.apiKeyId)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Webhooks ───────────────────────────────────────────────────── */}
        <div id="webhooks" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              <span className="material-symbols-outlined">webhook</span>
              Webhooks
            </h3>
            <button className="btn btn-primary btn-sm" onClick={() => setWebhookCreating(true)}>+ Add Webhook</button>
          </div>

          <table className="table-lines w-full">
            <thead>
              <tr>
                <th>Target URL</th>
                <th>Events</th>
                <th>Secret Key</th>
                <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhookCreating && (
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td>
                    <input
                      className="input"
                      placeholder="https://..."
                      value={webhookForm.targetUrl}
                      onChange={e => setWebhookForm({ ...webhookForm, targetUrl: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      placeholder="invoice.created, order.created"
                      value={webhookForm.eventTypes}
                      onChange={e => setWebhookForm({ ...webhookForm, eventTypes: e.target.value })}
                    />
                  </td>
                  <td className="text-muted text-sm">Auto-generated</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => setWebhookCreating(false)}>Cancel</button>
                      <button className="btn btn-primary btn-xs" onClick={handleCreateWebhook}>Save</button>
                    </div>
                  </td>
                </tr>
              )}
              {!webhooksLoading && (webhooks?.length || 0) === 0 && !webhookCreating && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No webhooks found.</td></tr>
              )}
              {(webhooks || []).map(w => (
                <tr key={w.webhookId}>
                  <td className="font-medium text-sm">{w.targetUrl}</td>
                  <td className="text-sm">
                    {w.eventTypes.map(e => (
                      <span key={e} className="inline-block bg-black/20 px-2 py-0.5 rounded text-xs mr-1">{e}</span>
                    ))}
                  </td>
                  <td className="font-mono text-xs">{w.secretKey}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteWebhook(w.webhookId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </DetailsLayout>
  );
}
