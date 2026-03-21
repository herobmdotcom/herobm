/* eslint-disable i18next/no-literal-string */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

export default function ProductDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [dto, setDto] = useState<any>({
    name: '',
    barcode: '',
    listPrice: '0',
    standardCost: '0',
    tradePrice: '0',
    priceLevel3: '0',
    priceLevel4: '0',
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
        listPrice: data.listPrice || '0',
        standardCost: data.standardCost || '0',
        tradePrice: data.tradePrice || '0',
        priceLevel3: data.priceLevel3 || '0',
        priceLevel4: data.priceLevel4 || '0',
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
  }, [fetchProduct]);

  const saveProduct = async (updatedValues: any) => {
    if (product?.source === 'abm' || saving) return;
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
      toast.success(t('toast.productUpdated'), { icon: '📦' });
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
      toast.success(t('toast.productUpdated'), { icon: '📦' });
      await fetchProduct(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Shell><div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div></Shell>;
  if (!product) return <Shell><div className="text-center py-20">{t('common.noMatchingResults')}</div></Shell>;

  const isLegacy = product.source === 'abm';
  const isEditable = !isLegacy && product.stateCode !== 'archived';

  return (
    <Shell>
      <EntityHeader
        title={product.productNumber}
        subtitle={product.name}
        onBack={() => router.push('/products')}
        isSaving={saving}
        badges={
          <>
            {product.stateCode && <StateBadge state={product.stateCode as ValidState} />}
            {isLegacy && <span className="badge badge-abm">{t('common.sources.abm')}</span>}
          </>
        }
        actions={
          product.source === 'app' ? (
            product.stateCode === 'archived' ? (
              <button className="btn btn-secondary btn-sm" onClick={unarchiveProduct} disabled={saving}>📦 {t('salesOrders.buttons.unarchive')}</button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                onClick={archiveProduct}
                disabled={saving}
              >
                📦 {t('salesOrders.buttons.archive')}
              </button>
            )
          ) : null
        }
      />

      {product.stateCode === 'archived' && (
        <div
          className="mb-6 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <strong className="font-semibold text-amber-800">{t('salesOrders.archivedBannerTitle')}</strong> {t('salesOrders.archivedBannerBody')}
          </div>
        </div>
      )}

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Product Information Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {t('products.productInformation')}
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
              {/* Legacy-only: Product Group */}
              {isLegacy && product.productGroupName && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.productGroup')}
                  </label>
                  <input className="input" disabled value={product.productGroupName} />
                </div>
              )}
              {/* Legacy-only: SC Number + GST Category */}
              {isLegacy && (product.scNumber || product.gstCategory) && (
                <div className="grid grid-cols-2 gap-4">
                  {product.scNumber && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        SC Number
                      </label>
                      <input className="input" disabled value={product.scNumber} />
                    </div>
                  )}
                  {product.gstCategory && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        {t('products.columns.gstCategory')}
                      </label>
                      <input className="input" disabled value={product.gstCategory} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {t('products.pricing')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.listPrice')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={!isEditable || saving}
                    value={dto.listPrice}
                    onChange={(e) => setDto({ ...dto, listPrice: e.target.value })}
                    onBlur={(e) => handleBlur('listPrice', e.target.value)}
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
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={!isEditable || saving}
                    value={dto.standardCost}
                    onChange={(e) => setDto({ ...dto, standardCost: e.target.value })}
                    onBlur={(e) => handleBlur('standardCost', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.tradePrice')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={!isEditable || saving}
                    value={dto.tradePrice}
                    onChange={(e) => setDto({ ...dto, tradePrice: e.target.value })}
                    onBlur={(e) => handleBlur('tradePrice', e.target.value)}
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
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={!isEditable || saving}
                    value={dto.priceLevel3}
                    onChange={(e) => setDto({ ...dto, priceLevel3: e.target.value })}
                    onBlur={(e) => handleBlur('priceLevel3', e.target.value)}
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
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={!isEditable || saving}
                    value={dto.priceLevel4}
                    onChange={(e) => setDto({ ...dto, priceLevel4: e.target.value })}
                    onBlur={(e) => handleBlur('priceLevel4', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Record Details Card - full width */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {t('products.recordDetails')}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Product ID
                </label>
                <input className="input" disabled value={product.productId} style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.source')}
                </label>
                <input className="input" disabled value={product.source === 'abm' ? t('common.sources.abm') : t('common.sources.app')} />
              </div>
              {product.createdOn && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Created
                  </label>
                  <input className="input" disabled value={new Date(product.createdOn).toLocaleDateString()} />
                </div>
              )}
              {product.createdBy && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Created By
                  </label>
                  <input className="input" disabled value={product.createdBy} />
                </div>
              )}
            </div>
            {product.modifiedOn && (
              <div style={{ maxWidth: '50%' }}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Last Modified
                </label>
                <input className="input" disabled value={new Date(product.modifiedOn).toLocaleString()} />
              </div>
            )}
            {isLegacy && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                {t('common.legacyRecordImported')}
              </p>
            )}
          </div>
        </div>

        {/* Notes Card - full width */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {t('common.notesCardHeading')}
          </h3>
          <textarea
            className="input w-full"
            style={{ height: 110, paddingTop: 12 }}
            disabled={isLegacy || saving}
            value={dto.notes}
            onChange={(e) => setDto({ ...dto, notes: e.target.value })}
            onBlur={(e) => handleBlur('notes', e.target.value)}
            placeholder={t('products.placeholders.notes')}
          />
        </div>

        {/* Activity Timeline */}
        <ActivityTimeline events={product.events || []} />
      </div>
    </Shell>
  );
}
