'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import GroupSelect from '@/components/shared/GroupSelect';
import { PRODUCT_STATE } from '@herobm/shared';
import { getErrorMessage } from '@herobm/shared';

const formatMoney = (val: string | number | undefined | null) => {
  if (!val) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
};

export default function NewProductPage() {
  const t = useTranslations();
  useDocumentTitle(t('products.newTitle'));
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [dto, setDto] = useState({
    productNumber: '',
    name: '',
    productType: 'inventory',
    structureType: 'standard',
    barcode: '',
    listPrice: '0.00',
    standardCost: '0.00',
    tradePrice: '0.00',
    priceLevel3: '0.00',
    priceLevel4: '0.00',
    purchaseTaxCategoryId: '',
    salesTaxCategoryId: '',
    externalTaxCode: '',
    alternateProductNumber: '',
    stateCode: PRODUCT_STATE.ACTIVE,
    productGroupId: null,
    notes: '',
  });

  useEffect(() => {
    api.taxCategoriesControllerFindAll().then((res: unknown) => setTaxCategories((res as { data: unknown[] }).data as unknown as api.TaxCategoryResponseDto[])).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...dto };
      if (!payload.purchaseTaxCategoryId) delete payload.purchaseTaxCategoryId;
      if (!payload.salesTaxCategoryId) delete payload.salesTaxCategoryId;
      if (!payload.productGroupId) delete payload.productGroupId;

      const res = await api.productsControllerCreate(payload as unknown as api.CreateProductDto);
      const product = res.data;
      toast.success(t('toast.productCreated'));
      router.push(`/products/${product.id}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setDto((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'structureType' && value === 'kit') {
        next.productType = 'non-stock';
      }
      return next;
    });
  };

  const isValid = dto.productNumber.trim() !== '' && dto.name.trim() !== '';

  return (
    <>
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
                  {submitting ? t('common.saving') : t('products.buttons.addProduct')}
                </button>
              </>
            }
            showPrint={false}
          />
        }
      >
        <div className="flex flex-col gap-3">
          {/* Identity Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">badge</span>
              {t('products.cards.identity')}
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
                    {t('products.columns.alternateProductNumber')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.alternateProductNumber}
                    onChange={(e) => updateField('alternateProductNumber', e.target.value)}
                    placeholder={t('products.columns.alternateProductNumber')}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Classification Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">category</span>
              {t('products.cards.classification')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.type')}
                </label>
                <select
                  className="input w-full"
                  value={dto.productType}
                  onChange={(e) => updateField('productType', e.target.value)}
                  disabled={submitting}
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
                  value={dto.structureType}
                  onChange={(e) => updateField('structureType', e.target.value)}
                  disabled={submitting}
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
                  value={dto.stateCode}
                  onChange={(e) => updateField('stateCode', e.target.value)}
                  disabled={submitting}
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
                  value={dto.productGroupId}
                  onChange={(val) => updateField('productGroupId', val || '')}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Financials Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
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
                  onBlur={(e) => updateField('listPrice', formatMoney(e.target.value))}
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
                  onBlur={(e) => updateField('tradePrice', formatMoney(e.target.value))}
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
                  onBlur={(e) => updateField('priceLevel3', formatMoney(e.target.value))}
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
                  onBlur={(e) => updateField('priceLevel4', formatMoney(e.target.value))}
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
                  onBlur={(e) => updateField('standardCost', formatMoney(e.target.value))}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Taxation Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
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
                  value={dto.purchaseTaxCategoryId || ''}
                  onChange={(e) => updateField('purchaseTaxCategoryId', e.target.value)}
                  disabled={submitting}
                >
                  <option value="">{t('common.none')}</option>
                  {taxCategories.map((cat) => (
                    <option key={cat.taxCategoryId} value={cat.taxCategoryId}>
                      {cat.title} ({cat.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.salesTaxCategory')}
                </label>
                <select
                  className="input"
                  value={dto.salesTaxCategoryId || ''}
                  onChange={(e) => updateField('salesTaxCategoryId', e.target.value)}
                  disabled={submitting}
                >
                  <option value="">{t('common.none')}</option>
                  {taxCategories.map((cat) => (
                    <option key={cat.taxCategoryId} value={cat.taxCategoryId}>
                      {cat.title} ({cat.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('products.columns.externalTaxCode')}
                </label>
                <input
                  className="input w-full"
                  disabled={submitting}
                  value={dto.externalTaxCode}
                  onChange={(e) => updateField('externalTaxCode', e.target.value)}
                  placeholder="e.g. 20010"
                />
              </div>
            </div>
          </div>

          {/* Notes Card */}
          <div className="card">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
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
    </>
  );
}
