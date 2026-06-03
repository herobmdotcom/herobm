'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslations } from 'next-intl';

import { useState, useEffect, useMemo } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import DiscountMatrixSlideOver from '@/components/shared/DiscountMatrixSlideOver';
import { getErrorMessage } from '@modbm/shared';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';

export default function AccountGroupsAdmin() {
  useDocumentTitle('Account Groups');
  const t = useTranslations('admin.customerGroups');
  const tCommon = useTranslations('admin.common');
  const tGlobalCommon = useTranslations('common');
  const [groups, setGroups] = useState<api.AccountGroupResponseDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [costCenters, setCostCenters] = useState<api.CostCenterResponseDto[]>([]);
  const [activities, setActivities] = useState<api.ActivityResponseDto[]>([]);
  const [matrixRules, setMatrixRules] = useState<api.DiscountMatrixResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [discountGroup, setDiscountGroup] = useState<Partial<api.AccountGroupResponseDto> | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, customers, cc, act, rules] = await Promise.all([
        api.accountGroupsControllerFindAll().then(r => r.data || []),
        api.glControllerGetAccounts({ format: 'flat' }).then(r => r.data || []),
        api.costCentersControllerFindAll().then(r => r.data || []),
        api.activitiesControllerFindAll().then(r => r.data || []),
        api.discountMatrixControllerList({ ownerType: 'account_group' }).then(r => r.data || [])
      ]);
      const sorted = [...data].sort((a: any, b: any) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      setGroups(sorted);
      setGlAccounts(customers);
      setCostCenters(cc);
      setActivities(act);
      setMatrixRules(rules);
    } catch (err: unknown) {
      toast.error('Failed to load groups: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const glAccountOptions = useMemo(() => glAccounts.map((a: any) => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` })), [glAccounts]);
  const costCenterOptions = useMemo(() => costCenters.map((c: any) => ({ value: c.costCenterId, label: `${c.code} - ${c.name}` })), [costCenters]);
  const activityOptions = useMemo(() => activities.map((a: any) => ({ value: a.activityId, label: `${a.code} - ${a.name}` })), [activities]);

  const columns: InlineTableColumn<any>[] = useMemo(() => [
    { key: 'groupCode', title: tCommon('code'), type: 'text', placeholder: t('placeholders.code'), width: 100 },
    { key: 'name', title: tCommon('name'), type: 'text', placeholder: t('placeholders.name') },
    { 
      key: 'customerGroupId', 
      title: t('discountRules'), 
      width: 140,
      render: (row, isEditing) => {
        if (isEditing) {
          return <span className="text-xs text-muted italic">{t('saveToManage')}</span>;
        }
        return (
          <button 
            className="btn btn-secondary btn-xs relative"
            onClick={() => setDiscountGroup(row)}
          >
            {t('manage')}
            {matrixRules.some((r: any) => r.customerGroupId === row.customerGroupId) && (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 ml-2"></span>
            )}
          </button>
        );
      }
    },
    { key: 'defaultArAccountId', title: tCommon('defArAccount'), type: 'select', options: glAccountOptions, emptyLabel: `-- ${tGlobalCommon('selectNone')} --`, width: 140 },
    { key: 'defaultRevenueAccountId', title: tCommon('defRevAccount'), type: 'select', options: glAccountOptions, emptyLabel: `-- ${tGlobalCommon('selectNone')} --`, width: 140 },
    { key: 'defaultCostCenterId', title: tCommon('defCostCenter'), type: 'select', options: costCenterOptions, emptyLabel: `-- ${tGlobalCommon('selectNone')} --`, width: 140 },
    { key: 'defaultActivityId', title: tCommon('defActivity'), type: 'select', options: activityOptions, emptyLabel: `-- ${tGlobalCommon('selectNone')} --`, width: 140 }
  ], [tCommon, t, tGlobalCommon, glAccountOptions, costCenterOptions, activityOptions, matrixRules]);

  const handleSave = async (payload: any, isNew: boolean) => {
    if (!payload.groupCode || !payload.name) {
      toast.error('Code and Name are required');
      throw new Error('Code and Name are required');
    }
    try {
      const formattedPayload = {
        ...payload,
        defaultArAccountId: payload.defaultArAccountId || null,
        defaultRevenueAccountId: payload.defaultRevenueAccountId || null,
        defaultCostCenterId: payload.defaultCostCenterId || null,
        defaultActivityId: payload.defaultActivityId || null,
      };

      if (!isNew) {
        await api.accountGroupsControllerUpdate(payload.customerGroupId, formattedPayload);
        toast.success('Group updated');
      } else {
        await api.accountGroupsControllerCreate(formattedPayload);
        toast.success('Group created');
      }
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  const handleDelete = async (payload: any) => {
    if(!confirm(tGlobalCommon('confirmDelete'))) return;
    try {
      await api.accountGroupsControllerRemove(payload.customerGroupId);
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <InlineSettingsTable
          title={<span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.875rem', fontWeight: 600 }}>{t('definedGroups')}</span>}
          columns={columns}
          data={groups}
          rowKey={row => row.customerGroupId}
          onSave={handleSave}
          onDelete={handleDelete}
          onAdd={() => ({
            groupCode: '',
            name: '',
            defaultArAccountId: '',
            defaultRevenueAccountId: '',
            defaultCostCenterId: '',
            defaultActivityId: '',
          })}
          addLabel={t('newGroup')}
          emptyLabel={loading ? null : t('noGroups')}
        />
      </div>

      <DiscountMatrixSlideOver
        open={!!discountGroup}
        onClose={() => setDiscountGroup(null)}
        ownerLabel={discountGroup ? `${discountGroup.groupCode} — ${discountGroup.name}` : ''}
        customerGroupId={discountGroup?.customerGroupId}
      />
    </div>
  );
}
