'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import DataGrid from '@/components/DataGrid';
import AddSupplierModal from '@/components/products/AddSupplierModal';
import GroupSelect from '@/components/shared/GroupSelect';

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
  const [activeTab, setActiveTab] = useState<'details' | 'suppliers' | 'inventory'>('details');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [refreshGrid, setRefreshGrid] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [gstCategories, setGstCategories] = useState<any[]>([]);
  const [uomDictionary, setUomDictionary] = useState<{ uomCode: string; description: string }[]>([]);
  const [addingUom, setAddingUom] = useState(false);
  const [newUomCode, setNewUomCode] = useState('');
  const [newUomRatio, setNewUomRatio] = useState('1');
  const [dto, setDto] = useState<any>({
    name: '',
    barcode: '',
    listPrice: '0',
    standardCost: '0',
    tradePrice: '0',
    priceLevel3: '0',
    priceLevel4: '0',
    gstCategoryId: '',
    scNumber: '',
    notes: '',
    stateCode: 'active',
    productGroupId: null,
  });

  useDocumentTitle(product ? (product.name ? `${product.productNumber} - ${product.name}` : product.productNumber) : null);

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
        gstCategoryId: data.gstCategoryId || '',
        scNumber: data.scNumber || '',
        notes: data.notes || '',
        stateCode: data.stateCode || 'active',
        productGroupId: data.productGroupId || null,
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
    apiFetch<{ uomCode: string; description: string }[]>('/api/settings/uom-dictionary').then(setUomDictionary).catch(console.error);
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

  const unarchiveSupplier = async (vendorId: string) => {
      // Re-linking a previously removed supplier is handled seamlessly by adding them again via the modal upsert!
  };

  const removeSupplier = async (vendorId: string, vendorName: string) => {
    if (!window.confirm(`Are you sure you want to unlink ${vendorName} from this product?`)) return;
    try {
      await apiMutate(`/api/products/${id}/suppliers/${vendorId}`, 'DELETE');
      toast.success('Supplier successfully unlinked');
      setRefreshGrid(prev => prev + 1);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const supplierColumns: any[] = useMemo(() => [
    { field: 'vendorName', headerName: tCommon('columns.name'), flex: 1, minWidth: 160 },
    { field: 'vendorNumber', headerName: 'Number', width: 140 },
    { field: 'supplierPartNumber', headerName: 'Part No.', width: 140 },
    { field: 'costPrice', headerName: 'Cost Price', type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    { field: 'discountPercent', headerName: 'Discount %', type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value)}%` : '—' },
    { field: 'stateCode', headerName: tCommon('columns.status'), width: 110, cellRenderer: (p: { value: string }) => p.value ? <StateBadge state={p.value as ValidState} /> : null },
    {
      headerName: '',
      field: 'vendorId',
      width: 70,
      suppressMenu: true,
      sortable: false,
      onCellClicked: (p: any) => p.event?.stopPropagation(), // prevent triggering row click
      cellRenderer: (p: { value: string, data: any }) => (
        <button 
          onClick={(e) => { e.stopPropagation(); removeSupplier(p.value, p.data.vendorName); }}
          className="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 px-2 h-7 min-h-7"
          title="Unlink Supplier"
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined text-[16px]">link_off</span>
        </button>
      )
    }
  ], [tCommon, t]);

  const inventoryColumns: any[] = useMemo(() => [
    { field: 'locationNo', headerName: 'Location No.', width: 140 },
    { field: 'locationName', headerName: 'Location', flex: 1, minWidth: 160 },
    { field: 'quantityOnHand', headerName: 'On Hand', type: 'numericColumn', width: 120 },
    { field: 'quantityCommitted', headerName: 'Committed', type: 'numericColumn', width: 120 },
    { field: 'quantityAvailable', headerName: 'Available', type: 'numericColumn', width: 120 },
    { field: 'quantityOnOrder', headerName: 'On Order', type: 'numericColumn', width: 120 },
  ], []);

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
        { id: 'uom-section', label: 'Units', onClick: () => { setActiveTab('details'); setTimeout(() => document.getElementById('uom-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
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
    },
    {
      id: 'tab-inventory',
      label: 'Inventory',
      isSubPage: true,
      isActive: activeTab === 'inventory',
      onClick: () => setActiveTab('inventory'),
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
        <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
              <DataGrid 
                endpoint={`/api/suppliers/by-product/${encodeURIComponent(id as string)}?r=${refreshGrid}`}
                columns={supplierColumns}
                gridKey={`product-suppliers-grid`}
                fetchAll
                rowIdField="vendorId"
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
                      <button 
                        className="btn btn-sm btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm flex items-center gap-1.5"
                        onClick={() => setIsAddSupplierOpen(true)}
                        disabled={!isEditable}
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        <span className="material-symbols-outlined text-[16px]">add_link</span>
                        Link Supplier
                      </button>
                    </div>
                  </div>
                )}
            />
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
              <DataGrid 
                endpoint={`/api/inventory/by-products?productIds=${encodeURIComponent(id as string)}`}
                columns={inventoryColumns}
                gridKey={`product-inventory-grid`}
                fetchAll
                rowIdField="locationId"
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Inventory Levels
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
              {/* eslint-disable-next-line i18next/no-literal-string */}
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
              <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Type
                  </label>
                  <select
                    className="input"
                    value={product.productType || 'inventory'}
                    onChange={(e) => handleSelectChange('productType', e.target.value)}
                    disabled={!isEditable}
                  >
                    <option value="inventory">Inventory (Tracked)</option>
                    <option value="non-stock">Non-Stock</option>
                    <option value="service">Service</option>
                  </select>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Product Group
                  </label>
                  <GroupSelect
                    type="product"
                    value={dto.productGroupId}
                    onChange={(val) => handleSelectChange('productGroupId', val)}
                    disabled={!isEditable || saving}
                    placeholder="No Product Group"
                  />
                </div>
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
                    value={dto.gstCategoryId || ''}
                    onChange={(e) => handleSelectChange('gstCategoryId', e.target.value)}
                  >
                    <option value="">(None)</option>
                    {gstCategories.map((cat) => (
                      <option key={cat.gstCategoryId} value={cat.gstCategoryId}>
                        {cat.title} ({cat.code})
                      </option>
                    ))}
                    {/* Fallback for legacy values not in current categories */}
                    {dto.gstCategoryId && !gstCategories.find(c => c.gstCategoryId === dto.gstCategoryId) && (
                      <option value={dto.gstCategoryId}>Unknown Category ({dto.gstCategoryId})</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div id="pricing-section" className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
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

        {/* Units & Dimensions Card */}
        <div id="uom-section" className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">straighten</span>
            Units of Measure
          </h3>

          {/* Default UoM selectors */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Base UoM
              </label>
              <select
                className="input"
                disabled={!isEditable || saving}
                value={product.baseUom || 'EA'}
                onChange={(e) => handleSelectChange('baseUom', e.target.value)}
              >
                {uomDictionary.map((u) => (
                  <option key={u.uomCode} value={u.uomCode}>
                    {u.uomCode}{u.description ? ` — ${u.description}` : ''}
                  </option>
                ))}
                {/* Fallback if current value isn't in dictionary yet */}
                {product.baseUom && !uomDictionary.find(u => u.uomCode === product.baseUom) && (
                  <option value={product.baseUom}>{product.baseUom}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Default Sales UoM
              </label>
              <select
                className="input"
                disabled={!isEditable || saving}
                value={product.defaultSalesUomId || ''}
                onChange={(e) => handleSelectChange('defaultSalesUomId', e.target.value || null)}
              >
                <option value="">(Base: {product.baseUom || 'EA'})</option>
                {(product.productUoms || []).map((u: any) => (
                  <option key={u.productUomId} value={u.productUomId}>
                    {u.uomCode} (×{u.ratio})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Default Purchase UoM
              </label>
              <select
                className="input"
                disabled={!isEditable || saving}
                value={product.defaultPurchaseUomId || ''}
                onChange={(e) => handleSelectChange('defaultPurchaseUomId', e.target.value || null)}
              >
                <option value="">(Base: {product.baseUom || 'EA'})</option>
                {(product.productUoms || []).map((u: any) => (
                  <option key={u.productUomId} value={u.productUomId}>
                    {u.uomCode} (×{u.ratio})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversions table */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Packaging Conversions</span>
              {isEditable && (
                <button
                  className="btn btn-sm btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm flex items-center gap-1.5"
                  style={{ fontSize: 12 }}
                  onClick={() => setAddingUom(true)}
                  disabled={saving}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Add Conversion
                </button>
              )}
            </div>

            {/* Add row */}
            {addingUom && (
              <div className="flex items-end gap-3 mb-3 p-3 rounded-lg" style={{ background: 'rgba(0,107,92,0.04)', border: '1px solid rgba(0,107,92,0.15)' }}>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>UoM Code</label>
                  <select
                    className="input"
                    value={newUomCode}
                    onChange={(e) => setNewUomCode(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {uomDictionary
                      .filter(u => u.uomCode !== (product.baseUom || 'EA'))
                      .filter(u => !(product.productUoms || []).some((pu: any) => pu.uomCode === u.uomCode))
                      .map((u) => (
                        <option key={u.uomCode} value={u.uomCode}>
                          {u.uomCode}{u.description ? ` — ${u.description}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ width: 120 }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ratio</label>
                  <input
                    className="input"
                    type="number"
                    min="0.000001"
                    step="any"
                    value={newUomRatio}
                    onChange={(e) => setNewUomRatio(e.target.value)}
                    style={{ textAlign: 'right' }}
                  />
                </div>
                <button
                  className="btn btn-sm btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white"
                  disabled={!newUomCode || !newUomRatio || saving}
                  onClick={async () => {
                    try {
                      await apiMutate(`/api/products/${id}/uoms`, 'POST', {
                        uomCode: newUomCode,
                        ratio: newUomRatio,
                      });
                      toast.success('Conversion added');
                      setAddingUom(false);
                      setNewUomCode('');
                      setNewUomRatio('1');
                      await fetchProduct(false);
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                >
                  Save
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setAddingUom(false); setNewUomCode(''); setNewUomRatio('1'); }}
                >
                  Cancel
                </button>
              </div>
            )}

            {(product.productUoms || []).length === 0 && !addingUom ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                No alternate packaging conversions configured.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>UoM Code</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ratio (× Base)</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Barcode</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(product.productUoms || []).map((u: any) => (
                    <tr key={u.productUomId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.uomCode}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.ratio}</td>
                      <td style={{ padding: '10px 12px', color: u.barcode ? 'inherit' : 'var(--text-muted)' }}>{u.barcode || '—'}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                        {isEditable && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Remove ${u.uomCode} conversion?`)) return;
                              try {
                                await apiMutate(`/api/products/${id}/uoms/${u.productUomId}`, 'DELETE');
                                toast.success('Conversion removed');
                                await fetchProduct(false);
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }}
                            className="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 px-2 h-7 min-h-7"
                            title="Remove conversion"
                          >
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Notes Card - full width */}
        <div id="notes-section" className="card">
          <h3 className="section-heading">
             {/* eslint-disable-next-line i18next/no-literal-string */}
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
      <AddSupplierModal 
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        productId={id as string}
        productName={product?.name || ''}
        productNumber={product?.productNumber || ''}
        onSuccess={() => setRefreshGrid(prev => prev + 1)}
      />
    </>
  );
}
