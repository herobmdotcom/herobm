import {
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uuid,
  unique,
  check,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { SupplierState, ProductState } from '@herobm/shared';
import { herobmCore } from './core.schema';
import {
  glAccounts,
  costCenters,
  activities,
  customerGroups,
  customers,
  suppliers,
} from './index';
import { taxCategories } from './tax.schema';

// ---------------------------------------------------------------------------
export const productGroups = herobmCore.table('product_groups', {
  productGroupId: uuid('product_group_id').primaryKey().defaultRandom(),
  groupCode: text('group_code').unique().notNull(),
  name: text('name').notNull(),
  defaultRevenueAccountId: uuid('default_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultExpenseAccountId: uuid('default_expense_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultCostCenterId: uuid('default_cost_center_id').references(
    () => costCenters.costCenterId,
  ),
  defaultActivityId: uuid('default_activity_id').references(
    () => activities.activityId,
  ),
  purchaseTaxCategoryId: uuid('purchase_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
  salesTaxCategoryId: uuid('sales_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
});

// ---------------------------------------------------------------------------
// discount_matrix  (Multi-dimensional default discount rules)
// ---------------------------------------------------------------------------
export const discountMatrix = herobmCore.table(
  'discount_matrix',
  {
    discountMatrixId: uuid('discount_matrix_id').primaryKey().defaultRandom(),
    customerGroupId: uuid('customer_group_id').references(
      () => customerGroups.customerGroupId,
    ),
    customerId: uuid('customer_id').references(() => customers.customerId),
    productGroupId: uuid('product_group_id').references(
      () => productGroups.productGroupId,
    ), // NULL = wildcard (all product groups)
    discountPercentage: numeric('discount_percentage').notNull(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    // Exactly one of customer_group_id or customer_id must be set
    exactlyOneOwner: check(
      'discount_matrix_owner_check',
      sql`(customer_group_id IS NOT NULL AND customer_id IS NULL) OR
          (customer_group_id IS NULL AND customer_id IS NOT NULL)`,
    ),
    // Unique per intersection
    unqGroup: unique('discount_matrix_group_product_unq').on(
      t.customerGroupId,
      t.productGroupId,
    ),
    unqCustomer: unique('discount_matrix_customer_product_unq').on(
      t.customerId,
      t.productGroupId,
    ),
    // Indexes for lookup performance
    customerGroupIdx: index('idx_discount_matrix_customer_group').on(
      t.customerGroupId,
    ),
    customerIdx: index('idx_discount_matrix_customer').on(t.customerId),
  }),
);

// ---------------------------------------------------------------------------
export const productTypeEnum = herobmCore.enum('product_type', [
  'inventory',
  'non-stock',
  'service',
  'freight',
]);
export const productStructureEnum = herobmCore.enum('product_structure', [
  'standard',
  'kit',
]);

// ---------------------------------------------------------------------------
// uom_dictionary  (Global unit of measure definitions)
// ---------------------------------------------------------------------------
export const uomDictionary = herobmCore.table('uom_dictionary', {
  uomCode: text('uom_code').primaryKey(),
  description: text('description').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// products  (Native schema structure mapped to CDM product definitions)
// ---------------------------------------------------------------------------
export const products = herobmCore.table('products', {
  productId: uuid('product_id').primaryKey().defaultRandom(),
  productNumber: text('product_number').unique().notNull(),
  name: text('name').notNull(),
  productType: productTypeEnum('product_type').notNull(),
  structureType: productStructureEnum('structure_type').notNull(),
  productGroupId: uuid('product_group_id').references(
    () => productGroups.productGroupId,
  ),
  barcode: text('barcode'),
  listPrice: numeric('list_price', { precision: 12, scale: 2 }),
  standardCost: numeric('standard_cost', { precision: 12, scale: 2 }),
  tradePrice: numeric('trade_price', { precision: 12, scale: 2 }),
  priceLevel3: numeric('price_level_3', { precision: 12, scale: 2 }),
  priceLevel4: numeric('price_level_4', { precision: 12, scale: 2 }),
  weightedAverageCost: numeric('weighted_average_cost'),
  weight: numeric('weight', { precision: 12, scale: 4 }),
  alternateInvoiceDescription: text('alternate_invoice_description'),
  boxQuantity: numeric('box_quantity'),
  baseUom: text('base_uom')
    .notNull()
    .references(() => uomDictionary.uomCode),
  defaultSalesUomId: uuid('default_sales_uom_id'),
  defaultPurchaseUomId: uuid('default_purchase_uom_id'),
  purchaseTaxCategoryId: uuid('purchase_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
  salesTaxCategoryId: uuid('sales_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
  externalTaxCode: text('external_tax_code'),
  alternateProductNumber: text('alternate_product_number'),
  imagePath: text('image_path'),
  stateCode: text('state_code').$type<ProductState>().notNull(),
  notes: text('notes'),
  sourceId: text('source_id').unique(),
  source: text('source').notNull(),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// product_components  (Master Bill of Materials / Kits)
// ---------------------------------------------------------------------------
export const fractionalBehaviorEnum = herobmCore.enum('fractional_behavior', [
  'allow_fractional',
  'round_up',
  'round_down',
  'force_multiple',
]);

export const productComponents = herobmCore.table('product_components', {
  componentId: uuid('component_id').primaryKey().defaultRandom(),
  parentProductId: uuid('parent_product_id')
    .notNull()
    .references(() => products.productId),
  childProductId: uuid('child_product_id')
    .notNull()
    .references(() => products.productId),
  parentQuantity: numeric('parent_quantity', {
    precision: 14,
    scale: 4,
  }).notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
  sequenceNumber: integer('sequence_number'),
  fractionalBehavior: fractionalBehaviorEnum('fractional_behavior'),
});

// ---------------------------------------------------------------------------
// product_uoms  (Product-specific unit of measure definitions)
// ---------------------------------------------------------------------------
export const productUoms = herobmCore.table(
  'product_uoms',
  {
    productUomId: uuid('product_uom_id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    uomCode: text('uom_code')
      .notNull()
      .references(() => uomDictionary.uomCode),
    ratio: numeric('ratio', { precision: 12, scale: 4 }).notNull(),
    barcode: text('barcode'),
    isSalesDefault: boolean('is_sales_default'),
    isPurchaseDefault: boolean('is_purchase_default'),
  },
  (t) => ({
    unq: unique('product_uoms_product_code_unq').on(t.productId, t.uomCode),
  }),
);

export const productSuppliers = herobmCore.table(
  'product_suppliers',
  {
    productSupplierId: uuid('product_supplier_id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => suppliers.vendorId),
    supplierPartNumber: text('supplier_part_number'),
    costPrice: numeric('cost_price'),
    discountPercent: numeric('discount_percent'),
    priceBreakQuantity: numeric('price_break_quantity'),
    isPreferred: boolean('is_preferred').notNull(),
    minPurchaseQty: numeric('min_purchase_qty'),
    purchaseUnit: text('purchase_unit'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    stateCode: text('state_code').$type<SupplierState>().notNull(),
    sourceId: text('source_id').unique(),
    source: text('source').notNull(),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('product_suppliers_supplier_product_unq').on(
      t.vendorId,
      t.productId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// product_images (Multi-image gallery & metadata tracking)
// ---------------------------------------------------------------------------
export const productImages = herobmCore.table('product_images', {
  imageId: uuid('image_id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.productId, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  isPrimary: boolean('is_primary').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});
