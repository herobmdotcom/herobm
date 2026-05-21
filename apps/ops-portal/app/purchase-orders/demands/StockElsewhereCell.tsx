'use client';

import {
  computeStockElsewhereDisplay,
  type AvailableElsewhereEntry,
} from './stock-elsewhere-utils';

interface StockElsewhereCellProps {
  availableElsewhere: AvailableElsewhereEntry[];
  requiredQty: number;
}

/**
 * Cell renderer for the "Stock Elsewhere" column in the open demand grid.
 *
 * Picks the single location with the highest available quantity (excluding
 * the demand's destination, which is already filtered server-side), shows
 * an overflow badge if other locations also have stock, and colours the
 * cell green/amber based on whether the single best location fully covers
 * the demand.
 */
export default function StockElsewhereCell({
  availableElsewhere,
  requiredQty,
}: StockElsewhereCellProps) {
  const { label, overflow, signal } = computeStockElsewhereDisplay(
    availableElsewhere,
    requiredQty,
  );

  if (signal === 'empty' || !label) {
    return null;
  }

  const colorClass =
    signal === 'green'
      ? 'text-[var(--success)]'
      : 'text-[var(--warning)]';

  return (
    <span className={`font-medium ${colorClass}`}>
      {label}
      {overflow > 0 && (
        <span className="ml-1 text-[var(--text-muted)] font-normal">
          +{overflow}
        </span>
      )}
    </span>
  );
}
