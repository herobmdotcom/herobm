'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { useRouter } from 'next/navigation';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import SlideOver from '@/components/shared/SlideOver';
import CustomerSelect from '@/components/shared/CustomerSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';


interface RuleFormData {
  ruleId?: string;
  glAccountIds?: string[];
  conditionType?: string;
  conditionValue?: string;
  typeCondition?: string;
  payeeConditionType?: string;
  payeeConditionValue?: string;
  amountMin?: string | number;
  amountMax?: string | number;
  targetGlAccountId?: string;
  costCenterId?: string;
  activityId?: string;
  partyType?: string;
  partyId?: string;
  memo?: string;
}

export default function RulesEnginePage() {
  const router = useRouter();
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle('Rules');

  const [rules, setRules] = useState<api.ReconciliationRuleResponseDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [costCenters, setCostCenters] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [activities, setActivities] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [customers, setCustomers] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [suppliers, setSuppliers] = useState<Record<string, any>[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleFormData | null>(null);

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
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      setCustomers((Array.isArray(custData) ? custData : custData?.items || []) as Record<string, any>[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      setSuppliers((Array.isArray(suppData) ? suppData : suppData?.items || []) as Record<string, any>[]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const handleSaveRule = async (row: any, isNew: boolean) => {
    if (!row.conditionValue || !row.targetGlAccountId) {
      throw new Error('Condition Value and Target Account are required');
    }
    if (isNew) {
      await api.bankFeedsControllerCreateRule({
        glAccountIds: row.glAccountIds?.length ? row.glAccountIds : undefined,
        conditionType: row.conditionType || undefined,
        conditionValue: row.conditionValue || undefined,
        typeCondition: row.typeCondition || undefined,
        payeeConditionType: row.payeeConditionType || undefined,
        payeeConditionValue: row.payeeConditionValue || undefined,
        amountMin: row.amountMin !== '' && row.amountMin != null ? parseFloat(row.amountMin) : undefined,
        amountMax: row.amountMax !== '' && row.amountMax != null ? parseFloat(row.amountMax) : undefined,
        targetGlAccountId: row.targetGlAccountId,
        costCenterId: row.costCenterId || undefined,
        activityId: row.activityId || undefined,
        partyType: row.partyType || undefined,
        partyId: row.partyId || undefined,
        memo: row.memo || undefined,
        priority: 10
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      } as any);
      toast.success(t('ruleCreated') || 'Rule created');
    } else {
      await api.bankFeedsControllerUpdateRule(row.ruleId, {
        glAccountIds: row.glAccountIds?.length ? row.glAccountIds : undefined,
        conditionType: row.conditionType || undefined,
        conditionValue: row.conditionValue || undefined,
        typeCondition: row.typeCondition || undefined,
        payeeConditionType: row.payeeConditionType || undefined,
        payeeConditionValue: row.payeeConditionValue || undefined,
        amountMin: row.amountMin !== '' && row.amountMin != null ? parseFloat(row.amountMin) : undefined,
        amountMax: row.amountMax !== '' && row.amountMax != null ? parseFloat(row.amountMax) : undefined,
        targetGlAccountId: row.targetGlAccountId,
        costCenterId: row.costCenterId || undefined,
        activityId: row.activityId || undefined,
        partyType: row.partyType || undefined,
        partyId: row.partyId || undefined,
        memo: row.memo || undefined,
        priority: 10
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      } as any);
      toast.success(t('ruleUpdated') || 'Rule updated');
    }
    await loadData();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const bankAccs = glAccounts.filter(a => (a as any).isBankAccount);

  const handleOpenAdd = () => {
    setEditingRule({ 
      glAccountIds: [], conditionType: '', conditionValue: '', targetGlAccountId: '',
      typeCondition: '', payeeConditionType: '', payeeConditionValue: '',
      amountMin: '', amountMax: '', costCenterId: '', activityId: '', partyType: '', partyId: '', memo: ''
    });
    setIsModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const handleOpenEdit = (rule: any) => {
    setEditingRule({ 
      ...rule, 
      glAccountIds: rule.glAccountIds || [],
      amountMin: rule.amountMin ?? '', 
      amountMax: rule.amountMax ?? '' 
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      await handleSaveRule(editingRule, !editingRule.ruleId);
      handleCloseModal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const columns: DataTableColumn<any>[] = useMemo(() => [
    {
      id: 'matchingConditions',
      header: t('matchingConditions'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      render: (r: any) => {
        let bankStr = t('allBankAccounts');
        if (r.glAccountIds && r.glAccountIds.length > 0) {
          const accNames = r.glAccountIds.map((id: string) => {
            const acc = bankAccs.find(a => a.glAccountId === id);
            return acc ? acc.accountCode : id;
          });
          bankStr = accNames.join(', ');
        }
        const condType = r.conditionType === 'contains' ? t('descriptionContains') : r.conditionType === 'starts_with' ? t('descriptionStartsWith') : t('descriptionExactMatch');
        
        const hasMin = r.amountMin !== null && r.amountMin !== undefined && r.amountMin !== '';
        const hasMax = r.amountMax !== null && r.amountMax !== undefined && r.amountMax !== '';
        let amtStr = '';
        if (hasMin && hasMax) amtStr = `Amount: ${r.amountMin} - ${r.amountMax}`;
        else if (hasMin) amtStr = `Amount >= ${r.amountMin}`;
        else if (hasMax) amtStr = `Amount <= ${r.amountMax}`;

        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium text-[var(--text-primary)]">{bankStr}</div>
            {r.conditionType && r.conditionValue && (
              <div className="text-sm text-[var(--text-muted)]">
                {t('descriptionCondition')} {condType} <span className="font-semibold px-1 bg-[var(--bg-tertiary)] rounded">"{r.conditionValue}"</span>
              </div>
            )}
            {r.typeCondition && (
              <div className="text-sm text-[var(--text-muted)]">
                {t('typeCondition')} <span className="font-semibold px-1 bg-[var(--bg-tertiary)] rounded">"{r.typeCondition}"</span>
              </div>
            )}
            {r.payeeConditionValue && (
              <div className="text-sm text-[var(--text-muted)]">
                {t('payeeCondition')} {r.payeeConditionType === 'contains' ? t('descriptionContains') : r.payeeConditionType === 'starts_with' ? t('descriptionStartsWith') : t('descriptionExactMatch')} <span className="font-semibold px-1 bg-[var(--bg-tertiary)] rounded">"{r.payeeConditionValue}"</span>
              </div>
            )}
            {amtStr && <div className="text-xs text-[var(--text-muted)]">{amtStr}</div>}
          </div>
        );
      }
    },
    {
      id: 'effect',
      header: t('effect'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      render: (r: any) => {
        const targetAcc = glAccounts.find(a => a.glAccountId === r.targetGlAccountId);
        const cc = costCenters.find(c => c.costCenterId === r.costCenterId);
        const act = activities.find(a => a.activityId === r.activityId);
        
        let partyStr = '';
        if (r.partyType === 'customer') {
          const c = customers.find(x => x.customerId === r.partyId);
          if (c) partyStr = `${t('customer')}: ${c.name}`;
        } else if (r.partyType === 'supplier') {
          const s = suppliers.find(x => x.supplierId === r.partyId);
          if (s) partyStr = `${t('supplier')}: ${s.name}`;
        }

        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium text-[var(--text-primary)]">
              {targetAcc ? `${targetAcc.accountCode} - ${targetAcc.name}` : r.targetGlAccountId}
            </div>
            {(cc || act || partyStr) && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
                {cc && <span>{tCommon('costCenter')}: {cc.name ? `${cc.code} - ${cc.name}` : cc.code}</span>}
                {cc && (act || partyStr) && <span>&bull;</span>}
                {act && <span>{tCommon('activity')}: {act.name ? `${act.code} - ${act.name}` : act.code}</span>}
                {act && partyStr && <span>&bull;</span>}
                {partyStr && <span>{partyStr}</span>}
              </div>
            )}
            {r.memo && <div className="text-xs italic text-[var(--text-muted)] mt-1">{tCommon('memo')}: {r.memo}</div>}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '100px',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      render: (row: any) => (
        <div className="flex justify-end gap-1">
          <button className="btn btn-sm btn-ghost btn-circle" onClick={() => handleOpenEdit(row)}>
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button className="btn btn-sm btn-ghost btn-circle text-red-500 hover:text-red-700" onClick={() => handleDeleteRule(row)}>
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      )
    }
  ], [bankAccs, glAccounts, t, customers, suppliers]);

  return (
    <DetailsLayout
      header={<EntityHeader title="Rules" onBack={() => router.push('/reconciliations')} />}
    >
      <div className="flex flex-col h-full overflow-hidden w-full max-w-[1400px]">
        <div className="flex-1 flex flex-col h-full min-w-0 pb-8 overflow-y-auto space-y-12 mt-4">
          
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-heading !mb-0 flex items-center gap-2">{tCommon('reconciliationRules')}</h3>
              <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
                {t('addRule')}
              </button>
            </div>
            
            <DataTable
              columns={columns}
              data={rules}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
              keyExtractor={(r: any) => r.ruleId}
              emptyMessage={t('noRulesDefinedYet')}
            />
          </div>

          <div className="card bg-[var(--bg-primary)] p-6 border border-[var(--border)] rounded-xl max-w-2xl">
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <h3 className="section-heading flex items-center gap-2 mb-6">Smart Match Parameters</h3>
            <div className="space-y-6">
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
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

      <SlideOver
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingRule?.ruleId ? 'Edit Rule' : 'Add Rule'}
        footer={
          <div className="flex justify-end gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <button type="button" className="btn btn-ghost" onClick={handleCloseModal}>Cancel</button>
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <button type="submit" form="ruleForm" className="btn btn-primary">Save</button>
          </div>
        }
      >
        {editingRule && (
          <form id="ruleForm" className="space-y-6" onSubmit={handleSaveModal}>
            
            {/* MATCHING CONDITIONS */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                {t('matchingConditions')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('bankAccount')}</label>
                  <div className="border border-[var(--border)] rounded p-2 max-h-32 overflow-y-auto space-y-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--bg-tertiary)] px-1 rounded">
                      <input 
                        type="checkbox" 
                        checked={!editingRule.glAccountIds || editingRule.glAccountIds.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) setEditingRule({ ...editingRule, glAccountIds: [] });
                        }}
                      />
                      {t('allBankAccounts')}
                    </label>
                    {bankAccs.map(a => (
                      <label key={a.glAccountId} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[var(--bg-tertiary)] px-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={editingRule.glAccountIds?.includes(a.glAccountId) || false}
                          onChange={(e) => {
                            const ids = new Set(editingRule.glAccountIds || []);
                            if (e.target.checked) ids.add(a.glAccountId);
                            else ids.delete(a.glAccountId);
                            setEditingRule({ ...editingRule, glAccountIds: Array.from(ids) });
                          }}
                        />
                        {a.accountCode} - {a.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('descriptionCondition')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select 
                      className="input col-span-1"
                      value={editingRule.conditionType || ''}
                      onChange={e => setEditingRule({ ...editingRule, conditionType: e.target.value })}
                    >
                      <option value="">{t('anyDescription')}</option>
                      <option value="contains">{t('descriptionContains')}</option>
                      <option value="starts_with">{t('descriptionStartsWith')}</option>
                      <option value="exact_match">{t('descriptionExactMatch')}</option>
                    </select>
                    <input 
                      type="text"
                      className="input col-span-2 w-full"
                      value={editingRule.conditionValue || ''}
                      onChange={e => setEditingRule({ ...editingRule, conditionValue: e.target.value })}
                      disabled={!editingRule.conditionType}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('typeCondition')}</label>
                  <input 
                    type="text"
                    className="input w-full"
                    placeholder="e.g. FEE"
                    value={editingRule.typeCondition || ''}
                    onChange={e => setEditingRule({ ...editingRule, typeCondition: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('payeeCondition')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select 
                      className="input col-span-1"
                      value={editingRule.payeeConditionType || ''}
                      onChange={e => setEditingRule({ ...editingRule, payeeConditionType: e.target.value })}
                    >
                      <option value="">{t('anyPayee')}</option>
                      <option value="contains">{t('descriptionContains')}</option>
                      <option value="starts_with">{t('descriptionStartsWith')}</option>
                      <option value="exact_match">{t('descriptionExactMatch')}</option>
                    </select>
                    <input 
                      type="text"
                      className="input col-span-2 w-full"
                      value={editingRule.payeeConditionValue || ''}
                      onChange={e => setEditingRule({ ...editingRule, payeeConditionValue: e.target.value })}
                      disabled={!editingRule.payeeConditionType}
                    />
                  </div>
                </div>



                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('minAmount')}</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="input w-full"
                    value={editingRule.amountMin || ''}
                    onChange={e => setEditingRule({ ...editingRule, amountMin: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('maxAmount')}</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="input w-full"
                    value={editingRule.amountMax || ''}
                    onChange={e => setEditingRule({ ...editingRule, amountMax: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* EFFECT */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                {t('effect')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('targetGlAccount')} <span className="text-red-500">*</span></label>
                  <select 
                    className="input w-full"
                    required
                    value={editingRule.targetGlAccountId || ''}
                    onChange={e => setEditingRule({ ...editingRule, targetGlAccountId: e.target.value })}
                  >
                    <option value="">{t('selectAccountPlaceholder')}</option>
                    {glAccounts.map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tCommon('costCenter')}</label>
                  <select 
                    className="input w-full"
                    value={editingRule.costCenterId || ''}
                    onChange={e => setEditingRule({ ...editingRule, costCenterId: e.target.value })}
                  >
                    <option value="">-</option>
                    {costCenters.map(cc => <option key={cc.costCenterId} value={cc.costCenterId}>{cc.code}{cc.name ? ` - ${cc.name}` : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tCommon('activity')}</label>
                  <select 
                    className="input w-full"
                    value={editingRule.activityId || ''}
                    onChange={e => setEditingRule({ ...editingRule, activityId: e.target.value })}
                  >
                    <option value="">-</option>
                    {activities.map(a => <option key={a.activityId} value={a.activityId}>{a.code}{a.name ? ` - ${a.name}` : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('partyType')}</label>
                  <select 
                    className="input w-full"
                    value={editingRule.partyType || ''}
                    onChange={e => setEditingRule({ ...editingRule, partyType: e.target.value, partyId: '' })}
                  >
                    <option value="">-</option>
                    <option value="customer">{t('customer')}</option>
                    <option value="supplier">{t('supplier')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('party')}</label>
                  {editingRule.partyType === 'customer' ? (
                    <CustomerSelect 
                      value={editingRule.partyId || null}
                      onChange={(c) => setEditingRule({ ...editingRule, partyId: c?.customerId || '' })}
                      initialSearchTerm={customers.find((c) => c.customerId === editingRule.partyId)?.name || ''}
                    />
                  ) : editingRule.partyType === 'supplier' ? (
                    <SupplierSelect 
                      value={editingRule.partyId || null}
                      onChange={(s) => setEditingRule({ ...editingRule, partyId: s?.vendorId || '' })}
                      initialSearchTerm={suppliers.find((s) => s.supplierId === editingRule.partyId || s.vendorId === editingRule.partyId)?.name || ''}
                    />
                  ) : (
                    <select className="input w-full" disabled>
                      <option value="">-</option>
                    </select>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tCommon('memo')} <span className="text-gray-400 font-normal">({tCommon('optional')})</span></label>
                  <input
                    type="text"
                    className="input w-full"
                    value={editingRule.memo || ''}
                    onChange={e => setEditingRule({ ...editingRule, memo: e.target.value })}
                    placeholder="Standardized description for the GL entry"
                  />
                </div>
              </div>
            </div>
            
            {/* Hidden submit button to allow Enter key submission, but SlideOver footer "Save" button triggers handleSaveModal */}
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <button type="submit" className="hidden">Submit</button>
          </form>
        )}
      </SlideOver>
    </DetailsLayout>
  );
}
