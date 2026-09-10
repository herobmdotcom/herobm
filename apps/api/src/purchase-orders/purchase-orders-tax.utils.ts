import type { DrizzleDB } from '../drizzle/drizzle.module';
import { taxCategories, appSettings } from '@herobm/db-schema';
import { eq, inArray } from 'drizzle-orm';
import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import { AppConfigService } from '../settings/app-config.service';

export async function resolvePurchaseTaxForLine(
  tx: DrizzleDB,
  vendorId: string,
  suppliersService: SuppliersService,
  taxResolutionEngine: TaxResolutionEngine,
  appConfig: AppConfigService,
  productId?: string,
  taxCategoryIdOverride?: string,
): Promise<{ taxCategoryId: string; rate: number }> {
  const supplier = await suppliersService.findOne(vendorId, tx);

  const resolvedTaxCategoryId = await taxResolutionEngine.resolveTaxCategory(
    {
      isPurchase: true,
      isTaxRegistered:
        ((supplier as Record<string, unknown>)?.isTaxRegistered as boolean) ||
        false,
      partyTaxPositionId:
        supplier?.taxPositionId ||
        ((supplier as Record<string, unknown>)?.supplierGroupTaxPositionId as
          | string
          | undefined) ||
        appConfig.getAppSettingsRaw()?.defaultSupplierTaxPositionId ||
        null,
      productId:
        productId === '00000000-0000-4000-8000-000000000000'
          ? null
          : productId || null,
      productDefaultTaxCategoryId: null,
      manualOverrideTaxCategoryId: taxCategoryIdOverride || null,
    },
    tx,
  );

  if (resolvedTaxCategoryId) {
    try {
      const catRows = await tx
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.taxCategoryId, resolvedTaxCategoryId))
        .limit(1);
      if (catRows.length > 0) {
        return {
          taxCategoryId: catRows[0].taxCategoryId,
          rate: parseFloat(catRows[0].rate ?? '0'),
        };
      }
    } catch {
      // Ignore and fallback
    }
  }

  const defaultSettings = await tx
    .select({ taxCategoryId: appSettings.defaultPurchaseTaxCategoryId })
    .from(appSettings)
    .limit(1);

  if (defaultSettings.length > 0 && defaultSettings[0].taxCategoryId) {
    const catRows = await tx
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.taxCategoryId, defaultSettings[0].taxCategoryId))
      .limit(1);

    if (catRows.length > 0) {
      return {
        taxCategoryId: catRows[0].taxCategoryId,
        rate: parseFloat(catRows[0].rate ?? '0'),
      };
    }
  }

  const fallbacks = await tx
    .select()
    .from(taxCategories)
    .where(
      inArray(taxCategories.code, ['GST', 'INPUT', 'STANDARD', 'VAT', 'TAX']),
    )
    .limit(1);

  if (fallbacks.length > 0) {
    return {
      taxCategoryId: fallbacks[0].taxCategoryId,
      rate: parseFloat(fallbacks[0].rate ?? '0'),
    };
  }

  const anyCat = await tx.select().from(taxCategories).limit(1);
  if (anyCat.length > 0) {
    return {
      taxCategoryId: anyCat[0].taxCategoryId,
      rate: parseFloat(anyCat[0].rate ?? '0'),
    };
  }

  return { taxCategoryId: '', rate: 0 };
}
