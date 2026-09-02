import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  taxPositionMappings,
  taxCategories,
  products,
  productGroups,
  appSettings,
} from '@herobm/db-schema';
import { eq, and } from 'drizzle-orm';

export interface TaxResolutionContext {
  isPurchase: boolean;
  isTaxRegistered: boolean;
  partyTaxPositionId?: string | null;
  productId?: string | null;
  productDefaultTaxCategoryId?: string | null;
  manualOverrideTaxCategoryId?: string | null;
}

@Injectable()
export class TaxResolutionEngine {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Resolves the final tax category ID for a transaction line based on the business rules.
   */
  async resolveTaxCategory(
    context: TaxResolutionContext,
    tx?: DrizzleDB,
  ): Promise<string | null> {
    const db = tx || this.db;

    // 1. Manual Override takes highest precedence
    if (context.manualOverrideTaxCategoryId) {
      return context.manualOverrideTaxCategoryId;
    }

    // Resolve Product Hierarchy Tax if not explicitly provided
    let baseTaxCategoryId = context.productDefaultTaxCategoryId || null;
    if (!baseTaxCategoryId && context.productId) {
      baseTaxCategoryId = await this.resolveProductTaxHierarchy(
        context.productId,
        context.isPurchase,
        db,
      );
    }

    // 2. Unregistered Supplier enforcement (Purchases only)
    if (context.isPurchase && !context.isTaxRegistered) {
      // Find an exempt tax category. In a production system, this should be a configurable setting.
      // We look for a 'zero_rated' or 'exempt' category as a fallback.
      let exemptTax = await db
        .select()
        .from(taxCategories)
        .where(eq(taxCategories.type, 'exempt'))
        .limit(1);
      if (exemptTax.length === 0) {
        exemptTax = await db
          .select()
          .from(taxCategories)
          .where(eq(taxCategories.type, 'zero_rated'))
          .limit(1);
      }
      if (exemptTax.length > 0) {
        return exemptTax[0].taxCategoryId;
      }
      return null;
    }

    // 3. Tax Position Mapping
    if (context.partyTaxPositionId && baseTaxCategoryId) {
      const mapping = await db
        .select()
        .from(taxPositionMappings)
        .where(
          and(
            eq(taxPositionMappings.taxPositionId, context.partyTaxPositionId),
            eq(taxPositionMappings.sourceTaxCategoryId, baseTaxCategoryId),
          ),
        )
        .limit(1);

      if (mapping.length > 0) {
        return mapping[0].destinationTaxCategoryId;
      }
    }

    // 4. Fallback to Product Default Tax
    return baseTaxCategoryId;
  }

  /**
   * Resolves the base tax category for a product traversing the hierarchy:
   * Product -> Product Group -> App Settings
   */
  async resolveProductTaxHierarchy(
    productId: string,
    isPurchase: boolean,
    db: DrizzleDB,
  ): Promise<string | null> {
    const productRecord = await db
      .select({
        salesTaxCategoryId: products.salesTaxCategoryId,
        purchaseTaxCategoryId: products.purchaseTaxCategoryId,
        productGroupId: products.productGroupId,
      })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);

    if (productRecord.length === 0) {
      return null;
    }

    const { salesTaxCategoryId, purchaseTaxCategoryId, productGroupId } =
      productRecord[0];

    // Tier 1: Product Level
    const productLevelTax = isPurchase
      ? purchaseTaxCategoryId
      : salesTaxCategoryId;
    if (productLevelTax) {
      return productLevelTax;
    }

    // Tier 2: Product Group Level
    if (productGroupId) {
      const groupRecord = await db
        .select({
          salesTaxCategoryId: productGroups.salesTaxCategoryId,
          purchaseTaxCategoryId: productGroups.purchaseTaxCategoryId,
        })
        .from(productGroups)
        .where(eq(productGroups.productGroupId, productGroupId))
        .limit(1);

      if (groupRecord.length > 0) {
        const groupLevelTax = isPurchase
          ? groupRecord[0].purchaseTaxCategoryId
          : groupRecord[0].salesTaxCategoryId;
        if (groupLevelTax) {
          return groupLevelTax;
        }
      }
    }

    // Tier 3: App Settings Level
    const settingsRecord = await db
      .select({
        defaultSalesTaxCategoryId: appSettings.defaultSalesTaxCategoryId,
        defaultPurchaseTaxCategoryId: appSettings.defaultPurchaseTaxCategoryId,
      })
      .from(appSettings)
      .limit(1);

    if (settingsRecord.length > 0) {
      const settingsLevelTax = isPurchase
        ? settingsRecord[0].defaultPurchaseTaxCategoryId
        : settingsRecord[0].defaultSalesTaxCategoryId;
      if (settingsLevelTax) {
        return settingsLevelTax;
      }
    }

    return null;
  }
}
