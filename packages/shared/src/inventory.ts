export type ProductType = 'inventory' | 'non-stock' | 'service' | 'freight';
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
 * Check to determine if a line represents a tracked inventory item
 * that is stocked in warehouse bins and requires perpetual inventory tracking / bin picking.
 */
export function isStockedProductLine(line: { productId?: string | null, productType?: string | null }): boolean {
  if (!line) return false;
  const isCustom = !line.productId || line.productId === CUSTOM_LINE_ID || line.productId === LEGACY_CUSTOM_LINE_ID;
  if (isCustom) return false;
  
  // Only 'inventory' productType has tracked warehouse bin stock
  if (line.productType) {
    return line.productType === 'inventory';
  }
  
  // If productType is missing but it has a valid productId, assume inventory
  return true;
}

/**
 * Check to determine if a line represents physical deliverable goods
 * (both stocked inventory and non-stock items / physical custom items) vs intangible services/fees.
 */
export function isPhysicalProductLine(line: { productId?: string | null, productType?: string | null }): boolean {
  if (!line) return false;
  if (line.productType) {
    return line.productType !== 'service' && line.productType !== 'freight';
  }
  return true;
}

/**
 * Check if a product line is shippable / can be included on shipments and packing slips.
 */
export function isShippableProductLine(line: { productId?: string | null, productType?: string | null }): boolean {
  return isPhysicalProductLine(line);
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
    const isStocked = isStockedProductLine(line);
    
    // Exclude non-stock Kit parent items from gaps (components are calculated separately)
    const isKitParent = line.structureType === 'kit' && line.productType === 'non-stock';
    
    if (!isStocked || isKitParent || !line.productId) continue;

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

    // Deduct consumed stock from availabilityMap so subsequent lines reflect remaining stock
    availabilityMap.set(key, available - ordered);
  }

  return gaps;
}

/**
 * Natural alphanumeric comparator for bin numbers and code strings.
 * Ensures 'A-1-1' < 'A-1-2' < 'A-1-10' rather than lexicographical ordering.
 */
export function compareBinNumbers(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export interface PickBarcodePayload {
  orderId: string;
  lineId: string;
  binId: string;
  quantity: string;
}

/**
 * Construct the canonical scan-to-pick barcode string.
 * Format: PICK:{orderId}:{lineId}:{binId}:{quantity}
 */
export function formatPickBarcode(params: PickBarcodePayload): string {
  return `PICK:${params.orderId}:${params.lineId}:${params.binId}:${params.quantity}`;
}

/**
 * Parse a scanned barcode string into its picking components.
 * Accepts both 'PICK:{orderId}:{lineId}:{binId}:{quantity}' and raw '{orderId}:{lineId}:{binId}:{quantity}'.
 */
export function parsePickBarcode(barcode: string): PickBarcodePayload | null {
  if (!barcode) return null;
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  const raw = trimmed.startsWith('PICK:') ? trimmed.slice(5) : trimmed;
  const parts = raw.split(':');
  if (parts.length < 4) {
    return null;
  }

  const [orderId, lineId, binId, qtyStr] = parts;
  if (!orderId || !lineId || !binId) {
    return null;
  }

  const quantity = qtyStr || '1';
  return {
    orderId,
    lineId,
    binId,
    quantity,
  };
}

/**
 * Formats a numeric quantity for natural human display:
 * - Whole numbers render without decimals (e.g. 10, 1,000)
 * - Fractional numbers render with natural decimals up to maxFractionDigits without trailing zero noise (e.g. 9.93, 0.5)
 * - Uses locale-aware thousands separators (delegating to client runtime locale if undefined)
 * - Fallbacks gracefully to '0' for null/undefined/empty/NaN values.
 */
export function formatQuantity(
  val: string | number | undefined | null,
  maxFractionDigits = 4,
  locale?: string,
): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(num)) return '0';

  return num.toLocaleString(locale || undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}


