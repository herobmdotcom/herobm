export type ProductType = 'inventory' | 'non-stock' | 'service';
export enum BIN_TYPE {
  /** Standard racking or shelving intended for general long-term or short-term storage */
  STORAGE = 'storage',
  /** Forward active picking locations designed for high-velocity fulfillment */
  PICK = 'pick',
  /** Bulk floor locations or overstock storage for pallets and large items */
  BULK = 'bulk',
  /** Temporary holding areas (e.g. shipping docks, receiving floors, temporary transit) */
  STAGING = 'staging',
  /** Restricted bins for quality inspection, damaged goods, or blocked inventory */
  QUARANTINE = 'quarantine',
  /** Virtual bins representing inventory currently moving between physical locations */
  IN_TRANSIT = 'in_transit',
  /** Work in progress bin for manufacturing component staging and build output */
  WIP = 'wip',
}
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
  structureType?: 'standard' | 'kit' | string | null;
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

export const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
export const LEGACY_CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Centralized check to determine if a line represents a physical product
 * that requires picking, shipping, or physical return.
 */
export function isPhysicalProductLine(line: { productId?: string | null, productType?: string | null }): boolean {
  if (!line) return false;
  const isCustom = !line.productId || line.productId === CUSTOM_LINE_ID || line.productId === LEGACY_CUSTOM_LINE_ID;
  if (isCustom) return false;
  
  // If productType is explicitly set, only 'inventory' is physical
  if (line.productType) {
    return line.productType === 'inventory';
  }
  
  // If productType is missing but it has a valid productId, assume physical (legacy fallback)
  return true;
}

/**
 * Centralized logic for calculating inventory shortages.
 * Handles string-to-number conversion and location fallback.
 */
export function calculateInventoryGaps(
  lines: OrderLineMinimal[] = [],
  inventoryLevels: InventoryLevelMinimal[] = [],
  headerLocationId?: string | null,
): InventoryGap[] {
  lines = lines || [];
  inventoryLevels = inventoryLevels || [];
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
  for (const line of lines) {
    const isPhysical = isPhysicalProductLine(line);
    
    // Exclude non-stock Kit parent items from gaps (components are calculated separately)
    const isKitParent = line.structureType === 'kit' && line.productType === 'non-stock';
    
    if (!isPhysical || isKitParent || !line.productId) continue;

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
