'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  reportError,
} from '@/lib/api';
import * as api from '@modbm/sdk';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { CURRENCIES } from '@/lib/currency';
import PageNav from '@/components/shared/PageNav';
import DataGrid from '@/components/DataGrid';
import GroupSelect from '@/components/shared/GroupSelect';
import { resolveSupplierRiskProfile } from '@/lib/supplier-risk';
import SupplierStatusBadges from '@/components/suppliers/SupplierStatusBadges';
import SupplierExpiries from '@/components/suppliers/SupplierExpiries';
import { useSettings } from '@/components/SettingsProvider';
import { SUPPLIER_STATE } from '@modbm/shared';

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
  creditLimit?: string | null;
  isPurchasingBlocked?: boolean;
  purchasingBlockReason?: string | null;
  isPaymentBlocked?: boolean;
  paymentBlockReason?: string | null;
  
  // Group properties (resolved in backend from join)
  supplierGroupName?: string | null;
  supplierGroupCode?: string | null;
  groupIsPurchasingBlocked?: boolean;
  groupPurchasingBlockReason?: string | null;
  groupIsPaymentBlocked?: boolean;
  groupPaymentBlockReason?: string | null;

  currencyCode: string;
  supplierGroupId: string | null;
  stateCode: string;
  notes: string | null;
  blockNotes?: string | null;

  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;

  createdBy?: string | null;
  createdOn?: string | null;
  modifiedOn?: string | null;
  events?: any[];
}

