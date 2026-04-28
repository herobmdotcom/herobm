import { ProductType } from './index';

export interface InventoryLevelData {
  inventoryLevelId: string;
  productId: string;
  productNumber: string;
  productName: string;
  locationId?: string;
  locationNo?: string;
  locationName: string;
  quantityOnHand: string | number | null;
  quantityCommitted: string | number | null;
  quantityReserved: string | number | null;
  quantityOnOrder: string | number | null;
  quantityAvailable: string | number | null;
  binBalances?: {
    binId: string;
    binNumber: string;
    quantityOnHand: number;
  }[];
}

export function calculateAvailableQuantity(onHand: number | string | null | undefined, committed: number | string | null | undefined, reserved: number | string | null | undefined = 0): number {
  const h = typeof onHand === 'string' ? parseFloat(onHand) || 0 : onHand || 0;
  const c = typeof committed === 'string' ? parseFloat(committed) || 0 : committed || 0;
  const r = typeof reserved === 'string' ? parseFloat(reserved) || 0 : reserved || 0;
  return h - c - r;
}

export interface InventoryLevelMinimal {
  productId: string;
  locationId: string;
  quantityAvailable: string | number;
}

export interface OrderLineMinimal {
  salesOrderLineId: string;
  productId: string | null;
  productDescription: string | null;
  quantity: string | number;
  fulfillmentLocationId?: string | null;
  productType?: ProductType | string | null;
}

export interface InventoryGap {
  salesOrderLineId: string;
  productId: string;
  productDescription: string | null;
  orderedQuantity: number;
  availableQuantity: number;
  shortage: number;
  locationId: string | null;
}

/**
 * Centralized logic for calculating inventory shortages.
 * Handles string-to-number conversion and location fallback.
 */
export function calculateInventoryGaps(
  lines: OrderLineMinimal[],
  inventoryLevels: InventoryLevelMinimal[],
  headerLocationId?: string | null,
): InventoryGap[] {
  // Roll up available quantities by product AND location
  const availabilityMap = new Map<string, number>();
  for (const lvl of inventoryLevels) {
    if (!lvl.productId || !lvl.locationId) continue;
    const key = `${lvl.productId}_${lvl.locationId}`;
    const current = availabilityMap.get(key) || 0;
    
    // Safety check for Drizzle numeric-as-string
    const val = typeof lvl.quantityAvailable === 'string' ? parseFloat(lvl.quantityAvailable) : (lvl.quantityAvailable as number);
    availabilityMap.set(key, current + (val || 0));
  }

  const gaps: InventoryGap[] = [];
  const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';

  for (const line of lines) {
    const isCustom = !line.productId || line.productId === CUSTOM_LINE_ID;
    
    // Only check physical inventory products
    const isInventory = line.productType === 'inventory' || (!line.productType && !isCustom);
    if (!isInventory || isCustom || !line.productId) continue;

    const pid = line.productId;
    const locId = line.fulfillmentLocationId || headerLocationId;
    const ordered = typeof line.quantity === 'string' ? parseFloat(line.quantity) : (line.quantity as number);

    const key = `${pid}_${locId}`;
    const available = availabilityMap.get(key) || 0;
    
    // If available is negative (due to other backorders), treat it as 0 for this specific line's gap calculation
    const effectiveAvailable = Math.max(0, available);

    if (ordered > effectiveAvailable) {
      gaps.push({
        salesOrderLineId: line.salesOrderLineId,
        productId: pid,
        productDescription: line.productDescription,
        orderedQuantity: ordered,
        availableQuantity: available, // keep raw available for reference
        shortage: ordered - effectiveAvailable,
        locationId: locId || null,
      });
    }
  }

  return gaps;
}
