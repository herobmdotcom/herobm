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
  type: text('type').notNull(), // not_relevant | exempt | zero_rated | gst_applies
  rate: numeric('rate').default('0'), // percentage, e.g. '9' = 9%
  isDefault: boolean('is_default').default(false),
});

// ---------------------------------------------------------------------------
// exchange_rates  (Static currency exchange rates)
// ---------------------------------------------------------------------------
export const exchangeRates = modbmCore.table('exchange_rates', {
  exchangeRateId: uuid('exchange_rate_id').primaryKey().defaultRandom(),
  currencyCode: text('currency_code').notNull().unique(), // ISO 4217
  currencyName: text('currency_name').notNull(),
  buyRate: numeric('buy_rate').notNull(), // units of this currency per 1 EUR
  sellRate: numeric('sell_rate').notNull(), // units of this currency per 1 EUR
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
  gstCategoryId: uuid('gst_category_id').references(
    () => gstCategories.gstCategoryId,
  ),
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
  gstCategoryId: uuid('gst_category_id').references(
    () => gstCategories.gstCategoryId,
  ),
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
  purchaseOrderLineId: uuid('purchase_order_line_id')
    .primaryKey()
    .defaultRandom(),
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
// purchase_order_receptions  (Goods Receipt)
// ---------------------------------------------------------------------------
export const purchaseOrderReceptions = modbmCore.table(
  'purchase_order_receptions',
  {
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
  },
);

// ---------------------------------------------------------------------------
// purchase_order_reception_lines  (Per-line quantities received)
// ---------------------------------------------------------------------------
export const purchaseOrderReceptionLines = modbmCore.table(
  'purchase_order_reception_lines',
  {
    receptionLineId: uuid('reception_line_id').primaryKey().defaultRandom(),
    receptionId: uuid('reception_id')
      .notNull()
      .references(() => purchaseOrderReceptions.receptionId),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLineItems.purchaseOrderLineId),
    quantityReceived: numeric('quantity_received').notNull(),
  },
);

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

// ---------------------------------------------------------------------------
// products  (CDM: Product)
// ---------------------------------------------------------------------------
export const products = modbmCore.table('products', {
  productId: uuid('product_id').primaryKey().defaultRandom(),
  productNumber: text('product_number').unique().notNull(),
  name: text('name').notNull(),
  barcode: text('barcode'),
  listPrice: numeric('list_price').default('0'),
  standardCost: numeric('standard_cost').default('0'),
  tradePrice: numeric('trade_price').default('0'),
  priceLevel3: numeric('price_level_3').default('0'),
  priceLevel4: numeric('price_level_4').default('0'),
  weightedAverageCost: numeric('weighted_average_cost').default('0'),
  quantityOnHand: numeric('quantity_on_hand').default('0'),
  stateCode: text('state_code').notNull().default('active'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

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
export const accounts = modbmCore.table('accounts', {
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
  customerGroup: text('customer_group'),
  stateCode: text('state_code').notNull().default('active'),
  gstPosition: text('gst_position'),
  currencyCode: text('currency_code').notNull().default('EUR'),
  customerDiscount: numeric('customer_discount').default('0'),
  erpnextId: text('erpnext_id'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

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
export const suppliers = modbmCore.table('suppliers', {
  vendorId: uuid('vendor_id').primaryKey().defaultRandom(),
  vendorNumber: text('vendor_number').unique().notNull(),
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
  paymentTerms: text('payment_terms'),
  currencyCode: text('currency_code').notNull().default('EUR'),
  stateCode: text('state_code').notNull().default('active'),
  erpnextId: text('erpnext_id'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

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
// users  (Application users for portal auth + RBAC)
// ---------------------------------------------------------------------------
export const users = modbmCore.table('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // admin | sales | warehouse | procurement
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// sales_invoices  (AR header)
// ---------------------------------------------------------------------------
export const salesInvoices = modbmCore.table('sales_invoices', {
  invoiceId: uuid('invoice_id').primaryKey().defaultRandom(),
  invoiceNumber: text('invoice_number').unique().notNull(),
  salesOrderId: uuid('sales_order_id')
    .notNull()
    .references(() => salesOrders.salesOrderId),
  erpnextJournalId: text('erpnext_journal_id'),
  totalAmount: numeric('total_amount').notNull(),
  taxAmount: numeric('tax_amount').default('0'),
  currencyCode: text('currency_code').notNull().default('EUR'),
  stateCode: text('state_code').notNull().default('draft'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

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
export const purchaseInvoices = modbmCore.table('purchase_invoices', {
  invoiceId: uuid('invoice_id').primaryKey().defaultRandom(),
  invoiceNumber: text('invoice_number').unique().notNull(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.purchaseOrderId),
  supplierInvoiceNumber: text('supplier_invoice_number'),
  erpnextJournalId: text('erpnext_journal_id'),
  totalAmount: numeric('total_amount').notNull(),
  taxAmount: numeric('tax_amount').default('0'),
  currencyCode: text('currency_code').notNull().default('EUR'),
  stateCode: text('state_code').notNull().default('draft'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// purchase_invoice_lines  (AP details)
// ---------------------------------------------------------------------------
export const purchaseInvoiceLines = modbmCore.table('purchase_invoice_lines', {
  invoiceLineId: uuid('invoice_line_id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => purchaseInvoices.invoiceId),
  purchaseOrderLineId: uuid('purchase_order_line_id')
    .notNull()
    .references(() => purchaseOrderLineItems.purchaseOrderLineId),
  quantityInvoiced: numeric('quantity_invoiced').notNull(),
  pricePerUnit: numeric('price_per_unit').notNull(),
  amount: numeric('amount').notNull(),
});

// ===========================================================================
// GENERAL LEDGER (Native Double-Entry Accounting)
// ===========================================================================

// ---------------------------------------------------------------------------
// gl_accounts  (Chart of Accounts — hierarchical, customisable)
// ---------------------------------------------------------------------------
export const glAccounts = modbmCore.table('gl_accounts', {
  glAccountId: uuid('gl_account_id').primaryKey().defaultRandom(),
  accountCode: text('account_code').unique().notNull(),
  name: text('name').notNull(),
  accountType: text('account_type').notNull(), // asset | liability | equity | revenue | expense
  parentAccountId: uuid('parent_account_id'), // self-ref for hierarchy
  isGroup: boolean('is_group').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false), // prevents deletion
  currencyCode: text('currency_code').notNull().default('AUD'),
  isActive: boolean('is_active').notNull().default(true),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// gl_journal_entries  (Journal Entry header — one per financial event)
// ---------------------------------------------------------------------------
export const glJournalEntries = modbmCore.table('gl_journal_entries', {
  journalEntryId: uuid('journal_entry_id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').unique().notNull(),
  entryDate: date('entry_date').notNull(),
  memo: text('memo'),
  sourceType: text('source_type').notNull(), // sales_invoice | purchase_invoice | manual | adjustment
  sourceId: uuid('source_id'), // FK to originating document (nullable for manual)
  isReversed: boolean('is_reversed').notNull().default(false),
  reversedBy: uuid('reversed_by'), // self-ref to reversing JE
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
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
  partyId: text('party_id'), // generic reference to mart_accounts/mart_suppliers
  debit: numeric('debit').notNull().default('0'),
  credit: numeric('credit').notNull().default('0'),
  memo: text('memo'),
});

// ---------------------------------------------------------------------------
// gl_settings  (Singleton config — fiscal year + default account mappings)
// ---------------------------------------------------------------------------
export const glSettings = modbmCore.table('gl_settings', {
  settingsId: uuid('settings_id').primaryKey().defaultRandom(),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(7), // AU: July
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
  baseCurrency: text('base_currency').notNull().default('AUD'),
});
