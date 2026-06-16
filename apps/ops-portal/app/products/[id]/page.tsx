'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import DataGrid from '@/components/DataGrid';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import AddSupplierModal from '@/components/products/AddSupplierModal';
import GroupSelect from '@/components/shared/GroupSelect';
import { formatLocationDisplay } from '@/lib/formatters';
import { PRODUCT_STATE } from '@herobm/shared';
import { ProductKitComponentsTab } from './ProductKitComponentsTab';
import { getErrorMessage } from '@herobm/shared';
const formatMoney = (val: string | number | undefined | null) => {
  if (!val) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
};

const formatInt = (val: string | number | undefined | null) => {
  if (!val) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toString();
};

export interface KitComponent extends api.ProductResponseDto {
  childProductId: string;
  parentQuantity: number;
}

export default function ProductDetailPage() {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'suppliers' | 'inventory' | 'kit'>('details');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [refreshGrid, setRefreshGrid] = useState(0);
  const [product, setProduct] = useState<api.ProductResponseDto | null>(null);
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [uomDictionary, setUomDictionary] = useState<{ uomCode: string; description: string }[]>([]);
  const [addingUom, setAddingUom] = useState(false);

  // Storage Strategy State
  const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
  const [addingBinLink, setAddingBinLink] = useState(false);
  const [newBinLink, setNewBinLink] = useState({ locationId: '', binId: '', isPrimaryPerLocation: true, minQty: '', maxQty: '' });
  const [editingBinId, setEditingBinId] = useState<string | null>(null);
  const [editingBinData, setEditingBinData] = useState({ locationId: '', binId: '', isPrimaryPerLocation: true, minQty: '', maxQty: '' });
  const [availableBins, setAvailableBins] = useState<Record<string, unknown>[]>([]);
  const [inventoryLevels, setInventoryLevels] = useState<api.InventoryResponseDto[]>([]);
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);

  const buildableQuantity = useMemo(() => {
    if (product?.structureType !== 'kit' || !kitComponents.length || !inventoryLevels.length) return null;
    const inventoryByProduct = inventoryLevels.reduce((acc, lvl) => {
      acc[lvl.productId] = (acc[lvl.productId] || 0) + (parseFloat(lvl.quantityAvailable as string) || 0);
      return acc;
    }, {} as Record<string, number>);

    const maxBuildable = kitComponents.map(c => {
      const available = inventoryByProduct[c.childProductId] || 0;
      return Math.floor(available / (c.parentQuantity || 1));
    });
    return Math.min(...maxBuildable);
  }, [product, kitComponents, inventoryLevels]);

  const [dto, setDto] = useState<Partial<api.ProductResponseDto>>({
    productNumber: '',
    name: '',
    barcode: '',
    listPrice: '0',
    standardCost: '0',
    tradePrice: '0',
    priceLevel3: '0',
    priceLevel4: '0',
    purchaseTaxCategoryId: '',
    salesTaxCategoryId: '',
    externalTaxCode: '',
    alternateProductNumber: '',
    notes: '',
    stateCode: PRODUCT_STATE.ACTIVE,
    productGroupId: null,
  });

  useDocumentTitle(product ? (product.name ? `${product.productNumber} - ${product.name}` : product.productNumber) : null);

  const fetchProduct = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const dataRes = await api.productsControllerFindOne(id as string);
      const data = dataRes.data;
      setProduct(data);
      setDto({
        productNumber: data.productNumber || '',
        name: data.name || '',
        barcode: data.barcode || '',
        listPrice: formatMoney(data.listPrice),
        standardCost: formatMoney(data.standardCost),
        tradePrice: formatMoney(data.tradePrice),
        priceLevel3: formatMoney(data.priceLevel3),
        priceLevel4: formatMoney(data.priceLevel4),
        purchaseTaxCategoryId: data.purchaseTaxCategoryId || '',
        salesTaxCategoryId: data.salesTaxCategoryId || '',
        externalTaxCode: data.externalTaxCode || '',
        alternateProductNumber: data.alternateProductNumber || '',
        notes: data.notes || '',
        stateCode: data.stateCode || PRODUCT_STATE.ACTIVE,
        productGroupId: data.productGroupId || null,
      });

      let productIdsToFetch: string[] = [id as string];
      if (data.structureType === 'kit') {
        try {
          const componentsData = await api.productsControllerGetComponents(id as string);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
          const comps: any = (componentsData.data as any).data || componentsData.data;
          if (comps?.length) {
            setKitComponents(comps);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
            productIdsToFetch = [id as string, ...comps.map((c: any) => c.childProductId).filter(Boolean)];
          }
        } catch (e) {
          reportError(e, 'ProductDetailPage');
        }
      } else {
        setKitComponents([]);
      }

      const invDataRes = await api.inventoryControllerFindByProductIdsBulk({ productIds: productIdsToFetch });
      setInventoryLevels(invDataRes?.data || []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
    api.taxCategoriesControllerFindAll().then((res) => setTaxCategories(res.data)).catch((err) => reportError(err, 'ProductDetailPage'));
    api.uomDictionaryControllerFindAll().then((res) => setUomDictionary(res.data)).catch((err) => reportError(err, 'ProductDetailPage'));
    api.inventoryControllerFindAllLocations({ productId: id as string }).then((res) => setLocations((res.data) || [])).catch((err) => reportError(err, 'ProductDetailPage'));
  }, [fetchProduct, id]);

  useEffect(() => {
    if (!newBinLink.locationId) {
      setAvailableBins([]);
      return;
    }
    const loc = locations.find(l => l.locationId === newBinLink.locationId);
    if (!loc) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    const bins = ((loc as any).zones || []).flatMap((z: any) => z.bins || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    bins.sort((a: any, b: any) => (a.binNumber || '').localeCompare(b.binNumber || ''));
    
    setAvailableBins(bins);
  }, [newBinLink.locationId, locations]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
  const saveProduct = async (updatedValues: any) => {
    if (saving) return;
    setSaving(true);

    try {
      await api.productsControllerUpdate(id as string, updatedValues);
      await fetchProduct(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
  const handleBlur = (field: string, value: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    if (product && (product as any)[field] === value) return;
    saveProduct({ [field]: value });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
  const handleSelectChange = (field: string, value: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    if (product && (product as any)[field] === value) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    const payload: any = { [field]: value };
    if (field === 'structureType' && value === 'kit') {
      payload.productType = 'non-stock';
    }

    setDto((prev: unknown) => ({ ...(prev as Record<string, unknown>), ...payload }));
    saveProduct(payload);
  };

  const archiveProduct = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await api.productsControllerArchive(id as string, {});
      toast.success(t('toast.productUpdated'));
      await fetchProduct(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveProduct = async () => {
    setSaving(true);
    try {
      await api.productsControllerUnarchive(id as string, {});
      toast.success(t('toast.productUpdated'));
      await fetchProduct(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveSupplier = async (vendorId: string) => {
      // Re-linking a previously removed supplier is handled seamlessly by adding them again via the modal upsert!
  };

  const removeSupplier = async (vendorId: string, vendorName: string) => {
    if (!window.confirm(t('suppliers.confirmUnlink', { name: vendorName }))) return;
    try {
      await api.productsControllerRemoveSupplier(id as string, vendorId);
      toast.success(t('suppliers.toast.unlinked'));
      setRefreshGrid(prev => prev + 1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
  const supplierColumns: any[] = useMemo(() => [
    { field: 'vendorName', headerName: tCommon('columns.name'), flex: 1, minWidth: 160 },
    { field: 'vendorNumber', headerName: tCommon('columns.number'), width: 140 },
    { field: 'supplierPartNumber', headerName: t('products.supplierModal.inputs.supplierPartNo'), width: 140 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    { field: 'costPrice', headerName: t('products.supplierModal.inputs.costPrice'), type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    { field: 'discountPercent', headerName: tCommon('columns.discountPct'), type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value)}%` : '—' },
    { 
      field: 'stateCode', 
      headerName: tCommon('columns.status'), 
      width: 110, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const s = String(p.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(p.value);
      } 
    },
    {
      headerName: '',
      field: 'vendorId',
      width: 70,
      suppressMenu: true,
      sortable: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      onCellClicked: (p: any) => p.event?.stopPropagation(), // prevent triggering row click
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      cellRenderer: (p: { value: string, data: any }) => (
        <button 
          onClick={(e) => { e.stopPropagation(); removeSupplier(p.value, p.data.vendorName); }}
          className="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 px-2 h-7 min-h-7"
          title={t('suppliers.buttons.unlinkSupplier')}
        >
          {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
          <span className="material-symbols-outlined text-[16px]">link_off</span>
        </button>
      )
    }
  ], [tCommon, t]);
  const unifiedInventory = useMemo(() => {
    if (!product || !inventoryLevels) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    const locMap = new Map<string, any>();

    inventoryLevels.forEach(lvl => {
      const loc = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        locationId: (lvl as any).locationId,
        locationNo: lvl.locationNo,
        locationName: lvl.locationName,
        quantityOnHand: lvl.quantityOnHand || 0,
        quantityCommitted: lvl.quantityCommitted || 0,
        quantityAvailable: lvl.quantityAvailable || 0,
        quantityOnOrder: lvl.quantityOnOrder || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        bins: new Map<string, any>()
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      ((lvl as any).binBalances || []).forEach((b: any) => {
        loc.bins.set(b.binId, { ...b, isDefault: false });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      locMap.set((lvl as any).locationId, loc);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    ((product as any).defaultBins || []).forEach((db: any) => {
      let loc = locMap.get(db.locationId);
      if (!loc) {
        loc = {
          locationId: db.locationId,
          locationNo: db.locationNo || 'Unknown',
          locationName: db.locationName || 'Unknown Location',
          quantityOnHand: 0,
          quantityCommitted: 0,
          quantityAvailable: 0,
          quantityOnOrder: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
          bins: new Map<string, any>()
        };
        locMap.set(db.locationId, loc);
      }
      
      let bin = loc.bins.get(db.binId);
      if (!bin) {
        bin = {
          binId: db.binId,
          binNumber: db.binNumber,
          quantityOnHand: db.quantityOnHand || 0,
        };
        loc.bins.set(db.binId, bin);
      }
      bin.isDefault = true;
      bin.isPrimary = db.isPrimaryPerLocation;
      bin.productDefaultBinId = db.productDefaultBinId;
    });

    return Array.from(locMap.values())
      .map(loc => ({
        ...loc,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        bins: Array.from(loc.bins.values()).sort((a: any, b: any) => {
          if (a.isPrimary) return -1;
          if (b.isPrimary) return 1;
          return (a.binNumber || '').localeCompare(b.binNumber || '');
        })
      }))
      .sort((a, b) => a.locationNo?.localeCompare(b.locationNo));

  }, [inventoryLevels, product]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
  const inventoryColumns: any[] = useMemo(() => [
    { field: 'locationNo', headerName: tCommon('columns.locationNo'), width: 140 },
    { field: 'locationName', headerName: tCommon('columns.location'), flex: 1, minWidth: 160 },
    { field: 'bins', headerName: t('products.storage.columns.bin'), flex: 1, minWidth: 120 },
    { field: 'quantityOnHand', headerName: t('products.columns.quantityOnHand'), type: 'numericColumn', width: 120 },
    { field: 'quantityCommitted', headerName: t('inventory.columns.committed'), type: 'numericColumn', width: 120 },
    { field: 'quantityAvailable', headerName: t('inventory.columns.available'), type: 'numericColumn', width: 120 },
    { field: 'quantityOnOrder', headerName: t('inventory.columns.onOrder'), type: 'numericColumn', width: 120 },
  ], []);

  if (loading) return <><div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div></>;
  if (!product) return <><div className="text-center py-20">{t('common.noMatchingResults')}</div></>;

  const isEditable = product.stateCode !== PRODUCT_STATE.ARCHIVED;

  const visibleSections = [
    {
      id: 'tab-details',
      label: tCommon('tabs.overview'),
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
      label: tCommon('tabs.suppliers'),
      isSubPage: true,
      isActive: activeTab === 'suppliers',
      onClick: () => setActiveTab('suppliers'),
    },
    {
      id: 'tab-inventory',
      label: tCommon('tabs.inventory'),
      isSubPage: true,
      isActive: activeTab === 'inventory',
      onClick: () => setActiveTab('inventory'),
    },
    ...(product.structureType === 'kit' ? [{
      id: 'tab-kit',
      label: t('products.tabs.kitComponents'),
      isSubPage: true,
      isActive: activeTab === 'kit',
      onClick: () => setActiveTab('kit'),
    }] : [])
  ];

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
        title={product.productNumber}
        subtitle={product.name}
        onBack={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/products');
          }
        }}
        isSaving={saving}
        badges={
          <>
            {product.stateCode && <StateBadge state={product.stateCode as ValidState} />}
          </>
        }
        nav={<PageNav sections={visibleSections} />}
      />
    }
  >

      {product.stateCode === PRODUCT_STATE.ARCHIVED && (
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

      {activeTab === 'kit' && (
        <ProductKitComponentsTab productId={id as string} isEditable={isEditable} />
      )}

      {activeTab === 'suppliers' && (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
              <DataGrid 
                endpoint={`/api/suppliers/by-product/${encodeURIComponent(id as string)}?r=${refreshGrid}`}
                columns={supplierColumns}
                gridKey={`product-suppliers-grid`}
                urlPrefix="suppliers"
                fetchAll
                rowIdField="vendorId"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
                onRowClicked={(row: any) => router.push(`/suppliers/${row.vendorId}`)}
                renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {tCommon('tabs.suppliers')}
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
                        {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
                        <span className="material-symbols-outlined text-[16px]">add_link</span>
                        {t('products.supplierModal.title')}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(196,198,205,0.4)]">
              <div className="flex items-center gap-4 flex-1">
                <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('products.inventoryLevels')}
                  {buildableQuantity !== null && (
                    <span className="ml-3 badge badge-success text-[13px] font-bold">
                      {t('products.availableToAssemble', { quantity: buildableQuantity })}
                    </span>
                  )}
                </h2>
              </div>
              {!addingBinLink && isEditable && product?.productType !== 'non-stock' && (
                <button
                  className="btn btn-sm btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm flex items-center gap-1.5"
                  style={{ fontSize: 13 }}
                  onClick={() => setAddingBinLink(true)}
                  disabled={saving}
                >
                  {t('products.storage.addBinLink')}
                </button>
              )}
            </div>

            {addingBinLink && (
              <div className="flex flex-wrap items-end gap-3 p-5 border-b border-gray-100 bg-white">
                <div style={{ flex: '1 1 200px' }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{t('products.storage.columns.location')}</label>
                  <select
                    className="input w-full"
                    value={newBinLink.locationId}
                    onChange={(e) => setNewBinLink({ ...newBinLink, locationId: e.target.value, binId: '' })}
                  >
                    <option value="">{t('common.selectEllipsis')}</option>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                    {locations.map((loc: any) => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {formatLocationDisplay(loc)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{t('products.storage.columns.bin')}</label>
                  <select
                    className="input w-full"
                    disabled={!newBinLink.locationId}
                    value={newBinLink.binId}
                    onChange={(e) => setNewBinLink({ ...newBinLink, binId: e.target.value })}
                  >
                    <option value="">{t('common.selectEllipsis')}</option>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                    {availableBins.map((b: any) => (
                      <option key={b.binId} value={b.binId}>
                        {b.binNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 90 }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{t('products.storage.columns.minQty')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={newBinLink.minQty}
                    onChange={(e) => setNewBinLink({ ...newBinLink, minQty: e.target.value })}
                    style={{ textAlign: 'right' }}
                  />
                </div>
                <div style={{ width: 90 }}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{t('products.storage.columns.maxQty')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={newBinLink.maxQty}
                    onChange={(e) => setNewBinLink({ ...newBinLink, maxQty: e.target.value })}
                    style={{ textAlign: 'right' }}
                  />
                </div>
                <div style={{ width: 80 }}>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{t('products.storage.columns.primary')}</label>
                  <label className="switch mt-1">
                    <input 
                      type="checkbox" 
                      checked={newBinLink.isPrimaryPerLocation}
                      onChange={(e) => setNewBinLink({ ...newBinLink, isPrimaryPerLocation: e.target.checked })}
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>
                
                <div className="flex gap-2.5">
                  <button
                    className="btn btn-ghost hover:bg-gray-100 text-gray-700 font-semibold px-5"
                    onClick={() => {
                      setAddingBinLink(false);
                      setNewBinLink({ locationId: '', binId: '', isPrimaryPerLocation: true, minQty: '', maxQty: '' });
                    }}
                  >
                    {tCommon('buttons.cancel')}
                  </button>
                  <button
                    className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm font-semibold px-5"
                    disabled={!newBinLink.locationId || !newBinLink.binId || saving}
                    onClick={async () => {
                      try {
                        await api.productsControllerLinkDefaultBin(id as string, newBinLink);
                        toast.success(t('products.storage.toastLinkAdded'));
                        setAddingBinLink(false);
                        setNewBinLink({ locationId: '', binId: '', isPrimaryPerLocation: true, minQty: '', maxQty: '' });
                        await fetchProduct(false);
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err));
                      }
                    }}
                  >
                    {tCommon('buttons.save')}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-auto flex-1">
              <table className="w-full text-left" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                <thead className="bg-[#f9fafb] sticky top-0 z-10">
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="py-2 px-6 font-bold text-[#64748b] text-[11px] uppercase tracking-wider">{tCommon('columns.location')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider">{t('products.storage.columns.bin')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.storage.columns.minQty')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.storage.columns.maxQty')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.columns.quantityOnHand')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.committed')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.available')}</th>
                    <th className="py-2 px-4 font-bold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.onOrder')}</th>
                    <th style={{ width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {unifiedInventory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#64748b] text-sm">{t('common.noMatchingResults')}</td>
                    </tr>
                  ) : (
                    unifiedInventory.map((lvl) => (
                      <Fragment key={lvl.locationId}>
                        <tr className="bg-[#f1f5f9] border-b border-[#e2e8f0]">
                          <td className="py-2 px-6 font-bold text-[#0f172a]" colSpan={4}>
                            {lvl.locationName} <span className="text-[#64748b] ml-1 font-semibold">({lvl.locationNo})</span>
                          </td>
                          <td className="py-2 px-4 font-bold text-[#0f172a] text-right tabular-nums">{formatInt(lvl.quantityOnHand)}</td>
                          <td className="py-2 px-4 font-bold text-[#0f172a] text-right tabular-nums">{formatInt(lvl.quantityCommitted)}</td>
                          <td className="py-2 px-4 font-bold text-[#006b5c] text-right tabular-nums">{formatInt(lvl.quantityAvailable)}</td>
                          <td className="py-2 px-4 font-bold text-[#0f172a] text-right tabular-nums">{formatInt(lvl.quantityOnOrder)}</td>
                          <td></td>
                        </tr>
                        {lvl.bins.length === 0 ? (
                          <tr className="border-b border-[#e2e8f0]">
                            <td className="py-2 px-6"></td>
                            <td className="py-2 px-4 text-[#64748b] italic text-xs" colSpan={8}>{t('products.storage.noBins')}</td>
                          </tr>
                        ) : (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
                          Array.from(lvl.bins.values()).map((bin: any) => editingBinId === bin.binId ? (
                            <tr key={bin.binId} className="bg-white border-b border-[#e2e8f0]">
                              <td className="py-2 px-6"></td>
                              <td className="py-2 px-4">
                                <span className="font-semibold text-[#334155]">{bin.binNumber}</span>
                              </td>
                              <td className="py-2 px-4">
                                <input
                                  className="input input-sm w-full text-right h-[32px]"
                                  type="number"
                                  min="0"
                                  value={editingBinData.minQty}
                                  onChange={(e) => setEditingBinData({ ...editingBinData, minQty: e.target.value })}
                                />
                              </td>
                              <td className="py-2 px-4">
                                <input
                                  className="input input-sm w-full text-right h-[32px]"
                                  type="number"
                                  min="0"
                                  value={editingBinData.maxQty}
                                  onChange={(e) => setEditingBinData({ ...editingBinData, maxQty: e.target.value })}
                                />
                              </td>
                              <td colSpan={4} className="py-2 px-4">
                                <div className="flex items-center gap-2 pt-1">
                                  <label className="switch">
                                    <input 
                                      type="checkbox" 
                                      checked={editingBinData.isPrimaryPerLocation}
                                      onChange={(e) => setEditingBinData({ ...editingBinData, isPrimaryPerLocation: e.target.checked })}
                                    />
                                    <span className="switch-slider"></span>
                                  </label>
                                  <span className="text-xs text-[#64748b] font-medium leading-none mt-[-2px]">{t('products.storage.columns.primary')}</span>
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => setEditingBinId(null)} className="btn btn-xs btn-ghost px-1.5" title={tCommon('buttons.cancel')}>
                                    {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
                                    <span className="material-symbols-outlined text-[16px] text-gray-500">close</span>
                                  </button>
                                  <button 
                                    className="btn btn-xs btn-primary bg-[#006b5c] border-none px-1.5"
                                    onClick={async () => {
                                      try {
                                        await api.productsControllerLinkDefaultBin(id as string, editingBinData);
                                        toast.success(t('products.storage.toastLinkUpdated'));
                                        setEditingBinId(null);
                                        await fetchProduct(false);
                                      } catch (err: unknown) {
                                        toast.error(getErrorMessage(err));
                                      }
                                    }}
                                    title={tCommon('buttons.save')}
                                    disabled={saving}
                                  >
                                    {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={bin.binId} className="border-b border-[#e2e8f0] hover:bg-[#f8fafc]">
                              <td className="py-2 px-6"></td>
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#334155]">
                                    {bin.binNumber}
                                  </span>
                                  {bin.isPrimary && (
                                    <span title="Primary Bin" className="text-[10px] font-bold text-[#64748b] bg-[#e2e8f0] px-1.5 py-0.5 rounded leading-tight cursor-help mt-[1px]">P</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-4 text-[#475569] text-right tabular-nums">{bin.isDefault ? bin.minQty || '0' : '—'}</td>
                              <td className="py-2 px-4 text-[#475569] text-right tabular-nums">{bin.isDefault ? bin.maxQty || '0' : '—'}</td>
                              <td className="py-2 px-4 font-medium text-[#475569] text-right tabular-nums">{formatInt(bin.quantityOnHand)}</td>
                              <td colSpan={3}></td>
                              <td className="py-2 px-4 text-center">
                                {isEditable && (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingBinId(bin.binId);
                                        setEditingBinData({
                                          locationId: lvl.locationId,
                                          binId: bin.binId,
                                          isPrimaryPerLocation: bin.isPrimary || false,
                                          minQty: bin.minQty || '',
                                          maxQty: bin.maxQty || '',
                                        });
                                      }}
                                      className="p-1 hover:bg-[#eef2f6] rounded text-[#475569] transition-colors"
                                    >
                                      {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    {bin.isDefault && (
                                      <button
                                        onClick={async () => {
                                          if (!window.confirm(t('products.storage.confirmRemoveLink', { bin: bin.binNumber, location: lvl.locationName }))) return;
                                          try {
                                            await api.productsControllerRemoveDefaultBin(id as string, bin.productDefaultBinId);
                                            toast.success(t('products.storage.toastLinkRemoved'));
                                            await fetchProduct(false);
                                          } catch (err: unknown) {
                                            toast.error(getErrorMessage(err));
                                          }
                                        }}
                                        className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                                      >
                                        {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="flex flex-col gap-3">
          {/* Identity Card */}
          <div id="info-section" className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
              <span className="material-symbols-outlined">badge</span>
              {t('products.cards.identity')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.number')}
                  </label>
                  <input
                    className="input"
                    required
                    disabled={!isEditable || saving}
                    value={dto.productNumber ?? ''}
                    onChange={(e) => setDto({ ...dto, productNumber: e.target.value })}
                    onBlur={(e) => handleBlur('productNumber', e.target.value)}
                    placeholder={t('common.placeholders.number')}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.productName')}
                  </label>
                  <input
                    className="input w-full"
                    required
                    disabled={!isEditable || saving}
                    value={dto.name ?? ''}
                    onChange={(e) => setDto({ ...dto, name: e.target.value })}
                    onBlur={(e) => handleBlur('name', e.target.value)}
                    placeholder={t('products.placeholders.productDisplayName')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.barcode')}
                  </label>
                  <input
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.barcode ?? ''}
                    onChange={(e) => setDto({ ...dto, barcode: e.target.value })}
                    onBlur={(e) => handleBlur('barcode', e.target.value)}
                    placeholder={t('products.placeholders.barcode')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.alternateProductNumber')}
                  </label>
                  <input
                    className="input"
                    disabled={!isEditable || saving}
                    value={dto.alternateProductNumber ?? ''}
                    onChange={(e) => setDto({ ...dto, alternateProductNumber: e.target.value })}
                    onBlur={(e) => handleBlur('alternateProductNumber', e.target.value)}
                    placeholder={t('products.columns.alternateProductNumber')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Classification Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
              <span className="material-symbols-outlined">category</span>
              {t('products.cards.classification')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.type')}
                </label>
                <select
                  className="input w-full"
                  value={product.productType || 'inventory'}
                  onChange={(e) => handleSelectChange('productType', e.target.value)}
                  disabled={!isEditable}
                >
                  <option value="inventory">{t('products.types.inventory')}</option>
                  <option value="non-stock">{t('products.types.nonStock')}</option>
                  <option value="service">{t('products.types.service')}</option>
                  <option value="freight">{t('products.types.freight')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.structureType')}
                </label>
                <select
                  className="input w-full"
                  value={product.structureType || 'standard'}
                  onChange={(e) => handleSelectChange('structureType', e.target.value)}
                  disabled={!isEditable}
                >
                  <option value="standard">{t('products.structures.standard')}</option>
                  <option value="kit">{t('products.structures.kit')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.status')}
                </label>
                <select
                  className="input"
                  disabled={!isEditable || saving}
                  value={dto.stateCode ?? ''}
                  onChange={(e) => handleSelectChange('stateCode', e.target.value)}
                >
                  <option value={PRODUCT_STATE.ACTIVE}>{t('common.states.active')}</option>
                  <option value={PRODUCT_STATE.INACTIVE}>{t('common.states.inactive')}</option>
                  <option value={PRODUCT_STATE.DISCONTINUED}>{t('common.states.discontinued')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.productGroup')}
                </label>
                <GroupSelect
                  type="product"
                  value={dto.productGroupId ?? ''}
                  onChange={(val) => handleSelectChange('productGroupId', val)}
                  disabled={!isEditable || saving}
                  placeholder={t('products.placeholders.noProductGroup')}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div id="pricing-section" className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
              <span className="material-symbols-outlined">payments</span>
              {t('products.pricing')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.listPrice')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  disabled={!isEditable || saving}
                  value={dto.listPrice ?? ''}
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
                  value={dto.tradePrice ?? ''}
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
                  value={dto.priceLevel3 ?? ''}
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
                  value={dto.priceLevel4 ?? ''}
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
                  value={dto.standardCost ?? ''}
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

          {/* Taxation Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
              <span className="material-symbols-outlined">account_balance</span>
              {t('products.cards.taxation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.purchaseTaxCategory')}
                </label>
                <select
                  className="input"
                  disabled={!isEditable || saving}
                  value={dto.purchaseTaxCategoryId ?? ''}
                  onChange={(e) => handleSelectChange('purchaseTaxCategoryId', e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  {taxCategories.map((cat) => (
                    <option key={cat.taxCategoryId} value={cat.taxCategoryId}>
                      {cat.title} ({cat.code})
                    </option>
                  ))}
                  {/* Fallback for legacy values not in current categories */}
                  {dto.purchaseTaxCategoryId && !taxCategories.find(c => c.taxCategoryId === dto.purchaseTaxCategoryId) && (
                    <option value={dto.purchaseTaxCategoryId}>{t('products.unknownCategory', { id: dto.purchaseTaxCategoryId })}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.salesTaxCategory')}
                </label>
                <select
                  className="input"
                  disabled={!isEditable || saving}
                  value={dto.salesTaxCategoryId ?? ''}
                  onChange={(e) => handleSelectChange('salesTaxCategoryId', e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  {taxCategories.map((cat) => (
                    <option key={cat.taxCategoryId} value={cat.taxCategoryId}>
                      {cat.title} ({cat.code})
                    </option>
                  ))}
                  {/* Fallback for legacy values not in current categories */}
                  {dto.salesTaxCategoryId && !taxCategories.find(c => c.taxCategoryId === dto.salesTaxCategoryId) && (
                    <option value={dto.salesTaxCategoryId}>{t('products.unknownCategory', { id: dto.salesTaxCategoryId })}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.externalTaxCode')}
                </label>
                <input
                  className="input w-full"
                  disabled={!isEditable || saving}
                  value={dto.externalTaxCode ?? ''}
                  onChange={(e) => setDto({ ...dto, externalTaxCode: e.target.value })}
                  onBlur={(e) => handleBlur('externalTaxCode', e.target.value)}
                  placeholder="e.g. 20010"
                />
              </div>
            </div>
          </div>
        {/* Units & Dimensions Card */}
        <div id="uom-section" className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
            <span className="material-symbols-outlined">straighten</span>
            {t('products.unitsOfMeasure')}
          </h3>

          {/* Default UoM selectors */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('products.baseUom')}
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
                {t('products.defaultSalesUom')}
              </label>
              <select
                className="input"
                disabled={!isEditable || saving}
                value={product.defaultSalesUomId || ''}
                onChange={(e) => handleSelectChange('defaultSalesUomId', e.target.value || null)}
              >
                <option value="">{t('products.baseUomLabel', { uom: product.baseUom || 'EA' })}</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                {((product as any).productUoms || []).map((u: any) => (
                  <option key={u.productUomId} value={u.productUomId}>
                    {t('products.uomRatioLabel', { uom: u.uomCode, ratio: u.ratio })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('products.defaultPurchaseUom')}
              </label>
              <select
                className="input"
                disabled={!isEditable || saving}
                value={product.defaultPurchaseUomId || ''}
                onChange={(e) => handleSelectChange('defaultPurchaseUomId', e.target.value || null)}
              >
                <option value="">{t('products.baseUomLabel', { uom: product.baseUom || 'EA' })}</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                {((product as any).productUoms || []).map((u: any) => (
                  <option key={u.productUomId} value={u.productUomId}>
                    {t('products.uomRatioLabel', { uom: u.uomCode, ratio: u.ratio })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversions table */}
          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <InlineSettingsTable
              title={<span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('products.packagingConversions')}</span>}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              data={(product as any).productUoms || []}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              rowKey={(row: any) => row.productUomId}
              columns={[
                {
                  key: 'uomCode',
                  title: t('products.columns.uomCode'),
                  type: 'select',
                  options: uomDictionary
                    .filter(u => u.uomCode !== (product.baseUom || 'EA'))
                    .map(u => ({
                      value: u.uomCode,
                      label: u.uomCode + (u.description ? ` — ${u.description}` : '')
                    })),
                  disabled: true, // Only editable when adding a new row
                  validate: (v) => v ? null : tCommon('errors.typeAndDateRequired')
                },
                {
                  key: 'ratio',
                  title: t('products.columns.ratioBase'),
                  type: 'number',
                  validate: (v) => Number(v) > 0 ? null : tCommon('errors.typeAndDateRequired')
                },
                {
                  key: 'barcode',
                  title: t('products.columns.barcode'),
                  type: 'text',
                  disabled: true
                }
              ]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              onSave={async (row: any, isNew: boolean) => {
                if (isNew) {
                  await api.productsControllerAddUom(id as string, {
                    uomCode: row.uomCode,
                    ratio: String(row.ratio),
                  });
                  toast.success(t('products.toast.conversionAdded'));
                  await fetchProduct(false);
                } else {
                  // Not supported by API
                }
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              onDelete={async (row: any) => {
                await api.productsControllerRemoveUom(id as string, row.productUomId);
                toast.success(t('products.toast.conversionRemoved'));
                await fetchProduct(false);
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              onAdd={() => ({ uomCode: '', ratio: 1, barcode: '' } as any)}
              canEdit={() => false}
              canDelete={() => isEditable}
              addLabel={t('products.addConversion')}
              emptyLabel={t('products.noConversions')}
            />
          </div>
        </div>

        {/* Notes Card - full width */}
        <div id="notes-section" className="card">
          <h3 className="section-heading">
             {/* eslint-disable-next-line i18next/no-literal-string -- Complex UI state, DTO typing, or Material Icon */}
             <span className="material-symbols-outlined">notes</span>
            {t('common.notesCardHeading')}
          </h3>
          <textarea
            className="input w-full"
            style={{ height: 110, paddingTop: 12 }}
            disabled={!isEditable || saving}
            value={dto.notes ?? ''}
            onChange={(e) => setDto({ ...dto, notes: e.target.value })}
            onBlur={(e) => handleBlur('notes', e.target.value)}
            placeholder={t('products.placeholders.notes')}
          />
        </div>

        {/* Activity Timeline */}
        <div id="activity-section" className="card">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
          <ActivityTimeline events={(product as any).events || []} />
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end mt-4">
            {product.stateCode === PRODUCT_STATE.ARCHIVED ? (
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
