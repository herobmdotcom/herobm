export type PriceRoundingStrategy =
  | 'none'
  | 'nearest_0_05'
  | 'end_95'
  | 'end_99'
  | 'nearest_1';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts a purchase invoice unit cost (which may be billed in a purchase UOM
 * such as a Box of 12) into the effective cost per base unit (e.g. Each).
 */
export function computeBaseUnitCost(
  invoiceUnitCost: number,
  uomRatio: number,
): number {
  if (!Number.isFinite(invoiceUnitCost) || invoiceUnitCost < 0) return 0;
  const safeRatio = Number.isFinite(uomRatio) && uomRatio > 0 ? uomRatio : 1;
  return invoiceUnitCost / safeRatio;
}

/**
 * Returns the percentage change from previousCost to newCost, or null if
 * previousCost is missing or <= 0.
 */
export function computeCostDeltaPercent(
  previousCost: number | null | undefined,
  newCost: number,
): number | null {
  if (
    previousCost === null ||
    previousCost === undefined ||
    !Number.isFinite(previousCost) ||
    previousCost <= 0 ||
    !Number.isFinite(newCost)
  ) {
    return null;
  }
  return ((newCost - previousCost) / previousCost) * 100;
}

/**
 * Gross margin percentage: ((sellPrice - cost) / sellPrice) * 100.
 * Returns null if sellPrice <= 0 or inputs are invalid.
 */
export function computeMarginPercent(
  sellPrice: number,
  cost: number,
): number | null {
  if (
    !Number.isFinite(sellPrice) ||
    !Number.isFinite(cost) ||
    sellPrice <= 0
  ) {
    return null;
  }
  return ((sellPrice - cost) / sellPrice) * 100;
}

/**
 * Markup percentage: ((sellPrice - cost) / cost) * 100.
 * Returns null if cost <= 0 or inputs are invalid.
 */
export function computeMarkupPercent(
  sellPrice: number,
  cost: number,
): number | null {
  if (!Number.isFinite(sellPrice) || !Number.isFinite(cost) || cost <= 0) {
    return null;
  }
  return ((sellPrice - cost) / cost) * 100;
}

/**
 * Calculates a new sell price that preserves the previous gross margin %
 * given oldSellPrice, oldCost, and newCost.
 * Returns null if oldCost <= 0, oldSellPrice <= 0, or oldSellPrice <= oldCost.
 */
export function recalculateMaintainingMargin(
  oldSellPrice: number,
  oldCost: number,
  newCost: number,
): number | null {
  if (
    !Number.isFinite(oldSellPrice) ||
    !Number.isFinite(oldCost) ||
    !Number.isFinite(newCost) ||
    oldSellPrice <= 0 ||
    oldCost <= 0 ||
    newCost < 0 ||
    oldSellPrice <= oldCost
  ) {
    return null;
  }
  const oldMarginRatio = (oldSellPrice - oldCost) / oldSellPrice;
  const newSellPrice = newCost / (1 - oldMarginRatio);
  return round2(newSellPrice);
}

/**
 * Applies a percentage adjustment (e.g. +8.5%) to an existing sell price.
 */
export function applyPercentChange(
  oldSellPrice: number,
  deltaPercent: number,
): number {
  if (
    !Number.isFinite(oldSellPrice) ||
    !Number.isFinite(deltaPercent) ||
    oldSellPrice <= 0
  ) {
    return 0;
  }
  return Math.max(0, round2(oldSellPrice * (1 + deltaPercent / 100)));
}

/**
 * Applies an optional psychological or nearest-increment rounding strategy.
 */
export function roundPrice(
  price: number,
  strategy: PriceRoundingStrategy,
): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  switch (strategy) {
    case 'nearest_0_05':
      return round2(Math.round(price * 20) / 20);
    case 'end_95':
      return round2(Math.max(0.95, Math.round(price - 0.95) + 0.95));
    case 'end_99':
      return round2(Math.max(0.99, Math.round(price - 0.99) + 0.99));
    case 'nearest_1':
      return round2(Math.round(price));
    case 'none':
    default:
      return round2(price);
  }
}

export function formatPriceString(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return round2(value).toFixed(2);
}
