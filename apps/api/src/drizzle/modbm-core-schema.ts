import {
  pgSchema,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  jsonb,
  primaryKey,
  unique,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  CURRENCIES,
  getValidStates,
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
  SalesOrderState,
  PurchaseOrderState,
  ShipmentState,
  ReturnState,
} from '@modbm/shared';

const validCurrencyCheck = (
  tableName: string,
  columnName: string = 'currency_code',
) =>
  check(
    `${tableName}_currency_check`,
    sql.raw(
      `${columnName} IN (${CURRENCIES.map((c) => `'${c.code}'`).join(', ')})`,
    ),
  );

/**
 * Drizzle schema for modbm_core — application-owned operational data.
 *
 * Column naming follows Microsoft CDM conventions (snake_case in Postgres).
 * All tables use UUID primary keys with gen_random_uuid() defaults.
 * Foreign keys reference other modbm_core tables (e.g. customer_id → accounts).
 * Schema is managed via migrations in apps/api/migrations/.
 */
export const modbmCore = pgSchema('modbm_core');

// ---------------------------------------------------------------------------
// tax_categories  (Tax classification for order lines)
// ---------------------------------------------------------------------------
export const taxCategories = modbmCore.table(
  'tax_categories',
  {
    taxCategoryId: uuid('tax_category_id').primaryKey().defaultRandom(),
    code: text('code').unique().notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(), // not_relevant | exempt | zero_rated | tax_applies
    rate: numeric('rate').default('0'), // percentage, e.g. '9' = 9%
    isDefault: boolean('is_default').default(false),
  },
  (table) => {
    return {
      singleDefaultIndex: uniqueIndex('tax_categories_single_default_idx')
        .on(table.isDefault)
        .where(sql`${table.isDefault} = true`),
    };
  },
);

// ---------------------------------------------------------------------------
// exchange_rates  (Static currency exchange rates)
// ---------------------------------------------------------------------------
export const exchangeRates = modbmCore.table(
  'exchange_rates',
  {
    exchangeRateId: uuid('exchange_rate_id').primaryKey().defaultRandom(),
    currencyCode: text('currency_code').notNull().unique(), // ISO 4217
    currencyName: text('currency_name').notNull(),
    buyRate: numeric('buy_rate').notNull(), // units of this currency per 1 EUR
    sellRate: numeric('sell_rate').notNull(), // units of this currency per 1 EUR
    effectiveDate: timestamp('effective_date').defaultNow(),
    updatedOn: timestamp('updated_on').defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('exchange_rates'),
  }),
);

