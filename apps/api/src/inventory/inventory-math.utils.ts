// security-ignore: sql-raw
import { SQL, sql as dSql, inArray, eq, and, or, isNull } from 'drizzle-orm';
import { BIN_TYPE } from '@herobm/shared';
import { bins } from '@herobm/db-schema';

export const PICKABLE_BIN_TYPES = [
  BIN_TYPE.STORAGE,
  BIN_TYPE.PICK,
  BIN_TYPE.BULK,
] as const;

export interface BinState {
  binType: string | null;
  isUnavailable?: boolean | null;
  isBonded?: boolean | null;
  isConsignment?: boolean | null;
  actualQuantity?: string | number | null;
  quantity?: string | number | null;
  onHand?: string | number | null;
}

/**
 * The single source of truth for whether a bin is eligible for general fulfillment.
 *
 * Standardized to a POSITIVE whitelist (storage, pick, bulk) to ensure that
 * newly introduced, unhandled bin types default securely to exclusion.
 * Explicitly guards against unavailable, bonded, and consignment bins.
 */
export function isPickableBin(bin: {
  binType: string | null;
  isUnavailable?: boolean | null;
  isBonded?: boolean | null;
  isConsignment?: boolean | null;
}): boolean {
  if (bin.isUnavailable || bin.isBonded || bin.isConsignment) {
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

/**
 * Drizzle condition for filtering pickable bins.
 * Expects the `bins` table object from the schema.
 */
export function isPickableBinCondition(binTable: typeof bins) {
  return and(
    inArray(binTable.binType, [...PICKABLE_BIN_TYPES]),
    or(eq(binTable.isUnavailable, false), isNull(binTable.isUnavailable)),
    or(eq(binTable.isBonded, false), isNull(binTable.isBonded)),
    or(eq(binTable.isConsignment, false), isNull(binTable.isConsignment)),
  );
}

/**
 * Drizzle condition for filtering quarantine bins.
 * Expects the `bins` table object from the schema.
 */
export function isQuarantineBinCondition(binTable: typeof bins) {
  return eq(binTable.binType, BIN_TYPE.QUARANTINE);
}

/**
 * Raw SQL condition for filtering pickable bins.
 * Expects the alias of the bins table (e.g. 'b').
 */
export function isPickableBinSqlCondition(binTableAlias: string): SQL {
  return dSql`${dSql.raw(binTableAlias)}.bin_type IN (${dSql.raw(
    PICKABLE_BIN_TYPES.map((t) => `'${t}'`).join(', '),
  )}) 
         AND COALESCE(${dSql.raw(binTableAlias)}.is_unavailable, false) = false 
         AND COALESCE(${dSql.raw(binTableAlias)}.is_bonded, false) = false 
         AND COALESCE(${dSql.raw(binTableAlias)}.is_consignment, false) = false`;
}

/**
 * Calculates the suggested replenishment/restock quantity for an item.
 *
 * An item requires restock only when its projected position (onHand + onOrder)
 * is strictly below its minQuantity threshold. When triggered, the suggested quantity
 * resupplies the inventory up to maxQuantity (if set and > minQuantity) or minQuantity.
 *
 * Returns 0 if projected stock satisfies or exceeds the minimum requirement.
 */
export function calculateSuggestedRestockQuantity(params: {
  onHand: number;
  onOrder: number;
  minQuantity: number;
  maxQuantity?: number | null;
  minPurchaseQty?: number | null;
}): number {
  const { onHand, onOrder, minQuantity, maxQuantity, minPurchaseQty } = params;
  const projectedStock = (onHand || 0) + (onOrder || 0);

  if (projectedStock >= minQuantity) {
    return 0;
  }

  const targetMax =
    maxQuantity !== null &&
    maxQuantity !== undefined &&
    maxQuantity > minQuantity
      ? maxQuantity
      : minQuantity;

  let suggested = Math.max(0, targetMax - projectedStock);
  if (suggested > 0 && minPurchaseQty && minPurchaseQty > 0) {
    if (suggested < minPurchaseQty) {
      suggested = minPurchaseQty;
    }
  }

  return suggested;
}
