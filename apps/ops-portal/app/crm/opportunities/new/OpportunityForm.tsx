'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useSettings } from '@/components/SettingsProvider';
import { toast } from 'react-hot-toast';

export default function OpportunityForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { app: appSettings, baseCurrency } = useSettings();

  const [dto, setDto] = useState({
    name: '',
    type: '',
    status: '',
    estimatedValue: '',
    currencyCode: baseCurrency || '',
    probability: 50,
    targetCloseDate: '',
    description: '',
  });

  useEffect(() => {
    if (baseCurrency && !dto.currencyCode) {
      setDto((prev) => ({ ...prev, currencyCode: baseCurrency }));
    }
  }, [baseCurrency, dto.currencyCode]);

  useEffect(() => {
    const statuses = appSettings?.opportunityStages || appSettings?.projectStatuses;
    if (statuses?.length && !dto.status) {
      const sorted = [...statuses].sort(
        (a, b) => Number(a.order) - Number(b.order),
      );
      setDto((prev) => ({ ...prev, status: sorted[0].value }));
    }
    const types = appSettings?.opportunityTypes || appSettings?.projectTypes;
    if (types?.length && !dto.type) {
      const sorted = [...types].sort(
        (a, b) => Number(a.order) - Number(b.order),
      );
      setDto((prev) => ({ ...prev, type: sorted[0].value }));
    }
  }, [appSettings, dto.status, dto.type]);

  async function handleSubmit() {
    if (!dto.name.trim()) {
      toast.error('Opportunity name is required');
      return;
    }

    setLoading(true);
    try {
      const payload: api.CreateOpportunityDto = {
        name: dto.name,
        type: dto.type,
        status: dto.status,
        estimatedValue: dto.estimatedValue ? dto.estimatedValue : undefined,
        currencyCode: dto.currencyCode || baseCurrency || undefined,
        probability: dto.probability ? Number(dto.probability) : undefined,
        targetCloseDate: dto.targetCloseDate ? new Date(dto.targetCloseDate).toISOString() : undefined,
        description: dto.description || undefined,
      };

      const res = await api.opportunitiesControllerCreate(payload);
      toast.success('Opportunity created successfully');
      const oppId = res.data?.opportunityId || '';
      router.push(`/crm/opportunities/${oppId}`);
    } catch (err) {
      toast.error('Failed to create opportunity');
      reportError(err, 'OpportunityForm');
    } finally {
      setLoading(false);
    }
  }

  const updateField = (field: string, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title="New Opportunity"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={loading}
              >
                Create Opportunity
              </Button>
            </>
          }
        />
      }
    >
      <div className="max-w-4xl p-6 flex flex-col gap-6">
        {/* Deal Basics */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">
              trending_up
            </span>
            Deal Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Opportunity Name *
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Acme Corp - Enterprise ERP Rollout"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Stage *
              </label>
              <select
                className="input w-full"
                value={dto.status}
                onChange={(e) => updateField('status', e.target.value)}
                disabled={loading}
              >
                {[...(appSettings?.opportunityStages || appSettings?.projectStatuses || [])]
                  .sort((a, b) => Number(a.order) - Number(b.order))
                  .map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.value}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Opportunity Type *
              </label>
              <select
                className="input w-full"
                value={dto.type}
                onChange={(e) => updateField('type', e.target.value)}
                disabled={loading}
              >
                {[...(appSettings?.opportunityTypes || appSettings?.projectTypes || [])]
                  .sort((a, b) => Number(a.order) - Number(b.order))
                  .map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.value}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Forecast Card */}
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">
              trending_up
            </span>
            Forecast
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Estimated Deal Value
              </label>
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={dto.estimatedValue}
                onChange={(e) => updateField('estimatedValue', e.target.value)}
                placeholder="150000"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Currency
              </label>
              <select
                className="input w-full"
                value={dto.currencyCode || baseCurrency || ''}
                onChange={(e) => updateField('currencyCode', e.target.value)}
                disabled={loading}
              >
                {baseCurrency && (
                  <option value={baseCurrency}>
                    {baseCurrency} (System Base)
                  </option>
                )}
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD']
                  .filter((c) => c !== baseCurrency)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Win Probability
                </label>
                <span className="text-xs font-bold text-[var(--accent)]">
                  {dto.probability}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                className="w-full mt-2 accent-[var(--accent)] cursor-pointer"
                value={dto.probability}
                onChange={(e) => updateField('probability', Number(e.target.value))}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Target Close Date
              </label>
              <input
                type="date"
                className="input w-full"
                value={dto.targetCloseDate}
                onChange={(e) => updateField('targetCloseDate', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Description & Opportunity Scope
              </label>
              <textarea
                rows={4}
                className="input w-full"
                value={dto.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Key drivers, customer pain points, competitor context..."
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
