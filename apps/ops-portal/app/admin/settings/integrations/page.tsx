'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';
import { getErrorMessage, COUNTRIES } from '@modbm/shared';
import toast from 'react-hot-toast';

import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { DynamicForm } from '@/components/DynamicForm';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';

interface ProviderConfig {
  name: string;
  type?: 'enrichment' | 'tax_engine';
  supportedCountries?: string[] | 'global';
  schema: any;
}

type TaxRule = { id: string; country: string; provider: string };
type EnrichmentRule = { id: string; field: string; country: string; provider: string };



export default function IntegrationsSettingsPage() {
  const router = useRouter();
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [configData, setConfigData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Test Connection State
  const [testPayload, setTestPayload] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);

  // Routing Rules State
  const [appConfig, setAppConfig] = useState<any>(null);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [enrichmentRules, setEnrichmentRules] = useState<EnrichmentRule[]>([]);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const [provRes, configRes] = await Promise.all([
        api.enrichmentControllerGetProviders(),
        api.appConfigControllerGet()
      ]);
      setProviders((provRes.data as unknown as ProviderConfig[]) || []);
      
      const config = configRes.data as any;
      setAppConfig(config);
      
      const taxMappingRaw = (config.taxProviderMappings as Record<string, string>) || {};
      const taxRulesArr = Object.entries(taxMappingRaw).map(([country, provider]) => ({ id: country, country, provider }));
      setTaxRules(taxRulesArr);

      const enrichmentMappingRaw = (config.enrichmentProviderMappings as Record<string, Record<string, string>>) || {};
      const enrichmentRulesArr: EnrichmentRule[] = [];
      Object.entries(enrichmentMappingRaw).forEach(([field, countryMap]) => {
        Object.entries(countryMap).forEach(([country, provider]) => {
          enrichmentRulesArr.push({ id: `${field}-${country}`, field, country, provider });
        });
      });
      setEnrichmentRules(enrichmentRulesArr);
    } catch (err) {
      toast.error('Failed to load integrations: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getUpdatedConfigPayload = (newTaxRules: TaxRule[], newEnrichmentRules: EnrichmentRule[]) => {
    const newTaxMappings: Record<string, string> = {};
    newTaxRules.forEach(r => {
      newTaxMappings[r.country.toUpperCase()] = r.provider;
    });
    
    const newEnrichmentMappings: Record<string, Record<string, string>> = {};
    newEnrichmentRules.forEach(r => {
      if (!newEnrichmentMappings[r.field]) newEnrichmentMappings[r.field] = {};
      newEnrichmentMappings[r.field][r.country.toUpperCase()] = r.provider;
    });

    return {
      taxProviderMappings: newTaxMappings as any,
      enrichmentProviderMappings: newEnrichmentMappings as any
    };
  };

  const saveTaxRule = async (row: TaxRule, isNew: boolean) => {
    if (!row.country || row.country.trim().length !== 2) {
      toast.error("Country code must be 2 letters");
      throw new Error("Invalid country");
    }
    if (!row.provider) {
      toast.error("Provider is required");
      throw new Error("Invalid provider");
    }
    
    const newRules = isNew ? [...taxRules, { ...row, id: row.country }] : taxRules.map(r => r.id === row.id ? row : r);
    setTaxRules(newRules);
    
    await api.appConfigControllerUpdate(getUpdatedConfigPayload(newRules, enrichmentRules));
    toast.success('Tax rule saved');
    await loadProviders();
  };

  const deleteTaxRule = async (row: TaxRule) => {
    const newRules = taxRules.filter(r => r.id !== row.id);
    setTaxRules(newRules);
    await api.appConfigControllerUpdate(getUpdatedConfigPayload(newRules, enrichmentRules));
    toast.success('Tax rule deleted');
    await loadProviders();
  };

  const saveEnrichmentRule = async (row: EnrichmentRule, isNew: boolean) => {
    if (!row.field) {
      toast.error("Field is required");
      throw new Error("Invalid field");
    }
    if (!row.country || row.country.trim().length !== 2) {
      toast.error("Country code must be 2 letters");
      throw new Error("Invalid country");
    }
    if (!row.provider) {
      toast.error("Provider is required");
      throw new Error("Invalid provider");
    }
    
    const newRules = isNew ? [...enrichmentRules, { ...row, id: `${row.field}-${row.country}` }] : enrichmentRules.map(r => r.id === row.id ? row : r);
    setEnrichmentRules(newRules);
    
    await api.appConfigControllerUpdate(getUpdatedConfigPayload(taxRules, newRules));
    toast.success('Enrichment rule saved');
    await loadProviders();
  };

  const deleteEnrichmentRule = async (row: EnrichmentRule) => {
    const newRules = enrichmentRules.filter(r => r.id !== row.id);
    setEnrichmentRules(newRules);
    await api.appConfigControllerUpdate(getUpdatedConfigPayload(taxRules, newRules));
    toast.success('Enrichment rule deleted');
    await loadProviders();
  };

  const toggleProvider = async (provider: ProviderConfig) => {
    if (expandedProvider === provider.name) {
      setExpandedProvider(null);
      return;
    }
    
    setExpandedProvider(provider.name);
    setTestPayload('');
    setTestResult(null);
    setConfigData({});
    
    try {
      setLoadingConfig(true);
      const res = await api.enrichmentControllerGetConfig({ provider: provider.name });
      const data = (res.data as Record<string, any>) || {};
      setConfigData(data);
      if (data.testPayload) {
        setTestPayload(typeof data.testPayload === 'object' ? JSON.stringify(data.testPayload, null, 2) : data.testPayload);
      } else if (provider.schema?.properties?.testPayload?.default) {
        setTestPayload(provider.schema.properties.testPayload.default);
      } else {
        setTestPayload('');
      }
    } catch (err) {
      toast.error('Failed to load configuration: ' + getErrorMessage(err));
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async (provider: ProviderConfig) => {
    try {
      setSaving(true);
      const payloadToSave = { ...configData, testPayload };
      await api.enrichmentControllerUpdateConfig(
        payloadToSave,
        { provider: provider.name }
      );
      toast.success('Configuration saved');
    } catch (err) {
      toast.error('Failed to save configuration: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (providerName: string) => {
    if (!testPayload.trim()) {
      toast.error('Please enter a test payload or query');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      
      let payload;
      let isJson = false;
      try {
        payload = JSON.parse(testPayload);
        isJson = true;
      } catch (e) {
        payload = testPayload;
      }

      if (isJson && typeof payload === 'object') {
        const res = await api.enrichmentControllerTestLookupPost(payload, { provider: providerName });
        setTestResult({ success: true, data: res.data });
      } else {
        const res = await api.enrichmentControllerTestLookup({ provider: providerName, query: testPayload });
        setTestResult({ success: true, data: res.data });
      }
      // Auto-save the test payload to the DB if we're testing
      if (testPayload.trim()) {
         try {
           const currentConfigRes = await api.enrichmentControllerGetConfig({ provider: providerName });
           const currentData = (currentConfigRes.data as Record<string, any>) || {};
           await api.enrichmentControllerUpdateConfig(
             { ...currentData, testPayload },
             { provider: providerName }
           );
         } catch (e) {
           // ignore silently if saving the test payload fails during a test
         }
      }

      toast.success('Test successful');
    } catch (err) {
      setTestResult({ success: false, error: getErrorMessage(err) });
      toast.error('Test connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="Integrations & Enrichment"
          subtitle="Manage external integrations, data providers, and API keys"
          onBack={() => router.push('/admin/settings/system')}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Routing Rules Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              <span className="material-symbols-outlined">route</span>
              Routing Rules
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-8">
            {/* Tax Engine Rules */}
            <div>
              <InlineSettingsTable<TaxRule>
                title="Tax Engines"
                columns={[
                  { 
                    key: 'country', 
                    title: 'Country', 
                    type: 'select',
                    options: [
                      { value: '', label: 'Select Country...' },
                      ...COUNTRIES.map(c => ({ value: c.code, label: `${c.name} (${c.code})` }))
                    ]
                  },
                  { 
                    key: 'provider', 
                    title: 'Provider', 
                    type: 'select', 
                    options: (row) => {
                      const taxProviders = providers.filter(p => p.type === 'tax_engine');
                      const filtered = row.country ? taxProviders.filter(p => {
                        const supported = p.supportedCountries;
                        if (supported === 'global') return true;
                        if (Array.isArray(supported)) return supported.includes(row.country!);
                        return true;
                      }) : taxProviders;
                      
                      return [
                        { value: 'internal', label: 'Internal (Default)' },
                        ...filtered.map(p => ({ value: p.name, label: p.name }))
                      ];
                    }
                  }
                ]}
                data={taxRules}
                rowKey={(row) => row.id}
                onSave={saveTaxRule}
                onDelete={deleteTaxRule}
                onAdd={() => ({ id: '', country: '', provider: 'internal' })}
                addLabel="Add Rule"
              />
            </div>

            {/* Enrichment Rules */}
            <div>
              <InlineSettingsTable<EnrichmentRule>
                title="Data Enrichment"
                columns={[
                  { 
                    key: 'field', 
                    title: 'Field', 
                    type: 'select',
                    options: [
                      { value: '', label: 'Select Field...' },
                      { value: 'customer.business_number', label: 'Customer Business Number' },
                      { value: 'supplier.business_number', label: 'Supplier Business Number' }
                    ]
                  },
                  { 
                    key: 'country', 
                    title: 'Country', 
                    type: 'select',
                    options: [
                      { value: '', label: 'Select Country...' },
                      ...COUNTRIES.map(c => ({ value: c.code, label: `${c.name} (${c.code})` }))
                    ]
                  },
                  { 
                    key: 'provider', 
                    title: 'Provider', 
                    type: 'select', 
                    options: (row) => {
                      const enrichmentProviders = providers.filter(p => p.type === 'enrichment');
                      const filtered = row.country ? enrichmentProviders.filter(p => {
                        const supported = p.supportedCountries;
                        if (supported === 'global') return true;
                        if (Array.isArray(supported)) return supported.includes(row.country!);
                        return true;
                      }) : enrichmentProviders;
                      
                      return [
                        { value: '', label: 'Select Provider...' },
                        ...filtered.map(p => ({ value: p.name, label: p.name }))
                      ];
                    }
                  }
                ]}
                data={enrichmentRules}
                rowKey={(row) => row.id}
                onSave={saveEnrichmentRule}
                onDelete={deleteEnrichmentRule}
                onAdd={() => ({ id: '', field: '', country: '', provider: providers[0]?.name || '' })}
                addLabel="Add Rule"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              <span className="material-symbols-outlined">extension</span>
              Available Integrations
            </h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center text-muted">Loading integrations...</div>
          ) : providers.length === 0 ? (
            <div className="p-6 text-center text-muted">No integrations found.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {providers.map(p => {
                const isExpanded = expandedProvider === p.name;
                
                return (
                  <div key={p.name} className="border border-[var(--border)] rounded-xl overflow-hidden flex flex-col bg-white transition-colors">
                    <div 
                      className={`flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-secondary)] cursor-pointer select-none ${isExpanded ? 'border-b border-[rgba(196,198,205,0.4)]' : ''}`}
                      onClick={() => toggleProvider(p)}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 text-[var(--accent)] ${isExpanded ? 'rotate-90' : ''}`}>
                          chevron_right
                        </span>
                        <div>
                          <div className="font-bold text-sm text-[#041627] capitalize" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {p.name.toUpperCase()}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            External Data Provider
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleProvider(p)}>
                          {isExpanded ? 'Close' : 'Configure'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5 flex flex-col gap-6">
                        
                        {/* Configuration Section */}
                        <div>
                          <h4 className="text-sm font-bold text-[#041627] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            Configuration
                          </h4>
                          {loadingConfig ? (
                            <div className="text-sm text-muted animate-pulse p-4 bg-white rounded border border-[var(--border)]">Loading configuration...</div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              <div className="bg-white p-5 border border-[var(--border)] rounded-lg">
                                {(() => {
                                  const displaySchema = { ...p.schema };
                                  if (displaySchema.properties) {
                                    displaySchema.properties = { ...displaySchema.properties };
                                    delete displaySchema.properties.testPayload;
                                  }
                                  return (
                                    <DynamicForm
                                      schema={displaySchema}
                                      data={configData}
                                      onChange={(data) => setConfigData(data)}
                                    />
                                  );
                                })()}
                              </div>
                              <div className="flex justify-end">
                                <button 
                                  className="btn btn-primary" 
                                  onClick={() => handleSaveConfig(p)}
                                  disabled={saving}
                                >
                                  {saving ? 'Saving...' : 'Save Configuration'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <hr className="border-[var(--border)]" />

                        {/* Test Connection Section */}
                        <div>
                          <h4 className="text-sm font-bold text-[#041627] mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            Test Connection
                          </h4>
                          <div className="bg-white p-5 border border-[var(--border)] rounded-lg flex flex-col gap-4">
                            <div>
                              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                Query or Payload (JSON)
                              </label>
                              <textarea
                                className="input w-full font-mono text-sm"
                                style={{ minHeight: 100, resize: 'vertical' }}
                                placeholder='e.g. "ABN_NUMBER" or { "query": "..." }'
                                value={testPayload}
                                onChange={(e) => setTestPayload(e.target.value)}
                              />
                            </div>
                            <div className="flex justify-end">
                              <button 
                                className="btn btn-secondary"
                                onClick={() => handleTestConnection(p.name)}
                                disabled={testing || !testPayload.trim()}
                              >
                                {testing ? 'Testing...' : 'Run Test'}
                              </button>
                            </div>

                            {/* Test Result */}
                            {testResult && (
                              <div className={`mt-2 p-4 rounded-lg border ${testResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                <h5 className={`text-xs font-bold uppercase tracking-wider mb-2 ${testResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {testResult.success ? 'Test Successful' : 'Test Failed'}
                                </h5>
                                {testResult.success ? (
                                  <pre className="text-xs bg-white/60 p-3 rounded border border-emerald-100 overflow-x-auto whitespace-pre-wrap font-mono text-emerald-900">
                                    {JSON.stringify(testResult.data, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-sm text-red-600">{testResult.error}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}
