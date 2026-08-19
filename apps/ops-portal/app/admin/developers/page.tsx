'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/shared/Button';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import PageNav from '@/components/shared/PageNav';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';
import { formatLocalDate } from '@/lib/date';
import { useHelp } from '@/components/help/HelpContext';

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
  const tDev = useTranslations('admin.developers');
  const router = useRouter();
  const { openHelp } = useHelp();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic field updates from input components bypass strict type checking
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
      setRoles((res.data as api.RoleDetailsDto[]) || []);
    } catch (err: unknown) {
      reportError(err, 'DevelopersPage_loadRoles');
      toast.error('Failed to load roles: ' + getErrorMessage(err));
    }
  };

  const loadEvents = async () => {
    try {
      const res = await api.webhooksControllerListEvents();
      setAvailableEvents(res.data as string[] || []);
    } catch (err: unknown) {
      reportError(err, 'DevelopersPage_loadEvents');
    }
  };

  useEffect(() => {
    loadAppConfig();
    loadKeys();
    loadWebhooks();
    loadRoles();
    loadEvents();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────



  const navSections = useMemo(() => [
    { id: 'rate-limits', label: 'Rate Limits', show: true },
    { id: 'api-keys', label: 'API Keys', show: true },
    { id: 'webhooks', label: 'Webhooks', show: true },
  ], []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="Developers"
        subtitle="Manage API access, webhooks, and rate limits"
        actions={[
          {
            label: (
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                <span className="material-symbols-outlined text-[16px]">webhook</span>
                <span>{tDev('webhooksGuide')}</span>
              </span>
            ),
            onClick: () => openHelp('webhooks-api'),
            variant: 'secondary',
          },
          {
            label: (
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                <span className="material-symbols-outlined text-[16px]">api</span>
                <span>{tDev('apiReference')}</span>
              </span>
            ),
            onClick: () => openHelp('api-reference'),
            variant: 'secondary',
          },
          {
            label: (
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                <span>{tDev('swaggerUi')}</span>
              </span>
            ),
            onClick: () => window.open('/api/docs', '_blank', 'noopener,noreferrer'),
            variant: 'secondary',
          },
        ]}
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        {/* ── Rate Limits ────────────────────────────────────────────────── */}
        <div id="rate-limits" className="card">
          <h3 className="section-heading mb-4">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined">speed</span>
            {tDev('apiRateLimits')}
          </h3>
          <div className="flex flex-col gap-1 max-w-sm">
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {tDev('maxRequestsPerMinute')}
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

          </div>
        </div>

        {/* ── API Keys ───────────────────────────────────────────────────── */}
        <div id="api-keys" className="card relative">
          <h3 className="section-heading mb-4">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined">key</span>
            {tDev('apiKeys')}
          </h3>
          <InlineSettingsTable
            data={apiKeys || []}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            rowKey={(r: any) => r.apiKeyId}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            onSave={async (row: any, isNew: boolean) => {
              if (isNew) {
                const res = await api.apiKeysControllerCreate({ name: row.name, role: row.role });
                setNewSecret(res.data.secretKey);
                toast.success('API Key created');
                await loadKeys();
              }
            }}
             
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            onDelete={async (row: any) => {
              if (!confirm('Are you sure you want to revoke this API key?')) return;
              await api.apiKeysControllerRevoke(row.apiKeyId);
              toast.success('API Key revoked');
              await loadKeys();
            }}
             
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            onAdd={() => ({ name: '', role: 'agent', prefix: 'Will be generated...', createdOn: new Date().toISOString() } as any)}
            canEdit={() => false}
            canDelete={() => true}
            addLabel={tDev('createKey')}
            emptyLabel={tDev('noApiKeysFound')}
            columns={[
              {
                key: 'name',
                title: tCommon('name'),
                type: 'text',
                validate: (v) => v ? null : 'Required'
              },
              {
                key: 'role',
                title: 'Role',
                type: 'select',
                options: [
                  { value: 'agent', label: tDev('roleAgent') },
                  { value: 'viewer', label: tDev('roleViewer') },
                  { value: 'admin', label: tDev('roleAdmin') },
                  ...roles
                    .filter(r => !['agent', 'viewer', 'admin'].includes(r.role))
                    .map(r => ({ value: r.role, label: r.role }))
                ]
              },
              {
                key: 'prefix',
                title: tCommon('prefix'),
                type: 'text',
                disabled: true
              },
              {
                key: 'createdOn',
                title: tCommon('created'),
                type: 'custom',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
                render: (row: any) => <span>{formatLocalDate(row.createdOn)}</span>
              }
            ]}
          />

          {/* New API Key Secret Modal */}
          {newSecret && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--bg-card)] rounded-lg max-w-lg w-full p-6 border border-[var(--border)] relative">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-[var(--warning)]">

                  <span className="material-symbols-outlined text-[24px]">warning</span>
                  {/* eslint-disable-next-line no-restricted-syntax -- Temporary literal for webhook */}
                  {newSecret.startsWith('whsec_') ? 'Copy Webhook Secret' : tDev('copyApiKeyWarning')}
                </h3>
                <p className="text-sm text-muted mb-6">
                  {tDev('onlyTimeSecretShown')}
                </p>
                <div className="flex items-center gap-2 mb-8">
                  <code className="p-4 rounded bg-black/5 text-[var(--text-primary)] font-mono flex-1 text-center border border-[var(--border)] text-lg tracking-wider select-all break-all">{newSecret}</code>
                </div>
                <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setNewSecret(null)}
                  >
                    {tCommon('close')}
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-[var(--warning)] hover:brightness-110 border-none text-black"
                    onClick={() => {
                      navigator.clipboard.writeText(newSecret);
                      toast.success(tCommon('copiedToClipboard'));
                    }}
                  >
                    {tCommon('copy')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Webhooks ───────────────────────────────────────────────────── */}
        <div id="webhooks" className="card">
          <h3 className="section-heading mb-4">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined">webhook</span>
            {tDev('webhooks')}
          </h3>
          <InlineSettingsTable
            data={webhooks || []}
             
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            rowKey={(r: any) => r.webhookId}
             
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            onSave={async (row: any, isNew: boolean) => {
              if (isNew) {
                const res = await api.webhooksControllerCreate({
                  targetUrl: row.targetUrl,
                  eventTypes: (row.eventTypes || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                });
                setNewSecret(res.data.secretKey);
                toast.success('Webhook created');
                await loadWebhooks();
              }
            }}
             
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            onDelete={async (row: any) => {
              if (!confirm('Are you sure you want to delete this webhook?')) return;
              await api.webhooksControllerRemove(row.webhookId);
              toast.success('Webhook deleted');
              await loadWebhooks();
            }}
             
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            onAdd={() => ({ targetUrl: '', eventTypes: '', secretKey: tDev('autoGenerated') } as any)}
            canEdit={() => false}
            canDelete={() => true}
            addLabel={tDev('addWebhook')}
            emptyLabel={tDev('noWebhooksFound')}
            columns={[
              {
                key: 'targetUrl',
                title: tDev('targetUrl'),
                type: 'text',
                validate: (v) => v ? null : 'Required'
              },
              {
                key: 'eventTypes',
                title: tDev('events'),
                type: 'text',
                 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
                render: (row: any, isEditing: boolean, onChange?: (val: any) => void) => {
                  const currentEvents = Array.isArray(row.eventTypes) ? row.eventTypes : (row.eventTypes || '').split(',').map((e: string) => e.trim()).filter(Boolean);
                  if (isEditing) {
                    return (
                      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-[var(--border)] p-2 rounded text-xs bg-black/5">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)]">
                          <input
                            type="checkbox"
                            checked={currentEvents.includes('*')}
                            onChange={(e) => {
                              if (e.target.checked) onChange?.('*');
                              else onChange?.('');
                            }}
                          />
                          {tDev('allEvents')}
                        </label>
                        {availableEvents.map(e => (
                          <label key={e} className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)]">
                            <input
                              type="checkbox"
                              checked={currentEvents.includes(e)}
                              onChange={(ev) => {
                                const newEvents = ev.target.checked
                                  ? [...currentEvents.filter((c: string) => c !== '*'), e]
                                  : currentEvents.filter((c: string) => c !== e && c !== '*');
                                onChange?.(newEvents.join(', '));
                              }}
                            />
                            {e}
                          </label>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      {currentEvents.map((e: string) => (
                        <span key={e} className="inline-block px-2 py-0.5 text-xs">{e.trim()}</span>
                      ))}
                    </div>
                  );
                }
              },
              {
                key: 'secretKey',
                title: tDev('secretKey'),
                type: 'text',
                disabled: true,
                 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
                render: (row: any) => <span className="font-mono text-xs">{row.secretKey}</span>
              }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
