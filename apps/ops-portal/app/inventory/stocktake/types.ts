export type StocktakeCountStatus = 'uncounted' | 'match' | 'surplus' | 'shortage';

export interface StocktakeItem {
  id: string; // unique item id (e.g. `${binId}_${productId}`)
  productId: string;
  productNumber: string;
  productName: string;
  barcode?: string | null;
  alternateProductNumber?: string | null;
  imagePath?: string | null;
  description?: string | null;
  baseUom: string;
  binId: string;
  binNumber: string;
  zoneCode?: string;
  locationId: string;
  locationCode: string;
  expectedQuantity: number;
  countedQuantity: number | null; // null means not counted yet
  lastCountedAt?: Date | null;
  isUnlisted?: boolean; // item found in bin that wasn't registered in system
  notes?: string;
}

export interface StocktakeLocation {
  locationId: string;
  code: string;
  name: string;
}

export interface StocktakeBin {
  binId: string;
  binNumber: string;
  zoneCode?: string;
  binType?: string;
  isUnavailable?: boolean;
}

export type StocktakeFilter = 'all' | 'discrepancies' | 'counted' | 'uncounted';

export interface StocktakeFeedback {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  detail?: string;
}

export interface StocktakeSessionDraft {
  locationId: string;
  locationCode: string;
  binId: string | null;
  binNumber: string | null;
  binPattern?: string | null;
  zone?: string | null;
  filter?: StocktakeFilter;
  isBlindCount: boolean;
  isSoundEnabled: boolean;
  isVibrateEnabled: boolean;
  items: StocktakeItem[];
  confirmedEmptyBinIds?: string[];
  savedAt: string;
}
