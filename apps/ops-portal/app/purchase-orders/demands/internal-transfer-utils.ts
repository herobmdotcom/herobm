export interface InternalTransferSourceOption {
  locationId: string;
  /** Pre-formatted human label, e.g. "Warehouse B - 12 available". */
  label: string;
  availableQty: number;
}

interface LocationLike {
  locationId: string;
  code?: string;
  name: string;
  availableQty?: number;
}

/**
 * Build the source-location dropdown options for the Internal Transfer modal.
 *
 *   - Excludes the destination location (the user can't transfer to and
 *     from the same place).
 *   - Includes locations with zero available qty — they are shown (with
 *     "0 available") rather than disabled, because users may legitimately
 *     initiate a transfer from a zero-stock location to pre-empt an
 *     inbound receipt (per Ticket 4 AC).
 *   - Locations missing an `availableQty` field (e.g. when the API was
 *     called without a productId) default to 0.
 */
export function buildInternalTransferSourceOptions(
  locations: LocationLike[],
  destinationLocationId?: string,
): InternalTransferSourceOption[] {
  return locations
    .filter((loc) => loc.locationId !== destinationLocationId)
    .map((loc) => {
      const availableQty = typeof loc.availableQty === 'number' ? loc.availableQty : 0;
      const label = `${loc.name} - ${formatQty(availableQty)} available`;
      return { locationId: loc.locationId, label, availableQty };
    });
}

function formatQty(qty: number): string {
  if (Number.isInteger(qty)) return qty.toString();
  return Number(qty.toFixed(2)).toString();
}
