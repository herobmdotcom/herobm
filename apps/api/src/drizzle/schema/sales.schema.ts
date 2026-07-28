import {
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  check,
  foreignKey,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  getValidStates,
  SALES_ORDER_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
  SALES_ORDER_PICK_TRANSITIONS,
  SalesOrderState,
  ShipmentState,
  ReturnState,
  SalesOrderPickState,
  SalesInvoiceState,
  PUTAWAY_STATUS,
} from '@herobm/shared';

import { herobmCore, validCurrencyCheck } from './core.schema';
import { products } from './products.schema';
import { locations, bins } from './inventory.schema';
import { taxCategories } from './tax.schema';
import {
  customers,
  bins as coreBins,
  suppliers,
  glAccounts,
  purchaseOrders,
  purchaseOrderLineItems,
  transferOrders,
  transferOrderLines,
} from '../schema';

// ---------------------------------------------------------------------------
// sales_orders  (CDM: SalesOrder)
// ---------------------------------------------------------------------------
export const salesOrders = herobmCore.table(
  'sales_orders',
  {
    salesOrderId: uuid('sales_order_id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').unique().notNull(),
    name: text('name'),
    customerId: uuid('customer_id').references(() => customers.customerId),
    customerOrderNumber: text('customer_order_number'),
    fulfillmentLocationId: uuid('fulfillment_location_id')
      .notNull()
      .references(() => locations.locationId),
    stateCode: text('state_code').$type<SalesOrderState>().notNull(),
    baseTotalAmount: numeric('base_total_amount'),
    currencyCode: text('currency_code').notNull(),
    exchangeRate: numeric('exchange_rate').notNull(),
    notes: text('notes'),
    shippingNotes: text('shipping_notes'),
    deliveryCompanyName: text('delivery_company_name'),
    deliveryName: text('delivery_name'),
    deliveryPhone: text('delivery_phone'),
    deliveryAddressLine1: text('delivery_address_line1'),
    deliveryAddressLine2: text('delivery_address_line2'),
    deliveryCity: text('delivery_city'),
    deliveryState: text('delivery_state'),
    deliveryPostalCode: text('delivery_postal_code'),
    deliveryCountry: text('delivery_country'),
    customFields: jsonb('custom_fields'),
    discrepanciesAcknowledged: boolean('discrepancies_acknowledged').notNull(),
    sourceId: text('source_id').unique(),
    source: text('source').notNull(),
    termsDescription: text('terms_description'),
    creditHoldOverrideAt: timestamp('credit_hold_override_at', {
      withTimezone: true,
    }),
    creditHoldOverrideBy: text('credit_hold_override_by'),
    creditHoldOverrideReason: text('credit_hold_override_reason'),
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
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
    customerIdx: index('idx_sales_orders_customer_id').on(t.customerId),
    stateIdx: index('idx_sales_orders_state_code').on(t.stateCode),
    createdOnIdx: index('idx_sales_orders_created_on').on(t.createdOn),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_lines  (CDM: SalesOrderProduct)
// ---------------------------------------------------------------------------
export const salesOrderLineItems = herobmCore.table(
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
    discountPercentage: numeric('discount_percentage'),
    amount: numeric('amount'),
    taxCategoryId: uuid('tax_category_id')
      .notNull()
      .references(() => taxCategories.taxCategoryId),
    tax: numeric('tax'),
    totalAmount: numeric('total_amount'),
    unitOfMeasure: text('unit_of_measure'),
    quantityPicked: numeric('quantity_picked'),
    fulfillmentLocationId: uuid('fulfillment_location_id')
      .notNull()
      .references(() => locations.locationId),
    isPostConfirmation: boolean('is_post_confirmation'),
    parentLineId: uuid('parent_line_id'),
  },
  (t) => ({
    uniqueSoLineNumber: uniqueIndex('unique_so_line_number')
      .on(t.salesOrderId, t.lineNumber)
      .where(sql`${t.salesOrderId} != '00000000-0000-4000-8000-000000000001'`),
    productLocationIdx: index('idx_sales_order_lines_product_location').on(
      t.productId,
      t.fulfillmentLocationId,
    ),
    orderIdx: index('idx_sales_order_lines_order_id').on(t.salesOrderId),
    parentLineIdx: index('idx_sales_order_lines_parent_line').on(
      t.parentLineId,
    ),
    parentLineFk: foreignKey({
      columns: [t.parentLineId],
      foreignColumns: [t.salesOrderLineId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_picks  (Pick allocations against sales orders)
// ---------------------------------------------------------------------------
export const salesOrderPicks = herobmCore.table(
  'sales_order_picks',
  {
    pickId: uuid('pick_id').primaryKey().defaultRandom(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    salesOrderLineId: uuid('sales_order_line_id')
      .notNull()
      .references(() => salesOrderLineItems.salesOrderLineId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    binId: uuid('bin_id').references(() => bins.binId),
    quantity: numeric('quantity').notNull(),
    stateCode: text('state_code').$type<SalesOrderPickState>().notNull(),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_sales_order_picks_order').on(t.salesOrderId),
    lineIdx: index('idx_sales_order_picks_line').on(t.salesOrderLineId),
    stateCheck: check(
      'sales_order_pick_state_check',
      sql.raw(
        `state_code IN (${getValidStates(SALES_ORDER_PICK_TRANSITIONS)
          .map((s) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_returns  (Return header against an invoiced order)
// ---------------------------------------------------------------------------
export const salesOrderReturns = herobmCore.table(
  'sales_order_returns',
  {
    returnId: uuid('return_id').primaryKey().defaultRandom(),
    returnNumber: text('return_number').unique().notNull(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    stateCode: text('state_code').$type<ReturnState>().notNull(),
    locationId: uuid('location_id').references(() => locations.locationId),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'return_state_check',
      sql.raw(
        `state_code IN (${getValidStates(RETURN_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
export const salesOrderReturnLines = herobmCore.table(
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
    quantityReceived: numeric('quantity_received'),
    reason: text('reason'),
    resolution: text('resolution', { enum: ['refund', 'replace'] }).notNull(),
    returnFee: numeric('return_fee'), // absolute fee in order currency
    putawayStatus: text('putaway_status', {
      enum: [
        PUTAWAY_STATUS.AWAITING_MATCHING,
        PUTAWAY_STATUS.PENDING_PUTAWAY,
        PUTAWAY_STATUS.QUARANTINED,
        PUTAWAY_STATUS.COMPLETED,
      ],
    }).notNull(),
  },
  (t) => ({
    soLineIdx: index('idx_sales_order_return_lines_so_line').on(
      t.salesOrderLineId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_invoices  (AR header)
// ---------------------------------------------------------------------------
export const salesInvoices = herobmCore.table(
  'sales_invoices',
  {
    invoiceId: uuid('invoice_id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').unique().notNull(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    totalAmount: numeric('total_amount').notNull(),
    outstandingAmount: numeric('outstanding_amount').notNull(),
    taxAmount: numeric('tax_amount'),
    baseTotalAmount: numeric('base_total_amount'),
    baseOutstandingAmount: numeric('base_outstanding_amount'),
    currencyCode: text('currency_code').notNull(),
    exchangeRate: numeric('exchange_rate').notNull(),
    stateCode: text('state_code').$type<SalesInvoiceState>().notNull(),
    invoiceDate: timestamp('invoice_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    termsDescription: text('terms_description'),
    notes: text('notes'),
    earlyPaymentDiscount: numeric('early_payment_discount'),
    earlyPaymentDiscountDays: integer('early_payment_discount_days'),
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
export const salesInvoiceLines = herobmCore.table(
  'sales_invoice_lines',
  {
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
  },
  (t) => ({
    soLineIdx: index('idx_sales_invoice_lines_so_line').on(t.salesOrderLineId),
  }),
);

// ---------------------------------------------------------------------------
// sales_credit_notes  (Credit Note header — reverses a sales invoice)
// ---------------------------------------------------------------------------
export const salesCreditNotes = herobmCore.table(
  'sales_credit_notes',
  {
    creditNoteId: uuid('credit_note_id').primaryKey().defaultRandom(),
    creditNoteNumber: text('credit_note_number').unique().notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.customerId),
    returnId: uuid('return_id').references(() => salesOrderReturns.returnId),
    salesOrderId: uuid('sales_order_id').references(
      () => salesOrders.salesOrderId,
    ),
    invoiceId: uuid('invoice_id').references(() => salesInvoices.invoiceId),
    totalAmount: numeric('total_amount').notNull(),
    taxAmount: numeric('tax_amount'),
    feeAmount: numeric('fee_amount'),
    outstandingAmount: numeric('outstanding_amount').notNull(),
    baseTotalAmount: numeric('base_total_amount'),
    baseOutstandingAmount: numeric('base_outstanding_amount'),
    currencyCode: text('currency_code').notNull(),
    exchangeRate: numeric('exchange_rate').notNull(),
    stateCode: text('state_code').notNull(),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('sales_credit_notes'),
  }),
);

// ---------------------------------------------------------------------------
// sales_credit_note_lines  (Per-line credit amounts)
// ---------------------------------------------------------------------------
export const salesCreditNoteLines = herobmCore.table(
  'sales_credit_note_lines',
  {
    creditNoteLineId: uuid('credit_note_line_id').primaryKey().defaultRandom(),
    creditNoteId: uuid('credit_note_id')
      .notNull()
      .references(() => salesCreditNotes.creditNoteId),
    salesOrderLineId: uuid('sales_order_line_id').references(
      () => salesOrderLineItems.salesOrderLineId,
    ),
    description: text('description'),
    accountId: uuid('account_id').references(() => glAccounts.glAccountId),
    taxCategoryId: uuid('tax_category_id').references(
      () => taxCategories.taxCategoryId,
    ),
    quantityCredited: numeric('quantity_credited').notNull(),
    pricePerUnit: numeric('price_per_unit').notNull(),
    amount: numeric('amount').notNull(),
    taxAmount: numeric('tax_amount'),
  },
  (t) => ({
    soLineIdx: index('idx_sales_credit_note_lines_so_line').on(
      t.salesOrderLineId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_shipments  (Shipment/delivery batch header)
// ---------------------------------------------------------------------------
export const salesOrderShipments = herobmCore.table(
  'sales_order_shipments',
  {
    shipmentId: uuid('shipment_id').primaryKey().defaultRandom(),
    shipmentNumber: text('shipment_number').unique().notNull(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.salesOrderId),
    stateCode: text('state_code').$type<ShipmentState>().notNull(),
    notes: text('notes'),
    trackingNumber: text('tracking_number'),
    deliveryCompanyName: text('delivery_company_name'),
    fulfillmentLocationId: uuid('fulfillment_location_id').references(
      () => locations.locationId,
    ),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'shipment_state_check',
      sql.raw(
        `state_code IN (${getValidStates(SHIPMENT_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_order_shipment_lines  (Per-line quantities in each shipment)
// ---------------------------------------------------------------------------
export const salesOrderShipmentLines = herobmCore.table(
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
  (t) => ({
    soLineIdx: index('idx_sales_order_shipment_lines_so_line').on(
      t.salesOrderLineId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// sales_events  (Sales domain audit log)
// ---------------------------------------------------------------------------
export const salesEvents = herobmCore.table('sales_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// backorders (Order Allocations for Cross-Dock/Picked bridging)
// ---------------------------------------------------------------------------
export const backorders = herobmCore.table(
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
    transferOrderId: uuid('transfer_order_id').references(
      () => transferOrders.transferOrderId,
    ),
    transferOrderLineId: uuid('transfer_order_line_id').references(
      () => transferOrderLines.transferOrderLineId,
    ),
    quantity: numeric('quantity').notNull(),
    stateCode: text('state_code').notNull(),
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
