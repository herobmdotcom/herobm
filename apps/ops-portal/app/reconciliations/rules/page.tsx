'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import { getErrorMessage } from '@modbm/shared';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { useRouter } from 'next/navigation';

export default function RulesEnginePage() {
  const router = useRouter();
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle('Rules');

  const [rules, setRules] = useState<api.ReconciliationRuleResponseDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  // modbm-allow-record-any
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  // modbm-allow-record-any
  const [costCenters, setCostCenters] = useState<Record<string, any>[]>([]);
  // modbm-allow-record-any
  const [activities, setActivities] = useState<Record<string, any>[]>([]);
  // modbm-allow-record-any
  const [customers, setCustomers] = useState<Record<string, any>[]>([]);
  // modbm-allow-record-any
  const [suppliers, setSuppliers] = useState<Record<string, any>[]>([]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accsRes, rulesRes, settingsRes, ccRes, actRes, custRes, suppRes] = await Promise.all([
        api.glControllerGetAccounts(),
        api.bankFeedsControllerGetRules(),
        api.glControllerGetSettings(),
        api.costCentersControllerFindAll().catch(() => ({ data: [] })),
        api.activitiesControllerFindAll().catch(() => ({ data: [] })),
        api.accountsControllerFindAll({}).catch(() => ({ data: { data: [] } })),
        api.suppliersControllerFindAll({}).catch(() => ({ data: { data: [] } }))
      ]);
      setGlAccounts(accsRes.data || []);
      setRules(rulesRes.data || []);
      setSettings(settingsRes.data || {});
      
      setCostCenters(ccRes.data || []);
      setActivities(actRes.data || []);
      const custData = custRes.data as { items?: unknown[] } | unknown[];
      const suppData = suppRes.data as { items?: unknown[] } | unknown[];
      
      // modbm-allow-record-any
      setCustomers((Array.isArray(custData) ? custData : custData?.items || []) as Record<string, any>[]);
      // modbm-allow-record-any
      setSuppliers((Array.isArray(suppData) ? suppData : suppData?.items || []) as Record<string, any>[]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (row: any, isNew: boolean) => {
    if (!row.conditionValue || !row.targetGlAccountId) {
      throw new Error('Condition Value and Target Account are required');
    }
    if (isNew) {
      await api.bankFeedsControllerCreateRule({
        glAccountId: row.glAccountId || undefined,
        conditionType: row.conditionType,
        conditionValue: row.conditionValue,
        amountMin: row.amountMin !== '' && row.amountMin != null ? parseFloat(row.amountMin) : undefined,
        amountMax: row.amountMax !== '' && row.amountMax != null ? parseFloat(row.amountMax) : undefined,
        targetGlAccountId: row.targetGlAccountId,
        costCenterId: row.costCenterId || undefined,
        activityId: row.activityId || undefined,
        partyType: row.partyType || undefined,
        partyId: row.partyId || undefined,
        priority: 10
      } as any);
      toast.success(t('ruleCreated') || 'Rule created');
    } else {
      await api.bankFeedsControllerUpdateRule(row.ruleId, {
        glAccountId: row.glAccountId || undefined,
        conditionType: row.conditionType,
        conditionValue: row.conditionValue,
        amountMin: row.amountMin !== '' && row.amountMin != null ? parseFloat(row.amountMin) : undefined,
        amountMax: row.amountMax !== '' && row.amountMax != null ? parseFloat(row.amountMax) : undefined,
        targetGlAccountId: row.targetGlAccountId,
        costCenterId: row.costCenterId || undefined,
        activityId: row.activityId || undefined,
        partyType: row.partyType || undefined,
        partyId: row.partyId || undefined,
        priority: 10
      } as any);
      toast.success(t('ruleUpdated') || 'Rule updated');
    }
    await loadData();
  };

  const handleDeleteRule = async (row: any) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await api.bankFeedsControllerDeleteRule(row.ruleId);
      toast.success(t('ruleDeleted') || 'Rule deleted');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleUpdateSetting = async (field: string, value: string | boolean | number | null) => {
    try {
      const payload = { [field]: value };
      const res = await api.glControllerUpdateSettings(payload);
      setSettings(res.data);
      toast.success('Settings updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const bankAccs = glAccounts.filter(a => (a as any).isBankAccount);

  const columns = useMemo(() => [
    {
      key: 'glAccountId',
      title: t('bankAccount'),
      type: 'select' as const,
      emptyLabel: t('allBankAccounts'),
      options: bankAccs.map(a => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` }))
    },
    {
      key: 'conditionType',
      title: t('condition'),
      type: 'select' as const,
      emptyLabel: undefined,
      options: [
        { value: 'contains', label: t('descriptionContains') },
        { value: 'starts_with', label: t('descriptionStartsWith') },
        { value: 'exact_match', label: t('descriptionExactMatch') }
      ]
    },
    {
      key: 'conditionValue',
      title: t('conditionValue'),
      type: 'text' as const,
      validate: (v: any) => v ? null : 'Required'
    },
    {
      key: 'targetGlAccountId',
      title: t('targetGlAccount'),
      type: 'select' as const,
      emptyLabel: t('selectAccountPlaceholder'),
      options: glAccounts.map(a => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` })),
      validate: (v: any) => v ? null : 'Required'
    },
    {
      key: 'costCenterId',
      title: tCommon('costCenter'),
      type: 'select' as const,
      emptyLabel: '-',
      options: costCenters.map(cc => ({ value: cc.costCenterId, label: cc.code }))
    },
    {
      key: 'activityId',
      title: tCommon('activity'),
      type: 'select' as const,
      emptyLabel: '-',
      options: activities.map(a => ({ value: a.activityId, label: a.code }))
    },
    {
      key: 'partyType',
      title: t('partyType'),
      type: 'select' as const,
      emptyLabel: '-',
      options: [
        { value: 'customer', label: t('customer') },
        { value: 'supplier', label: t('supplier') }
      ]
    },
    {
      key: 'partyId',
      title: t('party'),
      type: 'select' as const,
      emptyLabel: '-',
      options: (row: any) => {
        const type = row.partyType;
        if (type === 'customer') return customers.map(c => ({ value: c.customerId, label: c.name }));
        if (type === 'supplier') return suppliers.map(s => ({ value: s.supplierId, label: s.name }));
        return [];
      }
    },
    {
      key: 'amountMin',
      title: t('minAmount'),
      type: 'number' as const
    },
    {
      key: 'amountMax',
      title: t('maxAmount'),
      type: 'number' as const
    }
  ], [bankAccs, glAccounts, costCenters, activities, customers, suppliers, t, tCommon]);

  return (
    <DetailsLayout
      header={<EntityHeader title="Rules" onBack={() => router.push('/reconciliations')} />}
    >
      <div className="flex flex-col h-full overflow-hidden w-full max-w-[1400px]">
        <div className="flex-1 flex flex-col h-full min-w-0 pb-8 overflow-y-auto space-y-12 mt-4">
          
          <div className="card">
            <InlineSettingsTable
              title={<h3 className="section-heading !mb-0 flex items-center gap-2">{tCommon('reconciliationRules')}</h3>}
              data={rules}
              rowKey={(r: any) => r.ruleId}
              onSave={handleSaveRule}
              onDelete={handleDeleteRule}
              onAdd={() => ({ 
                glAccountId: '', conditionType: 'contains', conditionValue: '', targetGlAccountId: '',
                amountMin: '', amountMax: '', costCenterId: '', activityId: '', partyType: '', partyId: ''
              })}
              canEdit={() => true}
              canDelete={() => true}
              addLabel={t('addRule')}
              emptyLabel={t('noRulesDefinedYet')}
              columns={columns}
            />
          </div>

          <div className="card bg-[var(--bg-primary)] p-6 border border-[var(--border)] rounded-xl max-w-2xl">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <h3 className="section-heading flex items-center gap-2 mb-6">Smart Match Parameters</h3>
            <div className="space-y-6">
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Date Tolerance (Days)
                </label>
                <input
                  type="number"
                  className="input max-w-[150px]"
                  value={settings?.bankMatchDateToleranceDays ?? ''}
                  onChange={(e) => setSettings({ ...settings, bankMatchDateToleranceDays: e.target.value })}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      handleUpdateSetting('bankMatchDateToleranceDays', val);
                    }
                  }}
                  min={0}
                  max={30}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </DetailsLayout>
  );
}