// ---------------------------------------------------------------------------
// sales_orders  (CDM: SalesOrder)
// ---------------------------------------------------------------------------
export const salesOrders = modbmCore.table(
  'sales_orders',
  {
    salesOrderId: uuid('sales_order_id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').unique().notNull(),
    name: text('name'),
    customerId: uuid('customer_id').references(() => accounts.accountId),
    customerOrderNumber: text('customer_order_number'),
    fulfillmentLocationId: uuid('fulfillment_location_id')
      .notNull()
      .references(() => locations.locationId),
    stateCode: text('state_code')
      .$type<SalesOrderState>()
      .notNull()
      .default('draft'),
    currencyCode: text('currency_code').notNull(),
    notes: text('notes'),
    customFields: jsonb('custom_fields'),
    discrepanciesAcknowledged: boolean('discrepancies_acknowledged')
      .notNull()
      .default(false),
    sourceId: text('source_id').unique(),
    source: text('source').notNull().default('app'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('sales_orders'),
    stateCheck: check(
      'sales_order_state_check',
      sql.raw(
        `state_code IN (${getValidStates(SALES_ORDER_TRANSITIONS)
          .map((s) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_lines  (CDM: SalesOrderProduct)
// ---------------------------------------------------------------------------
export const salesOrderLineItems = modbmCore.table(
  'sales_order_lines',
  {
    salesOrderLineId: uuid('sales_order_line_id').primaryKey().defaultRandom(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    lineNumber: integer('line_number').notNull(),
    productId: uuid('product_id').references(() => products.productId),
    productDescription: text('product_description'),
    quantity: numeric('quantity').notNull(),
    pricePerUnit: numeric('price_per_unit').notNull(),
    discountPercentage: numeric('discount_percentage').default('0'),
    amount: numeric('amount'),
    taxCategoryId: uuid('tax_category_id')
      .notNull()
      .references(() => taxCategories.taxCategoryId),
    tax: numeric('tax').default('0'),
    totalAmount: numeric('total_amount'),
    unitOfMeasure: text('unit_of_measure'),
    quantityPicked: numeric('quantity_picked').default('0'),
    fulfillmentLocationId: uuid('fulfillment_location_id')
      .notNull()
      .references(() => locations.locationId),
    isPostConfirmation: boolean('is_post_confirmation').default(false),
  },
  (t) => ({
    productLocationIdx: index('idx_sales_order_lines_product_location').on(
      t.productId,
      t.fulfillmentLocationId,
    ),
  }),
);

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
export const salesOrderReturns = modbmCore.table(
  'sales_order_returns',
  {
    returnId: uuid('return_id').primaryKey().defaultRandom(),
    returnNumber: text('return_number').unique().notNull(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    stateCode: text('state_code')
      .$type<ReturnState>()
      .notNull()
      .default('draft'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'sales_order_return_state_check',
      sql.raw(
        `state_code IN (${getValidStates(RETURN_TRANSITIONS)
          .map((s) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
export const salesOrderReturnLines = modbmCore.table(
  'sales_order_return_lines',
  {
    returnLineId: uuid('return_line_id').primaryKey().defaultRandom(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => salesOrderReturns.returnId),
    salesOrderLineId: uuid('sales_order_line_id')
      .notNull()
      .references(() => salesOrderLineItems.salesOrderLineId),
    quantityReturned: numeric('quantity_returned').notNull(),
    reason: text('reason'),
    returnFee: numeric('return_fee').default('0'), // absolute fee in order currency
  },
);

// ---------------------------------------------------------------------------
// sales_order_shipments  (Shipment/delivery batch header)
// ---------------------------------------------------------------------------
export const salesOrderShipments = modbmCore.table(
  'sales_order_shipments',
  {
    shipmentId: uuid('shipment_id').primaryKey().defaultRandom(),
    shipmentNumber: text('shipment_number').unique().notNull(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    stateCode: text('state_code')
      .$type<ShipmentState>()
      .notNull()
      .default('draft'),
    notes: text('notes'),
    trackingNumber: text('tracking_number'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'sales_order_shipment_state_check',
      sql.raw(
        `state_code IN (${getValidStates(SHIPMENT_TRANSITIONS)
          .map((s) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_shipment_lines  (Per-line quantities in each shipment)
// ---------------------------------------------------------------------------
export const salesOrderShipmentLines = modbmCore.table(
  'sales_order_shipment_lines',
  {
    shipmentLineId: uuid('shipment_line_id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => salesOrderShipments.shipmentId),
    salesOrderLineId: uuid('sales_order_line_id')
      .notNull()
      .references(() => salesOrderLineItems.salesOrderLineId),
    quantityShipped: numeric('quantity_shipped').notNull(),
  },
);

// ---------------------------------------------------------------------------
// purchase_orders  (CDM: PurchaseOrder)
// ---------------------------------------------------------------------------
export const purchaseOrders = modbmCore.table(
  'purchase_orders',
  {
    purchaseOrderId: uuid('purchase_order_id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').unique().notNull(),
    name: text('name'),
    vendorId: uuid('vendor_id').references(() => suppliers.vendorId),
    deliveryLocationId: uuid('delivery_location_id')
      .notNull()
      .references(() => locations.locationId),
    referenceNumber: text('reference_number'),
    stateCode: text('state_code')
      .$type<PurchaseOrderState>()
      .notNull()
      .default('draft'),
    currencyCode: text('currency_code').notNull(),
    notes: text('notes'),
    customFields: jsonb('custom_fields'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('purchase_orders'),
    stateCheck: check(
      'purchase_order_state_check',
      sql.raw(
        `state_code IN (${getValidStates(PURCHASE_ORDER_TRANSITIONS)
          .map((s) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
    deliveryLocIdx: index('idx_purchase_orders_delivery_location').on(
      t.deliveryLocationId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// purchase_order_lines  (CDM: PurchaseOrderProduct)
// ---------------------------------------------------------------------------
export const purchaseOrderLineItems = modbmCore.table(
  'purchase_order_lines',
  {
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .primaryKey()
      .defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.purchaseOrderId),
    lineNumber: integer('line_number').notNull(),
    productId: uuid('product_id').references(() => products.productId),
    productDescription: text('product_description'),
    quantity: numeric('quantity').notNull(),
    pricePerUnit: numeric('price_per_unit').notNull(),
    discountPercentage: numeric('discount_percentage').default('0'),
    amount: numeric('amount'),
    taxCategoryId: uuid('tax_category_id')
      .notNull()
      .references(() => taxCategories.taxCategoryId),
    tax: numeric('tax').default('0'),
    totalAmount: numeric('total_amount'),
    unitOfMeasure: text('unit_of_measure'),
    quantityReceived: numeric('quantity_received').default('0'),
  },
  (t) => ({
    productIdx: index('idx_purchase_order_lines_product').on(t.productId),
  }),
);
// ---------------------------------------------------------------------------
// purchase_order_events (Audit log + event sourcing)
// ---------------------------------------------------------------------------
export const purchaseOrderEvents = modbmCore.table('purchase_order_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.purchaseOrderId),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// purchase_order_returns  (Return header against a PO)
// ---------------------------------------------------------------------------
export const purchaseOrderReturns = modbmCore.table('purchase_order_returns', {
  returnId: uuid('return_id').primaryKey().defaultRandom(),
  returnNumber: text('return_number').unique().notNull(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.purchaseOrderId),
  stateCode: text('state_code').notNull().default('draft'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// purchase_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
export const purchaseOrderReturnLines = modbmCore.table(
  'purchase_order_return_lines',
  {
    returnLineId: uuid('return_line_id').primaryKey().defaultRandom(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => purchaseOrderReturns.returnId),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLineItems.purchaseOrderLineId),
    quantityReturned: numeric('quantity_returned').notNull(),
    reason: text('reason'),
    returnFee: numeric('return_fee').default('0'), // absolute fee in order currency
  },
);

// ---------------------------------------------------------------------------
// backorders (Order Allocations for Cross-Dock/Picked bridging)
// ---------------------------------------------------------------------------
export const backorders = modbmCore.table(
  'backorders',
  {
    backorderId: uuid('backorder_id').primaryKey().defaultRandom(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    salesOrderLineId: uuid('sales_order_line_id')
      .notNull()
      .references(() => salesOrderLineItems.salesOrderLineId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    purchaseOrderId: uuid('purchase_order_id').references(
      () => purchaseOrders.purchaseOrderId,
    ),
    purchaseOrderLineId: uuid('purchase_order_line_id').references(
      () => purchaseOrderLineItems.purchaseOrderLineId,
    ),
    quantity: numeric('quantity').notNull(),
    stateCode: text('state_code').notNull().default('pending_supply'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    solStateIdx: index('idx_backorders_sol_state').on(
      t.salesOrderLineId,
      t.stateCode,
    ),
    productIdx: index('idx_backorders_product').on(t.productId),
  }),
);

// ---------------------------------------------------------------------------
// locations  (Physical warehouses or regional centers)
// ---------------------------------------------------------------------------
export const locations = modbmCore.table('locations', {
  locationId: uuid('location_id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // e.g. "SIN"
  name: text('name').notNull(),
  addressLine1: text('address_line_1'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  postCode: text('post_code'),
  sourceId: text('source_id').unique(),
  source: text('source').notNull().default('app'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// zones  (Logical or physical areas within a location, e.g. 'Bulk', 'Picking')
// ---------------------------------------------------------------------------
export const zones = modbmCore.table(
  'zones',
  {
    zoneId: uuid('zone_id').primaryKey().defaultRandom(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.locationId),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sourceId: text('source_id').unique(),
    source: text('source').notNull().default('app'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('zones_code_location_unq').on(t.code, t.locationId),
  }),
);

// inventory_levels — Legacy table removed. Now defined as a dynamic VIEW below.

// ---------------------------------------------------------------------------
// bins  (Physical storage locations within a location)
// ---------------------------------------------------------------------------
export const binTypeEnum = pgEnum('bin_type_enum', [
  'storage',
  'pick',
  'bulk',
  'receiving',
  'staging',
  'quarantine',
]);

export const bins = modbmCore.table(
  'bins',
  {
    binId: uuid('bin_id').primaryKey().defaultRandom(),
    binNumber: text('bin_number').notNull(),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => zones.zoneId),
    binType: binTypeEnum('bin_type').notNull().default('storage'),
    isConsignment: boolean('is_consignment').default(false),
    isBonded: boolean('is_bonded').default(false),
    isUnavailable: boolean('is_unavailable').default(false),
    sourceId: text('source_id').unique(),
    source: text('source').notNull().default('app'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('bins_bin_number_zone_unq').on(t.binNumber, t.zoneId),
  }),
);

// ---------------------------------------------------------------------------
// inventory_entries (Header grouping for stock movements)
// ---------------------------------------------------------------------------
export const inventoryEntries = modbmCore.table('inventory_entries', {
  entryId: uuid('entry_id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').unique().notNull(), // e.g. STK-20260325-001
  entryDate: timestamp('entry_date', { withTimezone: true })
    .notNull()
    .defaultNow(),
  memo: text('memo'),
  sourceType: text('source_type').notNull(), // INITIAL_IMPORT, PO_RECEIPT, SO_SHIPMENT, RETURN, ADJUSTMENT, TRANSFER
  sourceId: uuid('source_id'), // FK to originating document
  isReversed: boolean('is_reversed').notNull().default(false),
  reversedBy: uuid('reversed_by'), // self-ref to reversing entry
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// inventory_ledger (Immutable double-entry ledger of all stock movement lines)
// ---------------------------------------------------------------------------
export const inventoryLedger = modbmCore.table(
  'inventory_ledger',
  {
    ledgerId: uuid('ledger_id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => inventoryEntries.entryId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    binId: uuid('bin_id')
      .notNull()
      .references(() => bins.binId),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.locationId),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => zones.zoneId),
    quantity: numeric('quantity').notNull(),
  },
  (t) => ({
    productLocationIdx: index('idx_inventory_ledger_product_location').on(
      t.productId,
      t.locationId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// bin_contents (Real-time calculated snapshot cache of current stock)
// ---------------------------------------------------------------------------
export const binContents = modbmCore.table(
  'bin_contents',
  {
    binContentId: uuid('bin_content_id').primaryKey().defaultRandom(),
    binId: uuid('bin_id')
      .notNull()
      .references(() => bins.binId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    actualQuantity: numeric('actual_quantity').notNull().default('0'),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('bin_contents_bin_product_unq').on(t.binId, t.productId),
  }),
);

// ---------------------------------------------------------------------------
// product_default_bins (WMS Directed Putaway & Replenishment routing)
// ---------------------------------------------------------------------------
export const productDefaultBins = modbmCore.table(
  'product_default_bins',
  {
    productDefaultBinId: uuid('product_default_bin_id')
      .primaryKey()
      .defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.locationId),
    binId: uuid('bin_id')
      .notNull()
      .references(() => bins.binId),
    isPrimaryPerLocation: boolean('is_primary_per_loc').notNull().default(true),
    minQuantity: numeric('min_quantity').default('0'),
    maxQuantity: numeric('max_quantity'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('product_default_bins_prod_loc_bin_unq').on(
      t.productId,
      t.locationId,
      t.binId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// outbox  (Transactional outbox for async BullMQ/External sync)
// ---------------------------------------------------------------------------
export const outbox = modbmCore.table('outbox', {
  outboxId: uuid('outbox_id').primaryKey().defaultRandom(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastError: text('last_error'),
});

// ---------------------------------------------------------------------------
// inventory_levels  (Dynamic stock resourcing view)
// ---------------------------------------------------------------------------
export const inventoryLevels = modbmCore
  .view('inventory_levels', {
    inventoryLevelId: uuid('inventory_level_id'), // Fake ID for backwards compatibility
    locationId: uuid('location_id'),
    productId: uuid('product_id'),
    quantityOnHand: numeric('quantity_on_hand'),
    quantityCommitted: numeric('quantity_committed'),
    quantityReserved: numeric('quantity_reserved'),
    quantityOnOrder: numeric('quantity_on_order'),
  })
  .existing();

// ---------------------------------------------------------------------------
// trading_terms  (Dictionary of standard payment cycles)
// ---------------------------------------------------------------------------
export const tradingTerms = modbmCore.table('trading_terms', {
  tradingTermsId: uuid('trading_terms_id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(), // e.g., 'NET30', 'COD', 'EOM'
  description: text('description').notNull(),
  days: integer('days').notNull(), // Number of days allowed
  type: text('type').notNull(), // 'net' | 'end_of_month' | 'cash_on_delivery'
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// macros  (Standard texts and dynamic automations)
// ---------------------------------------------------------------------------
export const macros = modbmCore.table('macros', {
  macroId: uuid('macro_id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  macroType: text('macro_type').notNull().default('text_template'),
  content: text('content').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// account_groups  (Administrative grouping and GL routing)
// ---------------------------------------------------------------------------
export const accountGroups = modbmCore.table('account_groups', {
  accountGroupId: uuid('account_group_id').primaryKey().defaultRandom(),
  groupCode: text('group_code').unique().notNull(),
  name: text('name').notNull(),
  defaultDiscountPercentage: numeric('default_discount_percentage').default(
    '0',
  ),
  defaultArAccountId: uuid('default_ar_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultRevenueAccountId: uuid('default_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  tradingTermsId: uuid('trading_terms_id').references(
    () => tradingTerms.tradingTermsId,
  ),
  creditLimit: numeric('credit_limit').default('0'), // 0 = cash only/no limit policy
  isOnCreditHold: boolean('is_on_credit_hold').notNull().default(false),
});

// ---------------------------------------------------------------------------
// supplier_groups  (Administrative grouping and GL routing)
// ---------------------------------------------------------------------------
export const supplierGroups = modbmCore.table('supplier_groups', {
  supplierGroupId: uuid('supplier_group_id').primaryKey().defaultRandom(),
  groupCode: text('group_code').unique().notNull(),
  name: text('name').notNull(),
  defaultApAccountId: uuid('default_ap_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultExpenseAccountId: uuid('default_expense_account_id').references(
    () => glAccounts.glAccountId,
  ),
  tradingTermsId: uuid('trading_terms_id').references(
    () => tradingTerms.tradingTermsId,
  ),
  earlyPaymentDiscount: numeric('early_payment_discount').default('0'),
  creditLimit: numeric('credit_limit').default('0'),
  isPurchasingBlocked: boolean('is_purchasing_blocked')
    .notNull()
    .default(false),
  purchasingBlockReason: text('purchasing_block_reason', {
    enum: [
      'compliance_breach',
      'quality_issues',
      'dispute',
      'financial_risk',
      'other',
    ],
  }),
  isPaymentBlocked: boolean('is_payment_blocked').notNull().default(false),
  paymentBlockReason: text('payment_block_reason', {
    enum: ['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'],
  }),
  blockNotes: text('block_notes'),
});

// ---------------------------------------------------------------------------
// product_groups  (Administrative grouping and GL routing)
// ---------------------------------------------------------------------------
export const productGroups = modbmCore.table('product_groups', {
  productGroupId: uuid('product_group_id').primaryKey().defaultRandom(),
  groupCode: text('group_code').unique().notNull(),
  name: text('name').notNull(),
  defaultRevenueAccountId: uuid('default_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultExpenseAccountId: uuid('default_expense_account_id').references(
    () => glAccounts.glAccountId,
  ),
});

// ---------------------------------------------------------------------------
// products  (Native schema structure mapped to CDM product definitions)
// ---------------------------------------------------------------------------
export const products = modbmCore.table('products', {
  productId: uuid('product_id').primaryKey().defaultRandom(),
  productNumber: text('product_number').unique().notNull(),
  name: text('name').notNull(),
  productType: text('product_type', {
    enum: ['inventory', 'non-stock', 'service'],
  })
    .notNull()
    .default('inventory'),
  productGroupId: uuid('product_group_id').references(
    () => productGroups.productGroupId,
  ),
  barcode: text('barcode'),
  listPrice: numeric('list_price', { precision: 12, scale: 2 }).default('0'),
  standardCost: numeric('standard_cost', { precision: 12, scale: 2 }).default(
    '0',
  ),
  tradePrice: numeric('trade_price', { precision: 12, scale: 2 }).default('0'),
  priceLevel3: numeric('price_level_3', { precision: 12, scale: 2 }).default(
    '0',
  ),
  priceLevel4: numeric('price_level_4', { precision: 12, scale: 2 }).default(
    '0',
  ),
  weightedAverageCost: numeric('weighted_average_cost').default('0'),
  alternateInvoiceDescription: text('alternate_invoice_description'),
  boxQuantity: numeric('box_quantity').default('1'),
  baseUom: text('base_uom')
    .notNull()
    .default('EA')
    .references(() => uomDictionary.uomCode),
  defaultSalesUomId: uuid('default_sales_uom_id'),
  defaultPurchaseUomId: uuid('default_purchase_uom_id'),
  purchaseTaxCategoryId: uuid('purchase_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
  salesTaxCategoryId: uuid('sales_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
  alternateProductNumber: text('alternate_product_number'),
  stateCode: text('state_code').notNull().default('active'),
  notes: text('notes'),
  sourceId: text('source_id').unique(),
  source: text('source').notNull().default('app'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// uom_dictionary  (Global unit of measure definitions)
// ---------------------------------------------------------------------------
export const uomDictionary = modbmCore.table('uom_dictionary', {
  uomCode: text('uom_code').primaryKey(),
  description: text('description').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// product_uoms  (Product-specific unit of measure definitions)
// ---------------------------------------------------------------------------
export const productUoms = modbmCore.table(
  'product_uoms',
  {
    productUomId: uuid('product_uom_id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    uomCode: text('uom_code')
      .notNull()
      .references(() => uomDictionary.uomCode),
    ratio: numeric('ratio', { precision: 14, scale: 6 }).notNull(),
    barcode: text('barcode'),
    isSalesDefault: boolean('is_sales_default').default(false),
    isPurchaseDefault: boolean('is_purchase_default').default(false),
  },
  (t) => ({
    unq: unique('product_uoms_product_code_unq').on(t.productId, t.uomCode),
  }),
);

// ---------------------------------------------------------------------------
// product_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
export const productEvents = modbmCore.table('product_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.productId),
  eventType: text('event_type').notNull(), // created, updated, price_changed, etc.
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// accounts  (CDM: Account)
// ---------------------------------------------------------------------------
export const accounts = modbmCore.table(
  'accounts',
  {
    accountId: uuid('account_id').primaryKey().defaultRandom(),
    accountNumber: text('account_number').unique().notNull(),
    name: text('name').notNull(),
    address1Line1: text('address1_line1'),
    address1Line2: text('address1_line2'),
    address1City: text('address1_city'),
    address1StateOrProvince: text('address1_state_or_province'),
    address1PostalCode: text('address1_postal_code'),
    address1Country: text('address1_country'),
    telephone1: text('telephone1'),
    fax: text('fax'),
    emailAddress1: text('email_address1'),
    primaryContactName: text('primary_contact_name'),
    primaryContactEmail: text('primary_contact_email'),
    primaryContactPhone: text('primary_contact_phone'),
    accountGroupId: uuid('account_group_id').references(
      () => accountGroups.accountGroupId,
    ),
    stateCode: text('state_code').notNull().default('active'),
    taxCategoryId: uuid('tax_category_id').references(
      () => taxCategories.taxCategoryId,
    ),
    currencyCode: text('currency_code').notNull(),
    tradingTermsId: uuid('trading_terms_id').references(
      () => tradingTerms.tradingTermsId,
    ),
    creditLimit: numeric('credit_limit'), // Nullable. Overrides group if NOT NULL.
    isOnCreditHold: boolean('is_on_credit_hold').notNull().default(false), // Manual override per account
    customerDiscount: numeric('customer_discount').default('0'),
    externalId: text('external_id'),
    sourceId: text('source_id').unique(),
    source: text('source').notNull().default('app'),
    priceTier: text('price_tier'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('accounts'),
  }),
);

// ---------------------------------------------------------------------------
// account_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
export const accountEvents = modbmCore.table('account_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.accountId),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// suppliers  (CDM: Vendor)
// ---------------------------------------------------------------------------
export const suppliers = modbmCore.table(
  'suppliers',
  {
    vendorId: uuid('vendor_id').primaryKey().defaultRandom(),
    vendorNumber: text('vendor_number').unique().notNull(),
    name: text('name').notNull(),
    supplierGroupId: uuid('supplier_group_id').references(
      () => supplierGroups.supplierGroupId,
    ),
    address1Line1: text('address1_line1'),
    address1Line2: text('address1_line2'),
    address1City: text('address1_city'),
    address1StateOrProvince: text('address1_state_or_province'),
    address1PostalCode: text('address1_postal_code'),
    address1Country: text('address1_country'),
    telephone1: text('telephone1'),
    fax: text('fax'),
    emailAddress1: text('email_address1'),
    tradingTermsId: uuid('trading_terms_id').references(
      () => tradingTerms.tradingTermsId,
    ),
    earlyPaymentDiscount: numeric('early_payment_discount'),
    creditLimit: numeric('credit_limit'),
    isPurchasingBlocked: boolean('is_purchasing_blocked')
      .notNull()
      .default(false),
    purchasingBlockReason: text('purchasing_block_reason', {
      enum: [
        'compliance_breach',
        'quality_issues',
        'dispute',
        'financial_risk',
        'other',
      ],
    }),
    isPaymentBlocked: boolean('is_payment_blocked').notNull().default(false),
    paymentBlockReason: text('payment_block_reason', {
      enum: ['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'],
    }),
    blockNotes: text('block_notes'),
    currencyCode: text('currency_code').notNull(),
    stateCode: text('state_code').notNull().default('active'),
    externalId: text('external_id'),
    notes: text('notes'),
    sourceId: text('source_id').unique(),
    source: text('source').notNull().default('app'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('suppliers'),
  }),
);

// ---------------------------------------------------------------------------
// supplier_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
export const supplierEvents = modbmCore.table('supplier_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => suppliers.vendorId),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// supplier_expiries  (Generic tracking for compliance dates like insurance, tax certs)
// ---------------------------------------------------------------------------
export const supplierExpiries = modbmCore.table('supplier_expiries', {
  expiryId: uuid('expiry_id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => suppliers.vendorId),
  expiryType: text('expiry_type', {
    enum: ['insurance', 'tax_certificate', 'trial_period', 'other'],
  }).notNull(),
  expiryDate: date('expiry_date').notNull(),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// product_suppliers  (Native product-supplier catalogue mapping)
// ---------------------------------------------------------------------------
export const productSuppliers = modbmCore.table(
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
    costPrice: numeric('cost_price').default('0'),
    discountPercent: numeric('discount_percent').default('0'),
    priceBreakQuantity: numeric('price_break_quantity'),
    isPreferred: boolean('is_preferred').notNull().default(false),
    minPurchaseQty: numeric('min_purchase_qty'),
    purchaseUnit: text('purchase_unit'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    stateCode: text('state_code').notNull().default('active'),
    sourceId: text('source_id').unique(),
    source: text('source').notNull().default('app'),
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
// product_supplier_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
export const productSupplierEvents = modbmCore.table(
  'product_supplier_events',
  {
    eventId: uuid('event_id').primaryKey().defaultRandom(),
    productSupplierId: uuid('product_supplier_id')
      .notNull()
      .references(() => productSuppliers.productSupplierId),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload'),
    actor: text('actor'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
);

// ---------------------------------------------------------------------------
// users  (Application users for portal auth + RBAC)
// ---------------------------------------------------------------------------
export const users = modbmCore.table('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  email: text('email'),
  role: text('role').notNull(), // admin | sales | warehouse | procurement
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// user_events  (Audit log for user management actions)
// ---------------------------------------------------------------------------
export const userEvents = modbmCore.table('user_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// sales_invoices  (AR header)
// ---------------------------------------------------------------------------
export const salesInvoices = modbmCore.table(
  'sales_invoices',
  {
    invoiceId: uuid('invoice_id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').unique().notNull(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    totalAmount: numeric('total_amount').notNull(),
    taxAmount: numeric('tax_amount').default('0'),
    currencyCode: text('currency_code').notNull(),
    stateCode: text('state_code').notNull().default('draft'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('sales_invoices'),
  }),
);

// ---------------------------------------------------------------------------
// sales_invoice_lines  (AR details)
// ---------------------------------------------------------------------------
export const salesInvoiceLines = modbmCore.table('sales_invoice_lines', {
  invoiceLineId: uuid('invoice_line_id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => salesInvoices.invoiceId),
  salesOrderLineId: uuid('sales_order_line_id')
    .notNull()
    .references(() => salesOrderLineItems.salesOrderLineId),
  quantityInvoiced: numeric('quantity_invoiced').notNull(),
  pricePerUnit: numeric('price_per_unit').notNull(),
  amount: numeric('amount').notNull(),
});

// ---------------------------------------------------------------------------
// purchase_invoices  (AP header)
// ---------------------------------------------------------------------------
export const purchaseInvoices = modbmCore.table(
  'purchase_invoices',
  {
    invoiceId: uuid('invoice_id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').unique().notNull(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => suppliers.vendorId),
    purchaseOrderId: uuid('purchase_order_id').references(
      () => purchaseOrders.purchaseOrderId,
    ),
    supplierInvoiceNumber: text('supplier_invoice_number'),
    receiptFilename: text('receipt_filename'),
    totalAmount: numeric('total_amount').notNull(),
    taxAmount: numeric('tax_amount').default('0'),
    currencyCode: text('currency_code').notNull(),
    stateCode: text('state_code').notNull().default('draft'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('purchase_invoices'),
  }),
);

// ---------------------------------------------------------------------------
// purchase_invoice_lines  (AP details)
// ---------------------------------------------------------------------------
export const purchaseInvoiceLines = modbmCore.table('purchase_invoice_lines', {
  invoiceLineId: uuid('invoice_line_id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => purchaseInvoices.invoiceId),
  purchaseOrderLineId: uuid('purchase_order_line_id').references(
    () => purchaseOrderLineItems.purchaseOrderLineId,
  ),
  productId: uuid('product_id').references(() => products.productId),
  glAccountId: uuid('gl_account_id').references(() => glAccounts.glAccountId),
  description: text('description'),
  quantityInvoiced: numeric('quantity_invoiced').notNull(),
  pricePerUnit: numeric('price_per_unit').notNull(),
  amount: numeric('amount').notNull(),
  matchStatus: text('match_status').notNull().default('unmatched'),
});

// ---------------------------------------------------------------------------
// purchase_invoice_receipts  (N:N mapping for 3-way matching between invoice lines and received goods lines)
// ---------------------------------------------------------------------------
export const purchaseInvoiceReceipts = modbmCore.table(
  'purchase_invoice_receipts',
  {
    invoiceReceiptId: uuid('invoice_receipt_id').primaryKey().defaultRandom(),
    invoiceLineId: uuid('invoice_line_id')
      .notNull()
      .references(() => purchaseInvoiceLines.invoiceLineId),
    goodsReceivedLineId: uuid('goods_received_line_id')
      .notNull()
      .references(() => goodsReceivedLines.goodsReceivedLineId),
    quantityBilled: numeric('quantity_billed').notNull(),
  },
);
// ===========================================================================
// GENERAL LEDGER (Native Double-Entry Accounting)
// ===========================================================================

// ---------------------------------------------------------------------------
// gl_accounts  (Chart of Accounts — hierarchical, customisable)
// ---------------------------------------------------------------------------
export const glAccounts = modbmCore.table(
  'gl_accounts',
  {
    glAccountId: uuid('gl_account_id').primaryKey().defaultRandom(),
    accountCode: text('account_code').unique().notNull(),
    name: text('name').notNull(),
    accountType: text('account_type').notNull(), // asset | liability | equity | revenue | expense
    parentAccountId: uuid('parent_account_id'), // self-ref for hierarchy
    isGroup: boolean('is_group').notNull().default(false),
    isSystem: boolean('is_system').notNull().default(false), // prevents deletion
    currencyCode: text('currency_code').notNull(), // GL accounts can have different currencies
    isActive: boolean('is_active').notNull().default(true),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('gl_accounts'),
  }),
);

// ---------------------------------------------------------------------------
// gl_journal_entries  (Journal Entry header — one per financial event)
// ---------------------------------------------------------------------------
export const glJournalEntries = modbmCore.table('gl_journal_entries', {
  journalEntryId: uuid('journal_entry_id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').unique().notNull(),
  entryDate: date('entry_date').notNull(),
  memo: text('memo'),
  sourceType: text('source_type').notNull(), // sales_invoice | purchase_invoice | sales_credit_note | manual | adjustment
  sourceId: uuid('source_id'), // FK to originating document (nullable for manual)
  isReversed: boolean('is_reversed').notNull().default(false),
  reversedBy: uuid('reversed_by'), // self-ref to reversing JE
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// gl_reconciliations (Bank Reconciliation header)
// ---------------------------------------------------------------------------
export const glReconciliations = modbmCore.table('gl_reconciliations', {
  reconciliationId: uuid('reconciliation_id').primaryKey().defaultRandom(),
  glAccountId: uuid('gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  statementDate: date('statement_date').notNull(),
  statementBalance: numeric('statement_balance').notNull(),
  status: text('status').notNull().default('draft'), // 'draft' | 'posted'
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  postedOn: timestamp('posted_on', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// gl_journal_lines  (Debits and Credits — the core of double-entry)
// ---------------------------------------------------------------------------
export const glJournalLines = modbmCore.table('gl_journal_lines', {
  journalLineId: uuid('journal_line_id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id')
    .notNull()
    .references(() => glJournalEntries.journalEntryId),
  glAccountId: uuid('gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  partyType: text('party_type'), // 'customer' | 'supplier'
  partyId: text('party_id'), // generic reference to accounts/suppliers
  debit: numeric('debit').notNull().default('0'),
  credit: numeric('credit').notNull().default('0'),
  memo: text('memo'),
  isReconciled: boolean('is_reconciled').notNull().default(false),
  reconciliationId: uuid('reconciliation_id').references(
    () => glReconciliations.reconciliationId,
  ),
});

// ---------------------------------------------------------------------------
// organization  (Singleton config for company identity)
// ---------------------------------------------------------------------------
export const organization = modbmCore.table('organization', {
  organizationId: uuid('organization_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  postCode: text('post_code'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  companyNumber: text('company_number'),
  taxNumber: text('tax_number'),
  logoUrl: text('logo_url'),
  bankName: text('bank_name'),
  bankAccountName: text('bank_account_name'),
  bankAccountNumber: text('bank_account_number'),
  bankSwiftBic: text('bank_swift_bic'),
  bankIban: text('bank_iban'),
});

// ---------------------------------------------------------------------------
// gl_settings  (Singleton config — fiscal year + default account mappings)
// ---------------------------------------------------------------------------
export const glSettings = modbmCore.table('gl_settings', {
  settingsId: uuid('settings_id').primaryKey().defaultRandom(),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull(), // Sourced from settings JSON
  defaultArAccountId: uuid('default_ar_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultApAccountId: uuid('default_ap_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultRevenueAccountId: uuid('default_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultCogsAccountId: uuid('default_cogs_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultTaxAccountId: uuid('default_tax_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultExpenseAccountId: uuid('default_expense_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultInventoryAccountId: uuid('default_inventory_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultGrniAccountId: uuid('default_grni_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultShrinkageAccountId: uuid('default_shrinkage_account_id').references(
    () => glAccounts.glAccountId,
  ),
  baseCurrency: text('base_currency').notNull(),
  revenueRoutingPrecedence: text('revenue_routing_precedence')
    .notNull()
    .default('product_first'), // 'product_first' | 'customer_first'
  expenseRoutingPrecedence: text('expense_routing_precedence')
    .notNull()
    .default('product_first'), // 'product_first' | 'supplier_first'
});

// ---------------------------------------------------------------------------
// app_settings  (Singleton config — operational defaults)
// ---------------------------------------------------------------------------
export const appSettings = modbmCore.table('app_settings', {
  settingsId: uuid('settings_id').primaryKey().defaultRandom(),
  defaultFulfillmentLocationId: uuid(
    'default_fulfillment_location_id',
  ).references(() => locations.locationId),
  inventoryValuationMethod: text('inventory_valuation_method')
    .notNull()
    .default('weighted_average'), // 'weighted_average' | 'fifo' | 'standard'
  inventoryAccountingMode: text('inventory_accounting_mode')
    .notNull()
    .default('periodic'), // 'periodic' | 'perpetual'
  nonStockBillingMode: text('non_stock_billing_mode')
    .notNull()
    .default('per_shipment'), // 'per_shipment' | 'final_invoice'
  creditLimitBehavior: text('credit_limit_behavior').notNull().default('soft'), // 'hard' (block creation) | 'soft' (allow draft, block dispatch)
  setupCompletedAt: timestamp('setup_completed_at', { withTimezone: true }),
});

// ===========================================================================
// DYNAMIC REPORTING
// ===========================================================================

export const reports = modbmCore.table('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  template: text('template').notNull(),
  mockData: jsonb('mock_data').$type<Record<string, any>>(),
  outputNamePattern: text('output_name_pattern').default('Report.pdf'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const reportContexts = modbmCore.table(
  'report_contexts',
  {
    reportId: uuid('report_id')
      .references(() => reports.id, { onDelete: 'cascade' })
      .notNull(),
    context: text('context').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reportId, t.context] }),
  }),
);

export const reportHookAssignments = modbmCore.table(
  'report_hook_assignments',
  {
    hookSlug: text('hook_slug').primaryKey(),
    reportId: uuid('report_id')
      .references(() => reports.id, { onDelete: 'cascade' })
      .notNull(),
    contextSlug: text('context_slug').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

// ---------------------------------------------------------------------------
// system_events  (Cross-cutting audit log for GL, inventory, and other
//                 domain events that don't belong to a specific entity table)
// ---------------------------------------------------------------------------
export const systemEvents = modbmCore.table('system_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// goods_received  (Physical dock manifest — one per incoming package/packing slip)
// ---------------------------------------------------------------------------
export const goodsReceived = modbmCore.table('goods_received', {
  goodsReceivedId: uuid('goods_received_id').primaryKey().defaultRandom(),
  receiptNumber: text('receipt_number').unique().notNull(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => suppliers.vendorId),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.locationId),
  packingSlipNumber: text('packing_slip_number'),
  notes: text('notes'),
  stateCode: text('state_code').notNull().default('received'), // received | invoiced | archived
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// goods_received_lines  (Per-product quantities from the packing slip)
// ---------------------------------------------------------------------------
export const goodsReceivedLines = modbmCore.table('goods_received_lines', {
  goodsReceivedLineId: uuid('goods_received_line_id')
    .primaryKey()
    .defaultRandom(),
  goodsReceivedId: uuid('goods_received_id')
    .notNull()
    .references(() => goodsReceived.goodsReceivedId),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.productId),
  quantityReceived: numeric('quantity_received').notNull(),
  matchStatus: text('match_status').notNull().default('unmatched'), // matched | unmatched | ambiguous
  putawayStatus: text('putaway_status', {
    enum: ['pending_putaway', 'quarantined', 'completed'],
  })
    .notNull()
    .default('pending_putaway'),
  purchaseOrderLineId: uuid('purchase_order_line_id').references(
    () => purchaseOrderLineItems.purchaseOrderLineId,
  ),
  purchaseOrderId: uuid('purchase_order_id').references(
    () => purchaseOrders.purchaseOrderId,
  ),
});

// ---------------------------------------------------------------------------
// dashboard_timeline  (Unified operational timeline combining all entity and
//                      system events for the dashboard chronological feed)
// ---------------------------------------------------------------------------
export const dashboardTimeline = modbmCore
  .view('dashboard_timeline', {
    eventId: uuid('event_id'),
    aggregateType: text('aggregate_type'),
    aggregateId: uuid('aggregate_id'),
    eventType: text('event_type'),
    payload: jsonb('payload'),
    actor: text('actor'),
    createdOn: timestamp('created_on', { withTimezone: true }),
  })
  .existing();
