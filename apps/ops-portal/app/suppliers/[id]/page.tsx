'use client';

import { useState, useEffect, use, useMemo } from 'react';
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
import PageNav from '@/components/shared/PageNav';
import DataGrid from '@/components/DataGrid';
import GroupSelect from '@/components/shared/GroupSelect';
import { resolveSupplierRiskProfile } from '@/lib/supplier-risk';
import SupplierStatusBadges from '@/components/suppliers/SupplierStatusBadges';
import SupplierExpiries from '@/components/suppliers/SupplierExpiries';
import InheritedSelect from '@/components/shared/InheritedSelect';
import InheritedNumberInput from '@/components/shared/InheritedNumberInput';
import { useSettings } from '@/components/SettingsProvider';
import { SUPPLIER_STATE, getErrorMessage, CURRENCIES as _CURRENCIES, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';

interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
  emailAddress1: string | null;
  telephone1: string | null;
  address1Line1: string | null;
  address1Line2: string | null;
  address1City: string | null;
  address1StateOrProvince: string | null;
  address1PostalCode: string | null;
  address1Country: string | null;
  // Overrides
  tradingTermsId?: string | null;
  earlyPaymentDiscount?: string | null;
  earlyPaymentDiscountDays?: number | null;
  creditLimit?: string | null;
  isPurchasingBlocked?: boolean;
  purchasingBlockReason?: string | null;
  isPaymentBlocked?: boolean;
  paymentBlockReason?: string | null;
  


  currencyCode: string;
  supplierGroupId: string | null;
  stateCode: string;
  notes: string | null;
  blockNotes?: string | null;

  businessNumber: string | null;
  isTaxRegistered: boolean;
  taxPositionId?: string | null;

  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;

  createdBy?: string | null;
  createdOn?: string | null;
  modifiedOn?: string | null;
  events?: unknown[];
}

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
  const initialTab = (searchParams.get('tab') as 'details' | 'products' | 'compliance' | 'purchaseOrders' | 'invoices' | 'payments') || 'details';
  const [activeTab, setActiveTab] = useState<'details' | 'products' | 'compliance' | 'purchaseOrders' | 'invoices' | 'payments'>(initialTab);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useDocumentTitle(supplier ? (supplier.name ? `${supplier.vendorNumber} - ${supplier.name}` : supplier.vendorNumber) : null);



  // Editable field state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editTradingTermsId, setEditTradingTermsId] = useState<string | null>(null);
  const [editEarlyPaymentDiscount, setEditEarlyPaymentDiscount] = useState<string | null>(null);
  const [editEarlyPaymentDiscountDays, setEditEarlyPaymentDiscountDays] = useState<string | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editCurrency, setEditCurrency] = useState(baseCurrency);
  const [editSupplierGroupId, setEditSupplierGroupId] = useState<string | null>(null);
  
  const [editIsPurchasingBlocked, setEditIsPurchasingBlocked] = useState<boolean | null>(null);
  const [editPurchasingBlockReason, setEditPurchasingBlockReason] = useState('');
  const [editIsPaymentBlocked, setEditIsPaymentBlocked] = useState<boolean | null>(null);
  const [editPaymentBlockReason, setEditPaymentBlockReason] = useState('');
  const [editBlockNotes, setEditBlockNotes] = useState('');

  const [editBusinessNumber, setEditBusinessNumber] = useState('');
  const [editIsTaxRegistered, setEditIsTaxRegistered] = useState(false);
  const [editTaxPositionId, setEditTaxPositionId] = useState('');

  const [editBankAccountName, setEditBankAccountName] = useState('');
  const [editBankBsb, setEditBankBsb] = useState('');
  const [editBankAccountNumber, setEditBankAccountNumber] = useState('');

  const [availableTradingTerms, setAvailableTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [supplierGroups, setSupplierGroups] = useState<api.SupplierGroupResponseDto[]>([]);

  const selectedGroup = useGroup(supplierGroups, editSupplierGroupId);

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

  const loadSupplier = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [supplierRes, termsRes, taxPositionsRes, groupsRes] = await Promise.all([
        api.suppliersControllerFindOne(params.id),
        api.tradingTermsControllerFindAll().catch(() => ({ data: [] as api.TradingTermResponseDto[] } as unknown as api.tradingTermsControllerFindAllResponse)),
        api.taxPositionsControllerFindAll().catch(() => ({ data: [] as api.TaxPositionResponseDto[] } as unknown as api.taxPositionsControllerFindAllResponse)),
        api.supplierGroupsControllerFindAll().catch(() => ({ data: [] as api.SupplierGroupResponseDto[] } as unknown as api.supplierGroupsControllerFindAllResponse)),
      ]) as unknown as [
        { data: Supplier },
        { data: api.TradingTermResponseDto[] },
        { data: api.TaxPositionResponseDto[] },
        { data: api.SupplierGroupResponseDto[] }
      ];
      const data = supplierRes?.data;
      const termsData = termsRes?.data || [];
      setTaxPositions(taxPositionsRes?.data || []);
      setSupplierGroups(groupsRes?.data || []);
      setSupplier(data);
      setAvailableTradingTerms(termsData);
      
      setEditName(data.name || '');
      setEditEmail(data.emailAddress1 || '');
      setEditPhone(data.telephone1 || '');
      setEditStreet(data.address1Line1 || '');
      setEditCity(data.address1City || '');
      setEditCountry(data.address1Country || '');
      setEditTradingTermsId(data.tradingTermsId || null);
      setEditEarlyPaymentDiscount(data.earlyPaymentDiscount || '');
      setEditEarlyPaymentDiscountDays(data.earlyPaymentDiscountDays?.toString() || '');
      setEditCreditLimit(data.creditLimit || '');
      setEditNotes(data.notes || '');
      
      setEditIsPurchasingBlocked(data.isPurchasingBlocked ?? null);
      setEditPurchasingBlockReason(data.purchasingBlockReason || '');
      setEditIsPaymentBlocked(data.isPaymentBlocked ?? null);
      setEditPaymentBlockReason(data.paymentBlockReason || '');
      setEditBlockNotes(data.blockNotes || '');
      
      setEditBusinessNumber(data.businessNumber || '');
      setEditIsTaxRegistered(data.isTaxRegistered || false);
      setEditTaxPositionId(data.taxPositionId || '');

      setEditBankAccountName(data.bankAccountName || '');
      setEditBankBsb(data.bankBsb || '');
      setEditBankAccountNumber(data.bankAccountNumber || '');
      
      setEditCurrency(data.currencyCode || baseCurrency);
      setEditSupplierGroupId(data.supplierGroupId || null);
    } catch (err) {
      setError(err instanceof Error ? getErrorMessage(err) : tCommon('errors.failedToLoadOrder'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplier();
  }, [params.id]);

  /** Save a single field on blur if it changed */
  const saveField = async (field: string, value: unknown, original: unknown) => {
    if (value === original) return;
    if (value === '' && original === null) return;
    setSaving(true);
    setError('');
    try {
      const payloadValue = value === '' ? null : value;
      await api.suppliersControllerUpdate(params.id, { [field]: payloadValue } as api.UpdateSupplierDto);
      await loadSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? getErrorMessage(err) : tCommon('errors.failedToUpdateOrder'));
    } finally {
      setSaving(false);
    }
  };

  /** Toggle state code (active/inactive) */
  const toggleState = async () => {
    if (!supplier || saving) return;
    const newState = supplier.stateCode === SUPPLIER_STATE.ACTIVE ? SUPPLIER_STATE.INACTIVE : SUPPLIER_STATE.ACTIVE;
    setSaving(true);
    setError('');
    try {
      await api.suppliersControllerUpdate(params.id, { stateCode: newState } as api.UpdateSupplierDto);
      await loadSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? getErrorMessage(err) : tCommon('errors.failedToChangeState'));
    } finally {
      setSaving(false);
    }
  };

  const archiveSupplier = async () => {
    if (!confirm(tConfirm('archiveOrder'))) return;
    setSaving(true);
    try {
      await api.suppliersControllerArchive(params.id, {});
      toast.success(tToast('orderArchived'));
      await loadSupplier(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveSupplier = async () => {
    setSaving(true);
    try {
      await api.suppliersControllerUnarchive(params.id, {});
      toast.success(tToast('orderUnarchived'));
      await loadSupplier(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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
    { field: "createdOn", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => p.value ? new Date(p.value).toLocaleDateString() : "" },
    { field: "totalPrice", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
  ], [tStates, baseCurrency]);

  const invoiceColumns: Record<string, unknown>[] = useMemo(() => [
    { field: "invoiceNumber", headerName: "Invoice No.", width: 150 },
    { field: "orderNumber", headerName: "PO Number", width: 150 },
    { field: "createdOn", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => p.value ? new Date(p.value).toLocaleDateString() : "" },
    { field: "totalAmount", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "outstandingAmount", headerName: "Outstanding", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
  ], [tStates, baseCurrency]);

  const paymentColumns: Record<string, unknown>[] = useMemo(() => [
    { field: "paymentNumber", headerName: "Payment No.", width: 150 },
    { field: "paymentDate", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => p.value ? new Date(p.value).toLocaleDateString() : "" },
    { field: "modeOfPayment", headerName: "Mode", width: 150 },
    { field: "totalAmount", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "unallocatedAmount", headerName: "Unallocated", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
    { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
  ], [tStates, baseCurrency]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
        </div>
      </>
    );
  }

  if (!supplier) {
    return (
      <>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
            {error || tCommon('noMatchingResults')}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/suppliers')}>
            ← {tSidebar('items.suppliers')}
          </button>
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
            badges={<SupplierStatusBadges mode="header" profile={resolveSupplierRiskProfile(supplier)} stateCode={supplier.stateCode} />}
            nav={<PageNav sections={visibleSections} />}
          />
        }
      >
      {supplier.stateCode === SUPPLIER_STATE.ARCHIVED && (
        <div
          className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <div>
            <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="flex-1 min-h-0 flex flex-col z-10 w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/suppliers/${encodeURIComponent(params.id)}/products`}
                columns={productColumns}
                gridKey="supplier-products"
                fetchAll
                onRowClicked={(row: { productId?: string }) => router.push(`/products/${row.productId}`)}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {t('products.title')}
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {tCommon('grid.rowCountLabel')}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? '...' : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">
                        {searchInput}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                    </div>
                  </div>
                )}
            />
          </div>
        </div>
      )}
      {activeTab === 'purchaseOrders' && (
        <div className="flex-1 min-h-0 flex flex-col z-10 w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/purchase-orders?vendorId=${encodeURIComponent(params.id)}`}
                columns={orderColumns}
                gridKey="supplier-orders"
                fetchAll
                onRowClicked={(row: { id?: string }) => router.push(`/purchase-orders/${row.id}`)}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Orders
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {tCommon('grid.rowCountLabel')}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? '...' : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">
                        {searchInput}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                    </div>
                  </div>
                )}
            />
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="flex-1 min-h-0 flex flex-col z-10 w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/purchase-invoices?vendorId=${encodeURIComponent(params.id)}`}
                columns={invoiceColumns}
                gridKey="supplier-invoices"
                fetchAll
                onRowClicked={(row: { invoiceId?: string }) => router.push(`/supplier-invoices/${row.invoiceId}`)}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Invoices
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {tCommon('grid.rowCountLabel')}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? '...' : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">
                        {searchInput}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                    </div>
                  </div>
                )}
            />
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="flex-1 min-h-0 flex flex-col z-10 w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/payments?partyId=${encodeURIComponent(params.id)}`}
                columns={paymentColumns}
                gridKey="supplier-payments"
                fetchAll
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Payments
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {tCommon('grid.rowCountLabel')}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? '...' : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">
                        {searchInput}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                    </div>
                  </div>
                )}
            />
          </div>
        </div>
      )}


      {activeTab === 'details' && (
        <div className="flex flex-col gap-3">

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
          <button className="ml-3 text-xs underline" onClick={() => setError('')}>{tCommon('dismiss')}</button>
        </div>
      )}

        {/* General Info Card */}
        <div id="info-section" className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">info</span>
            {t('generalInfo')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.name')} *
              </label>
              <input
                type="text"
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => saveField('name', editName, supplier.name)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('supplierGroup')}
              </label>
              <GroupSelect
                type="supplier"
                value={editSupplierGroupId}
                onChange={(val) => {
                  setEditSupplierGroupId(val);
                  saveField('supplierGroupId', val || '', supplier.supplierGroupId);
                }}
                disabled={!isEditable || saving}
                placeholder={t('placeholders.noGroup')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('country')} *
              </label>
              <select
                className="input"
                value={editCountry}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditCountry(val);
                  const newCurrency = getCurrencyForCountry(val);
                  if (newCurrency && newCurrency !== editCurrency) {
                    setEditCurrency(newCurrency);
                  }
                }}
                onBlur={() => {
                  saveField('address1Country', editCountry, supplier.address1Country);
                  const newCurrency = getCurrencyForCountry(editCountry);
                  if (newCurrency && newCurrency !== supplier.currencyCode) {
                    saveField('currencyCode', newCurrency, supplier.currencyCode);
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('notesCardHeading')}
              </label>
              <input
                type="text"
                className="input w-full"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                onBlur={() => saveField('notes', editNotes, supplier.notes)}
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.currency')} *
              </label>
              <select
                className="input"
                value={editCurrency}
                onChange={(e) => {
                  setEditCurrency(e.target.value);
                  saveField('currencyCode', e.target.value, supplier.currencyCode);
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.state')}
              </label>
              <div
                className="flex items-center gap-3"
                style={{ paddingTop: 6, cursor: !isEditable || saving ? 'not-allowed' : 'pointer' }}
                onClick={toggleState}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: supplier.stateCode === SUPPLIER_STATE.ACTIVE ? 'var(--accent)' : 'var(--border)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    opacity: !isEditable || saving ? 0.5 : 1,
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
                      left: supplier.stateCode === SUPPLIER_STATE.ACTIVE ? 21 : 3,
                      transition: 'left 0.2s ease',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <StateName state={supplier.stateCode as ValidState} />
                </span>
              </div>
            </div>

            {/* 3. Early Payment Discount */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('earlyPaymentDiscount')}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-32 shrink-0">
                  <InheritedNumberInput
                    className="input w-full pr-8"
                    value={editEarlyPaymentDiscount || ''}
                    onChange={(val) => setEditEarlyPaymentDiscount(val)}
                    onBlur={() => saveField('earlyPaymentDiscount', editEarlyPaymentDiscount ? String(editEarlyPaymentDiscount) : null, supplier.earlyPaymentDiscount || null)}
                    disabled={!isEditable || saving}
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    inheritedValue={earlyPaymentDiscountInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountInheritance.inheritedSourceLabel}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                {/* eslint-disable-next-line i18next/no-literal-string -- The word 'in' is not translatable here */}
                <span className="text-sm font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
                  in
                </span>
                <div className="relative w-32 shrink-0">
                  <InheritedNumberInput
                    className="input w-full pr-12"
                    value={editEarlyPaymentDiscountDays || ''}
                    onChange={(val) => setEditEarlyPaymentDiscountDays(val)}
                    onBlur={() => saveField('earlyPaymentDiscountDays', editEarlyPaymentDiscountDays ? Number(editEarlyPaymentDiscountDays) : null, supplier.earlyPaymentDiscountDays || null)}
                    disabled={!isEditable || saving}
                    step="1"
                    min="0"
                    placeholder="10"
                    inheritedValue={earlyPaymentDiscountDaysInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountDaysInheritance.inheritedSourceLabel}
                  />
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none text-sm">days</span>
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Credit Limit
              </label>
              <div className="flex items-center gap-3">
                <InheritedNumberInput
                  step="0.01"
                  className="input w-full max-w-xs"
                  value={editCreditLimit || ""}
                  onChange={(val) => setEditCreditLimit(val)}
                  onBlur={() => saveField("creditLimit", editCreditLimit, supplier.creditLimit)}
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.businessNumber')}
                <FrontendEnrichmentDecorator
                  field="supplier.business_number"
                  country={supplier.address1Country || ''}
                  value={editBusinessNumber}
                  isSaving={saving}
                  onEnrich={(data: Record<string, unknown>) => {
                    const enriched = data as { name?: string; isTaxRegistered?: boolean };
                    if (enriched.name && enriched.name !== editName) {
                      setEditName(enriched.name);
                      saveField('name', enriched.name, supplier.name);
                      toast.success(tCommon('enrichment.nameUpdated'));
                    }
                    if (enriched.isTaxRegistered !== undefined && enriched.isTaxRegistered !== editIsTaxRegistered) {
                      setEditIsTaxRegistered(enriched.isTaxRegistered);
                      saveField('isTaxRegistered', enriched.isTaxRegistered, supplier.isTaxRegistered);
                      toast.success(tCommon('enrichment.taxUpdated'));
                    }
                  }}
                />
              </label>
              <input
                type="text"
                className="input w-full"
                value={editBusinessNumber}
                onChange={(e) => setEditBusinessNumber(e.target.value)}
                disabled={!isEditable || saving}
                onBlur={() => saveField('businessNumber', editBusinessNumber, supplier.businessNumber)}
                placeholder="Enter business number..."
              />
            </div>

            {/* 5. Tax Registered */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.taxRegistered')}
              </label>
              <div
                className="flex items-center gap-3"
                style={{ paddingTop: 6, cursor: !isEditable || saving ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (!isEditable || saving) return;
                  const newValue = !editIsTaxRegistered;
                  setEditIsTaxRegistered(newValue);
                  saveField('isTaxRegistered', newValue, supplier.isTaxRegistered);
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: editIsTaxRegistered ? 'var(--accent)' : 'var(--border)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    opacity: !isEditable || saving ? 0.5 : 1,
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
                      left: editIsTaxRegistered ? 21 : 3,
                      transition: 'left 0.2s ease',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {editIsTaxRegistered ? tCommon('yes') : tCommon('no')}
                </span>
              </div>
            </div>

            {/* 6. Tax Position */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.taxPosition')}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving}
                value={editTaxPositionId}
                onChange={(val) => {
                  setEditTaxPositionId(val);
                  saveField('taxPositionId', val, supplier.taxPositionId);
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('tradingTerms')}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving}
                value={editTradingTermsId || ''}
                onChange={(val) => {
                  setEditTradingTermsId(val || null);
                  saveField('tradingTermsId', val, supplier.tradingTermsId || null);
                }}
                options={availableTradingTerms.map((term) => ({
                  value: term.id,
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('email')}
              </label>
              <input
                type="email"
                className="input"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                onBlur={() => saveField('emailAddress1', editEmail, supplier.emailAddress1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('phone')}
              </label>
              <input
                type="text"
                className="input"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                onBlur={() => saveField('telephone1', editPhone, supplier.telephone1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.address')}
              </label>
              <input
                type="text"
                className="input"
                value={editStreet}
                onChange={(e) => setEditStreet(e.target.value)}
                onBlur={() => saveField('address1Line1', editStreet, supplier.address1Line1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('city')}
              </label>
              <input
                type="text"
                className="input"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                onBlur={() => saveField('address1City', editCity, supplier.address1City)}
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.bankAccountName')}
              </label>
              <input
                type="text"
                className="input w-full"
                value={editBankAccountName}
                onChange={(e) => setEditBankAccountName(e.target.value)}
                onBlur={() => saveField('bankAccountName', editBankAccountName, supplier.bankAccountName)}
                disabled={!isEditable || saving}
                placeholder="e.g. John Doe Pty Ltd"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                BSB
              </label>
              <input
                type="text"
                className="input"
                value={editBankBsb}
                onChange={(e) => setEditBankBsb(e.target.value)}
                onBlur={() => saveField('bankBsb', editBankBsb, supplier.bankBsb)}
                disabled={!isEditable || saving}
                placeholder="e.g. 062-000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.accountNumber')}
              </label>
              <input
                type="text"
                className="input"
                value={editBankAccountNumber}
                onChange={(e) => setEditBankAccountNumber(e.target.value)}
                onBlur={() => saveField('bankAccountNumber', editBankAccountNumber, supplier.bankAccountNumber)}
                disabled={!isEditable || saving}
                placeholder="e.g. 12345678"
              />
            </div>
          </div>
        </div>

        {/* Activity Timeline — full width */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={(supplier.events || []) as TimelineEvent[]} />
        </div>

        <div className="flex justify-end pt-2">
          {supplier.stateCode === SUPPLIER_STATE.ARCHIVED ? (
            <button className="btn btn-secondary" onClick={unarchiveSupplier} disabled={saving}>
              {tSales('buttons.unarchive')}
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
              onClick={archiveSupplier}
              disabled={saving}
            >
              {tSales('buttons.archive')}
            </button>
          )}
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
                stateCode={supplier.stateCode}
                mode="header"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <label className="block text-xs font-medium m-0" style={{ color: 'var(--text-muted)' }}>{t('compliance.purchasingBlock')}</label>
                  <InheritedSelect
                    className="input"
                    disabled={!isEditable || saving}
                    value={editIsPurchasingBlocked === true ? 'true' : editIsPurchasingBlocked === false ? 'false' : ''}
                    onChange={(val) => {
                      const newBlocked = val === 'true' ? true : val === 'false' ? false : null;
                      setEditIsPurchasingBlocked(newBlocked);
                      saveField('isPurchasingBlocked', newBlocked, supplier.isPurchasingBlocked ?? null);
                    }}
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    inheritedValue={purchasingBlockInheritance.inheritedValue}
                    inheritedSourceLabel={purchasingBlockInheritance.inheritedSourceLabel}
                  />
                </div>
                {editIsPurchasingBlocked && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('compliance.reason')}</label>
                    <select
                      className="input w-full"
                      value={editPurchasingBlockReason}
                      onChange={e => setEditPurchasingBlockReason(e.target.value)}
                      onBlur={() => saveField('purchasingBlockReason', editPurchasingBlockReason, supplier.purchasingBlockReason || '')}
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
                  <label className="block text-xs font-medium m-0" style={{ color: 'var(--text-muted)' }}>{t('compliance.paymentBlock')}</label>
                  <InheritedSelect
                    className="input"
                    disabled={!isEditable || saving}
                    value={editIsPaymentBlocked === true ? 'true' : editIsPaymentBlocked === false ? 'false' : ''}
                    onChange={(val) => {
                      const newBlocked = val === 'true' ? true : val === 'false' ? false : null;
                      setEditIsPaymentBlocked(newBlocked);
                      saveField('isPaymentBlocked', newBlocked, supplier.isPaymentBlocked ?? null);
                    }}
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    inheritedValue={paymentBlockInheritance.inheritedValue}
                    inheritedSourceLabel={paymentBlockInheritance.inheritedSourceLabel}
                  />
                </div>
                {editIsPaymentBlocked && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('compliance.reason')}</label>
                    <select
                      className="input w-full"
                      value={editPaymentBlockReason}
                      onChange={e => setEditPaymentBlockReason(e.target.value)}
                      onBlur={() => saveField('paymentBlockReason', editPaymentBlockReason, supplier.paymentBlockReason || '')}
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('compliance.blockNotes')}
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder={t('compliance.notesPlaceholder')}
                value={editBlockNotes}
                onChange={e => setEditBlockNotes(e.target.value)}
                onBlur={() => saveField('blockNotes', editBlockNotes, supplier.blockNotes || null)}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
          
          <SupplierExpiries vendorId={supplier.vendorId} isEditable={isEditable} />
        </div>
      )}
      </DetailsLayout>
    </>
  );
}
