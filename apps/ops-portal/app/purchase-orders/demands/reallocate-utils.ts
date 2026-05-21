import type { AvailableElsewhereEntry } from './stock-elsewhere-utils';

export interface ReallocateLocationOption {
  locationId: string;
  /** Pre-formatted human label, e.g. "WH-B - Warehouse B - 12 available". */
  label: string;
  availableQty: number;
}

interface LocationLike {
  locationId: string;
  code?: string;
  name: string;
}

/**
 * Build the dropdown options for the Reallocate modal.
 *
 * Merges the full set of locations returned by `/api/inventory/locations`
 * with the `availableElsewhere` array on the selected demand row.
 *
 *   - `availableElsewhere` omits zero-stock locations server-side; we
 *     backfill missing locations with `availableQty = 0` so users still
 *     see every option in the dropdown (per Ticket 3 AC).
 *   - The destination location (i.e. the demand's current location) is
 *     also part of `locations` and is left in the list because the
 *     Reallocate modal is *destination*-framed: it is valid to "reallocate"
 *     to the same destination, although typically users will pick a
 *     different one.
 *   - Each label uses the directional phrasing "X available" rather than
 *     "X to transfer" because the user is choosing where the demand
 *     will be fulfilled from, not where stock will be moved.
 */
export function buildReallocateLocationOptions(
  locations: LocationLike[],
  availableElsewhere: AvailableElsewhereEntry[],
): ReallocateLocationOption[] {
  const qtyByLocation = new Map<string, number>();
  for (const entry of availableElsewhere) {
    qtyByLocation.set(entry.locationId, entry.availableQty);
  }

  return locations.map((loc) => {
    const availableQty = qtyByLocation.get(loc.locationId) ?? 0;
    const codePart = loc.code ? `${loc.code} - ` : '';
    const label = `${codePart}${loc.name} - ${formatQty(availableQty)} available`;
    return { locationId: loc.locationId, label, availableQty };
  });
}

function formatQty(qty: number): string {
  if (Number.isInteger(qty)) return qty.toString();
  return Number(qty.toFixed(2)).toString();
}
