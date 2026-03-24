/* eslint-disable i18next/no-literal-string */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { apiMutate } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
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
    tradePrice: '0',
    priceLevel3: '0',
    priceLevel4: '0',
    stateCode: 'active',
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
      <DetailsLayout
        header={
          <EntityHeader
            title={t('products.buttons.addProduct')}
            onBack={() => router.push('/products')}
            actions={
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push('/products')}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                >
                  {submitting ? t('common.saving') : `+ ${t('products.buttons.addProduct')}`}
                </button>
              </>
            }
          />
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Product Information Card */}
          <div className="card">
            <h3 className="section-heading">
              <span className="material-symbols-outlined">info</span>
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
                  placeholder={t('products.placeholders.productNumber')}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.productName')} *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={t('products.placeholders.productName')}
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('products.columns.barcode')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.barcode}
                    onChange={(e) => updateField('barcode', e.target.value)}
                    placeholder={t('products.placeholders.barcode')}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Status
                  </label>
                  <select
                    className="input"
                    value={dto.stateCode}
                    onChange={(e) => updateField('stateCode', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="active">{t('common.states.active')}</option>
                    <option value="inactive">{t('common.states.inactive')}</option>
                    <option value="discontinued">{t('common.states.discontinued')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div className="card">
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
                  value={dto.listPrice}
                  onChange={(e) => updateField('listPrice', e.target.value)}
                  disabled={submitting}
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
                  value={dto.tradePrice}
                  onChange={(e) => updateField('tradePrice', e.target.value)}
                  disabled={submitting}
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
                  value={dto.priceLevel3}
                  onChange={(e) => updateField('priceLevel3', e.target.value)}
                  disabled={submitting}
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
                  value={dto.priceLevel4}
                  onChange={(e) => updateField('priceLevel4', e.target.value)}
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
          </div>
        </div>

        {/* Notes Card */}
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">notes</span>
            {t('common.notesCardHeading')}
          </h3>
          <textarea
            className="input w-full"
            style={{ height: 110, paddingTop: 12 }}
            value={dto.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder={t('products.placeholders.notes')}
            disabled={submitting}
          />
        </div>
        </div>
      </DetailsLayout>
    </Shell>
  );
}
