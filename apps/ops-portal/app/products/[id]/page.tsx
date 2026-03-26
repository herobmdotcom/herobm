'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import DataGrid from '@/components/DataGrid';

const formatMoney = (val: string | number | undefined | null) => {
  if (!val) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
};

export default function ProductDetailPage() {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'suppliers'>('details');
  const [product, setProduct] = useState<any>(null);
  const [gstCategories, setGstCategories] = useState<any[]>([]);
  const [dto, setDto] = useState<any>({
    name: '',
    barcode: '',
    listPrice: '0',
    standardCost: '0',
    tradePrice: '0',
    priceLevel3: '0',
    priceLevel4: '0',
    gstCategory: '',
    scNumber: '',
    notes: '',
    stateCode: 'active',
  });

  const fetchProduct = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/products/${id}`);
      setProduct(data);
      setDto({
        name: data.name || '',
        barcode: data.barcode || '',
        listPrice: formatMoney(data.listPrice),
        standardCost: formatMoney(data.standardCost),
        tradePrice: formatMoney(data.tradePrice),
        priceLevel3: formatMoney(data.priceLevel3),
        priceLevel4: formatMoney(data.priceLevel4),
        gstCategory: data.gstCategory || '',
        scNumber: data.scNumber || '',
        notes: data.notes || '',
        stateCode: data.stateCode || 'active',
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
    apiFetch<any[]>('/api/gst-categories').then(setGstCategories).catch(console.error);
  }, [fetchProduct]);

  const saveProduct = async (updatedValues: any) => {
    if (saving) return;
    setSaving(true);

    try {
      await apiMutate(`/api/products/${id}`, 'PATCH', updatedValues);
      await fetchProduct(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = (field: string, value: any) => {
    if (product[field] === value) return;
    saveProduct({ [field]: value });
  };

  const handleSelectChange = (field: string, value: any) => {
    if (product[field] === value) return;
    setDto((prev: any) => ({ ...prev, [field]: value }));
    saveProduct({ [field]: value });
  };

  const archiveProduct = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await apiMutate(`/api/products/${id}/archive`, 'POST');
      toast.success(t('toast.productUpdated'));
      await fetchProduct(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const unarchiveProduct = async () => {
    setSaving(true);
    try {
      await apiMutate(`/api/products/${id}/unarchive`, 'POST');
      toast.success(t('toast.productUpdated'));
      await fetchProduct(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const supplierColumns: any[] = useMemo(() => [
    { field: 'vendorName', headerName: tCommon('columns.name'), flex: 1, minWidth: 160 },
    { field: 'vendorNumber', headerName: 'Number', width: 140 },
    { field: 'supplierPartNumber', headerName: 'Part No.', width: 140 },
    { field: 'costPrice', headerName: 'Cost Price', type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'discountPercent', headerName: 'Discount %', type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value)}%` : '—' },
    { field: 'stateCode', headerName: tCommon('columns.status'), width: 110, cellRenderer: (p: { value: string }) => p.value ? <StateBadge state={p.value as ValidState} /> : null },
  ], [tCommon, t]);

  if (loading) return <><div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div></>;
  if (!product) return <><div className="text-center py-20">{t('common.noMatchingResults')}</div></>;

  const isEditable = product.stateCode !== 'archived';

  const visibleSections = [
    {
      id: 'tab-details',
      label: 'Overview',
      isSubPage: true,
      isActive: activeTab === 'details',
      onClick: () => setActiveTab('details'),
      subtargets: [
        { id: 'info-section', label: 'Info', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'pricing-section', label: 'Pricing', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'notes-section', label: 'Notes', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'activity-section', label: 'Activity', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ],
    },
    {
      id: 'tab-suppliers',
      label: 'Suppliers',
      isSubPage: true,
      isActive: activeTab === 'suppliers',
      onClick: () => setActiveTab('suppliers'),
    }
  ];

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
        title={product.productNumber}
        subtitle={product.name}
        onBack={() => router.push('/products')}
        isSaving={saving}
        badges={
          <>
            {product.stateCode && <StateBadge state={product.stateCode as ValidState} />}
          </>
        }
        actions={
          <>
            <PageNav sections={visibleSections} />
          </>
        }
      />
    }
  >

      {product.stateCode === 'archived' && (
        <div
          className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <strong className="font-semibold text-amber-800">{t('salesOrders.archivedBannerTitle')}</strong> {t('salesOrders.archivedBannerBody')}
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div style={{ height: 'calc(100vh - 260px)', minHeight: 400 }} className="pb-6">
          <div className="h-full flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid 
                endpoint={`/api/suppliers/by-product/${encodeURIComponent(id as string)}`}
                columns={supplierColumns}
                gridKey="product-suppliers"
                fetchAll
                onRowClicked={(row: any) => router.push(`/suppliers/${row.vendorId}`)}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Suppliers
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Product Information Card */}
          <div id="info-section" className="card">
            <h3 className="section-heading">
              <span className="material-symbols-outlined">info</span>
              {t('products.generalInfo')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.productName')}
                </label>
                <input
                  className="input"
                  required
                  disabled={!isEditable || saving}
                  value={dto.name}
                  onChange={(e) => setDto({ ...dto, name: e.target.value })}
                  onBlur={(e) => handleBlur('name', e.target.value)}
                  placeholder="Product display name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.barcode')}
                  </label>
                  <input
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.barcode}
                    onChange={(e) => setDto({ ...dto, barcode: e.target.value })}
                    onBlur={(e) => handleBlur('barcode', e.target.value)}
                    placeholder={t('products.placeholders.barcode')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Status
                  </label>
                  <select
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.stateCode}
                    onChange={(e) => handleSelectChange('stateCode', e.target.value)}
                  >
                    <option value="active">{t('common.states.active')}</option>
                    <option value="inactive">{t('common.states.inactive')}</option>
                    <option value="discontinued">{t('common.states.discontinued')}</option>
                  </select>
                </div>
              </div>
              {product.productGroupName && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.productGroup')}
                  </label>
                  <input className="input" disabled value={product.productGroupName} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    SC Number
                  </label>
                  <input
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.scNumber}
                    onChange={(e) => setDto({ ...dto, scNumber: e.target.value })}
                    onBlur={(e) => handleBlur('scNumber', e.target.value)}
                    placeholder="SC Number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.gstCategory')}
                  </label>
                  <select
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.gstCategory}
                    onChange={(e) => handleSelectChange('gstCategory', e.target.value)}
                  >
                    <option value="">(None)</option>
                    {gstCategories.map((cat) => (
                      <option key={cat.gstCategoryId} value={cat.code}>
                        {cat.title} ({cat.code})
                      </option>
                    ))}
                    {/* Fallback for legacy values not in current categories */}
                    {dto.gstCategory && !gstCategories.find(c => c.code === dto.gstCategory) && (
                      <option value={dto.gstCategory}>{dto.gstCategory}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div id="pricing-section" className="card">
            <h3 className="section-heading">
              <span className="material-symbols-outlined">payments</span>
              {t('products.pricing')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.listPrice')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"

                  disabled={!isEditable || saving}
                  value={dto.listPrice}
                  onChange={(e) => setDto({ ...dto, listPrice: e.target.value })}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    setDto({ ...dto, listPrice: formatted });
                    handleBlur('listPrice', formatted);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.tradePrice')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"

                  disabled={!isEditable || saving}
                  value={dto.tradePrice}
                  onChange={(e) => setDto({ ...dto, tradePrice: e.target.value })}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    setDto({ ...dto, tradePrice: formatted });
                    handleBlur('tradePrice', formatted);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.priceLevel3')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"

                  disabled={!isEditable || saving}
                  value={dto.priceLevel3}
                  onChange={(e) => setDto({ ...dto, priceLevel3: e.target.value })}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    setDto({ ...dto, priceLevel3: formatted });
                    handleBlur('priceLevel3', formatted);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.priceLevel4')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"

                  disabled={!isEditable || saving}
                  value={dto.priceLevel4}
                  onChange={(e) => setDto({ ...dto, priceLevel4: e.target.value })}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    setDto({ ...dto, priceLevel4: formatted });
                    handleBlur('priceLevel4', formatted);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.stdCost')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"

                  disabled={!isEditable || saving}
                  value={dto.standardCost}
                  onChange={(e) => setDto({ ...dto, standardCost: e.target.value })}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    setDto({ ...dto, standardCost: formatted });
                    handleBlur('standardCost', formatted);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes Card - full width */}
        <div id="notes-section" className="card">
          <h3 className="section-heading">
             <span className="material-symbols-outlined">notes</span>
            {t('common.notesCardHeading')}
          </h3>
          <textarea
            className="input w-full"
            style={{ height: 110, paddingTop: 12 }}
            disabled={!isEditable || saving}
            value={dto.notes}
            onChange={(e) => setDto({ ...dto, notes: e.target.value })}
            onBlur={(e) => handleBlur('notes', e.target.value)}
            placeholder={t('products.placeholders.notes')}
          />
        </div>

        {/* Activity Timeline */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={product.events || []} />
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end mt-4">
            {product.stateCode === 'archived' ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={unarchiveProduct}
                disabled={saving}
              >
                {t('salesOrders.buttons.unarchive')}
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                onClick={archiveProduct}
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
