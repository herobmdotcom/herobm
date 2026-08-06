import { text, numeric, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { herobmCore } from './core.schema';

// ---------------------------------------------------------------------------
// tax_categories  (Tax classification for order lines)
// ---------------------------------------------------------------------------
export const taxCategories = herobmCore.table('tax_categories', {
  taxCategoryId: uuid('tax_category_id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // not_relevant | exempt | zero_rated | tax_applies
  rate: numeric('rate'), // percentage, e.g. '9' = 9%
  salesGlAccountId: uuid('sales_gl_account_id'),
  purchaseGlAccountId: uuid('purchase_gl_account_id'),
});

// ---------------------------------------------------------------------------
// tax_positions  (Business context for tax mapping)
// ---------------------------------------------------------------------------
export const taxPositions = herobmCore.table('tax_positions', {
  taxPositionId: uuid('tax_position_id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  title: text('title').notNull(),
});

// ---------------------------------------------------------------------------
// tax_position_mappings  (Map product taxes to contextual taxes)
// ---------------------------------------------------------------------------
export const taxPositionMappings = herobmCore.table(
  'tax_position_mappings',
  {
    mappingId: uuid('mapping_id').primaryKey().defaultRandom(),
    taxPositionId: uuid('tax_position_id')
      .notNull()
      .references(() => taxPositions.taxPositionId, { onDelete: 'cascade' }),
    sourceTaxCategoryId: uuid('source_tax_category_id')
      .notNull()
      .references(() => taxCategories.taxCategoryId, { onDelete: 'cascade' }),
    destinationTaxCategoryId: uuid('destination_tax_category_id')
      .notNull()
      .references(() => taxCategories.taxCategoryId, { onDelete: 'cascade' }),
  },
  (table) => {
    return {
      uniqueMapping: uniqueIndex('tax_position_mappings_unique_idx').on(
        table.taxPositionId,
        table.sourceTaxCategoryId,
      ),
    };
  },
);
