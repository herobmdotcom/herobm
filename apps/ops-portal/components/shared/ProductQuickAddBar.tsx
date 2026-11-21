'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import ProductSearchInput, { type Product } from './ProductSearchInput';
import { Button } from './Button';

export interface ProductQuickAddBarProps {
  onAdd: (product: Product, quantity: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  fulfillmentLocationId?: string;
  structureType?: 'standard' | 'kit';
  productType?: string;
  disabled?: boolean;
  /** When true, pressing '/' outside of form inputs focuses the product search input */
  enableShortcut?: boolean;
  /** Optional 1-based line number where the next added item will be inserted */
  insertAtLineNumber?: number | null;
  /** Called when the user cancels the insert-at position */
  onCancelInsert?: () => void;
  /** Increment to programmatically focus the search input */
  focusTrigger?: number;
}

export function ProductQuickAddBar({
  onAdd,
  placeholder,
  className,
  fulfillmentLocationId,
  structureType,
  productType,
  disabled = false,
  enableShortcut = true,
  insertAtLineNumber = null,
  onCancelInsert,
  focusTrigger = 0,
}: ProductQuickAddBarProps) {
  const t = useTranslations('common.productSearch');

  const [stagedProduct, setStagedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const shouldRefocusSearchRef = useRef(false);

  // Global '/' shortcut to jump straight into product search without touching the mouse
  useEffect(() => {
    if (!enableShortcut || disabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      e.preventDefault();
      if (stagedProduct) {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      } else {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [enableShortcut, disabled, stagedProduct]);

  // Auto-focus and select the qty input as soon as a product is staged
  useEffect(() => {
    if (stagedProduct && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [stagedProduct]);

  // Refocus search input once we return from staging / async submission completes
  useEffect(() => {
    if (!stagedProduct && !disabled && !submitting && shouldRefocusSearchRef.current) {
      shouldRefocusSearchRef.current = false;
      searchInputRef.current?.focus();
    }
  }, [stagedProduct, disabled, submitting]);

  // Programmatic focus trigger (e.g. when clicking "+ Insert above" on a line)
  useEffect(() => {
    if (focusTrigger > 0 && !disabled) {
      if (stagedProduct) {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      } else {
        searchInputRef.current?.focus();
      }
    }
  }, [focusTrigger, disabled, stagedProduct]);

  const handleProductSelect = useCallback((product: Product) => {
    setStagedProduct(product);
    setQty('1');
  }, []);

  const handleCancel = useCallback(() => {
    shouldRefocusSearchRef.current = true;
    setStagedProduct(null);
    setQty('1');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!stagedProduct || submitting || disabled) return;
    const parsed = parseFloat(qty);
    const finalQty = !isNaN(parsed) && parsed > 0 ? qty.trim() : '1';

    setSubmitting(true);
    try {
      await onAdd(stagedProduct, finalQty);
    } finally {
      shouldRefocusSearchRef.current = true;
      setSubmitting(false);
      setStagedProduct(null);
      setQty('1');
    }
  }, [stagedProduct, qty, submitting, disabled, onAdd]);

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const insertBadge = insertAtLineNumber ? (
    <span className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)]/30 text-[var(--accent)] font-semibold text-xs whitespace-nowrap shrink-0">
      <span>{t('insertingAt', { lineNumber: insertAtLineNumber })}</span>
      {onCancelInsert && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancelInsert}
          aria-label={t('cancelInsert')}
          className="hover:text-[var(--text-primary)] leading-none cursor-pointer !w-4 !h-4 !p-0 !border-0"
        >
          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
        </Button>
      )}
    </span>
  ) : null;

  if (stagedProduct) {
    return (
      <div className={`flex items-center gap-1.5 w-full ${className || ''}`}>
        {insertBadge}
        <div
          className="flex items-center gap-1.5 flex-1 min-w-[140px] h-8 px-2.5 rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)]/20 text-xs overflow-hidden"
          title={`${stagedProduct.productNumber} — ${stagedProduct.name}`}
        >
          <span className="font-mono font-semibold text-[var(--accent)] shrink-0">
            {stagedProduct.productNumber}
          </span>
          <span className="text-[var(--text-secondary)] truncate">
            {stagedProduct.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={submitting}
            aria-label={t('cancelSelection')}
            className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] !w-4 !h-4 !p-0 !border-0 leading-none cursor-pointer shrink-0"
          >
            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
          </Button>
        </div>
        <input
          ref={qtyInputRef}
          type="number"
          min="0"
          step="any"
          aria-label={t('qtyLabel')}
          placeholder={t('qtyPlaceholder')}
          value={qty}
          disabled={disabled || submitting}
          onChange={(e) => setQty(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={handleQtyKeyDown}
          className="input !w-20 text-right tabular-nums !text-xs !h-8 !py-1 !px-2 shrink-0"
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-8 whitespace-nowrap shrink-0"
          onClick={() => void handleConfirm()}
          disabled={disabled || submitting}
        >
          {t('add')}
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 w-full ${className || ''}`}>
      {insertBadge}
      <div className="flex-1 min-w-0">
        <ProductSearchInput
          onSelect={handleProductSelect}
          placeholder={placeholder}
          className="w-full"
          fulfillmentLocationId={fulfillmentLocationId}
          structureType={structureType}
          productType={productType}
          disabled={disabled}
          inputRef={searchInputRef}
          shortcutHint={enableShortcut ? '/' : undefined}
        />
      </div>
    </div>
  );
}

export default ProductQuickAddBar;
