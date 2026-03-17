'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { apiFetch, apiMutate, EntityHeader, ActivityTimeline } from '@/lib/api';

export default function ProductDetailPage() {
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

  if (loading) return <Shell><div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div></Shell>;
  if (!product) return <Shell><div className="text-center py-20">Product not found</div></Shell>;

  const isLegacy = product.source === 'abm';

  return (
    <Shell>
      <EntityHeader
        title={product.productNumber}
        subtitle={product.name}
        onBack={() => router.push('/products')}
        isSaving={saving}
        badges={
          <>
            <span className={`badge badge-${product.stateCode}`}>{product.stateCode}</span>
            {isLegacy && <span className="badge badge-abm">Legacy ABM</span>}
          </>
        }
      />

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Product Information Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Product Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Product Name
                </label>
                <input
                  className="input"
                  required
                  disabled={isLegacy || saving}
                  value={dto.name}
                  onChange={(e) => setDto({ ...dto, name: e.target.value })}
                  onBlur={(e) => handleBlur('name', e.target.value)}
                  placeholder="Product display name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Barcode
                  </label>
                  <input
                    className="input"
                    disabled={isLegacy || saving}
                    value={dto.barcode}
                    onChange={(e) => setDto({ ...dto, barcode: e.target.value })}
                    onBlur={(e) => handleBlur('barcode', e.target.value)}
                    placeholder="EAN / UPC barcode"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Status
                  </label>
                  <select
                    className="input"
                    disabled={isLegacy || saving}
                    value={dto.stateCode}
                    onChange={(e) => handleSelectChange('stateCode', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              </div>
              {/* Legacy-only: Product Group */}
              {isLegacy && product.productGroupName && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Product Group
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
                        GST Category
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
              Pricing & Financials
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    List Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={isLegacy || saving}
                    value={dto.listPrice}
                    onChange={(e) => setDto({ ...dto, listPrice: e.target.value })}
                    onBlur={(e) => handleBlur('listPrice', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Standard Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    disabled={isLegacy || saving}
                    value={dto.standardCost}
                    onChange={(e) => setDto({ ...dto, standardCost: e.target.value })}
                    onBlur={(e) => handleBlur('standardCost', e.target.value)}
                  />
                </div>
              </div>
              {/* Legacy-only: Trade Price + Price Levels */}
              {isLegacy && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Trade Price
                    </label>
                    <input
                      className="input"
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                      disabled
                      value={product.tradePrice ?? '—'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Price Level 3
                    </label>
                    <input
                      className="input"
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                      disabled
                      value={product.priceLevel3 ?? '—'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Price Level 4
                    </label>
                    <input
                      className="input"
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                      disabled
                      value={product.priceLevel4 ?? '—'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Record Details Card - full width */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Record Details
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
                  Source
                </label>
                <input className="input" disabled value={product.source === 'abm' ? 'Legacy ABM' : 'Application'} />
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
                This is a read-only legacy record imported from ABM. Changes must be made in the source system.
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
            Internal Notes
          </h3>
          <textarea
            className="input w-full"
            style={{ height: 110, paddingTop: 12 }}
            disabled={isLegacy || saving}
            value={dto.notes}
            onChange={(e) => setDto({ ...dto, notes: e.target.value })}
            onBlur={(e) => handleBlur('notes', e.target.value)}
            placeholder="Technical specifications, sourcing details, etc…"
          />
        </div>

        {/* Activity Timeline */}
        <ActivityTimeline events={product.events || []} />
      </div>
    </Shell>
  );
}
