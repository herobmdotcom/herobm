import {
  pgSchema,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uuid,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle schema for modbm_core — application-owned operational data.
 * Phase 3: read-write order management.
 *
 * Column naming follows Microsoft CDM conventions (snake_case in Postgres).
 * Cross-schema references (customer_id → mart_accounts, product_id → mart_products)
 * are enforced at the application level, not via database FK — because dbt
 * drops/recreates mart tables on every pipeline run.
 */
export const modbmCore = pgSchema('modbm_core');

// ---------------------------------------------------------------------------
// gst_categories  (Tax classification for order lines)
// ---------------------------------------------------------------------------
export const gstCategories = modbmCore.table('gst_categories', {
  gstCategoryId: uuid('gst_category_id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),          // not_relevant | exempt | zero_rated | gst_applies
  rate: numeric('rate').default('0'),     // percentage, e.g. '9' = 9%
  isDefault: boolean('is_default').default(false),
});

// ---------------------------------------------------------------------------
// sales_orders  (CDM: SalesOrder)
// ---------------------------------------------------------------------------
export const salesOrders = modbmCore.table('sales_orders', {
  salesOrderId: uuid('sales_order_id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').unique().notNull(),
  name: text('name'),
  customerId: text('customer_id'),
  customerOrderNumber: text('customer_order_number'),
  stateCode: text('state_code').notNull().default('draft'),
  customerDiscount: numeric('customer_discount').default('0'),
  gstCategoryId: uuid('gst_category_id').references(() => gstCategories.gstCategoryId),
  notes: text('notes'),
  customFields: jsonb('custom_fields'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// sales_order_lines  (CDM: SalesOrderProduct)
// ---------------------------------------------------------------------------
export const salesOrderLineItems = modbmCore.table('sales_order_lines', {
  salesOrderLineId: uuid('sales_order_line_id').primaryKey().defaultRandom(),
  salesOrderId: uuid('sales_order_id')
    .notNull()
    .references(() => salesOrders.salesOrderId),
  lineNumber: integer('line_number').notNull(),
  productId: text('product_id'),
  productDescription: text('product_description'),
  quantity: numeric('quantity').notNull(),
  pricePerUnit: numeric('price_per_unit').notNull(),
  discountPercentage: numeric('discount_percentage').default('0'),
  amount: numeric('amount'),
  gstCategoryId: uuid('gst_category_id').references(() => gstCategories.gstCategoryId),
  tax: numeric('tax').default('0'),
  totalAmount: numeric('total_amount'),
  unitOfMeasure: text('unit_of_measure'),
});

// ---------------------------------------------------------------------------
// order_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
export const orderEvents = modbmCore.table('order_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  salesOrderId: uuid('sales_order_id')
    .notNull()
    .references(() => salesOrders.salesOrderId),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// outbox  (Transactional outbox for async BullMQ/ERPNext sync)
// ---------------------------------------------------------------------------
export const outbox = modbmCore.table('outbox', {
  outboxId: uuid('outbox_id').primaryKey().defaultRandom(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});
