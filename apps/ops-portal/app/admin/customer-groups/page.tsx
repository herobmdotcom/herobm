'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslations } from 'next-intl';

import { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import DiscountMatrixSlideOver from '@/components/shared/DiscountMatrixSlideOver';
import { getErrorMessage, CUSTOMER_STATE } from '@herobm/shared';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';
import FinancialDefaultsSlideOver from '@/components/shared/FinancialDefaultsSlideOver';
import { Button } from '@/components/shared/Button';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';

export default function AccountGroupsAdmin() {
  useDocumentTitle('Customer Groups');
  const t = useTranslations('admin.customerGroups');
  const tCommon = useTranslations('admin.common');
  const tGlobalCommon = useTranslations('common');
  const [groups, setGroups] = useState<api.AccountGroupResponseDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [costCenters, setCostCenters] = useState<api.CostCenterResponseDto[]>([]);
  const [activities, setActivities] = useState<api.ActivityResponseDto[]>([]);
  const [matrixRules, setMatrixRules] = useState<api.DiscountMatrixResponseDto[]>([]);
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [discountGroup, setDiscountGroup] = useState<Partial<api.AccountGroupResponseDto> | null>(null);
  const [financialGroup, setFinancialGroup] = useState<Partial<api.AccountGroupResponseDto> | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, customers, cc, act, rules, taxPositionsData, tradingTermsData] = await Promise.all([
        api.accountGroupsControllerFindAll().then(r => r.data || []),
        api.glControllerGetAccounts({ format: 'flat' }).then(r => r.data || []),
        api.costCentersControllerFindAll().then(r => r.data || []),
        api.activitiesControllerFindAll().then(r => r.data || []),
        api.discountMatrixControllerList({ ownerType: 'account_group' }).then(r => r.data || []),
        api.taxPositionsControllerFindAll().then(r => r.data || []),
        api.tradingTermsControllerFindAll().then(r => r.data || [])
      ]);
      const sorted = [...data].sort((a: api.AccountGroupResponseDto, b: api.AccountGroupResponseDto) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      setGroups(sorted);
      setGlAccounts(customers);
      setCostCenters(cc);
      setActivities(act);
      setMatrixRules(rules);
      setTaxPositions(taxPositionsData);
      setTradingTerms(tradingTermsData);
    } catch (err: unknown) {
      toast.error('Failed to load groups: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const glAccountOptions = useMemo(() => glAccounts.map((a: api.GlAccountResponseDto) => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` })), [glAccounts]);
  const costCenterOptions = useMemo(() => costCenters.map((c) => ({ value: (c as unknown as { costCenterId: string }).costCenterId, label: `${c.code} - ${c.name}` })), [costCenters]);
  const activityOptions = useMemo(() => activities.map((a) => ({ value: (a as unknown as { activityId: string }).activityId, label: `${a.code} - ${a.name}` })), [activities]);
  const taxPositionOptions = useMemo(() => taxPositions.map((p: api.TaxPositionResponseDto) => ({ value: p.taxPositionId, label: p.title })), [taxPositions]);
  const tradingTermsOptions = useMemo(() => tradingTerms.map((t: api.TradingTermResponseDto) => ({ value: t.id, label: `${t.code} - ${t.description}` })), [tradingTerms]);

  const columns: InlineTableColumn<api.AccountGroupResponseDto>[] = useMemo(() => [
    { key: 'groupCode', title: tCommon('code'), type: 'text', placeholder: t('placeholders.code'), width: 100 },
    { key: 'name', title: tCommon('name'), type: 'text', placeholder: t('placeholders.name') },
    {
      key: 'stateCode',
      title: tGlobalCommon('columns.state'),
      type: 'custom',
      width: 140,
      render: (row, isEditing, onChange) => {
        const isActive = !row.stateCode || [CUSTOMER_STATE.ACTIVE as string, 'legacy'].includes(String(row.stateCode).toLowerCase());
        return (
          <div className="flex items-center gap-2">
            <div
              style={{ cursor: isEditing ? 'pointer' : 'default' }}
              onClick={() => {
                if (!isEditing || !onChange) return;
                onChange(isActive ? CUSTOMER_STATE.INACTIVE : CUSTOMER_STATE.ACTIVE);
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: isActive ? 'var(--success)' : 'var(--danger)',
                  position: 'relative',
                  transition: 'background 0.2s ease',
                  opacity: isEditing ? 1 : 0.7,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: isActive ? 21 : 3,
                    transition: 'left 0.2s ease',
                  }}
                />
              </div>
            </div>
            <span className={`text-xs font-semibold ${isActive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {isActive ? tGlobalCommon('states.active') : tGlobalCommon('states.inactive')}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'customerGroupId', 
      title: t('discountRules'), 
      width: 140,
      render: (row, isEditing) => {
        if (isEditing) {
          return <span className="text-xs text-muted italic">{t('saveToManage')}</span>;
        }
        return (
          <Button 
            variant="secondary" 
            size="xs" 
            className="relative"
            onClick={() => setDiscountGroup(row)}
          >
            {t('manage')}
            {matrixRules.some((r: api.DiscountMatrixResponseDto) => r.customerGroupId === row.customerGroupId) && (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 ml-2"></span>
            )}
          </Button>
        );
      }
    },
    { 
      key: 'financials', 
      title: tCommon('financialDefaults'), 
      width: 140,
      render: (row, isEditing) => {
        if (isEditing) {
          return <span className="text-xs text-muted italic">{t('saveToManage')}</span>;
        }
        return (
          <Button 
            variant="secondary" 
            size="xs" 
            className="relative"
            onClick={() => setFinancialGroup(row)}
          >
            {t('manage')}
          </Button>
        );
      }
    }
  ], [tCommon, t, matrixRules]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
        taxPositionId: payload.taxPositionId || null,
        tradingTermsId: payload.tradingTermsId || null,
        creditLimit: payload.creditLimit || null,
        earlyPaymentDiscount: payload.earlyPaymentDiscount || null,
        earlyPaymentDiscountDays: payload.earlyPaymentDiscountDays || null,
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

  const handleDelete = async (row: api.AccountGroupResponseDto) => {
    if(!confirm(tGlobalCommon('confirmDelete'))) return;
    try {
      await api.accountGroupsControllerRemove(row.customerGroupId);
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
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
            earlyPaymentDiscount: '',
            earlyPaymentDiscountDays: undefined,
            customerGroupId: '',
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

      <FinancialDefaultsSlideOver
        isOpen={!!financialGroup}
        onClose={() => setFinancialGroup(null)}
        groupType="customer"
        ownerLabel={financialGroup ? `${financialGroup.groupCode} — ${financialGroup.name}` : ''}
        data={financialGroup}
        onSave={async (d) => {
          await api.accountGroupsControllerUpdate(d.customerGroupId as string, d);
          setGroups((prev) => prev.map((g) => (g.customerGroupId === d.customerGroupId ? { ...g, ...d } : g)));
        }}
        glAccountOptions={glAccountOptions}
        costCenterOptions={costCenterOptions}
        activityOptions={activityOptions}
        taxPositionOptions={taxPositionOptions}
        tradingTermsOptions={tradingTermsOptions}
      />
    </div>
  );
}
