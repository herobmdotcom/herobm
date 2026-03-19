'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { apiMutate, EntityHeader } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function NewProductPage() {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    productNumber: '',
    name: '',
    barcode: '',
    listPrice: '0',
    standardCost: '0',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const product = await apiMutate<any>('/api/products', 'POST', dto);
      toast.success(t('toast.productCreated'));
      router.push(`/products/${product.productId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.productNumber.trim() !== '' && dto.name.trim() !== '';

  return (
    <Shell>
      <EntityHeader
        title={t('products.buttons.addProduct')}
        subtitle={t('products.catalogManagement')}
        onBack={() => router.push('/products')}
        isSaving={submitting}
        isDirty={isValid}
        onSave={handleSubmit}
        saveLabel={t('products.buttons.addProduct')}
      />

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* General Information Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t('products.generalInfo')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.productNumber')} *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.productNumber}
                  onChange={(e) => updateField('productNumber', e.target.value)}
                  placeholder="e.g. PROD-001"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.name')} *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Widget Deluxe"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.barcode')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  placeholder="UPC / EAN"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Costs Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
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
                    value={dto.listPrice}
                    onChange={(e) => updateField('listPrice', e.target.value)}
                    disabled={submitting}
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
                    value={dto.standardCost}
                    onChange={(e) => updateField('standardCost', e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-base-200/50 border border-base-300">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {t('products.pricingCostsInfo')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('products.internalWarehouseNotes')}
          </h3>
          <textarea
            className="textarea h-32"
            value={dto.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Handling instructions, storage requirements, or product description..."
            disabled={submitting}
          />
        </div>
      </div>
    </Shell>
  );
}
