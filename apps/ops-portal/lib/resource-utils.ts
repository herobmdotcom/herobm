import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';

/**
 * Resolves the unit cost for a contractor project resource based on the linked supplier and service product.
 * If the supplier is linked to the service product in product_suppliers, calculates the net contracted cost price.
 * Otherwise, falls back to the provided fallbackStandardCost or null.
 */
export async function resolveContractorUnitCost(
  vendorId: string | null | undefined,
  serviceProductId: string | null | undefined,
  fallbackStandardCost?: string | number | null,
): Promise<string | null> {
  if (!vendorId || !serviceProductId) {
    if (fallbackStandardCost !== undefined && fallbackStandardCost !== null) {
      return String(fallbackStandardCost);
    }
    return null;
  }

  try {
    const res = await api.suppliersControllerFindByProduct(serviceProductId, { limit: 100 });
    const rawData = res.data;
    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as { data?: unknown })?.data)
      ? ((rawData as { data: unknown[] }).data)
      : [];

    interface ProductSupplierItem {
      vendorId?: string;
      costPrice?: string | number | null;
      discountPercent?: string | number | null;
    }

    const matched = (list as ProductSupplierItem[]).find((item) => item.vendorId === vendorId);
    if (matched && matched.costPrice !== undefined && matched.costPrice !== null) {
      const baseCost = parseFloat(String(matched.costPrice));
      if (!isNaN(baseCost)) {
        const discountPct = matched.discountPercent ? parseFloat(String(matched.discountPercent)) : 0;
        const netCost = discountPct > 0 ? baseCost * (1 - discountPct / 100) : baseCost;
        return netCost.toFixed(2);
      }
    }
  } catch (e) {
    // fallback to provided standard cost or null
    reportError(e, 'resolveContractorUnitCost');
  }

  if (fallbackStandardCost !== undefined && fallbackStandardCost !== null) {
    return String(fallbackStandardCost);
  }
  return null;
}
