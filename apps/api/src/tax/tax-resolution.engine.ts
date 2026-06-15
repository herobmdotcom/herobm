import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  taxPositionMappings,
  taxCategories,
} from '../drizzle/herobm-core-schema';
import { eq, and } from 'drizzle-orm';

export interface TaxResolutionContext {
  isPurchase: boolean;
  isTaxRegistered: boolean;
  partyTaxPositionId?: string | null;
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
    if (context.partyTaxPositionId && context.productDefaultTaxCategoryId) {
      const mapping = await db
        .select()
        .from(taxPositionMappings)
        .where(
          and(
            eq(taxPositionMappings.taxPositionId, context.partyTaxPositionId),
            eq(
              taxPositionMappings.sourceTaxCategoryId,
              context.productDefaultTaxCategoryId,
            ),
          ),
        )
        .limit(1);

      if (mapping.length > 0) {
        return mapping[0].destinationTaxCategoryId;
      }
    }

    // 4. Fallback to Product Default Tax
    return context.productDefaultTaxCategoryId || null;
  }
}
