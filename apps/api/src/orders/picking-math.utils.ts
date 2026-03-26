import { BadRequestException } from '@nestjs/common';

export interface AvailableBin {
  binId: string;
  locationId: string;
  actualQuantity: number;
}

export interface PickAllocation {
  sourceBinId: string;
  locationId: string;
  takeQuantity: number;
}

export interface FallbackBin {
  binId: string;
  locationId: string;
}

/**
 * Pure business logic calculation to distribute a requested pick delta across
 * available stock bins. Returns a set of absolute allocations mapping how much
 * stock should be pulled from (or returned to) specific bins.
 *
 * By extracting this calculation from the database query loops, we can thoroughly
 * unit test partial fulfillments, multi-bin allocations, and fallback logic without
 * complex Drizzle ORM mocks.
 */
export function calculatePickAllocations(
  delta: number,
  availableBins: AvailableBin[],
  fallbackBin: FallbackBin | null,
): PickAllocation[] {
  if (delta === 0) return [];

  const allocations: PickAllocation[] = [];

  // Positive delta: We need to pull stock OUT of storage bins INTO staging.
  if (delta > 0) {
    let remainingToPick = delta;

    // Distribute across bins that have available stock
    for (const b of availableBins) {
      if (remainingToPick <= 0) break;
      const available = b.actualQuantity;
      if (available <= 0) continue; // Skip empty bins

      const take = Math.min(available, remainingToPick);
      allocations.push({
        sourceBinId: b.binId,
        locationId: b.locationId,
        takeQuantity: take,
      });
      remainingToPick -= take;
    }

    // If we couldn't fulfill the entire delta with what was available on the shelves,
    // we must pull the remainder from the fallback system bin to allow the picking
    // operation to continue (assuming physical reality superseded recorded system state).
    if (remainingToPick > 0) {
      if (!fallbackBin) {
        throw new BadRequestException('No storage bins defined in the system.');
      }
      allocations.push({
        sourceBinId: fallbackBin.binId,
        locationId: fallbackBin.locationId,
        takeQuantity: remainingToPick,
      });
    }
  }

  // Negative delta: We are UN-picking. Stock moves OUT of staging INTO storage.
  else {
    if (!fallbackBin) {
      throw new BadRequestException('No storage bins defined in the system.');
    }
    // We don't try to guess which original bin the picker placed the item back into.
    // Instead, all un-picked stock goes back to the default fallback bin for putaway.
    allocations.push({
      sourceBinId: fallbackBin.binId,
      locationId: fallbackBin.locationId,
      takeQuantity: delta, // Will be negative.
    });
  }

  return allocations;
}
