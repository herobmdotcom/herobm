import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import Tabs, { type TabItem } from '@/components/shared/Tabs';
import InlineAlert from '@/components/shared/InlineAlert';
import { compareBinNumbers, getErrorMessage } from '@herobm/shared';
import type { StocktakeItem } from '../types';
import { getCountStatus } from './StocktakeLineItem';

import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';

interface StocktakeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  stocktakeId: string;
  locationCode: string;
  canWrite: boolean;
  onSubmitReconciliation: (reason: string) => Promise<void>;
  onReopen?: () => Promise<void>;
}

export default function StocktakeReviewModal({
  isOpen,
  onClose,
  stocktakeId,
  locationCode,
  canWrite,
  onSubmitReconciliation,
  onReopen,
}: StocktakeReviewModalProps) {
  const t = useTranslations('stocktake');
  const tCommon = useTranslations('common');

  const todayStr = new Date().toISOString().slice(0, 10);
  const [reason, setReason] = useState(`Physical Stocktake ${locationCode} - ${todayStr}`);
  type ReviewTab = 'discrepancies' | 'uncounted' | 'all_counted';
  const [activeTab, setActiveTab] = useState<ReviewTab>('discrepancies');
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewItems, setReviewItems] = useState<StocktakeItem[]>([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setHasSetInitialTab(false);
      return;
    }
    if (!stocktakeId) return;

    let isMounted = true;
    async function loadReviewLines() {
      setIsLoadingReview(true);
      try {
        const res = await api.stocktakesControllerFindLines(stocktakeId, {
          limit: 2000,
        });
        const rawLines = res.data as unknown;
        const linesList = (Array.isArray(rawLines)
          ? rawLines
          : (rawLines as { data?: api.StocktakeLineResponseDto[] })?.data || []) as api.StocktakeLineResponseDto[];

        if (!isMounted) return;
        setReviewItems(
          linesList.map((line) => ({
            id: line.stocktakeLineId,
            productId: line.productId,
            productNumber: line.productNumber || line.productId,
            productName: line.productName || line.productNumber || line.productId,
            barcode: line.barcode || null,
            alternateProductNumber: line.alternateProductNumber || null,
            imagePath: null,
            description: null,
            baseUom: line.baseUom || 'EA',
            binId: line.binId,
            binNumber: line.binNumber,
            zoneCode: line.zoneCode || undefined,
            locationId: '',
            locationCode,
            expectedQuantity:
              line.expectedQuantity !== null && line.expectedQuantity !== undefined
                ? parseFloat(String(line.expectedQuantity))
                : 0,
            countedQuantity:
              line.countedQuantity !== null && line.countedQuantity !== undefined
                ? parseFloat(String(line.countedQuantity))
                : null,
            isUnlisted: line.isUnlisted || false,
            notes: line.notes || undefined,
            lastCountedAt: line.lastCountedAt ? new Date(line.lastCountedAt) : undefined,
          })),
        );
      } catch (err) {
        reportError(err, 'StocktakeReviewModal_Load');
        toast.error(getErrorMessage(err));
      } finally {
        if (isMounted) setIsLoadingReview(false);
      }
    }

    loadReviewLines();
    return () => {
      isMounted = false;
    };
  }, [isOpen, stocktakeId, locationCode]);

  const countedItems = useMemo(() => {
    return reviewItems
      .filter((i) => i.countedQuantity !== null)
      .sort((a, b) => {
        const binCmp = compareBinNumbers(a.binNumber, b.binNumber);
        if (binCmp !== 0) return binCmp;
        return compareBinNumbers(a.productNumber, b.productNumber);
      });
  }, [reviewItems]);

  const uncountedItems = useMemo(() => {
    return reviewItems
      .filter((i) => i.countedQuantity === null)
      .sort((a, b) => {
        const binCmp = compareBinNumbers(a.binNumber, b.binNumber);
        if (binCmp !== 0) return binCmp;
        return compareBinNumbers(a.productNumber, b.productNumber);
      });
  }, [reviewItems]);

  const uncountedCount = uncountedItems.length;

  const discrepancyItems = useMemo(() => {
    return countedItems.filter((i) => getCountStatus(i) !== 'match');
  }, [countedItems]);

  const totalVariancesCount = discrepancyItems.length;

  // Auto-default tab to uncounted if uncounted lines exist upon load
  useEffect(() => {
    if (reviewItems.length > 0 && !hasSetInitialTab) {
      if (uncountedCount > 0) {
        setActiveTab('uncounted');
      } else {
        setActiveTab('discrepancies');
      }
      setHasSetInitialTab(true);
    }
  }, [reviewItems, uncountedCount, hasSetInitialTab]);

  const reviewTabs = useMemo<TabItem<ReviewTab>[]>(
    () => [
      {
        id: 'discrepancies',
        label: t('review.tabDiscrepancies', { count: totalVariancesCount }),
        color: totalVariancesCount > 0 ? 'amber' : 'accent',
      },
      {
        id: 'uncounted',
        label: t('review.tabUncounted', { count: uncountedCount }),
        color: uncountedCount > 0 ? 'warning' : 'accent',
      },
      {
        id: 'all_counted',
        label: t('review.tabAllCounted', { count: countedItems.length }),
        color: 'accent',
      },
    ],
    [t, totalVariancesCount, uncountedCount, countedItems.length],
  );

  const displayedItems = useMemo(() => {
    if (activeTab === 'discrepancies') return discrepancyItems;
    if (activeTab === 'uncounted') return uncountedItems;
    return countedItems;
  }, [activeTab, discrepancyItems, uncountedItems, countedItems]);

  let totalAdditions = 0;
  let totalReductions = 0;

  discrepancyItems.forEach((item) => {
    const diff = (item.countedQuantity ?? 0) - item.expectedQuantity;
    if (diff > 0) totalAdditions += diff;
    if (diff < 0) totalReductions += Math.abs(diff);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || isSubmitting || uncountedCount > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmitReconciliation(reason.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const footerActions = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>

        {onReopen && canWrite && (
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              await onReopen();
              onClose();
            }}
            disabled={isSubmitting}
          >
            {t('reopen')}
          </Button>
        )}
      </div>

      <Button
        type="submit"
        form="stocktake-review-form"
        variant="primary"
        loading={isSubmitting}
        disabled={
          isSubmitting ||
          !canWrite ||
          uncountedCount > 0 ||
          (countedItems.length === 0 && !isLoadingReview)
        }
        className="font-bold flex items-center gap-2"
      >
        <span>
          {isSubmitting ? t('review.committing') : t('review.commitAdjustments')}
        </span>
      </Button>
    </div>
  );

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('review.title')}
      subtitle={t('review.subtitle', { count: countedItems.length })}
      width="max-w-3xl"
      footer={footerActions}
    >
      <div className="flex flex-col gap-5 p-4 -mt-4">
        {/* Permission warning if user has read-only access */}
        {!canWrite && (
          <InlineAlert
            type="warning"
            message={t('review.readOnlyWarning')}
          />
        )}

        {/* Blocking alert if uncounted items remain */}
        {uncountedCount > 0 && (
          <InlineAlert
            type="error"
            message={t('uncountedBlockingAlert', { count: uncountedCount })}
          />
        )}

        {/* Metrics Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="card p-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              {t('review.totalCounted')}
            </span>
            <span className="font-mono font-bold text-lg text-[var(--text-primary)]">
              {countedItems.length}
            </span>
          </div>

          <div className="card p-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              {t('review.discrepancies')}
            </span>
            <span
              className={`font-mono font-bold text-lg ${
                totalVariancesCount > 0 ? 'text-amber-500' : 'text-emerald-500'
              }`}
            >
              {totalVariancesCount}
            </span>
          </div>

          <div className="card p-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              {t('review.additions')}
            </span>
            <span className="font-mono font-bold text-lg text-emerald-500">
              +{totalAdditions}
            </span>
          </div>

          <div className="card p-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              {t('review.reductions')}
            </span>
            <span className="font-mono font-bold text-lg text-rose-500">
              -{totalReductions}
            </span>
          </div>
        </div>

        {/* Form Container */}
        <form
          id="stocktake-review-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* Reason / Memo Input */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="stocktake-reason-input"
              className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
            >
              {t('review.reasonLabel')}
            </label>
            <input
              id="stocktake-reason-input"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('review.reasonPlaceholder')}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
            />
          </div>

          {/* Table Tabs Navigation using standard Tabs component */}
          <Tabs<ReviewTab>
            tabs={reviewTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            size="sm"
            className="mt-2"
          />

          {/* Table of Items */}
          <div className="border border-[var(--border)] rounded-xl overflow-x-auto overflow-y-auto max-h-80 bg-[var(--bg-card)]">
            {displayedItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                {activeTab === 'discrepancies'
                  ? t('review.noVariances')
                  : activeTab === 'uncounted'
                    ? t('review.noUncounted')
                    : t('review.noCountedItems')}
              </div>
            ) : activeTab === 'uncounted' ? (
              <table className="w-full min-w-[500px] text-xs text-left">
                <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 min-w-[150px]">{t('review.table.product')}</th>
                    <th className="px-2 py-2.5 min-w-[70px]">{t('review.table.bin')}</th>
                    <th className="px-2 py-2.5 text-right min-w-[65px] whitespace-nowrap">{t('review.table.recorded')}</th>
                    <th className="px-3 py-2.5 text-right min-w-[80px] whitespace-nowrap">{t('review.table.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {displayedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--bg-secondary)]/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-sans text-[var(--text-primary)]">
                        <div className="font-mono font-bold text-[var(--accent)]">
                          {item.productNumber}
                        </div>
                        <div
                          className="text-[11px] text-[var(--text-secondary)] truncate max-w-[180px] sm:max-w-xs"
                          title={item.productName}
                        >
                          {item.productName}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[var(--text-secondary)] whitespace-nowrap font-medium">
                        {item.binNumber}
                      </td>
                      <td className="px-2 py-2 text-right text-[var(--text-muted)] whitespace-nowrap">
                        {item.expectedQuantity}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded font-sans font-medium text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10">
                          {t('status.uncounted')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[500px] text-xs text-left">
                <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 min-w-[150px]">{t('review.table.product')}</th>
                    <th className="px-2 py-2.5 min-w-[70px]">{t('review.table.bin')}</th>
                    <th className="px-2 py-2.5 text-right min-w-[65px] whitespace-nowrap">{t('review.table.recorded')}</th>
                    <th className="px-2 py-2.5 text-right min-w-[65px] whitespace-nowrap">{t('review.table.counted')}</th>
                    <th className="px-3 py-2.5 text-right min-w-[80px] whitespace-nowrap">{t('review.table.delta')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {displayedItems.map((item) => {
                    const counted = item.countedQuantity ?? 0;
                    const diff = counted - item.expectedQuantity;
                    const isMatch = Math.abs(diff) < 0.0001;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-[var(--bg-secondary)]/50 transition-colors"
                      >
                        <td className="px-3 py-2 font-sans text-[var(--text-primary)]">
                          <div className="font-mono font-bold text-[var(--accent)]">
                            {item.productNumber}
                          </div>
                          <div
                            className="text-[11px] text-[var(--text-secondary)] truncate max-w-[180px] sm:max-w-xs"
                            title={item.productName}
                          >
                            {item.productName}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-[var(--text-secondary)] whitespace-nowrap font-medium">
                          {item.binNumber}
                        </td>
                        <td className="px-2 py-2 text-right text-[var(--text-muted)] whitespace-nowrap">
                          {item.expectedQuantity}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-[var(--text-primary)] whitespace-nowrap">
                          {counted}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-xs ${
                              isMatch
                                ? 'text-[var(--text-muted)] bg-[var(--bg-secondary)]'
                                : diff > 0
                                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                                  : 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {isMatch ? '0' : diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </form>
      </div>
    </SlideOver>
  );
}
