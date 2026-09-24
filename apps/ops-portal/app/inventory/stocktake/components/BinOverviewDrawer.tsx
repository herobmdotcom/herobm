'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import type { StocktakeBin, StocktakeItem } from '../types';
import { getCountStatus } from './StocktakeLineItem';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

interface BinOverviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bins: StocktakeBin[];
  items?: StocktakeItem[];
  stocktakeId?: string;
  confirmedEmptyBinIds?: string[];
  activeBinId: string;
  onSelectBin: (binId: string) => void;
}

export default function BinOverviewDrawer({
  isOpen,
  onClose,
  bins,
  items,
  stocktakeId,
  confirmedEmptyBinIds = [],
  activeBinId,
  onSelectBin,
}: BinOverviewDrawerProps) {
  const t = useTranslations('stocktake');
  const tCommon = useTranslations('common');
  const [filterText, setFilterText] = useState('');
  const [fetchedItems, setFetchedItems] = useState<StocktakeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all stocktake lines when drawer opens if stocktakeId is provided
  useEffect(() => {
    if (!isOpen || !stocktakeId) return;
    const sid = stocktakeId;

    let isMounted = true;
    const currentStocktakeId = stocktakeId;
    async function loadAllLines() {
      if (!currentStocktakeId) return;
      setIsLoading(true);
      try {
        const res = await api.stocktakesControllerFindLines(currentStocktakeId, {
          limit: 5000,
        });
        const rawLines = res.data as unknown;
        const linesList = (Array.isArray(rawLines)
          ? rawLines
          : (rawLines as { data?: api.StocktakeLineResponseDto[] })?.data || []) as api.StocktakeLineResponseDto[];

        if (!isMounted) return;
        setFetchedItems(
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
            locationCode: '',
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
        reportError(err, 'BinOverviewDrawer_LoadLines');
        toast.error(getErrorMessage(err));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAllLines();
    return () => {
      isMounted = false;
    };
  }, [isOpen, stocktakeId]);

  const effectiveItems = stocktakeId ? fetchedItems : (items || []);

  // Group items by binId for swift lookup
  const binItemMap = useMemo(() => {
    const map = new Map<string, StocktakeItem[]>();
    effectiveItems.forEach((item) => {
      const list = map.get(item.binId) || [];
      list.push(item);
      map.set(item.binId, list);
    });
    return map;
  }, [effectiveItems]);

  const countedBinsCount = useMemo(() => {
    let count = 0;
    bins.forEach((bin) => {
      const binItems = binItemMap.get(bin.binId) || [];
      const total = binItems.length;
      const counted = binItems.filter((i) => i.countedQuantity !== null).length;
      const uncounted = total - counted;
      if (total === 0) {
        if (confirmedEmptyBinIds.includes(bin.binId)) {
          count++;
        }
      } else if (uncounted === 0) {
        count++;
      }
    });
    return count;
  }, [bins, binItemMap, confirmedEmptyBinIds]);

  const filteredBins = useMemo(() => {
    if (!filterText.trim()) return bins;
    const q = filterText.trim().toLowerCase();
    return bins.filter(
      (b) =>
        b.binNumber.toLowerCase().includes(q) ||
        (b.zoneCode && b.zoneCode.toLowerCase().includes(q)),
    );
  }, [bins, filterText]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border)] h-full flex flex-col shadow-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {t('binOverview')}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {isLoading && effectiveItems.length === 0
                ? t('processing')
                : t('binCountSummary', { counted: countedBinsCount, total: bins.length })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={tCommon('close')}
            className="text-xs font-semibold"
          >
            {tCommon('close')}
          </Button>
        </div>

        {/* Search / Filter Input */}
        <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t('searchBinsPlaceholder')}
            className="input input-sm w-full text-xs"
            autoFocus
          />
        </div>

        {/* Bins List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {isLoading && effectiveItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)] animate-pulse">
              {t('processing')}
            </div>
          ) : filteredBins.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              {t('noBinsFound')}
            </div>
          ) : (
            filteredBins.map((bin, index) => {
              const binItems = binItemMap.get(bin.binId) || [];
              const total = binItems.length;
              const counted = binItems.filter((i) => i.countedQuantity !== null).length;
              const uncounted = total - counted;

              let hasDiscrepancy = false;
              binItems.forEach((i) => {
                if (i.countedQuantity !== null) {
                  const st = getCountStatus(i);
                  if (st === 'surplus' || st === 'shortage') hasDiscrepancy = true;
                }
              });

              let badgeVariant = 'badge-secondary';
              let badgeLabel = t('binStatus.uncounted');

              if (total === 0) {
                if (confirmedEmptyBinIds.includes(bin.binId)) {
                  badgeVariant = 'badge-success';
                  badgeLabel = t('binStatus.confirmedEmpty');
                } else {
                  badgeVariant = 'badge-secondary';
                  badgeLabel = t('binStatus.empty');
                }
              } else if (uncounted === 0) {
                if (hasDiscrepancy) {
                  badgeVariant = 'badge-warning';
                  badgeLabel = t('binStatus.discrepancy');
                } else {
                  badgeVariant = 'badge-success';
                  badgeLabel = t('binStatus.counted');
                }
              } else if (counted > 0) {
                badgeVariant = 'badge-info';
                badgeLabel = t('binStatus.inProgress');
              }

              const isActive = activeBinId === bin.binId;

              return (
                <div
                  key={bin.binId}
                  onClick={() => {
                    onSelectBin(bin.binId);
                    onClose();
                  }}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        #{index + 1}
                      </span>
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)] truncate">
                        {bin.binNumber}
                      </span>
                      {bin.zoneCode && (
                        <span className="badge badge-secondary font-mono text-[10px] px-1.5 py-0">
                          {bin.zoneCode}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {total === 1
                        ? `1 ${t('summary.items').toLowerCase()}`
                        : `${total} ${t('summary.items').toLowerCase()}`}
                      {counted > 0 && ` • ${counted} ${t('counted').toLowerCase()}`}
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className={`badge ${badgeVariant} text-xs font-semibold`}>
                      {badgeLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
