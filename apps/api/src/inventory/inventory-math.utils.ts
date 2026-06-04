import { SQL, sql, inArray, eq, and } from 'drizzle-orm';
import { BIN_TYPE } from '@modbm/shared';

export const PICKABLE_BIN_TYPES = [
  BIN_TYPE.STORAGE,
  BIN_TYPE.PICK,
  BIN_TYPE.BULK,
] as const;

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

/**
 * Drizzle condition for filtering pickable bins.
 * Expects the `bins` table object from the schema.
 */
export function isPickableBinCondition(binTable: any) {
  return and(
    inArray(binTable.binType, [...PICKABLE_BIN_TYPES]),
    eq(binTable.isUnavailable, false),
    eq(binTable.isBonded, false),
  );
}

/**
 * Drizzle condition for filtering quarantine bins.
 * Expects the `bins` table object from the schema.
 */
export function isQuarantineBinCondition(binTable: any) {
  return eq(binTable.binType, BIN_TYPE.QUARANTINE);
}

/**
 * Raw SQL condition for filtering pickable bins.
 * Expects the alias of the bins table (e.g. 'b').
 */
export function isPickableBinSqlCondition(binTableAlias: string): SQL {
  return sql`${sql.raw(binTableAlias)}.bin_type IN (${sql.raw(PICKABLE_BIN_TYPES.map((t) => `'${t}'`).join(', '))}) 
         AND ${sql.raw(binTableAlias)}.is_unavailable = false 
         AND ${sql.raw(binTableAlias)}.is_bonded = false`;
}
