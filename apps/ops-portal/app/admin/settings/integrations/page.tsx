'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';
import { getErrorMessage } from '@modbm/shared';
import toast from 'react-hot-toast';

import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { DynamicForm } from '@/components/DynamicForm';

interface ProviderConfig {
  name: string;
  schema: any;
}

export default function IntegrationsSettingsPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  
  // Selected provider for editing
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [configData, setConfigData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await api.enrichmentControllerGetProviders();
      setProviders((res.data as unknown as ProviderConfig[]) || []);
    } catch (err) {
      toast.error('Failed to load integrations: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEditConfig = async (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    try {
      setLoadingConfig(true);
      const res = await api.enrichmentControllerGetConfig({ provider: provider.name });
      setConfigData((res.data as Record<string, any>) || {});
    } catch (err) {
      toast.error('Failed to load configuration: ' + getErrorMessage(err));
      setConfigData({});
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) return;
    try {
      setSaving(true);
      await api.enrichmentControllerUpdateConfig({ provider: selectedProvider.name }, configData as unknown as Parameters<typeof api.enrichmentControllerUpdateConfig>[1]);
      toast.success('Configuration saved');
      setSelectedProvider(null);
    } catch (err) {
      toast.error('Failed to save configuration: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="Integrations & Enrichment"
          subtitle="Manage external integrations and API keys"
          onBack={() => router.push('/admin/settings/system')}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="card">
          <h3 className="section-heading">Available Integrations</h3>
          
          {loading ? (
            <div className="text-sm text-muted animate-pulse">Loading...</div>
          ) : providers.length === 0 ? (
            <div className="text-sm text-muted">No integrations found.</div>
          ) : (
            <div className="grid gap-4">
              {providers.map(p => (
                <div key={p.name} className="flex items-center justify-between p-4 border border-[var(--border)] rounded bg-[var(--bg-secondary)]">
                  <div>
                    <h4 className="font-semibold text-lg">{p.name.toUpperCase()}</h4>
                    <p className="text-sm text-muted">External Data Provider</p>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEditConfig(p)}
                  >
                    Configure
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedProvider && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-heading !mb-0">
                Configure: {selectedProvider.name.toUpperCase()}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedProvider(null)}>
                Close
              </button>
            </div>
            
            {loadingConfig ? (
              <div className="text-sm text-muted animate-pulse">Loading configuration...</div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="bg-[var(--bg-primary)] p-4 border border-[var(--border)] rounded">
                  <DynamicForm
                    schema={selectedProvider.schema}
                    data={configData}
                    onChange={(data) => setConfigData(data)}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setSelectedProvider(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSaveConfig}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DetailsLayout>
  );
}
