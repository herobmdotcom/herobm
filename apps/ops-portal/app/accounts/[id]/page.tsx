'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  apiFetch,
  apiMutate,
  reportError,
} from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { formatAmount, HOME_CURRENCY } from '@/lib/currency';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge, { StateName } from '@/components/StateBadge';
import DataGrid from '@/components/DataGrid';
import { ValidState } from '@/types/states';
import PageNav from '@/components/shared/PageNav';
import GroupSelect from '@/components/shared/GroupSelect';

interface Account {
  accountId: string;
  accountNumber: string;
  name: string;
  emailAddress1: string | null;
  telephone1: string | null;
  fax: string | null;
  address1Line1: string | null;
  address1Line2: string | null;
  address1City: string | null;
  address1StateOrProvince: string | null;
  address1PostalCode: string | null;
  address1Country: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  accountGroupId: string | null;
  gstCategoryId: string | null;
  currencyCode: string;
  customerDiscount: string | null;
  stateCode: ValidState;
  notes: string | null;

  createdOn: string | null;
  createdBy: string | null;
  modifiedOn: string | null;
  events?: any[];
}

export default function AccountDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const t = useTranslations();
  const tSales = useTranslations('salesOrders');
  const tCommon = useTranslations('common');
  const params = use(paramsPromise);
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useDocumentTitle(account ? (account.accountNumber ? `${account.accountNumber} - ${account.name}` : account.name) : null);
  const [isDirty, setIsDirty] = useState(false);
  const [dto, setDto] = useState<Partial<Account>>({});
  const [gstCategories, setGstCategories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'salesOrders' | 'invoices'>('details');

  const handleOrderRowClicked = useCallback((order: any) => {
    router.push(`/sales-orders/${order.id}`);
  }, [router]);

  const handleInvoiceRowClicked = useCallback((row: any) => {
    if (row.salesOrderId) {
        router.push(`/sales-orders/${row.salesOrderId}#invoices-section`);
    }
  }, [router]);

  const orderColumns = useMemo(() => [
    { field: 'orderNumber', headerName: tCommon('columns.orderNumber'), width: 150, pinned: 'left' as const },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 160 },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 110,
      cellRenderer: (p: { value: string }) => p.value ? <StateBadge state={p.value as ValidState} /> : null,
    },
    { field: 'customerOrderNumber', headerName: tCommon('columns.customerPO'), width: 140 },
    {
      field: 'totalPrice',
      headerName: tCommon('columns.totalPrice'),
      width: 120,
      type: 'numericColumn',
      valueGetter: (p: any) => p.data?.totalPrice ? parseFloat(p.data.totalPrice) : null,
      valueFormatter: (p: any) => (!p.value || p.value === 0) ? '—' : formatAmount(p.value, p.data?.currencyCode || HOME_CURRENCY.code),
    },
    {
      field: 'createdOn',
      headerName: tCommon('columns.date'),
      width: 110,
      valueFormatter: (p: any) => p.value ? new Date(p.value as string).toLocaleDateString() : '—',
    },
  ], [tCommon]);

  const invoiceColumns = useMemo(() => [
      { field: 'invoiceId', headerName: 'ID', hide: true },
      { field: 'invoiceNumber', headerName: tSales('columns.invoiceNumber', { defaultValue: 'Invoice No.' }), width: 180 },
      { field: 'orderNumber', headerName: tSales('columns.orderNumber', { defaultValue: 'Order No.' }), width: 160 },
      { field: 'createdOn', headerName: tSales('columns.date', { defaultValue: 'Date' }), width: 200, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
      { field: 'totalAmount', headerName: tSales('columns.amount', { defaultValue: 'Amount' }), type: 'numericColumn', width: 150,
          valueGetter: (p: any) => p.data?.totalAmount ? parseFloat(p.data.totalAmount) : null,
          valueFormatter: (p: any) => (!p.value || p.value === 0) ? '—' : formatAmount(p.value, p.data?.currencyCode || 'EUR'),
      },
      { 
          field: 'stateCode', 
          headerName: tSales('columns.state', { defaultValue: 'State' }), 
          width: 140,
          cellRenderer: (p: { value: string }) => p.value ? <StateBadge state={p.value as ValidState} /> : null,
      },
  ], [tSales]);



  useEffect(() => {
    apiFetch<Account>(`/api/accounts/${params.id}`)
      .then((data) => {
        setAccount(data);
        setDto(data);
      })
      .catch((err) => reportError(err, 'AccountDetailPage'))
      .finally(() => setLoading(false));
      
    apiFetch<any[]>('/api/gst-categories').then(setGstCategories).catch(console.error);
  }, [params.id]);

  // Auto-save effect
  useEffect(() => {
    if (!isDirty || saving) return;

    const handler = setTimeout(() => {
      handleSave();
    }, 1000);

    return () => clearTimeout(handler);
  }, [dto]);

  const updateField = (field: keyof Account, value: any) => {
    setDto((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);

    try {
      const updated = await apiMutate<Account>(
        `/api/accounts/${params.id}`,
        'PATCH',
        dto,
      );
      setAccount({ ...updated, events: account?.events });
      setDto({ ...updated, events: account?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh to get updated events
      const refreshed = await apiFetch<Account>(`/api/accounts/${params.id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const archiveAccount = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await apiMutate(`/api/accounts/${params.id}/archive`, 'POST');
      toast.success(t('toast.orderArchived'));
      const refreshed = await apiFetch<Account>(`/api/accounts/${params.id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const unarchiveAccount = async () => {
    setSaving(true);
    try {
      await apiMutate(`/api/accounts/${params.id}/unarchive`, 'POST');
      toast.success(t('toast.orderUnarchived'));
      const refreshed = await apiFetch<Account>(`/api/accounts/${params.id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <><div className="p-8">{t('common.loading')}</div></>;
  if (!account) return <><div className="p-8">{t('common.noMatchingResults')}</div></>;

  const isEditable = account.stateCode !== 'archived';

  const visibleSections = [
    {
      id: 'tab-details',
      label: t('accounts.overview', { defaultValue: 'Overview' }),
      isSubPage: true,
      isActive: activeTab === 'details',
      onClick: () => setActiveTab('details'),
      subtargets: [
        { id: 'info-section', label: 'Info', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'pricing-section', label: 'Pricing', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'address-section', label: 'Company', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('address-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'contact-section', label: 'Contact', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'activity-section', label: 'Activity', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ],
    },
    {
      id: 'tab-sales',
      label: t('accounts.orders', { defaultValue: 'Orders' }),
      isSubPage: true,
      isActive: activeTab === 'salesOrders',
      onClick: () => setActiveTab('salesOrders'),
    },
    {
      id: 'tab-invoices',
      label: t('accounts.invoices', { defaultValue: 'Invoices' }),
      isSubPage: true,
      isActive: activeTab === 'invoices',
      onClick: () => setActiveTab('invoices'),
    }
  ];

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={account.name}
            subtitle={account.accountNumber}
            onBack={() => router.push('/accounts')}
            isSaving={saving}
            isDirty={isDirty}
            onSave={handleSave}
            badges={
              <StateBadge state={account.stateCode as ValidState} />
            }
            actions={
              <PageNav sections={visibleSections} />
            }
          />
        }
      >

      {account.stateCode === 'archived' && (
        <div
          className="mb-4 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <strong className="font-semibold text-amber-800">{t('salesOrders.archivedBannerTitle')}</strong> {t('salesOrders.archivedBannerBody')}
          </div>
        </div>
      )}

      {activeTab === 'salesOrders' && (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full p-4 lg:p-6">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/sales-orders?accountId=${encodeURIComponent(params.id)}&limit=50`}
                columns={orderColumns}
                gridKey="account-orders"
                searchPlaceholder={tSales('placeholders.searchOrders')}
                exportFileName={`orders-${account.accountNumber}`}
                fetchAll
                rowIdField="id"
                onRowClicked={handleOrderRowClicked}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {tSales('title')}
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
                      <Link href={`/sales-orders/new?accountId=${params.id}`} className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110">
                        {tSales('buttons.createOrder')}
                      </Link>
                    </div>
                  </div>
                )}
            />
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full p-4 lg:p-6">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/sales-invoices?accountId=${encodeURIComponent(params.id)}&days=0&limit=50`}
                columns={invoiceColumns}
                gridKey="account-invoices"
                fetchAll
                rowIdField="invoiceId"
                onRowClicked={handleInvoiceRowClicked}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {tSales('invoicesCardHeading', { defaultValue: 'Sales Invoices' })}
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
            {/* Basic Info Card */}
            <div id="info-section" className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">info</span>
                {t('accounts.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.name')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('accounts.columns.accountNumber')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={account.accountNumber}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.group')}
                  </label>
                  <GroupSelect
                    type="account"
                    value={dto.accountGroupId || null}
                    onChange={(val) => updateField('accountGroupId', val)}
                    disabled={!isEditable || saving}
                    placeholder="No Account Group"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.gstPosition')}
                  </label>
                  <select
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.gstCategoryId || ''}
                    onChange={(e) => updateField('gstCategoryId', e.target.value)}
                  >
                    <option value="">(None)</option>
                    {gstCategories.map((cat) => (
                      <option key={cat.gstCategoryId} value={cat.gstCategoryId}>
                        {cat.title} ({cat.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.notesCardHeading')}
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    value={dto.notes || ''}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder={t('common.notesCardPlaceholder')}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
            </div>

          {/* Pricing & Currency Card */}
          <div id="pricing-section" className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">payments</span>
              {t('accounts.pricingCurrency')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.currency')}
                </label>
                <select
                  className="input"
                  value={dto.currencyCode}
                  onChange={(e) => updateField('currencyCode', e.target.value)}
                  disabled={!isEditable || saving}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('accounts.columns.discountPct')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="input"
                  value={dto.customerDiscount || '0'}
                  onChange={(e) => updateField('customerDiscount', e.target.value)}
                  disabled={!isEditable || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.state')}
                </label>
                <div
                  className="flex items-center gap-3"
                  style={{ paddingTop: 6, cursor: !isEditable || saving ? 'not-allowed' : 'pointer' }}
                  onClick={() => {
                    if (!isEditable || saving) return;
                    updateField('stateCode', dto.stateCode === 'active' ? 'inactive' : 'active');
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: dto.stateCode === 'active' ? 'var(--accent)' : 'var(--border)',
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
                        left: dto.stateCode === 'active' ? 21 : 3,
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {dto.stateCode ? <StateName state={dto.stateCode as ValidState} /> : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

            {/* Address & Contact Card */}
            <div id="address-section" className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">location_on</span>
                {t('accounts.company')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.email')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.emailAddress1 || ''}
                    onChange={(e) => updateField('emailAddress1', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.phone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.telephone1 || ''}
                    onChange={(e) => updateField('telephone1', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Line1 || ''}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.city')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1City || ''}
                    onChange={(e) => updateField('address1City', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.state')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1StateOrProvince || ''}
                    onChange={(e) => updateField('address1StateOrProvince', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.postalCode')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1PostalCode || ''}
                    onChange={(e) => updateField('address1PostalCode', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.country')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Country || ''}
                    onChange={(e) => updateField('address1Country', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
            </div>


            {/* Contact Card */}
            <div id="contact-section" className="card h-fit">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">person</span>
                {t('common.columns.contact')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactName')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactName || ''}
                    onChange={(e) => updateField('primaryContactName', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactEmail')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.primaryContactEmail || ''}
                    onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactPhone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactPhone || ''}
                    onChange={(e) => updateField('primaryContactPhone', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
            </div>

          <div id="activity-section" className="card">
            <ActivityTimeline events={account.events || []} />
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-end mt-4">
              {account.stateCode === 'archived' ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={unarchiveAccount}
                  disabled={saving}
                >
                  {t('salesOrders.buttons.unarchive')}
                </button>
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={archiveAccount}
                  disabled={saving}
                >
                  {t('salesOrders.buttons.archive')}
                </button>
              )}
            </div>
        </div>
      )}
      </DetailsLayout>
    </>
  );
}
