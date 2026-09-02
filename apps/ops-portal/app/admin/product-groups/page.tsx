'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';
import FinancialDefaultsSlideOver from '@/components/shared/FinancialDefaultsSlideOver';
import { Button } from '@/components/shared/Button';

export default function ProductGroupsAdmin() {
  const t = useTranslations('admin.productGroups');
  const tc = useTranslations('admin.common');
  const t_gen = useTranslations('common');
  
  useDocumentTitle(t('title'));
  
  const [groups, setGroups] = useState<Partial<api.ProductGroupResponseDto>[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [costCenters, setCostCenters] = useState<api.CostCenterResponseDto[]>([]);
  const [activities, setActivities] = useState<api.ActivityResponseDto[]>([]);
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [financialGroup, setFinancialGroup] = useState<Partial<api.ProductGroupResponseDto> | null>(null);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [data, glAccs, cc, act, taxCats] = await Promise.all([
        api.productGroupsControllerFindAll().then(r => (Array.isArray(r.data) ? r.data : ((r.data as unknown as { data: api.ProductGroupResponseDto[] }).data) || []) as api.ProductGroupResponseDto[]),
        api.glControllerGetAccounts({ format: 'flat' }).then(r => r.data || []),
        api.costCentersControllerFindAll().then(r => r.data),
        api.activitiesControllerFindAll().then(r => r.data),
        api.taxCategoriesControllerFindAll().then(r => r.data)
      ]);
      const sorted = [...data].sort((a: api.ProductGroupResponseDto, b: api.ProductGroupResponseDto) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      setGroups(sorted);
      setGlAccounts(glAccs);
      setCostCenters(cc);
      setActivities(act);
      setTaxCategories(taxCats || []);
    } catch(err) {
      const e = err as Error;
      toast.error(t('toasts.loadFailed') + ': ' + e.message);
      reportError(e, 'ProductGroupsAdmin_loadData');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const glAccountOptions = useMemo(() => glAccounts.map((a: api.GlAccountResponseDto) => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` })), [glAccounts]);
  const costCenterOptions = useMemo(() => costCenters.map((c) => ({ value: (c as unknown as { costCenterId: string }).costCenterId, label: `${c.code} - ${c.name}` })), [costCenters]);
  const activityOptions = useMemo(() => activities.map((a) => ({ value: (a as unknown as { activityId: string }).activityId, label: `${a.code} - ${a.name}` })), [activities]);
  const taxCategoryOptions = useMemo(() => taxCategories.map((t) => ({ value: (t as unknown as { taxCategoryId: string }).taxCategoryId, label: `${(t as unknown as { code: string }).code} - ${(t as unknown as { title: string }).title}${((t as unknown as { rate: string }).rate ? ` (${Number((t as unknown as { rate: string }).rate).toFixed(2)}%)` : '')}` })), [taxCategories]);

  const columns: InlineTableColumn<Partial<api.ProductGroupResponseDto>>[] = useMemo(() => [
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
            variant="secondary"
            size="xs"
            className="relative"
            onClick={() => setFinancialGroup(row)}
          >
            {tc('manage')}
          </Button>
        );
      }
    }
  ], [tc, t]);

  const handleSave = async (payload: Partial<api.ProductGroupResponseDto> & { productGroupId?: string }, isNew: boolean) => {
    if (!payload.groupCode || !payload.name) {
      toast.error(t('toasts.requiredFields'));
      throw new Error(t('toasts.requiredFields'));
    }
    try {
      // payload may have empty strings for select dropdowns, let's map them to null
      const formattedPayload = {
        ...payload,
        defaultExpenseAccountId: payload.defaultExpenseAccountId || null,
        defaultRevenueAccountId: payload.defaultRevenueAccountId || null,
        defaultCostCenterId: payload.defaultCostCenterId || null,
        defaultActivityId: payload.defaultActivityId || null,
        defaultPurchaseTaxCategoryId: (payload as Record<string, unknown>).defaultPurchaseTaxCategoryId as string || null,
        defaultSalesTaxCategoryId: (payload as Record<string, unknown>).defaultSalesTaxCategoryId as string || null,
      } as api.UpdateProductGroupDto;

      if (!isNew) {
        await api.productGroupsControllerUpdate(payload.productGroupId || '', formattedPayload);
        toast.success(t('toasts.updated'));
      } else {
        await api.productGroupsControllerCreate(formattedPayload as unknown as api.CreateProductGroupDto);
        toast.success(t('toasts.created'));
      }
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'ProductGroupsAdmin_handleSave');
      throw err;
    }
  };

  const handleDelete = async (payload: Partial<api.ProductGroupResponseDto> & { productGroupId?: string }) => {
    if(!confirm(t('confirmDelete'))) return;
    try {
      await api.productGroupsControllerRemove(payload.productGroupId || '');
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'ProductGroupsAdmin_handleDelete');
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="card mb-6">
        <InlineSettingsTable
          title={<span className="text-[var(--text-muted)] uppercase tracking-wider text-sm font-semibold">{t('definedGroups')}</span>}
          columns={columns}
          data={groups}
          rowKey={row => ((row as Record<string, unknown>).productGroupId as string) || ((row as Record<string, unknown>).id as string) || ''}
          onSave={handleSave}
          onDelete={handleDelete}
          onAdd={() => ({
            groupCode: '',
            name: '',
            defaultExpenseAccountId: '',
            defaultRevenueAccountId: '',
            defaultCostCenterId: '',
            defaultActivityId: '',
            purchaseTaxCategoryId: '',
            salesTaxCategoryId: '',
          })}
          addLabel={t('newGroup')}
          emptyLabel={loading ? null : t('noGroups')}
        />
      </div>

      <FinancialDefaultsSlideOver
        isOpen={!!financialGroup}
        onClose={() => setFinancialGroup(null)}
        groupType="product"
        ownerLabel={financialGroup ? `${financialGroup.groupCode} — ${financialGroup.name}` : ''}
        data={financialGroup}
        onSave={(data) => handleSave(data, false)}
        glAccountOptions={glAccountOptions}
        costCenterOptions={costCenterOptions}
        activityOptions={activityOptions}
        taxCategoryOptions={taxCategoryOptions}
      />
    </div>
  );
}
