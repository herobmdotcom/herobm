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
// exchange_rates  (Static currency exchange rates)
// ---------------------------------------------------------------------------
export const exchangeRates = modbmCore.table('exchange_rates', {
  exchangeRateId: uuid('exchange_rate_id').primaryKey().defaultRandom(),
  currencyCode: text('currency_code').notNull().unique(), // ISO 4217
  currencyName: text('currency_name').notNull(),
  buyRate: numeric('buy_rate').notNull(),      // units of this currency per 1 EUR
  sellRate: numeric('sell_rate').notNull(),     // units of this currency per 1 EUR
  effectiveDate: timestamp('effective_date').defaultNow(),
  updatedOn: timestamp('updated_on').defaultNow(),
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
  currencyCode: text('currency_code').notNull().default('EUR'),
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
  quantityPicked: numeric('quantity_picked').default('0'),
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
// sales_order_returns  (Return header against an invoiced order)
// ---------------------------------------------------------------------------
export const salesOrderReturns = modbmCore.table('sales_order_returns', {
  returnId: uuid('return_id').primaryKey().defaultRandom(),
  returnNumber: text('return_number').unique().notNull(),
  salesOrderId: uuid('sales_order_id')
    .notNull()
    .references(() => salesOrders.salesOrderId),
  stateCode: text('state_code').notNull().default('draft'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// sales_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
export const salesOrderReturnLines = modbmCore.table('sales_order_return_lines', {
  returnLineId: uuid('return_line_id').primaryKey().defaultRandom(),
  returnId: uuid('return_id')
    .notNull()
    .references(() => salesOrderReturns.returnId),
  salesOrderLineId: uuid('sales_order_line_id')
    .notNull()
    .references(() => salesOrderLineItems.salesOrderLineId),
  quantityReturned: numeric('quantity_returned').notNull(),
  reason: text('reason'),
  returnFee: numeric('return_fee').default('0'),    // absolute fee in order currency
});

// ---------------------------------------------------------------------------
// sales_order_shipments  (Shipment/delivery batch header)
// ---------------------------------------------------------------------------
export const salesOrderShipments = modbmCore.table('sales_order_shipments', {
  shipmentId: uuid('shipment_id').primaryKey().defaultRandom(),
  shipmentNumber: text('shipment_number').unique().notNull(),
  salesOrderId: uuid('sales_order_id')
    .notNull()
    .references(() => salesOrders.salesOrderId),
  stateCode: text('state_code').notNull().default('draft'),
  notes: text('notes'),
  trackingNumber: text('tracking_number'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// sales_order_shipment_lines  (Per-line quantities in each shipment)
// ---------------------------------------------------------------------------
export const salesOrderShipmentLines = modbmCore.table('sales_order_shipment_lines', {
  shipmentLineId: uuid('shipment_line_id').primaryKey().defaultRandom(),
  shipmentId: uuid('shipment_id')
    .notNull()
    .references(() => salesOrderShipments.shipmentId),
  salesOrderLineId: uuid('sales_order_line_id')
    .notNull()
    .references(() => salesOrderLineItems.salesOrderLineId),
  quantityShipped: numeric('quantity_shipped').notNull(),
});

// ---------------------------------------------------------------------------
// purchase_orders  (CDM: PurchaseOrder)
// ---------------------------------------------------------------------------
export const purchaseOrders = modbmCore.table('purchase_orders', {
  purchaseOrderId: uuid('purchase_order_id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').unique().notNull(),
  name: text('name'),
  vendorId: text('vendor_id'),
  invoiceNumber: text('invoice_number'),
  stateCode: text('state_code').notNull().default('draft'),
  currencyCode: text('currency_code').notNull().default('EUR'),
  notes: text('notes'),
  customFields: jsonb('custom_fields'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// purchase_order_lines  (CDM: PurchaseOrderProduct)
// ---------------------------------------------------------------------------
export const purchaseOrderLineItems = modbmCore.table('purchase_order_lines', {
  purchaseOrderLineId: uuid('purchase_order_line_id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.purchaseOrderId),
  lineNumber: integer('line_number').notNull(),
  productId: text('product_id'),
  productDescription: text('product_description'),
  quantity: numeric('quantity').notNull(),
  pricePerUnit: numeric('price_per_unit').notNull(),
  discountPercentage: numeric('discount_percentage').default('0'),
  amount: numeric('amount'),
  tax: numeric('tax').default('0'),
  totalAmount: numeric('total_amount'),
  unitOfMeasure: text('unit_of_measure'),
  quantityReceived: numeric('quantity_received').default('0'),
});

// ---------------------------------------------------------------------------
// purchase_order_receptions  (Goods Receipt)
// ---------------------------------------------------------------------------
export const purchaseOrderReceptions = modbmCore.table('purchase_order_receptions', {
  receptionId: uuid('reception_id').primaryKey().defaultRandom(),
  receptionNumber: text('reception_number').unique().notNull(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.purchaseOrderId),
  stateCode: text('state_code').notNull().default('draft'),
  notes: text('notes'),
  packingSlipNumber: text('packing_slip_number'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// purchase_order_reception_lines  (Per-line quantities received)
// ---------------------------------------------------------------------------
export const purchaseOrderReceptionLines = modbmCore.table('purchase_order_reception_lines', {
  receptionLineId: uuid('reception_line_id').primaryKey().defaultRandom(),
  receptionId: uuid('reception_id')
    .notNull()
    .references(() => purchaseOrderReceptions.receptionId),
  purchaseOrderLineId: uuid('purchase_order_line_id')
    .notNull()
    .references(() => purchaseOrderLineItems.purchaseOrderLineId),
  quantityReceived: numeric('quantity_received').notNull(),
});

// ---------------------------------------------------------------------------
// inventory_levels  (App-owned inventory, seeded from mart_inventory)
// ---------------------------------------------------------------------------
export const inventoryLevels = modbmCore.table('inventory_levels', {
  inventoryLevelId: uuid('inventory_level_id').primaryKey().defaultRandom(),
  productId: text('product_id').notNull(),
  locationNo: text('location_no').notNull().default('MAIN'),
  quantityOnHand: numeric('quantity_on_hand').notNull().default('0'),
  quantityCommitted: numeric('quantity_committed').notNull().default('0'),
  quantityOnOrder: numeric('quantity_on_order').notNull().default('0'),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});
// UNIQUE(product_id, location_no) — enforced via migration

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
