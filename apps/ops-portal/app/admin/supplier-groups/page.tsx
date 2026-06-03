'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@modbm/shared';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';

export default function SupplierGroupsAdmin() {
  const t = useTranslations('admin.supplierGroups');
  const tc = useTranslations('admin.common');
  const t_gen = useTranslations('common');

  useDocumentTitle(t('title'));
  
  const [rawGroups, setRawGroups] = useState<api.SupplierGroupResponseDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [costCenters, setCostCenters] = useState<api.CostCenterResponseDto[]>([]);
  const [activities, setActivities] = useState<api.ActivityResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [data, customers, cc, act] = await Promise.all([
        api.supplierGroupsControllerFindAll().then(r => r.data || []),
        api.glControllerGetAccounts({ format: 'flat' }).then(r => r.data || []),
        api.costCentersControllerFindAll().then(r => r.data || []),
        api.activitiesControllerFindAll().then(r => r.data || [])
      ]);
      const sorted = [...data].sort((a: any, b: any) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      setRawGroups(sorted);
      setGlAccounts(customers);
      setCostCenters(cc);
      setActivities(act);
    } catch(err) {
      toast.error(t('toasts.loadFailed') + ': ' + (err as Error).message);
      reportError(err as Error, 'SupplierGroupsAdmin_loadData');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const groups = useMemo(() => {
    return rawGroups.map(g => ({
      ...g,
      isActivePurchasing: !g.isPurchasingBlocked,
      isActivePayment: !g.isPaymentBlocked,
    }));
  }, [rawGroups]);

  const glAccountOptions = useMemo(() => glAccounts.map((a: any) => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` })), [glAccounts]);
  const costCenterOptions = useMemo(() => costCenters.map((c: any) => ({ value: c.costCenterId, label: `${c.code} - ${c.name}` })), [costCenters]);
  const activityOptions = useMemo(() => activities.map((a: any) => ({ value: a.activityId, label: `${a.code} - ${a.name}` })), [activities]);

  const columns: InlineTableColumn<any>[] = useMemo(() => [
    { key: 'groupCode', title: tc('code'), type: 'text', placeholder: t('placeholders.code'), width: 100 },
    { key: 'name', title: tc('name'), type: 'text', placeholder: t('placeholders.name') },
    { key: 'defaultApAccountId', title: tc('defApAccount'), type: 'select', options: glAccountOptions, emptyLabel: t_gen('selectNone'), width: 140 },
    { key: 'defaultExpenseAccountId', title: tc('defExpenseAccount'), type: 'select', options: glAccountOptions, emptyLabel: t_gen('selectNone'), width: 140 },
    { key: 'defaultCostCenterId', title: tc('defCostCenter'), type: 'select', options: costCenterOptions, emptyLabel: t_gen('selectNone'), width: 140 },
    { key: 'defaultActivityId', title: tc('defActivity'), type: 'select', options: activityOptions, emptyLabel: t_gen('selectNone'), width: 140 },
    { key: 'isActivePurchasing', title: t('purchasing'), type: 'boolean', width: 80 },
    { key: 'isActivePayment', title: t('payment'), type: 'boolean', width: 80 }
  ], [tc, t, t_gen, glAccountOptions, costCenterOptions, activityOptions]);

  const handleSave = async (payload: any, isNew: boolean) => {
    if (!payload.groupCode || !payload.name) {
      toast.error(t('toasts.requiredFields'));
      throw new Error(t('toasts.requiredFields'));
    }
    try {
      const formattedPayload = {
        ...payload,
        defaultApAccountId: payload.defaultApAccountId || null,
        defaultExpenseAccountId: payload.defaultExpenseAccountId || null,
        defaultCostCenterId: payload.defaultCostCenterId || null,
        defaultActivityId: payload.defaultActivityId || null,
        isPurchasingBlocked: !payload.isActivePurchasing,
        isPaymentBlocked: !payload.isActivePayment,
      };
      
      delete formattedPayload.isActivePurchasing;
      delete formattedPayload.isActivePayment;

      if (!isNew) {
        await api.supplierGroupsControllerUpdate(payload.supplierGroupId, formattedPayload);
      } else {
        await api.supplierGroupsControllerCreate(formattedPayload);
      }
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'SupplierGroupsAdmin_handleSave');
      throw err;
    }
  };

  const handleDelete = async (payload: any) => {
    if(!confirm(t('confirmDelete'))) return;
    try {
      await api.supplierGroupsControllerRemove(payload.supplierGroupId);
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'SupplierGroupsAdmin_handleDelete');
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
          rowKey={(row: any) => row.supplierGroupId}
          onSave={handleSave}
          onDelete={handleDelete}
          onAdd={() => ({
            groupCode: '',
            name: '',
            defaultApAccountId: '',
            defaultExpenseAccountId: '',
            defaultCostCenterId: '',
            defaultActivityId: '',
            isActivePurchasing: true,
            isActivePayment: true,
          })}
          addLabel={t('newGroup')}
          emptyLabel={loading ? null : t('noGroups')}
        />
      </div>
    </div>
  );
}
