import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';

interface KitComponentSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  componentId?: string;
  existingData?: any;
  onSaved: () => void;
}

export const KitComponentSlideOver: React.FC<KitComponentSlideOverProps> = ({
  isOpen,
  onClose,
  productId,
  componentId,
  existingData,
  onSaved,
}) => {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [dto, setDto] = useState({
    childProductId: '',
    childProductName: '',
    parentQuantity: '1',
    quantity: '1',
    sequenceNumber: '0',
    fractionalBehavior: 'allow_fractional',
  });

  useEffect(() => {
    if (isOpen) {
      if (existingData) {
        setDto({
          childProductId: existingData.childProductId,
          childProductName: existingData.name || existingData.productNumber || existingData.childProductId,
          parentQuantity: existingData.parentQuantity?.toString() || '1',
          quantity: existingData.quantity?.toString() || '1',
          sequenceNumber: existingData.sequenceNumber?.toString() || '1',
          fractionalBehavior: existingData.fractionalBehavior || 'ALLOW_FRACTIONAL',
        });
      } else {
        // Fetch existing components to determine next sequence number
        api.productsControllerGetComponents(productId)
          .then((res: any) => {
            const maxSeq = res.data?.reduce((max: number, c: any) => Math.max(max, c.sequenceNumber || 0), 0) || 0;
            setDto({
              childProductId: '',
              childProductName: '',
              parentQuantity: '1',
              quantity: '1',
              sequenceNumber: (maxSeq + 1).toString(),
              fractionalBehavior: 'allow_fractional',
            });
          })
          .catch(() => {
            setDto({
              childProductId: '',
              childProductName: '',
              parentQuantity: '1',
              quantity: '1',
              sequenceNumber: '1',
              fractionalBehavior: 'allow_fractional',
            });
          });
      }
    }
  }, [isOpen, existingData, productId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dto.childProductId) {
      toast.error(t('errors.childProductRequired'));
      return;
    }

    setSaving(true);
    try {
      if (componentId) {
        await api.productsControllerUpdateComponent(productId, componentId, {
          parentQuantity: dto.parentQuantity,
          quantity: dto.quantity,
          sequenceNumber: parseInt(dto.sequenceNumber, 10),
          fractionalBehavior: dto.fractionalBehavior as any,
        } );
        toast.success(t('toast.componentUpdated'));
      } else {
        await api.productsControllerAddComponent(productId, {
          childProductId: dto.childProductId,
          parentQuantity: dto.parentQuantity,
          quantity: dto.quantity,
          sequenceNumber: parseInt(dto.sequenceNumber, 10),
          fractionalBehavior: dto.fractionalBehavior as any,
        });
        toast.success(t('toast.componentAdded'));
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={componentId ? t('editComponent') : t('addComponent')}
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </button>
          <button type="button" className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <><span className="loading loading-spinner loading-sm mr-2" />{tCommon('saving', { defaultValue: 'Saving...' })}</>
            ) : (
              tCommon('save')
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSave} className="flex flex-col gap-5 h-full">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('componentProduct')}
            </label>
            {dto.childProductId ? (
              <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
                <span className="text-sm font-medium">{dto.childProductName}</span>
                {!componentId && !saving && (
                  <button 
                    type="button"
                    className="btn btn-sm btn-ghost text-red-500" 
                    onClick={() => setDto({ ...dto, childProductId: '', childProductName: '' })}
                  >
                    {tCommon('delete')}
                  </button>
                )}
              </div>
            ) : (
              <ProductSearchInput
                onSelect={(product: Product) => setDto({ ...dto, childProductId: product.productId, childProductName: `${product.productNumber} - ${product.name}` })}
                disabled={!!componentId || saving}
                placeholder={t('placeholders.searchProduct')}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.parentQuantity')}
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                className="input w-full text-right"
                value={dto.parentQuantity}
                onChange={(e) => setDto({ ...dto, parentQuantity: e.target.value })}
                disabled={saving}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.quantity')}
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                className="input w-full text-right"
                value={dto.quantity}
                onChange={(e) => setDto({ ...dto, quantity: e.target.value })}
                disabled={saving}
                required
              />
            </div>
          </div>

          <div className={dto.parentQuantity !== '1' ? 'grid grid-cols-2 gap-4' : ''}>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.sequenceNumber')}
              </label>
              <input
                type="number"
                min="0"
                className="input w-full text-right"
                value={dto.sequenceNumber}
                onChange={(e) => setDto({ ...dto, sequenceNumber: e.target.value })}
                disabled={saving}
              />
            </div>
            
            {dto.parentQuantity !== '1' && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('fractionalBehavior.label')}
                </label>
                <select
                  className="input w-full"
                  value={dto.fractionalBehavior}
                  onChange={(e) => setDto({ ...dto, fractionalBehavior: e.target.value })}
                  disabled={saving}
                >
                  <option value="allow_fractional">{t('fractionalBehavior.allow_fractional')}</option>
                  <option value="round_up">{t('fractionalBehavior.round_up')}</option>
                  <option value="round_down">{t('fractionalBehavior.round_down')}</option>
                  <option value="force_multiple">{t('fractionalBehavior.force_multiple')}</option>
                </select>
              </div>
            )}
          </div>
      </form>
    </SlideOver>
  );
};