export default function SupplierDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { baseCurrency } = useSettings();
  const t = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');
  const tStates = useTranslations('common.states');
  const tToast = useTranslations('toast');
  const tConfirm = useTranslations('confirm');
  const tSidebar = useTranslations('sidebar');
  const params = use(paramsPromise);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'details' | 'products' | 'compliance'>('details');
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
  const [editNotes, setEditNotes] = useState('');
  const [editCurrency, setEditCurrency] = useState(baseCurrency);
  const [editSupplierGroupId, setEditSupplierGroupId] = useState<string | null>(null);
  
  const [editIsPurchasingBlocked, setEditIsPurchasingBlocked] = useState(false);
  const [editPurchasingBlockReason, setEditPurchasingBlockReason] = useState('');
  const [editIsPaymentBlocked, setEditIsPaymentBlocked] = useState(false);
  const [editPaymentBlockReason, setEditPaymentBlockReason] = useState('');
  const [editBlockNotes, setEditBlockNotes] = useState('');

  const [editBankAccountName, setEditBankAccountName] = useState('');
  const [editBankBsb, setEditBankBsb] = useState('');
  const [editBankAccountNumber, setEditBankAccountNumber] = useState('');

  const [availableTradingTerms, setAvailableTradingTerms] = useState<any[]>([]);

  const loadSupplier = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const dataRes: any = await Promise.all([
        api.suppliersControllerFindOne(params.id),
        api.tradingTermsControllerFindAll().catch(() => ({ data: [] })),
      ]);
      const data = dataRes[0]?.data || dataRes[0];
      const termsData = dataRes[1]?.data || dataRes[1] || [];
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
      setEditNotes(data.notes || '');
      
      setEditIsPurchasingBlocked(data.isPurchasingBlocked || false);
      setEditPurchasingBlockReason(data.purchasingBlockReason || '');
      setEditIsPaymentBlocked(data.isPaymentBlocked || false);
      setEditPaymentBlockReason(data.paymentBlockReason || '');
      setEditBlockNotes(data.blockNotes || '');
      
      setEditBankAccountName(data.bankAccountName || '');
      setEditBankBsb(data.bankBsb || '');
      setEditBankAccountNumber(data.bankAccountNumber || '');
      
      setEditCurrency(data.currencyCode || baseCurrency);
      setEditSupplierGroupId(data.supplierGroupId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToLoadOrder'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplier();
  }, [params.id]);

  /** Save a single field on blur if it changed */
  const saveField = async (field: string, value: any, original: any) => {
    if (value === original) return;
    if (value === '' && original === null) return;
    setSaving(true);
    setError('');
    try {
      const payloadValue = value === '' ? null : value;
      await api.suppliersControllerUpdate(params.id, { [field]: payloadValue } as any);
      await loadSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateOrder'));
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
      await api.suppliersControllerUpdate(params.id, { stateCode: newState } as any);
      await loadSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeState'));
    } finally {
      setSaving(false);
    }
  };

  const archiveSupplier = async () => {
    if (!confirm(tConfirm('archiveOrder'))) return;
    setSaving(true);
    try {
      await api.suppliersControllerArchive(params.id);
      toast.success(tToast('orderArchived'), { icon: '📦' });
      await loadSupplier(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const unarchiveSupplier = async () => {
    setSaving(true);
    try {
      await api.suppliersControllerUnarchive(params.id);
      toast.success(tToast('orderUnarchived'), { icon: '📦' });
      await loadSupplier(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const productColumns: any[] = useMemo(() => [
    { field: 'productNumber', headerName: t('products.columns.productNo'), width: 140 },
    { field: 'productName', headerName: t('products.columns.name'), flex: 1, minWidth: 160 },
    { field: 'supplierPartNumber', headerName: t('products.columns.partNo'), width: 150 },
    { field: 'costPrice', headerName: t('products.columns.costPrice'), type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'discountPercent', headerName: t('products.columns.discount'), type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value)}%` : '—' },
    { 
      field: 'productStateCode', 
      headerName: t('products.columns.status'), 
      width: 110, 
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const s = String(p.value).toLowerCase();
        return tStates.has(s as any) ? tStates(s as any) : String(p.value);
      } 
    },
  ], [t]);

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
            onBack={() => {
              if (document.referrer.includes(window.location.host)) {
                router.back();
              } else {
                router.push('/suppliers');
              }
            }}
            isSaving={saving}
            badges={<SupplierStatusBadges mode="header" profile={resolveSupplierRiskProfile(supplier as any)} stateCode={supplier.stateCode} />}
            nav={<PageNav sections={visibleSections} />}
          />
        }
      >
      {supplier.stateCode === SUPPLIER_STATE.ARCHIVED && (
        <div
          className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/suppliers/${encodeURIComponent(params.id)}/products`}
                columns={productColumns}
                gridKey="supplier-products"
                fetchAll
                onRowClicked={(row: any) => router.push(`/products/${row.productId}`)}
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

        {/* Top row: General Info (left) + Financials (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* General Info Card */}
          <div id="info-section" className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">info</span>
              {t('generalInfo')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('columns.name')}
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
            </div>
          </div>

          {/* Financials Card */}
          <div id="financials-section" className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">payments</span>
              {t('financials')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('columns.currency')}
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
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('paymentTerms')}
                  </label>
                  <select
                    className="input"
                    value={editTradingTermsId || ''}
                    onChange={(e) => {
                      setEditTradingTermsId(e.target.value);
                      saveField('tradingTermsId', e.target.value, supplier.tradingTermsId || null);
                    }}
                    disabled={!isEditable || saving}
                  >
                    <option value="">{tCommon('selectEllipsis')}</option>
                    {availableTradingTerms.map(t => (
                      <option key={t.tradingTermsId} value={t.tradingTermsId}>{t.code} - {t.description}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('columns.status')}
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
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('earlyPaymentDiscount')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      className="input w-full pr-8"
                      value={editEarlyPaymentDiscount || ''}
                      onChange={(e) => setEditEarlyPaymentDiscount(e.target.value)}
                      onBlur={() => saveField('earlyPaymentDiscount', editEarlyPaymentDiscount || '', supplier.earlyPaymentDiscount || null)}
                      disabled={!isEditable || saving}
                      step="0.01"
                      min="0"
                      max="100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Notes Card — full width */}
        <div id="notes-section" className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">notes</span>
            {tCommon('notesCardHeading')}
          </h3>
          <textarea
            className="input w-full"
            style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onBlur={() => saveField('notes', editNotes, supplier.notes)}
            placeholder={tCommon('notesCardPlaceholder')}
            disabled={!isEditable || saving}
          />
        </div>

        {/* Contact & Location Card — full width */}
        <div id="contact-section" className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
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
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('country')}
              </label>
              <input
                type="text"
                className="input"
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                onBlur={() => saveField('address1Country', editCountry, supplier.address1Country)}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        </div>

        {/* Bank Details Card */}
        <div id="bank-section" className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
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
        {/* Activity Timeline — full width */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={supplier.events || []} />
        </div>

        <div className="flex justify-end pt-2">
          {supplier.stateCode === SUPPLIER_STATE.ARCHIVED ? (
            <button className="btn btn-secondary" onClick={unarchiveSupplier} disabled={saving}>
              📦 {tSales('buttons.unarchive')}
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
              onClick={archiveSupplier}
              disabled={saving}
            >
              📦 {tSales('buttons.archive')}
            </button>
          )}
        </div>
      </div>
      )}

      {activeTab === 'compliance' && (
        <div className="flex flex-col gap-3">
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">gavel</span>
              {t('compliance.title')}
            </h3>
            <div className="flex gap-2 pt-2 pb-4">
              <SupplierStatusBadges 
                profile={resolveSupplierRiskProfile(supplier as any)} 
                stateCode={supplier.stateCode}
                mode="header"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <label className="block text-xs font-medium m-0" style={{ color: 'var(--text-muted)' }}>{t('compliance.purchasingBlock')}</label>
                  <label className="switch" title={editIsPurchasingBlocked ? t('tooltips.currentlyBlocked') : t('tooltips.currentlyActive')}>
                    <input 
                      type="checkbox" 
                      checked={!editIsPurchasingBlocked} 
                      disabled={!isEditable || saving}
                      onChange={e => {
                        const newBlocked = !e.target.checked;
                        setEditIsPurchasingBlocked(newBlocked);
                        saveField('isPurchasingBlocked', newBlocked, supplier.isPurchasingBlocked || false);
                      }} 
                    />
                    <span className="switch-slider"></span>
                  </label>
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
                {supplier.groupIsPurchasingBlocked && (
                  <div className="text-xs font-semibold text-danger">
                    {t('compliance.groupInherited', { reason: (supplier.groupPurchasingBlockReason || 'Unspecified').replace('_', ' ') })}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <label className="block text-xs font-medium m-0" style={{ color: 'var(--text-muted)' }}>{t('compliance.paymentBlock')}</label>
                  <label className="switch" title={editIsPaymentBlocked ? t('tooltips.currentlyBlocked') : t('tooltips.currentlyActive')}>
                    <input 
                      type="checkbox" 
                      checked={!editIsPaymentBlocked} 
                      disabled={!isEditable || saving}
                      onChange={e => {
                        const newBlocked = !e.target.checked;
                        setEditIsPaymentBlocked(newBlocked);
                        saveField('isPaymentBlocked', newBlocked, supplier.isPaymentBlocked || false);
                      }} 
                    />
                    <span className="switch-slider"></span>
                  </label>
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
                {supplier.groupIsPaymentBlocked && (
                  <div className="text-xs font-semibold text-amber-600">
                    {t('compliance.groupInherited', { reason: (supplier.groupPaymentBlockReason || 'Unspecified').replace('_', ' ') })}
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
