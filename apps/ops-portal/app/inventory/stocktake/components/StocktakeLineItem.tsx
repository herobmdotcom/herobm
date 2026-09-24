'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import ProductImage from '@/components/products/ProductImage';
import type { StocktakeItem, StocktakeCountStatus } from '../types';

interface StocktakeLineItemProps {
  item: StocktakeItem;
  isSelected?: boolean;
  isBlindCount: boolean;
  onSelect?: (itemId: string) => void;
  onUpdateCount: (itemId: string, newCount: number | null) => void;
  onIncrement?: (itemId: string, delta: number) => void;
  onUpdateNotes?: (itemId: string, notes: string) => void;
}

export function getCountStatus(item: StocktakeItem): StocktakeCountStatus {
  if (item.countedQuantity === null || item.countedQuantity === undefined) {
    return 'uncounted';
  }
  const variance = item.countedQuantity - item.expectedQuantity;
  if (Math.abs(variance) < 0.0001) {
    return 'match';
  }
  return variance > 0 ? 'surplus' : 'shortage';
}

export default function StocktakeLineItem({
  item,
  isSelected = false,
  isBlindCount,
  onSelect,
  onUpdateCount,
}: StocktakeLineItemProps) {
  const t = useTranslations('stocktake');
  const tCommon = useTranslations('common');
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customInputValue, setCustomInputValue] = useState(
    item.countedQuantity !== null ? String(item.countedQuantity) : '',
  );

  const status = getCountStatus(item);
  const isCounted = item.countedQuantity !== null;
  const counted = item.countedQuantity ?? 0;
  const variance = isCounted ? counted - item.expectedQuantity : null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customInputValue.trim();
    if (val === '') {
      onUpdateCount(item.id, null);
    } else {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateCount(item.id, parsed);
      }
    }
    setIsEditingCustom(false);
  };

  return (
    <div
      data-testid={`stocktake-item-${item.id}`}
      onClick={() => onSelect?.(item.id)}
      className={`rounded-lg border p-3 sm:p-4 transition-all cursor-pointer select-none ${
        isSelected
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/[0.04] shadow-sm'
          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-secondary)]/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Main Content Info (Left/Center) */}
        <div className="min-w-0 flex-1">
          {/* Top Header: SKU, Barcode, Unlisted */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-mono font-bold text-sm text-[var(--accent)]">
                {item.productNumber}
              </span>
              {item.isUnlisted && (
                <span className="badge badge-secondary text-xs">
                  {t('unlistedItem')}
                </span>
              )}
              {item.barcode && (
                <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1">
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                  <span className="material-symbols-outlined text-[14px]">barcode</span>
                  {item.barcode}
                </span>
              )}
            </div>
          </div>

          {/* Product Name & Description */}
          <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
            {item.productName}
          </p>
          {item.description && item.description !== item.productName && (
            <p className="text-xs text-[var(--text-muted)] leading-normal line-clamp-2 mt-0.5">
              {item.description}
            </p>
          )}

          {/* Quantitative Comparison, Status Badge, & Notes on the Same Level */}
          <div className="flex items-start justify-between gap-6 pt-2.5 mt-2 border-t border-[var(--border)] text-xs">
            <div className="flex items-start gap-5 sm:gap-6 flex-wrap">
              {!isBlindCount && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] h-4 flex items-center">
                    {t('expected')}
                  </span>
                  <div className="h-7 flex items-center">
                    <span className="font-mono font-semibold text-sm text-[var(--text-secondary)]">
                      {item.expectedQuantity} {item.baseUom}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] h-4 flex items-center">
                  {t('counted')}
                </span>
                <div className="h-7 flex items-center">
                  {isEditingCustom ? (
                    <form
                      id={`custom-count-form-${item.id}`}
                      onSubmit={handleCustomSubmit}
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min="0"
                        step="any"
                        autoFocus
                        value={customInputValue}
                        onChange={(e) => setCustomInputValue(e.target.value)}
                        className="w-20 input input-sm font-mono font-bold h-7 py-0"
                        placeholder="0"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="xs"
                        aria-label={tCommon('save')}
                        className="font-bold px-2 py-0.5 h-7"
                      >
                        {tCommon('save')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => setIsEditingCustom(false)}
                        aria-label={tCommon('cancel')}
                        className="px-2 py-0.5 h-7"
                      >
                        {tCommon('cancel')}
                      </Button>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        onSelect?.(item.id);
                        setCustomInputValue(
                          item.countedQuantity !== null ? String(item.countedQuantity) : '',
                        );
                        setIsEditingCustom(true);
                      }}
                      className="group h-7 px-2 py-0 font-mono font-bold text-sm flex items-center gap-1.5 border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 hover:text-[var(--accent)] rounded-md bg-[var(--bg-secondary)]/50 transition-all cursor-pointer"
                      title={t('clickToEditQty')}
                    >
                      <span className={!isCounted ? 'text-[var(--text-muted)] italic font-normal text-xs' : 'text-[var(--text-primary)] group-hover:text-[var(--accent)]'}>
                        {isCounted ? `${item.countedQuantity} ${item.baseUom}` : t('notCounted')}
                      </span>
                      <span className="material-symbols-outlined text-[13px] text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-colors">
                        edit
                      </span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Status / Variance Badge (Circle with tick, -N, +N on the same level) */}
              {isCounted && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] h-4 flex items-center opacity-0 select-none">
                    -
                  </span>
                  <div className="h-7 flex items-center">
                    {status === 'match' ? (
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-bold shrink-0"
                        title={t('status.match')}
                        aria-label={t('status.match')}
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </span>
                    ) : status === 'surplus' ? (
                      <span
                        className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 text-xs font-bold shrink-0 font-mono"
                        title={t('status.surplus', { count: `+${(variance ?? 0).toFixed(0)}` })}
                        aria-label={t('status.surplus', { count: `+${(variance ?? 0).toFixed(0)}` })}
                      >
                        +{(variance ?? 0).toFixed(0)}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-xs font-bold shrink-0 font-mono"
                        title={t('status.shortage', { count: (variance ?? 0).toFixed(0) })}
                        aria-label={t('status.shortage', { count: (variance ?? 0).toFixed(0) })}
                      >
                        {(variance ?? 0).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {item.notes && (
              <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 bg-[var(--bg-secondary)] px-2.5 py-1 rounded-lg border border-[var(--border)] self-center max-w-[200px] truncate">
                <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)] shrink-0">sticky_note_2</span>
                <span className="font-medium truncate">{item.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Product Image on the Right (hidden if fallback) */}
        <ProductImage
          imagePath={item.imagePath}
          alt={item.productName}
          size="md"
          className="rounded-lg border border-[var(--border)] shadow-xs shrink-0 self-start"
          showPreviewOnClick
          hideFallback
        />
      </div>
    </div>
  );
}
