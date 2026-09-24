'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import SlideOver from '@/components/shared/SlideOver';
import SupplierSelect, { Supplier } from '@/components/shared/SupplierSelect';
import { Button } from '@/components/shared/Button';

export interface SupplierLinkInitialData {
  vendorId: string;
  vendorName?: string;
  vendorNumber?: string;
  supplierPartNumber?: string | null;
  costPrice?: string | number | null;
  discountPercent?: string | number | null;
  minPurchaseQty?: string | number | null;
  purchaseUnit?: string | null;
  isPreferred?: boolean;
}

export interface AddSupplierModalProps {
  productId: string;
  productName: string;
  productNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: SupplierLinkInitialData | null;
}

export default function AddSupplierModal({ 
  productId, productName, productNumber, isOpen, onClose, onSuccess, initialData 
}: AddSupplierModalProps) {
  const [vendorId, setVendorId] = useState('');
  const [supplierPartNumber, setSupplierPartNumber] = useState('');
  const [costPrice, setCostPrice] = useState('0.00');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [minPurchaseQty, setMinPurchaseQty] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('');
  const [isPreferred, setIsPreferred] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('products.supplierModal');
  const tCommon = useTranslations('common');

  const isEditing = Boolean(initialData);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setVendorId(initialData.vendorId || '');
        setSupplierPartNumber(initialData.supplierPartNumber || '');
        setCostPrice(
          initialData.costPrice != null && initialData.costPrice !== ''
            ? String(initialData.costPrice)
            : '0.00'
        );
        setDiscountPercent(
          initialData.discountPercent != null && initialData.discountPercent !== ''
            ? String(initialData.discountPercent)
            : '0'
        );
        setMinPurchaseQty(
          initialData.minPurchaseQty != null && initialData.minPurchaseQty !== ''
            ? String(initialData.minPurchaseQty)
            : ''
        );
        setPurchaseUnit(initialData.purchaseUnit || '');
        setIsPreferred(Boolean(initialData.isPreferred));
      } else {
        setVendorId('');
        setSupplierPartNumber('');
        setCostPrice('0.00');
        setDiscountPercent('0');
        setMinPurchaseQty('');
        setPurchaseUnit('');
        setIsPreferred(false);
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      toast.error(t('messages.selectDropdown'));
      return;
    }

    setSubmitting(true);
    try {
      await api.productsControllerAddSupplier(productId, {
        vendorId,
        supplierPartNumber: supplierPartNumber.trim() || undefined,
        costPrice: parseFloat(costPrice) || 0,
        discountPercent: discountPercent && parseFloat(discountPercent) > 0 ? parseFloat(discountPercent) : undefined,
        minPurchaseQty: minPurchaseQty && parseFloat(minPurchaseQty) > 0 ? parseFloat(minPurchaseQty) : undefined,
        purchaseUnit: purchaseUnit.trim() || undefined,
        isPreferred: isPreferred || undefined,
      });
      toast.success(isEditing ? t('messages.updateSuccess') : t('messages.success'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('editTitle') : t('title')}
      subtitle={`${productNumber} · ${productName}`}
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {t('buttons.cancel') || tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="link-supplier-form"
            variant="primary"
            className="bg-[#006b5c] hover:bg-[#005246] border-none text-white"
            loading={submitting}
            disabled={!vendorId || submitting}
          >
            {isEditing ? t('buttons.saveChanges') : t('buttons.linkProduct')}
          </Button>
        </div>
      }
    >
      <form
        id="link-supplier-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 h-full"
      >
        <div>
          <label
            htmlFor="supplier-select"
            className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]"
          >
            {t('inputs.searchSupplier')} <span className="text-red-500">*</span>
          </label>
          <SupplierSelect
            value={vendorId || null}
            initialSearchTerm={
              initialData?.vendorName
                ? (initialData.vendorNumber ? `${initialData.vendorNumber} — ${initialData.vendorName}` : initialData.vendorName)
                : undefined
            }
            onChange={(supplier: Supplier | null) => setVendorId(supplier?.vendorId || '')}
            placeholder={t('inputs.searchPlaceholder')}
            disabled={submitting || isEditing}
            required
          />
        </div>

        <div>
          <label
            htmlFor="supplier-part-number"
            className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]"
          >
            {t('inputs.supplierPartNo')}
          </label>
          <input
            id="supplier-part-number"
            type="text"
            className="input w-full"
            placeholder="Ex. 104-XX"
            value={supplierPartNumber}
            onChange={(e) => setSupplierPartNumber(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="cost-price"
              className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]"
            >
              {t('inputs.costPrice')}
            </label>
            <input
              id="cost-price"
              type="number"
              step="0.01"
              min="0"
              className="input w-full"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="discount-percent"
              className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]"
            >
              {t('inputs.discountPercent')}
            </label>
            <input
              id="discount-percent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="input w-full"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="min-purchase-qty"
              className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]"
            >
              {t('inputs.minPurchaseQty')}
            </label>
            <input
              id="min-purchase-qty"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 10"
              className="input w-full"
              value={minPurchaseQty}
              onChange={(e) => setMinPurchaseQty(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="purchase-unit"
              className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]"
            >
              {t('inputs.purchaseUnit')}
            </label>
            <input
              id="purchase-unit"
              type="text"
              placeholder="e.g. EA, BOX, PACK"
              className="input w-full"
              value={purchaseUnit}
              onChange={(e) => setPurchaseUnit(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            id="is-preferred-supplier"
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={isPreferred}
            onChange={(e) => setIsPreferred(e.target.checked)}
            disabled={submitting}
          />
          <label
            htmlFor="is-preferred-supplier"
            className="text-sm font-medium cursor-pointer text-[var(--text-primary)]"
          >
            {t('inputs.isPreferred')}
          </label>
        </div>
      </form>
    </SlideOver>
  );
}

export { AddSupplierModal as AddSupplierSlideOver };

