'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import GroupSelect from '@/components/shared/GroupSelect';
import InheritedSelect from '@/components/shared/InheritedSelect';
import { Button } from '@/components/shared/Button';
import { useSettings } from '@/components/SettingsProvider';
import { PRODUCT_STATE } from '@herobm/shared';
import { ProductKitComponentsTab } from './ProductKitComponentsTab';
import { useGroup, useInheritance } from '@/hooks/useInheritance';
import { useProduct } from './useProduct';
import { ProductSuppliersTab } from './ProductSuppliersTab';
import { ProductInventoryTab } from './ProductInventoryTab';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';

const formatMoney = (val: string | number | undefined | null) => {
  if (!val) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
};

export default function ProductDetailPage() {
  const { app } = useSettings();
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState<'details' | 'suppliers' | 'inventory' | 'kit'>('details');

  const {
    product,
    dto,
    loading,
    saving,
    updateField,
    saveField,
    loadProduct,
    taxCategories,
    productGroups,
    uomDictionary,
    archiveProduct,
    unarchiveProduct
  } = useProduct(id as string);

  useDocumentTitle(product ? (product.name ? `${product.productNumber} - ${product.name}` : product.productNumber) : null);

  const selectedGroup = useGroup(productGroups, dto?.productGroupId || null);

  const purchaseTaxInheritance = useInheritance([
    { value: selectedGroup?.purchaseTaxCategoryId, sourceLabel: `Group ${selectedGroup?.groupCode}` },
    { value: app?.defaultPurchaseTaxCategoryId, sourceLabel: 'System Default' }
  ]);

  const salesTaxInheritance = useInheritance([
    { value: selectedGroup?.salesTaxCategoryId, sourceLabel: `Group ${selectedGroup?.groupCode}` },
    { value: app?.defaultSalesTaxCategoryId, sourceLabel: 'System Default' }
  ]);

  if (loading) return <><div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div></>;
  if (!product || !dto) return <><div className="text-center py-20">{t('common.noMatchingResults')}</div></>;

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
    <DetailsLayout
      header={
        <EntityHeader
          title={product.productNumber}
          subtitle={product.name}
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
          className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <div>
            <strong className="font-semibold text-amber-800">{t('salesOrders.archivedBannerTitle')}</strong> {t('salesOrders.archivedBannerBody')}
          </div>
        </div>
      )}

      {activeTab === 'kit' && (
        <ProductKitComponentsTab productId={id as string} isEditable={isEditable} />
      )}

      {activeTab === 'suppliers' && (
        <ProductSuppliersTab 
          productId={id as string} 
          productName={product.name || ''} 
          productNumber={product.productNumber || ''} 
          isEditable={isEditable} 
        />
      )}

      {activeTab === 'inventory' && (
        <ProductInventoryTab 
          productId={id as string} 
          product={product} 
          isEditable={isEditable} 
          onRefresh={loadProduct}
        />
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
                    onChange={(e) => updateField('productNumber', e.target.value)}
                    onBlur={(e) => saveField('productNumber', e.target.value)}
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
                    onChange={(e) => updateField('name', e.target.value)}
                    onBlur={(e) => saveField('name', e.target.value)}
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
                    onChange={(e) => updateField('barcode', e.target.value)}
                    onBlur={(e) => saveField('barcode', e.target.value)}
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
                    onChange={(e) => updateField('alternateProductNumber', e.target.value)}
                    onBlur={(e) => saveField('alternateProductNumber', e.target.value)}
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
                  onChange={(e) => {
                    updateField('productType', e.target.value);
                    saveField('productType', e.target.value);
                  }}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('structureType', val);
                    saveField('structureType', val);
                    if (val === 'kit') {
                      updateField('productType', 'non-stock');
                      saveField('productType', 'non-stock');
                    }
                  }}
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
                  onChange={(e) => {
                    updateField('stateCode', e.target.value);
                    saveField('stateCode', e.target.value);
                  }}
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
                  onChange={(val) => {
                    updateField('productGroupId', val);
                    saveField('productGroupId', val);
                  }}
                  disabled={!isEditable || saving}
                  placeholder={t('products.placeholders.noProductGroup')}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div id="pricing-section" className="card">
            <h3 className="section-heading">
              { }
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
                  onChange={(e) => updateField('listPrice', e.target.value)}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    updateField('listPrice', formatted);
                    saveField('listPrice', formatted);
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
                  onChange={(e) => updateField('tradePrice', e.target.value)}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    updateField('tradePrice', formatted);
                    saveField('tradePrice', formatted);
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
                  onChange={(e) => updateField('priceLevel3', e.target.value)}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    updateField('priceLevel3', formatted);
                    saveField('priceLevel3', formatted);
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
                  onChange={(e) => updateField('priceLevel4', e.target.value)}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    updateField('priceLevel4', formatted);
                    saveField('priceLevel4', formatted);
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
                  onChange={(e) => updateField('standardCost', e.target.value)}
                  onBlur={(e) => {
                    const formatted = formatMoney(e.target.value);
                    updateField('standardCost', formatted);
                    saveField('standardCost', formatted);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Taxation Card */}
          <div className="card">
            <h3 className="section-heading">
              { }
              <span className="material-symbols-outlined">account_balance</span>
              {t('products.cards.taxation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.purchaseTaxCategory')}
                </label>
                <InheritedSelect
                  className="input"
                  disabled={!isEditable || saving}
                  value={dto.purchaseTaxCategoryId ?? ''}
                  onChange={(val) => {
                    updateField('purchaseTaxCategoryId', val);
                    saveField('purchaseTaxCategoryId', val);
                  }}
                  options={[
                    ...taxCategories.map((cat) => ({
                      value: cat.taxCategoryId,
                      label: `${cat.title} (${cat.code})`,
                    })),
                    // Fallback for legacy values not in current categories
                    ...(dto.purchaseTaxCategoryId && !taxCategories.find(c => c.taxCategoryId === dto.purchaseTaxCategoryId)
                      ? [{ value: dto.purchaseTaxCategoryId, label: t('products.unknownCategory', { id: dto.purchaseTaxCategoryId }) }]
                      : [])
                  ]}
                  inheritedValue={purchaseTaxInheritance.inheritedValue}
                  inheritedSourceLabel={purchaseTaxInheritance.inheritedSourceLabel}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.salesTaxCategory')}
                </label>
                <InheritedSelect
                  className="input"
                  disabled={!isEditable || saving}
                  value={dto.salesTaxCategoryId ?? ''}
                  onChange={(val) => {
                    updateField('salesTaxCategoryId', val);
                    saveField('salesTaxCategoryId', val);
                  }}
                  options={[
                    ...taxCategories.map((cat) => ({
                      value: cat.taxCategoryId,
                      label: `${cat.title} (${cat.code})`,
                    })),
                    // Fallback for legacy values not in current categories
                    ...(dto.salesTaxCategoryId && !taxCategories.find(c => c.taxCategoryId === dto.salesTaxCategoryId)
                      ? [{ value: dto.salesTaxCategoryId, label: t('products.unknownCategory', { id: dto.salesTaxCategoryId }) }]
                      : [])
                  ]}
                  inheritedValue={salesTaxInheritance.inheritedValue}
                  inheritedSourceLabel={salesTaxInheritance.inheritedSourceLabel}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.externalTaxCode')}
                </label>
                <input
                  className="input w-full"
                  disabled={!isEditable || saving}
                  value={dto.externalTaxCode ?? ''}
                  onChange={(e) => updateField('externalTaxCode', e.target.value)}
                  onBlur={(e) => saveField('externalTaxCode', e.target.value)}
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
                onChange={(e) => {
                  updateField('baseUom', e.target.value);
                  saveField('baseUom', e.target.value);
                }}
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
                onChange={(e) => {
                  const val = e.target.value || null;
                  updateField('defaultSalesUomId', val);
                  saveField('defaultSalesUomId', val);
                }}
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
                onChange={(e) => {
                  const val = e.target.value || null;
                  updateField('defaultPurchaseUomId', val);
                  saveField('defaultPurchaseUomId', val);
                }}
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
          <div className="pt-4 mt-4">
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
                  await loadProduct();
                } else {
                  // Not supported by API
                }
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              onDelete={async (row: any) => {
                await api.productsControllerRemoveUom(id as string, row.productUomId);
                toast.success(t('products.toast.conversionRemoved'));
                await loadProduct();
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
              onAdd={() => ({ uomCode: '', ratio: 1, barcode: '' } as any)}
              canEdit={() => false}
              canDelete={() => isEditable}
              addLabel={t('products.addConversion')}
              emptyLabel={t('products.noConversions')}
            />
          </div>

          <div className="pt-4 mt-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('products.columns.weight')}
              </label>
              <input
                type="number"
                step="0.0001"
                className="input"
                disabled={!isEditable || saving}
                value={dto.weight ?? ''}
                onChange={(e) => updateField('weight', e.target.value)}
                onBlur={(e) => saveField('weight', e.target.value)}
              />
            </div>
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
            onChange={(e) => updateField('notes', e.target.value)}
            onBlur={(e) => saveField('notes', e.target.value)}
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
              <Button
                variant="secondary"
                size="sm"
                onClick={unarchiveProduct}
                disabled={saving}
              >
                {t('salesOrders.buttons.unarchive')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                onClick={archiveProduct}
                disabled={saving}
              >
                {t('salesOrders.buttons.archive')}
              </Button>
            )}
          </div>
      </div>
      )}
    </DetailsLayout>
  );
}
