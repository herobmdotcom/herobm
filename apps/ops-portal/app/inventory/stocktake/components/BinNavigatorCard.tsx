'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import type { StocktakeBin } from '../types';

interface BinNavigatorCardProps {
  activeBin: StocktakeBin | null;
  currentIndex: number;
  totalBins: number;
  onPreviousBin: () => void;
  onNextBin: () => void;
  onMarkBinEmpty?: () => void;
  hasUncountedItems?: boolean;
}

export default function BinNavigatorCard({
  activeBin,
  currentIndex,
  totalBins,
  onPreviousBin,
  onNextBin,
}: BinNavigatorCardProps) {
  const t = useTranslations('stocktake');

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < totalBins - 1;

  return (
    <div className="card flex items-center justify-between gap-3">
      {/* Previous Bin Button (Icon Only) */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        icon="chevron_left"
        onClick={onPreviousBin}
        disabled={!hasPrevious}
        aria-label={t('previousBin')}
        title={t('previousBin')}
      />

      {/* Current Bin Identification */}
      <div className="flex flex-col items-center justify-center text-center">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)]">
          {totalBins > 0
            ? t('binOfTotal', { current: currentIndex + 1, total: totalBins })
            : t('activeBin')}
        </span>
        <h2 className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text-primary)]">
          {activeBin ? activeBin.binNumber : t('allBinsOption')}
        </h2>
      </div>

      {/* Next Bin Button (Icon Only) */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        icon="chevron_right"
        onClick={onNextBin}
        disabled={!hasNext}
        aria-label={t('nextBin')}
        title={t('nextBin')}
      />
    </div>
  );
}
