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
import { PRODUCT_STATE, getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

export default function NewProductPage() {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  useDocumentTitle(t('products.newTitle'));
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uomDictionary, setUomDictionary] = useState<api.UomResponseDto[]>([]);
  const [dto, setDto] = useState({
    productNumber: '',
    name: '',
    baseUom: '',
    productType: 'inventory',
    structureType: 'standard',
    stateCode: PRODUCT_STATE.ACTIVE,
    productGroupId: null as string | null,
  });

  useEffect(() => {
    api.uomDictionaryControllerFindAll()
      .then((res: unknown) => setUomDictionary((res as { data: api.UomResponseDto[] }).data || []))
      .catch((err) => toast.error('Failed to load UOM dictionary: ' + getErrorMessage(err)));
  }, []);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...dto };
      if (!payload.productGroupId) delete payload.productGroupId;

      const res = await api.productsControllerCreate(payload as unknown as api.CreateProductDto);
      const product = res.data;
      toast.success(t('toast.productCreated'));
      router.push(`/products/${product.productId}`);
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

  const isValid =
    dto.productNumber.trim() !== '' &&
    dto.name.trim() !== '' &&
    dto.baseUom.trim() !== '';

  return (
    <>
      <DetailsLayout
        showPrint={false}
        header={
          <EntityHeader
            title={t('products.buttons.addProduct')}
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/products')}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                >
                  {submitting ? t('common.saving') : t('products.buttons.addProduct')}
                </Button>
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('products.baseUom')} *
                </label>
                <select
                  className="input w-full"
                  value={dto.baseUom}
                  onChange={(e) => updateField('baseUom', e.target.value)}
                  disabled={submitting}
                >
                  <option value="" disabled>
                    {tCommon('selectOption')}
                  </option>
                  {uomDictionary.map((u) => (
                    <option key={u.uomCode} value={u.uomCode}>
                      {u.uomCode}{u.description ? ` — ${u.description}` : ''}
                    </option>
                  ))}
                </select>
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
        </div>
      </DetailsLayout>
    </>
  );
}
