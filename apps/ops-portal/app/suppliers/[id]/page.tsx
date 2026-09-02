'use client';


import { useState, useEffect, useMemo, use, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  reportError,
} from '@/lib/api';
import * as api from '@herobm/sdk';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import EntityHeader from '@/components/shared/EntityHeader';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { useInheritance, useGroup } from '@/hooks/useInheritance';
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { CURRENCIES, formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import PageNav from '@/components/shared/PageNav';
import { Button } from '@/components/shared/Button';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import GroupSelect from '@/components/shared/GroupSelect';
import { resolveSupplierRiskProfile } from '@/lib/supplier-risk';
import SupplierStatusBadges from '@/components/suppliers/SupplierStatusBadges';
import SupplierExpiries from '@/components/suppliers/SupplierExpiries';
import { SupplierContactsTab } from './components/SupplierContactsTab';
import InheritedSelect from '@/components/shared/InheritedSelect';
import InheritedNumberInput from '@/components/shared/InheritedNumberInput';
import { useSettings } from '@/components/SettingsProvider';
import { useAuth } from '@/components/shared/AuthGate';
import { SUPPLIER_STATE, getErrorMessage, CURRENCIES as _CURRENCIES, COUNTRIES, getCurrencyForCountry, SystemResource, hasPermission } from '@herobm/shared';
import { useSupplier, Supplier } from './useSupplier';

export default function SupplierDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { baseCurrency, app } = useSettings();
  const t = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');
  const tStates = useTranslations('common.states');
  const tToast = useTranslations('toast');
  const tConfirm = useTranslations('confirm');
  const tSidebar = useTranslations('sidebar');
  const params = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions } = useAuth();
  const canArchive = hasPermission(permissions, SystemResource.SUPPLIERS, 'archive');
  const initialTab = (searchParams.get('tab') as 'details' | 'products' | 'compliance' | 'purchaseOrders' | 'invoices' | 'payments') || 'details';
  const [activeTab, setActiveTab] = useState<'details' | 'products' | 'contacts' | 'compliance' | 'purchaseOrders' | 'invoices' | 'payments'>(initialTab);
  const {
    supplier,
    dto,
    loading,
    saving,
    setSaving,
    updateField,
    saveField,
    taxPositions,
    availableTradingTerms,
    supplierGroups,
    loadSupplier,
  } = useSupplier(params.id);

  const error = ''; // Kept for compatibility with existing JSX if needed

  useDocumentTitle(supplier ? (supplier.name ? `${supplier.vendorNumber} - ${supplier.name}` : supplier.vendorNumber) : null);

  const selectedGroup = useGroup(supplierGroups, dto?.supplierGroupId || null);

  const earlyPaymentDiscountInheritance = useInheritance([
    { value: selectedGroup?.earlyPaymentDiscount, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const earlyPaymentDiscountDaysInheritance = useInheritance([
    { value: selectedGroup?.earlyPaymentDiscountDays, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const creditLimitInheritance = useInheritance([
    { value: selectedGroup?.creditLimit, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const taxPositionInheritance = useInheritance([
    { value: selectedGroup?.taxPositionId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultSupplierTaxPositionId, sourceLabel: 'System Default' }
  ]);

  const tradingTermsInheritance = useInheritance([
    { value: selectedGroup?.tradingTermsId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultSupplierTermsId, sourceLabel: 'System Default' }
  ]);

  const purchasingBlockInheritance = useInheritance([
    { value: selectedGroup?.isPurchasingBlocked === true ? 'true' : selectedGroup?.isPurchasingBlocked === false ? 'false' : null, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const paymentBlockInheritance = useInheritance([
    { value: selectedGroup?.isPaymentBlocked === true ? 'true' : selectedGroup?.isPaymentBlocked === false ? 'false' : null, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  /** Toggle state code (active/inactive) */
  const toggleState = async () => {
    if (!supplier || saving) return;
    const newState = supplier.stateCode === SUPPLIER_STATE.ACTIVE ? SUPPLIER_STATE.INACTIVE : SUPPLIER_STATE.ACTIVE;
    try {
      await api.suppliersControllerUpdate(params.id, { stateCode: newState } as api.UpdateSupplierDto);
      await loadSupplier();
    } catch (err) {
      toast.error(err instanceof Error ? getErrorMessage(err) : tCommon('errors.failedToChangeState'));
    }
  };

  const archiveSupplier = async () => {
    if (!confirm(tConfirm('archiveOrder'))) return;
    setSaving(true);
    try {
      await api.suppliersControllerArchive(params.id, {});
      toast.success(tToast('orderArchived'));
      await loadSupplier();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveSupplier = async () => {
    setSaving(true);
    try {
      await api.suppliersControllerUnarchive(params.id, {});
      toast.success(tToast('orderUnarchived'));
      await loadSupplier();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const productColumns: Record<string, unknown>[] = useMemo(() => [
    { field: 'productNumber', headerName: t('products.columns.productNo'), width: 140 },
    { field: 'productName', headerName: t('products.columns.name'), flex: 1, minWidth: 160 },
    { field: 'supplierPartNumber', headerName: t('products.columns.partNo'), width: 150 },
    { field: 'costPrice', headerName: t('products.columns.costPrice'), type: 'numericColumn', width: 120, valueFormatter: (p: { value: unknown }) => p.value ? `$${parseFloat(String(p.value)).toFixed(2)}` : '—' },
    { field: 'discountPercent', headerName: t('products.columns.discount'), type: 'numericColumn', width: 120, valueFormatter: (p: { value: unknown }) => p.value ? `${parseFloat(String(p.value))}%` : '—' },
    { 
      field: 'productStateCode', 
      headerName: t('products.columns.status'), 
      width: 110, 
      valueFormatter: (p: { value: unknown }) => {
        if (!p.value) return '';
        const s = String(p.value).toLowerCase();
        return tStates.has(s as never) ? tStates(s as never) : String(p.value);
      } 
    },
  ], [t, tStates]);

  type GridParam = { value?: string | number | null; data?: { currencyCode?: string } };

  const orderColumns: Record<string, unknown>[] = useMemo(() => [
    { field: "orderNumber", headerName: "Order No.", width: 150 },
    { field: "createdOn", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => formatLocalDate(p.value, undefined, "") },
    { field: "totalPrice", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
  ], [tStates, baseCurrency]);

  const invoiceColumns: Record<string, unknown>[] = useMemo(() => [
    { field: "invoiceNumber", headerName: "Invoice No.", width: 150 },
    { field: "orderNumber", headerName: "PO Number", width: 150 },
    { field: "createdOn", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => formatLocalDate(p.value, undefined, "") },
    { field: "totalAmount", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "outstandingAmount", headerName: "Outstanding", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
  ], [tStates, baseCurrency]);

  const paymentColumns: Record<string, unknown>[] = useMemo(() => [
    { field: "paymentNumber", headerName: "Payment No.", width: 150 },
    { field: "paymentDate", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => formatLocalDate(p.value, undefined, "") },
    { field: "modeOfPayment", headerName: "Mode", width: 150 },
    { field: "totalAmount", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "unallocatedAmount", headerName: "Unallocated", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
  ], [tStates, baseCurrency]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center flex-1">
          <p className="text-[var(--text-muted)]">{tCommon('loading')}</p>
        </div>
      </>
    );
  }

  if (!supplier) {
    return (
      <>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2 text-[var(--danger)]">
            {tCommon('noMatchingResults')}
          </p>
          <Button variant="secondary" onClick={() => router.push('/suppliers')}>
            ← {tSidebar('items.suppliers')}
          </Button>
        </div>
      </>
    );
  }

  const isEditable = supplier.stateCode !== SUPPLIER_STATE.ARCHIVED;

  const visibleSections = [
    {
      id: 'tab-details',
      label: t('tabs.overview'),
      isSubPage: true,
      isActive: activeTab === 'details',
      onClick: () => setActiveTab('details'),
      subtargets: [
        { id: 'info-section', label: t('tabs.info'), onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'financials-section', label: t('tabs.financials'), onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('financials-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'notes-section', label: t('tabs.notes'), onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'contact-section', label: t('tabs.contact'), onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'bank-section', label: 'Bank', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('bank-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'activity-section', label: t('tabs.activity'), onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ]
    },
    {
      id: 'tab-products',
      label: t('tabs.products'),
      isSubPage: true,
      isActive: activeTab === 'products',
      onClick: () => setActiveTab('products')
    },
    {
      id: 'tab-contacts',
      label: t('tabs.contact'),
      isSubPage: true,
      isActive: activeTab === 'contacts',
      onClick: () => setActiveTab('contacts')
    },
    {
      id: 'tab-orders',
      label: 'Orders',
      isSubPage: true,
      isActive: activeTab === 'purchaseOrders',
      onClick: () => setActiveTab('purchaseOrders')
    },
    {
      id: 'tab-invoices',
      label: 'Invoices',
      isSubPage: true,
      isActive: activeTab === 'invoices',
      onClick: () => setActiveTab('invoices')
    },
    {
      id: 'tab-payments',
      label: 'Payments',
      isSubPage: true,
      isActive: activeTab === 'payments',
      onClick: () => setActiveTab('payments')
    },
    {
      id: 'tab-compliance',
      label: t('tabs.compliance'),
      isSubPage: true,
      isActive: activeTab === 'compliance',
      onClick: () => setActiveTab('compliance')
    }
  ];

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={supplier.name}
            subtitle={supplier.vendorNumber}
            isSaving={saving}
            badges={<SupplierStatusBadges mode="header" profile={resolveSupplierRiskProfile(supplier)} stateCode={supplier.stateCode || ''} />}
            nav={<PageNav sections={visibleSections} />}
          />
        }
        footerActions={
          canArchive && supplier ? (
            supplier.stateCode === SUPPLIER_STATE.ARCHIVED ? (
              <Button variant="secondary" onClick={unarchiveSupplier} disabled={saving}>
                {tSales('buttons.unarchive')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="text-red-500 border-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                onClick={archiveSupplier}
                disabled={saving}
              >
                {tSales('buttons.archive')}
              </Button>
            )
          ) : undefined
        }
      >
      {supplier.stateCode === SUPPLIER_STATE.ARCHIVED && (
        <div className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700">
          <div>
            <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <DetailTabGrid 
          title={t('products.title')}
          endpoint={`/api/suppliers/${encodeURIComponent(params.id)}/products`}
          columns={productColumns}
          gridKey="supplier-products"
          fetchAll
          rowHref={(row: { productId?: string }) => `/products/${row.productId}`}
        />
      )}
      {activeTab === 'contacts' && (
        <SupplierContactsTab supplier={supplier} loadSupplier={loadSupplier} />
      )}
      {activeTab === 'purchaseOrders' && (
        <DetailTabGrid 
          title="Orders"
          endpoint={`/api/purchase-orders?vendorId=${encodeURIComponent(params.id)}`}
          columns={orderColumns}
          gridKey="supplier-orders"
          fetchAll
          rowHref={(row: { id?: string }) => `/purchase-orders/${row.id}`}
        />
      )}

      {activeTab === 'invoices' && (
        <DetailTabGrid 
          title="Invoices"
          endpoint={`/api/purchase-invoices?vendorId=${encodeURIComponent(params.id)}`}
          columns={invoiceColumns}
          gridKey="supplier-invoices"
          fetchAll
          rowHref={(row: { invoiceId?: string }) => `/supplier-invoices/${row.invoiceId}`}
        />
      )}

      {activeTab === 'payments' && (
        <DetailTabGrid 
          title="Payments"
          endpoint={`/api/payments?partyId=${encodeURIComponent(params.id)}`}
          columns={paymentColumns}
          gridKey="supplier-payments"
          fetchAll
        />
      )}


      {activeTab === 'details' && (
        <div className="flex flex-col gap-3">



        {/* General Info Card */}
        <div id="info-section" className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">info</span>
            {t('generalInfo')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.name')} *
              </label>
              <input
                type="text"
                className="input"
                value={dto?.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                onBlur={() => saveField('name', dto?.name)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.vendorNumber')}
              </label>
              <input
                type="text"
                className="input"
                value={supplier.vendorNumber}
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('supplierGroup')}
              </label>
              <GroupSelect
                type="supplier"
                value={dto?.supplierGroupId || null}
                onChange={(val) => {
                  updateField('supplierGroupId', val || null);
                  saveField('supplierGroupId', val || null);
                }}
                disabled={!isEditable || saving}
                placeholder={t('placeholders.noGroup')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('country')} *
              </label>
              <select
                className="input"
                value={dto?.address1Country || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField('address1Country', val);
                  const newCurrency = getCurrencyForCountry(val);
                  if (newCurrency && newCurrency !== dto?.currencyCode) {
                    updateField('currencyCode', newCurrency);
                  }
                }}
                onBlur={() => {
                  saveField('address1Country', dto?.address1Country);
                  if (dto?.currencyCode !== supplier.currencyCode) {
                    saveField('currencyCode', dto?.currencyCode);
                  }
                }}
                disabled={!isEditable || saving}
              >
                <option value="">{tCommon('notConfigured')}</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('notesCardHeading')}
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto?.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                onBlur={() => saveField('notes', dto?.notes)}
                placeholder={tCommon('notesCardPlaceholder')}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        </div>

        {/* Financials Card */}
        <div id="financials-section" className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">payments</span>
            FINANCIALS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Row 1 ── */}
            {/* 1. Currency */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.currency')} *
              </label>
              <select
                className="input"
                value={dto?.currencyCode || ''}
                onChange={(e) => {
                  updateField('currencyCode', e.target.value);
                  saveField('currencyCode', e.target.value);
                }}
                disabled={!isEditable || saving}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            {/* 2. State */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.state')}
              </label>
              <div
                className={`flex items-center gap-3 pt-1.5 ${!isEditable || saving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={toggleState}
              >
                <div
                  className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${supplier.stateCode === SUPPLIER_STATE.ACTIVE ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'} ${!isEditable || saving ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all duration-200 ${supplier.stateCode === SUPPLIER_STATE.ACTIVE ? 'left-[21px]' : 'left-[3px]'}`}
                  />
                </div>
                <span className="text-sm text-[var(--text-secondary)]">
                  <StateName state={supplier.stateCode as ValidState} />
                </span>
              </div>
            </div>

            {/* 3. Early Payment Discount */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('earlyPaymentDiscount')}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-32 shrink-0">
                  <InheritedNumberInput
                    className="input w-full pr-8"
                    value={dto?.earlyPaymentDiscount || ''}
                    onChange={(val) => updateField('earlyPaymentDiscount', val)}
                    onBlur={() => saveField('earlyPaymentDiscount', dto?.earlyPaymentDiscount)}
                    disabled={!isEditable || saving}
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    inheritedValue={earlyPaymentDiscountInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountInheritance.inheritedSourceLabel}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-medium text-slate-400 pointer-events-none">%</span>
                </div>
                {/* eslint-disable-next-line i18next/no-literal-string -- The word 'in' is not translatable here */}
                <span className="text-sm font-medium shrink-0 text-[var(--text-muted)]">
                  in
                </span>
                <div className="relative w-32 shrink-0">
                  <InheritedNumberInput
                    className="input w-full pr-12"
                    value={dto?.earlyPaymentDiscountDays?.toString() || ''}
                    onChange={(val) => updateField('earlyPaymentDiscountDays', val ? Number(val) : null)}
                    onBlur={() => saveField('earlyPaymentDiscountDays', dto?.earlyPaymentDiscountDays)}
                    disabled={!isEditable || saving}
                    step="1"
                    min="0"
                    placeholder="10"
                    inheritedValue={earlyPaymentDiscountDaysInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountDaysInheritance.inheritedSourceLabel}
                  />
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-medium text-slate-400 pointer-events-none text-sm">days</span>
                </div>
                {!!earlyPaymentDiscountInheritance.inheritedSourceLabel && !!earlyPaymentDiscountDaysInheritance.inheritedSourceLabel && (
                  <span className="text-xs italic text-[var(--primary)] ml-2">
                    {tCommon('options.inheritValue', { 
                      label: `${earlyPaymentDiscountInheritance.inheritedValue}% in ${earlyPaymentDiscountDaysInheritance.inheritedValue} days`,
                      source: earlyPaymentDiscountInheritance.inheritedSourceLabel || ''
                    })}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Credit Limit
              </label>
              <div className="flex items-center gap-3">
                <InheritedNumberInput
                  step="0.01"
                  className="input w-full max-w-xs"
                  value={dto?.creditLimit || ""}
                  onChange={(val) => updateField('creditLimit', val)}
                  onBlur={() => saveField("creditLimit", dto?.creditLimit)}
                  disabled={!isEditable || saving}
                  placeholder="0.00"
                  inheritedValue={creditLimitInheritance.inheritedValue}
                  inheritedSourceLabel={creditLimitInheritance.inheritedSourceLabel}
                />
                {!!creditLimitInheritance.inheritedSourceLabel && (
                  <span className="text-xs italic text-[var(--primary)] ml-2">
                    {tCommon('options.inheritValue', {
                      label: creditLimitInheritance.inheritedValue || '',
                      source: creditLimitInheritance.inheritedSourceLabel || ''
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* ── Row 2 ── */}
            {/* 4. Business Number */}
            <div>
              <label className="flex items-center text-xs font-medium mb-1.5 text-[var(--text-muted)] min-h-[16px]">
                {t('fields.businessNumber')}
                <FrontendEnrichmentDecorator
                  field="supplier.business_number"
                  country={supplier.address1Country || ''}
                  value={dto?.businessNumber || ''}
                  isSaving={saving}
                  onEnrich={(data: Record<string, unknown>) => {
                    const enriched = data as { name?: string; isTaxRegistered?: boolean };
                    if (enriched.name && enriched.name !== dto?.name) {
                      updateField('name', enriched.name);
                      saveField('name', enriched.name);
                      toast.success(tCommon('enrichment.nameUpdated'));
                    }
                    if (enriched.isTaxRegistered !== undefined && enriched.isTaxRegistered !== dto?.isTaxRegistered) {
                      updateField('isTaxRegistered', enriched.isTaxRegistered);
                      saveField('isTaxRegistered', enriched.isTaxRegistered);
                      toast.success(tCommon('enrichment.taxUpdated'));
                    }
                  }}
                />
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto?.businessNumber || ''}
                onChange={(e) => updateField('businessNumber', e.target.value)}
                disabled={!isEditable || saving}
                onBlur={() => saveField('businessNumber', dto?.businessNumber)}
                placeholder="Enter business number..."
              />
            </div>

            {/* 5. Tax Registered */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('fields.taxRegistered')}
              </label>
              <div
                className={`flex items-center gap-3 pt-1.5 ${!isEditable || saving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  if (!isEditable || saving) return;
                  const newValue = !dto?.isTaxRegistered;
                  updateField('isTaxRegistered', newValue);
                  saveField('isTaxRegistered', newValue);
                }}
              >
                <div
                  className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${dto?.isTaxRegistered ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'} ${!isEditable || saving ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all duration-200 ${dto?.isTaxRegistered ? 'left-[21px]' : 'left-[3px]'}`}
                  />
                </div>
                <span className="text-sm text-[var(--text-secondary)]">
                  {dto?.isTaxRegistered ? tCommon('yes') : tCommon('no')}
                </span>
              </div>
            </div>

            {/* 6. Tax Position */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.taxPosition')}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving}
                value={dto?.taxPositionId || ''}
                onChange={(val) => {
                  updateField('taxPositionId', val || null);
                  saveField('taxPositionId', val || null);
                }}
                options={taxPositions.map((pos) => ({
                  value: pos.taxPositionId,
                  label: pos.title,
                }))}
                inheritedValue={taxPositionInheritance.inheritedValue}
                inheritedSourceLabel={taxPositionInheritance.inheritedSourceLabel}
              />
            </div>

            {/* ── Row 3 ── */}
            {/* 7. Trading Terms */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('tradingTerms')}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving}
                value={dto?.tradingTermsId || ''}
                onChange={(val) => {
                  updateField('tradingTermsId', val || null);
                  saveField('tradingTermsId', val || null);
                }}
                options={availableTradingTerms.map((term) => ({
                  value: term.tradingTermsId,
                  label: `${term.code} - ${term.description}`,
                }))}
                inheritedValue={tradingTermsInheritance.inheritedValue}
                inheritedSourceLabel={tradingTermsInheritance.inheritedSourceLabel}
              />
            </div>
          </div>
        </div>

        {/* Contact & Location Card — full width */}
        <div id="contact-section" className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">location_on</span>
            {t('contactLocation')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('email')}
              </label>
              <input
                type="email"
                className="input"
                value={dto?.emailAddress1 || ''}
                onChange={(e) => updateField('emailAddress1', e.target.value)}
                onBlur={() => saveField('emailAddress1', dto?.emailAddress1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('phone')}
              </label>
              <input
                type="text"
                className="input"
                value={dto?.telephone1 || ''}
                onChange={(e) => updateField('telephone1', e.target.value)}
                onBlur={() => saveField('telephone1', dto?.telephone1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.address')}
              </label>
              <input
                type="text"
                className="input"
                value={dto?.address1Line1 || ''}
                onChange={(e) => updateField('address1Line1', e.target.value)}
                onBlur={() => saveField('address1Line1', dto?.address1Line1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('city')}
              </label>
              <input
                type="text"
                className="input"
                value={dto?.address1City || ''}
                onChange={(e) => updateField('address1City', e.target.value)}
                onBlur={() => saveField('address1City', dto?.address1City)}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        </div>

        {/* Bank Details Card */}
        <div id="bank-section" className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">account_balance</span>
            Bank Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('fields.bankAccountName')}
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto?.bankAccountName || ''}
                onChange={(e) => updateField('bankAccountName', e.target.value)}
                onBlur={() => saveField('bankAccountName', dto?.bankAccountName)}
                disabled={!isEditable || saving}
                placeholder="e.g. John Doe Pty Ltd"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                BSB
              </label>
              <input
                type="text"
                className="input"
                value={dto?.bankBsb || ''}
                onChange={(e) => updateField('bankBsb', e.target.value)}
                onBlur={() => saveField('bankBsb', dto?.bankBsb)}
                disabled={!isEditable || saving}
                placeholder="e.g. 062-000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('fields.accountNumber')}
              </label>
              <input
                type="text"
                className="input"
                value={dto?.bankAccountNumber || ''}
                onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                onBlur={() => saveField('bankAccountNumber', dto?.bankAccountNumber)}
                disabled={!isEditable || saving}
                placeholder="e.g. 12345678"
              />
            </div>
          </div>
        </div>

        {/* Activity Timeline — full width */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={((supplier as { events?: unknown[] }).events || []) as TimelineEvent[]} />
        </div>

      </div>
      )}

      {activeTab === 'compliance' && (
        <div className="flex flex-col gap-3">
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">gavel</span>
              {t('compliance.title')}
            </h3>
            <div className="flex gap-2 pt-2 pb-4">
              <SupplierStatusBadges 
                profile={resolveSupplierRiskProfile(supplier)} 
                stateCode={supplier.stateCode || ''}
                mode="header"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <label className="block text-xs font-medium m-0 text-[var(--text-muted)]">{t('compliance.purchasingBlock')}</label>
                  <InheritedSelect
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto?.isPurchasingBlocked === true ? 'true' : dto?.isPurchasingBlocked === false ? 'false' : ''}
                    onChange={(val) => {
                      const newBlocked = val === 'true' ? true : val === 'false' ? false : null;
                      updateField('isPurchasingBlocked', newBlocked);
                      saveField('isPurchasingBlocked', newBlocked);
                    }}
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    inheritedValue={purchasingBlockInheritance.inheritedValue}
                    inheritedSourceLabel={purchasingBlockInheritance.inheritedSourceLabel}
                  />
                </div>
                {dto?.isPurchasingBlocked && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('compliance.reason')}</label>
                    <select
                      className="input w-full"
                      value={dto?.purchasingBlockReason || ''}
                      onChange={e => updateField('purchasingBlockReason', e.target.value)}
                      onBlur={() => saveField('purchasingBlockReason', dto?.purchasingBlockReason)}
                      disabled={!isEditable || saving}
                    >
                      <option value="">{tCommon('selectEllipsis')}</option>
                      <option value="compliance_breach">{t('compliance.reasons.compliance_breach')}</option>
                      <option value="quality_issues">{t('compliance.reasons.quality_issues')}</option>
                      <option value="dispute">{t('compliance.reasons.dispute')}</option>
                      <option value="financial_risk">{t('compliance.reasons.financial_risk')}</option>
                      <option value="other">{t('compliance.reasons.other')}</option>
                    </select>
                  </div>
                )}
                {selectedGroup?.isPurchasingBlocked && (
                  <div className="text-xs font-semibold text-danger">
                    {t('compliance.groupInherited', { reason: (selectedGroup?.purchasingBlockReason || 'Unspecified').replace('_', ' ') })}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <label className="block text-xs font-medium m-0 text-[var(--text-muted)]">{t('compliance.paymentBlock')}</label>
                  <InheritedSelect
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto?.isPaymentBlocked === true ? 'true' : dto?.isPaymentBlocked === false ? 'false' : ''}
                    onChange={(val) => {
                      const newBlocked = val === 'true' ? true : val === 'false' ? false : null;
                      updateField('isPaymentBlocked', newBlocked);
                      saveField('isPaymentBlocked', newBlocked);
                    }}
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    inheritedValue={paymentBlockInheritance.inheritedValue}
                    inheritedSourceLabel={paymentBlockInheritance.inheritedSourceLabel}
                  />
                </div>
                {dto?.isPaymentBlocked && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('compliance.reason')}</label>
                    <select
                      className="input w-full"
                      value={dto?.paymentBlockReason || ''}
                      onChange={e => updateField('paymentBlockReason', e.target.value)}
                      onBlur={() => saveField('paymentBlockReason', dto?.paymentBlockReason)}
                      disabled={!isEditable || saving}
                    >
                      <option value="">{tCommon('selectEllipsis')}</option>
                      <option value="invoice_dispute">{t('compliance.reasons.invoice_dispute')}</option>
                      <option value="missing_goods">{t('compliance.reasons.missing_goods')}</option>
                      <option value="contractual_breach">{t('compliance.reasons.contractual_breach')}</option>
                      <option value="other">{t('compliance.reasons.other')}</option>
                    </select>
                  </div>
                )}
                {selectedGroup?.isPaymentBlocked && (
                  <div className="text-xs font-semibold text-amber-600">
                    {t('compliance.groupInherited', { reason: (selectedGroup?.paymentBlockReason || 'Unspecified').replace('_', ' ') })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('compliance.blockNotes')}
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder={t('compliance.notesPlaceholder')}
                value={dto?.blockNotes || ''}
                onChange={e => updateField('blockNotes', e.target.value)}
                onBlur={() => saveField('blockNotes', dto?.blockNotes)}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
          
          <SupplierExpiries vendorId={(supplier as { vendorId?: string }).vendorId || params.id} isEditable={isEditable} />
        </div>
      )}
      </DetailsLayout>
    </>
  );
}
