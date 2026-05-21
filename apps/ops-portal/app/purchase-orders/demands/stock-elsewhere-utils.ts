export interface AvailableElsewhereEntry {
  locationId: string;
  locationName: string;
  availableQty: number;
}

export interface StockElsewhereDisplay {
  /** Rendered text, e.g. "12 @ Warehouse B". Empty string when no stock. */
  label: string;
  /** Overflow count when stock exists at more than one location ("+N"). 0 when not applicable. */
  overflow: number;
  /**
   * Colour signal for the single best location:
   *   - 'green'  → best.availableQty >= requiredQty (fully covers demand)
   *   - 'amber'  → 0 < best.availableQty < requiredQty (partial cover)
   *   - 'empty'  → no stock anywhere else
   *
   * Coverage is intentionally measured against the best single location
   * only — we do NOT aggregate stock across locations for the colour
   * signal because the user can only transfer from one source at a time.
   */
  signal: 'green' | 'amber' | 'empty';
  /** The best (highest qty) entry, or null when the input array is empty. */
  best: AvailableElsewhereEntry | null;
}

/**
 * Pure helper that decides how the "Stock Elsewhere" grid cell should render.
 *
 * Extracted from the cell renderer for unit testing — the renderer in
 * `StockElsewhereCell.tsx` is a thin wrapper that only deals with React.
 */
export function computeStockElsewhereDisplay(
  availableElsewhere: AvailableElsewhereEntry[] | undefined | null,
  requiredQty: number,
): StockElsewhereDisplay {
  const entries = Array.isArray(availableElsewhere) ? availableElsewhere : [];
  if (entries.length === 0) {
    return { label: '', overflow: 0, signal: 'empty', best: null };
  }

  const sorted = [...entries].sort((a, b) => b.availableQty - a.availableQty);
  const best = sorted[0];
  const overflow = sorted.length - 1;
  const label = `${formatQty(best.availableQty)} @ ${best.locationName}`;

  let signal: StockElsewhereDisplay['signal'];
  if (best.availableQty <= 0) {
    signal = 'empty';
  } else if (best.availableQty >= requiredQty) {
    signal = 'green';
  } else {
    signal = 'amber';
  }

  return { label, overflow, signal, best };
}

function formatQty(qty: number): string {
  // Display whole numbers without a trailing ".0"; preserve up to 2 decimals.
  if (Number.isInteger(qty)) return qty.toString();
  return Number(qty.toFixed(2)).toString();
}
