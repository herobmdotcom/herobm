'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { PRODUCT_STATE, getErrorMessage, isServiceProductType } from '@herobm/shared';
import { reportError } from '@/lib/api';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import GroupSelect from '@/components/shared/GroupSelect';

export interface CreateProductSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: api.ProductResponseDto) => void;
  vendorId?: string;
  vendorName?: string;
}

export default function CreateProductSlideOver({
  isOpen,
  onClose,
  onSuccess,
  vendorId,
  vendorName,
}: CreateProductSlideOverProps) {
  const tProducts = useTranslations('products');
  const tCommon = useTranslations('common');

  const [submitting, setSubmitting] = useState(false);
  const [uomDictionary, setUomDictionary] = useState<api.UomResponseDto[]>([]);

  const [productNumber, setProductNumber] = useState('');
  const [name, setName] = useState('');
  const [baseUom, setBaseUom] = useState('');
  const [productType, setProductType] = useState('inventory');
  const [structureType, setStructureType] = useState('standard');
  const [stateCode, setStateCode] = useState<string>(PRODUCT_STATE.ACTIVE);
  const [productGroupId, setProductGroupId] = useState<string | null>(null);
  const [standardCost, setStandardCost] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [barcode, setBarcode] = useState('');

  // Load UoM dictionary
  useEffect(() => {
    if (isOpen) {
      api.uomDictionaryControllerFindAll()
        .then((res: unknown) => {
          const uoms = (res as { data: api.UomResponseDto[] }).data || [];
          setUomDictionary(uoms);
          if (!baseUom) {
            const firstGoods = uoms.find((u) => (u.category || 'goods') === 'goods');
            if (firstGoods) {
              setBaseUom(firstGoods.uomCode);
            }
          }
        })
        .catch((err) => toast.error('Failed to load UOM dictionary: ' + getErrorMessage(err)));
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProductNumber('');
      setName('');
      setProductType('inventory');
      setStructureType('standard');
      setStateCode(PRODUCT_STATE.ACTIVE);
      setProductGroupId(null);
      setStandardCost('');
      setListPrice('');
      setBarcode('');
    }
  }, [isOpen]);

  const filteredUoms = useMemo(() => {
    const isService = isServiceProductType(productType);
    return uomDictionary.filter((u) => {
      const cat = u.category || 'goods';
      return isService ? cat === 'service' : cat === 'goods';
    });
  }, [uomDictionary, productType]);

  const handleProductTypeChange = (newType: string) => {
    setProductType(newType);
    const isNewService = isServiceProductType(newType);
    const currentUom = uomDictionary.find((u) => u.uomCode === baseUom);
    const currentCat = currentUom?.category || 'goods';
    if ((isNewService && currentCat !== 'service') || (!isNewService && currentCat === 'service')) {
      const validUom = uomDictionary.find((u) => {
        const cat = u.category || 'goods';
        return isNewService ? cat === 'service' : cat === 'goods';
      });
      setBaseUom(validUom ? validUom.uomCode : '');
    }
  };

  const handleStructureTypeChange = (newStructure: string) => {
    setStructureType(newStructure);
    if (newStructure === 'kit') {
      setProductType('non-stock');
    }
  };

  const isValid =
    productNumber.trim() !== '' &&
    name.trim() !== '' &&
    baseUom.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        productNumber: productNumber.trim(),
        name: name.trim(),
        baseUom: baseUom.trim(),
        productType,
        structureType,
        stateCode,
      };

      if (productGroupId) {
        payload.productGroupId = productGroupId;
      }
      if (standardCost.trim()) {
        payload.standardCost = standardCost.trim();
      }
      if (listPrice.trim()) {
        payload.listPrice = listPrice.trim();
      }
      if (barcode.trim()) {
        payload.barcode = barcode.trim();
      }

      const res = await api.productsControllerCreate(
        payload as unknown as api.CreateProductDto,
      );
      const createdProduct = res.data;

      // Automatically link active supplier if vendorId is provided
      if (vendorId) {
        try {
          await api.productsControllerAddSupplier(createdProduct.productId, {
            vendorId,
            costPrice: parseFloat(standardCost) || 0,
            isPreferred: true,
          });
        } catch (supplierErr: unknown) {
          toast.error(getErrorMessage(supplierErr));
          reportError(supplierErr, 'CreateProductSlideOver.addSupplier');
        }
      }

      toast.success(tProducts('createSlideOver.success') || tCommon('saved'));
      onSuccess(createdProduct);
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
      title={tProducts('createSlideOver.title')}
      subtitle={vendorName ? tProducts('createSlideOver.supplierLinkNote', { vendorName }) : tProducts('createSlideOver.subtitle')}
      width="max-w-md sm:max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="create-product-form"
            variant="primary"
            disabled={submitting || !isValid}
          >
            {submitting ? tCommon('saving') : tProducts('createSlideOver.submit')}
          </Button>
        </div>
      }
    >
      <form id="create-product-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Identity Section */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5 pb-1 border-b border-[var(--border)]">
            <span className="material-symbols-outlined text-[18px]">badge</span>
            {tProducts('cards.identity')}
          </h4>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="create-product-number" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('columns.productNumber')} *
              </label>
              <input
                id="create-product-number"
                type="text"
                className="input w-full"
                value={productNumber}
                onChange={(e) => setProductNumber(e.target.value)}
                placeholder={tProducts('placeholders.productNumber')}
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label htmlFor="create-product-name" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('productName')} *
              </label>
              <input
                id="create-product-name"
                type="text"
                className="input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tProducts('placeholders.productName')}
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label htmlFor="create-product-uom" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('baseUom')} *
              </label>
              <select
                id="create-product-uom"
                className="input w-full"
                value={baseUom}
                onChange={(e) => setBaseUom(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="" disabled>
                  {tCommon('selectOption')}
                </option>
                {filteredUoms.map((u) => (
                  <option key={u.uomCode} value={u.uomCode}>
                    {u.uomCode}{u.description ? ` — ${u.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Classification Section */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5 pb-1 border-b border-[var(--border)]">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI icon */}
            <span className="material-symbols-outlined text-[18px]">category</span>
            {tProducts('cards.classification')}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-product-type" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.type')}
              </label>
              <select
                id="create-product-type"
                className="input w-full"
                value={productType}
                onChange={(e) => handleProductTypeChange(e.target.value)}
                disabled={submitting}
              >
                <option value="inventory">{tProducts('types.inventory')}</option>
                <option value="non-stock">{tProducts('types.nonStock')}</option>
                <option value="service">{tProducts('types.service')}</option>
                <option value="freight">{tProducts('types.freight')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-product-structure" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('structureType')}
              </label>
              <select
                id="create-product-structure"
                className="input w-full"
                value={structureType}
                onChange={(e) => handleStructureTypeChange(e.target.value)}
                disabled={submitting}
              >
                <option value="standard">{tProducts('structures.standard')}</option>
                <option value="kit">{tProducts('structures.kit')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-product-status" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.status')}
              </label>
              <select
                id="create-product-status"
                className="input w-full"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                disabled={submitting}
              >
                <option value={PRODUCT_STATE.ACTIVE}>{tCommon('states.active')}</option>
                <option value={PRODUCT_STATE.INACTIVE}>{tCommon('states.inactive')}</option>
                <option value={PRODUCT_STATE.DISCONTINUED}>{tCommon('states.discontinued')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-product-group" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('productGroup')}
              </label>
              <GroupSelect
                type="product"
                value={productGroupId}
                onChange={(val) => setProductGroupId(val || null)}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        {/* Pricing & Cost Section */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5 pb-1 border-b border-[var(--border)]">
            <span className="material-symbols-outlined text-[18px]">payments</span>
            {tProducts('cards.pricing')}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-product-cost" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('createSlideOver.standardCost')}
              </label>
              <input
                id="create-product-cost"
                type="number"
                step="0.01"
                min="0"
                className="input w-full text-right"
                value={standardCost}
                onChange={(e) => setStandardCost(e.target.value)}
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="create-product-list-price" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('createSlideOver.listPrice')}
              </label>
              <input
                id="create-product-list-price"
                type="number"
                step="0.01"
                min="0"
                className="input w-full text-right"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="create-product-barcode" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tProducts('columns.barcode')}
              </label>
              <input
                id="create-product-barcode"
                type="text"
                className="input w-full"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder={tProducts('placeholders.barcode')}
                disabled={submitting}
              />
            </div>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
