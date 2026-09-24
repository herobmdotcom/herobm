'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import type { StocktakeBin } from '../types';

export interface ProductSearchResult {
  productId: string;
  productNumber: string;
  name: string;
  productType?: string;
  barcode?: string | null;
  imagePath?: string | null;
  description?: string | null;
  baseUom?: string | null;
}

interface AddUnlistedProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBin: StocktakeBin | null;
  onAddProduct: (
    product: ProductSearchResult,
    countedQuantity: number,
  ) => void;
}

export default function AddUnlistedProductModal({
  isOpen,
  onClose,
  activeBin,
  onAddProduct,
}: AddUnlistedProductModalProps) {
  const t = useTranslations('stocktake');
  const tCommon = useTranslations('common');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [initialQuantity, setInitialQuantity] = useState('1');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedProduct(null);
      setInitialQuantity('1');
    }
  }, [isOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.productsControllerFindAll({
          q: val.trim(),
          limit: 20,
        });
        const rawData = res.data as unknown;
        const prods = (Array.isArray(rawData) ? rawData : (rawData as { data?: ProductSearchResult[] })?.data || []) as ProductSearchResult[];
        const inventoryProds = prods.filter((p) => !p.productType || p.productType === 'inventory');
        setSearchResults(inventoryProds.slice(0, 10));
      } catch (err) {
        reportError(err, 'AddUnlistedProductModal_Search');
        toast.error(getErrorMessage(err));
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = parseFloat(initialQuantity);
    if (isNaN(qty) || qty < 0) return;

    onAddProduct(selectedProduct, qty);
    onClose();
  };

  const footerActions = (
    <div className="flex items-center justify-between w-full">
      <Button type="button" variant="secondary" onClick={onClose}>
        {tCommon('cancel')}
      </Button>

      <Button
        type="submit"
        form="add-unlisted-product-form"
        variant="primary"
        disabled={!selectedProduct || isNaN(parseFloat(initialQuantity))}
        className="font-bold"
      >
        {t('addUnlisted.addButton')}
      </Button>
    </div>
  );

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('addUnlisted.title')}
      subtitle={t('addUnlisted.subtitle', { bin: activeBin?.binNumber || 'Selected Bin' })}
      width="max-w-xl"
      footer={footerActions}
    >
      <div className="flex flex-col gap-5 p-4 -mt-4">
        <form
          id="add-unlisted-product-form"
          onSubmit={handleConfirm}
          className="flex flex-col gap-4"
        >
          {/* Search Box */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="add-product-search-input"
              className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
            >
              {t('addUnlisted.searchLabel')}
            </label>
            <div className="relative">
              <input
                id="add-product-search-input"
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={t('addUnlisted.searchPlaceholder')}
                className="w-full px-3.5 py-2.5 pl-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                autoComplete="off"
                autoFocus
              />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[var(--text-muted)] text-lg">search</span>
              {isSearching && (
                /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                <span className="material-symbols-outlined absolute right-3 top-2.5 text-[var(--accent)] text-lg animate-spin">refresh</span>
              )}
            </div>
          </div>

          {/* Search Results List */}
          {searchResults.length > 0 && !selectedProduct && (
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto border border-[var(--border)] rounded-xl p-1.5 bg-[var(--bg-card)]">
              {searchResults.map((prod) => (
                <div
                  key={prod.productId}
                  onClick={() => {
                    setSelectedProduct(prod);
                    setSearchResults([]);
                  }}
                  className="p-2.5 rounded-lg hover:bg-[var(--bg-secondary)] cursor-pointer flex items-center justify-between transition-colors text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-mono font-bold text-[var(--accent)] text-sm">
                      {prod.productNumber}
                    </div>
                    <div className="text-[var(--text-primary)] truncate font-medium">
                      {prod.name}
                    </div>
                  </div>
                  {prod.barcode && (
                    <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded border border-[var(--border)] shrink-0">
                      {prod.barcode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected Product Card */}
          {selectedProduct && (
            <div className="p-3.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block mb-0.5">
                  {t('addUnlisted.selectedProduct')}
                </span>
                <div className="font-mono font-bold text-base text-[var(--text-primary)]">
                  {selectedProduct.productNumber}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {selectedProduct.name}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProduct(null)}
                className="text-xs text-[var(--text-muted)] hover:text-red-500 underline p-0 h-auto"
              >
                {t('addUnlisted.change')}
              </Button>
            </div>
          )}

          {/* Quantity Input */}
          {selectedProduct && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="unlisted-qty-input"
                className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
              >
                {t('addUnlisted.physicalCountLabel')} ({selectedProduct.baseUom || t('defaultUom')})
              </label>
              <input
                id="unlisted-qty-input"
                type="number"
                min="0"
                step="any"
                required
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                className="px-3 py-2 text-base rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono font-bold"
              />
            </div>
          )}
        </form>
      </div>
    </SlideOver>
  );
}
