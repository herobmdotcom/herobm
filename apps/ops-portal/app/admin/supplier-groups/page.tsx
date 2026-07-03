'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';
import FinancialDefaultsSlideOver from '@/components/shared/FinancialDefaultsSlideOver';

export default function SupplierGroupsAdmin() {
  const t = useTranslations('admin.supplierGroups');
  const tc = useTranslations('admin.common');
  const t_gen = useTranslations('common');

  useDocumentTitle(t('title'));
  
  const [rawGroups, setRawGroups] = useState<api.SupplierGroupResponseDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [costCenters, setCostCenters] = useState<api.CostCenterResponseDto[]>([]);
  const [activities, setActivities] = useState<api.ActivityResponseDto[]>([]);
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [financialGroup, setFinancialGroup] = useState<Partial<api.SupplierGroupResponseDto> | null>(null);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [data, customers, cc, act, taxPositionsData, tradingTermsData] = await Promise.all([
        api.supplierGroupsControllerFindAll().then(r => r.data || []),
        api.glControllerGetAccounts({ format: 'flat' }).then(r => r.data || []),
        api.costCentersControllerFindAll().then(r => r.data || []),
        api.activitiesControllerFindAll().then(r => r.data || []),
        api.taxPositionsControllerFindAll().then(r => r.data || []),
        api.tradingTermsControllerFindAll().then(r => r.data || [])
      ]);
      const sorted = [...data].sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      setRawGroups(sorted);
      setGlAccounts(customers);
      setCostCenters(cc);
      setActivities(act);
      setTaxPositions(taxPositionsData);
      setTradingTerms(tradingTermsData);
    } catch(err) {
      toast.error(t('toasts.loadFailed') + ': ' + (err as Error).message);
      reportError(err as Error, 'SupplierGroupsAdmin_loadData');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const groups = rawGroups;

  const glAccountOptions = useMemo(() => glAccounts.map((a: api.GlAccountResponseDto) => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` })), [glAccounts]);
  const costCenterOptions = useMemo(() => costCenters.map((c) => ({ value: (c as unknown as { costCenterId: string }).costCenterId, label: `${c.code} - ${c.name}` })), [costCenters]);
  const activityOptions = useMemo(() => activities.map((a) => ({ value: (a as unknown as { activityId: string }).activityId, label: `${a.code} - ${a.name}` })), [activities]);
  const taxPositionOptions = useMemo(() => taxPositions.map((p: api.TaxPositionResponseDto) => ({ value: p.taxPositionId, label: p.title })), [taxPositions]);
  const tradingTermsOptions = useMemo(() => tradingTerms.map((t: api.TradingTermResponseDto) => ({ value: t.id, label: `${t.code} - ${t.description}` })), [tradingTerms]);

  const columns: InlineTableColumn<Partial<api.SupplierGroupResponseDto>>[] = useMemo(() => [
    { key: 'groupCode', title: tc('code'), type: 'text', placeholder: t('placeholders.code'), width: 100 },
    { key: 'name', title: tc('name'), type: 'text', placeholder: t('placeholders.name') },
    { 
      key: 'financials', 
      title: tc('financialDefaults'), 
      width: 140,
      render: (row, isEditing) => {
        if (isEditing) {
          return <span className="text-xs text-muted italic">{tc('saveToManage')}</span>;
        }
        return (
          <Button 
            variant="secondary" size="xs" className="relative"
            onClick={() => setFinancialGroup(row)}
          >
            {tc('manage')}
          </Button>
        );
      }
    }
  ], [tc, t]);

  const handleSave = async (
    payload: Partial<api.SupplierGroupResponseDto> & { supplierGroupId?: string; taxPositionId?: string | null },
    isNew: boolean
  ) => {
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
        taxPositionId: payload.taxPositionId || null,
        tradingTermsId: payload.tradingTermsId || null,
        creditLimit: payload.creditLimit || null,
        earlyPaymentDiscount: payload.earlyPaymentDiscount || null,
        earlyPaymentDiscountDays: payload.earlyPaymentDiscountDays || null,
        isPurchasingBlocked: payload.isPurchasingBlocked || false,
        isPaymentBlocked: payload.isPaymentBlocked || false,
      } as api.UpdateSupplierGroupDto;

      if (!isNew) {
        await api.supplierGroupsControllerUpdate(payload.supplierGroupId || '', formattedPayload as api.UpdateSupplierGroupDto);
      } else {
        await api.supplierGroupsControllerCreate(formattedPayload as unknown as api.CreateSupplierGroupDto);
      }
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'SupplierGroupsAdmin_handleSave');
      throw err;
    }
  };

  const handleDelete = async (payload: Partial<api.SupplierGroupResponseDto> & { supplierGroupId?: string }) => {
    if(!confirm(t('confirmDelete'))) return;
    try {
      await api.supplierGroupsControllerRemove(payload.supplierGroupId || '');
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'SupplierGroupsAdmin_handleDelete');
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="card mb-6">
        <InlineSettingsTable
          title={<span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.875rem', fontWeight: 600 }}>{t('definedGroups')}</span>}
          columns={columns}
          data={groups}
          rowKey={(row) => row.supplierGroupId || row.id || ''}
          onSave={handleSave}
          onDelete={handleDelete}
          onAdd={() => ({
            groupCode: '',
            name: '',
            defaultApAccountId: '',
            defaultExpenseAccountId: '',
            defaultCostCenterId: '',
            defaultActivityId: '',
            earlyPaymentDiscount: '',
            earlyPaymentDiscountDays: undefined,
            isPurchasingBlocked: false,
            isPaymentBlocked: false,
          })}
          addLabel={t('newGroup')}
          emptyLabel={loading ? null : t('noGroups')}
        />
      </div>

      <FinancialDefaultsSlideOver
        isOpen={!!financialGroup}
        onClose={() => setFinancialGroup(null)}
        groupType="supplier"
        ownerLabel={financialGroup ? `${financialGroup.groupCode} — ${financialGroup.name}` : ''}
        data={financialGroup}
        onSave={(data) => handleSave(data, false)}
        glAccountOptions={glAccountOptions}
        costCenterOptions={costCenterOptions}
        activityOptions={activityOptions}
        taxPositionOptions={taxPositionOptions}
        tradingTermsOptions={tradingTermsOptions}
      />
    </div>
  );
}
