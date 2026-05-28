export const PICKABLE_BIN_TYPES = ['storage', 'pick', 'bulk'] as const;

export interface BinState {
  binType: string | null;
  isUnavailable: boolean | null;
  actualQuantity?: string | number | null;
  quantity?: string | number | null;
  onHand?: string | number | null;
}

/**
 * The single source of truth for whether a bin is eligible for general fulfillment.
 *
 * Standardized to a POSITIVE whitelist (storage, pick, bulk) to ensure that
 * newly introduced, unhandled bin types default securely to exclusion.
 */
export function isPickableBin(bin: {
  binType: string | null;
  isUnavailable: boolean | null;
}): boolean {
  if (bin.isUnavailable) {
    return false;
  }
  if (!bin.binType) {
    return false;
  }
  return (PICKABLE_BIN_TYPES as readonly string[]).includes(bin.binType);
}

/**
 * Filters a generic array of bin records down to only those that are pickable.
 */
export function filterPickableBins<T extends BinState>(bins: T[]): T[] {
  return bins.filter(isPickableBin);
}

/**
 * Given a generic array of bin records, filters them for pickability
 * and sums their available quantity.
 */
export function calculatePickableOnHand<T extends BinState>(bins: T[]): number {
  return filterPickableBins(bins).reduce((sum, bin) => {
    // Attempt to extract the quantity field regardless of how the query named it
    let qty: string | number | null = 0;
    if (bin.actualQuantity !== undefined) qty = bin.actualQuantity;
    else if (bin.quantity !== undefined) qty = bin.quantity;
    else if (bin.onHand !== undefined) qty = bin.onHand;

    const parsed = parseFloat(qty as string) || 0;
    return sum + parsed;
  }, 0);
}
