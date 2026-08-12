export interface ProductUom {
  uomCode: string;
  ratio: string | number;
}

/**
 * Breaks down an absolute base quantity into its largest available packaging components.
 * E.g. if BOX=25, and qty=127, returns "5 BOX, 2 EA"
 */
export function formatCompositeQuantity(
  baseQty: string | number | null | undefined,
  uoms: ProductUom[] | null | undefined,
  baseUom: string | null | undefined
): string {
  if (baseQty == null) return '0';
  let remaining = typeof baseQty === 'string' ? parseFloat(baseQty) : baseQty;

  const bUomCode = baseUom || 'EA';

  if (!uoms || uoms.length === 0) {
    return `${remaining} ${bUomCode}`;
  }

  // Parse ratios and sort descending by ratio size
  const parsedUoms = uoms
    .map((u) => ({
      code: u.uomCode,
      ratio: typeof u.ratio === 'string' ? parseFloat(u.ratio) : u.ratio,
    }))
    .filter((u) => u.ratio > 0);

  parsedUoms.sort((a, b) => b.ratio - a.ratio);

  const parts: string[] = [];

  for (const pack of parsedUoms) {
    if (remaining >= pack.ratio) {
      const count = Math.floor(remaining / pack.ratio);
      parts.push(`${count} ${pack.code}`);
      remaining = remaining % pack.ratio;
    }
  }

  // If there's a remainder or it didn't fit into any higher unit
  if (remaining > 0 || parts.length === 0) {
    // Only display rounding artifact if we actually have fraction remainder
    // e.g., 0.5 EA
    const displayRemainder = Number.isInteger(remaining) ? remaining : parseFloat(remaining.toFixed(4));
    parts.push(`${displayRemainder} ${bUomCode}`);
  }

  return parts.join(', ');
}

/**
 * Calculates a new suggested unit price when switching between UOMs.
 * E.g., old price = 10, old ratio = 1 (EA), new ratio = 25 (BOX) -> new price 250
 */
export function calculateUomPriceAdjustment(
  oldPricePerUnit: string | number,
  oldRatio: number,
  newRatio: number
): number {
  const price = typeof oldPricePerUnit === 'string' ? parseFloat(oldPricePerUnit) : oldPricePerUnit;
  if (!price || price === 0) return 0;
  if (oldRatio === 0) return 0;

  // New Base Price = (Price / Old Ratio) * New Ratio
  return (price / oldRatio) * newRatio;
}

const EACH_ALIASES = new Set(['EA', 'EACH', 'EACHES', 'PC', 'PCS', 'PIECE', 'PIECES']);

/**
 * Normalizes input UOM strings to standard canonical codes.
 * E.g., 'Each', 'ea', 'pcs' -> 'EA', 'box', 'Box' -> 'BOX'
 */
export function normalizeUomCode(uom?: string | null): string {
  if (!uom || !uom.trim()) return 'EA';
  const clean = uom.trim().toUpperCase();
  if (EACH_ALIASES.has(clean)) return 'EA';
  return clean;
}
