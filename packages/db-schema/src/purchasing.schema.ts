import {
  text,
  integer,
  numeric,
  timestamp,
  date,
  uuid,
  jsonb,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  PURCHASE_ORDER_TRANSITIONS,
  PURCHASE_RETURN_TRANSITIONS,
  PURCHASE_RETURN_SHIPMENT_TRANSITIONS,
  PURCHASE_DEBIT_NOTE_TRANSITIONS,
  PurchaseOrderState,
  PurchaseReturnState,
  PurchaseReturnShipmentState,
  PurchaseDebitNoteState,
  GoodsReceivedState,
  PUTAWAY_STATUS,
  getValidStates,
} from '@herobm/shared';

import { herobmCore, validCurrencyCheck } from './core.schema';
import { suppliers, glAccounts } from './index';
import { locations } from './inventory.schema';
import { products } from './products.schema';
import { taxCategories } from './tax.schema';

// ---------------------------------------------------------------------------
// purchase_orders  (CDM: PurchaseOrder)
// ---------------------------------------------------------------------------
export const purchaseOrders = herobmCore.table(
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
    stateCode: text('state_code').$type<PurchaseOrderState>().notNull(),
    baseTotalAmount: numeric('base_total_amount'),
    currencyCode: text('currency_code').notNull(),
    exchangeRate: numeric('exchange_rate').notNull(),
    notes: text('notes'),
    customFields: jsonb('custom_fields'),
    expectedDate: timestamp('expected_date', { withTimezone: true }),
    termsDescription: text('terms_description'),
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
          .map((s: string) => `'${s}'`)
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
export const purchaseOrderLineItems = herobmCore.table(
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
    discountPercentage: numeric('discount_percentage'),
    amount: numeric('amount'),
    taxCategoryId: uuid('tax_category_id')
      .notNull()
      .references(() => taxCategories.taxCategoryId),
    tax: numeric('tax'),
    totalAmount: numeric('total_amount'),
    unitOfMeasure: text('unit_of_measure'),
    quantityReceived: numeric('quantity_received'),
  },
  (t) => ({
    productIdx: index('idx_purchase_order_lines_product').on(t.productId),
    uniquePoLineNumber: uniqueIndex('unique_po_line_number')
      .on(t.purchaseOrderId, t.lineNumber)
      .where(
        sql`${t.purchaseOrderId} != '00000000-0000-4000-8000-000000000001'`,
      ),
  }),
);

// ---------------------------------------------------------------------------
// purchase_order_returns  (Return header against a PO)
// ---------------------------------------------------------------------------
export const purchaseOrderReturns = herobmCore.table(
  'purchase_order_returns',
  {
    returnId: uuid('return_id').primaryKey().defaultRandom(),
    returnNumber: text('return_number').unique().notNull(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.purchaseOrderId),
    stateCode: text('state_code').$type<PurchaseReturnState>().notNull(),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'po_return_state_check',
      sql.raw(
        `state_code IN (${getValidStates(PURCHASE_RETURN_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// purchase_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
export const purchaseOrderReturnLines = herobmCore.table(
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
    returnFee: numeric('return_fee'), // absolute fee in order currency
  },
);

// ---------------------------------------------------------------------------
// purchase_order_return_shipments
// ---------------------------------------------------------------------------
export const purchaseOrderReturnShipments = herobmCore.table(
  'purchase_order_return_shipments',
  {
    shipmentId: uuid('shipment_id').primaryKey().defaultRandom(),
    shipmentNumber: text('shipment_number').unique().notNull(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => purchaseOrderReturns.returnId),
    stateCode: text('state_code')
      .$type<PurchaseReturnShipmentState>()
      .notNull(),
    notes: text('notes'),
    trackingNumber: text('tracking_number'),
    fulfillmentLocationId: uuid('fulfillment_location_id').references(
      () => locations.locationId,
    ),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'po_return_shipment_state_check',
      sql.raw(
        `state_code IN (${getValidStates(PURCHASE_RETURN_SHIPMENT_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// purchase_order_return_shipment_lines
// ---------------------------------------------------------------------------
export const purchaseOrderReturnShipmentLines = herobmCore.table(
  'purchase_order_return_shipment_lines',
  {
    shipmentLineId: uuid('shipment_line_id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => purchaseOrderReturnShipments.shipmentId),
    returnLineId: uuid('return_line_id')
      .notNull()
      .references(() => purchaseOrderReturnLines.returnLineId),
    quantityShipped: numeric('quantity_shipped').notNull(),
  },
);

// ---------------------------------------------------------------------------
// purchase_debit_notes
// ---------------------------------------------------------------------------
export const purchaseDebitNotes = herobmCore.table(
  'purchase_debit_notes',
  {
    debitNoteId: uuid('debit_note_id').primaryKey().defaultRandom(),
    debitNoteNumber: text('debit_note_number').unique().notNull(),
    supplierReferenceNumber: text('supplier_reference_number'),
    returnId: uuid('return_id')
      .notNull()
      .references(() => purchaseOrderReturns.returnId),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.purchaseOrderId),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => suppliers.vendorId),
    totalAmount: numeric('total_amount').notNull(),
    taxAmount: numeric('tax_amount'),
    feeAmount: numeric('fee_amount'),
    outstandingAmount: numeric('outstanding_amount').notNull(),
    baseTotalAmount: numeric('base_total_amount'),
    baseOutstandingAmount: numeric('base_outstanding_amount'),
    currencyCode: text('currency_code').notNull(),
    exchangeRate: numeric('exchange_rate').notNull(),
    stateCode: text('state_code').$type<PurchaseDebitNoteState>().notNull(),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('purchase_debit_notes'),
    stateCheck: check(
      'purchase_debit_note_state_check',
      sql.raw(
        `state_code IN (${getValidStates(PURCHASE_DEBIT_NOTE_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);

// ---------------------------------------------------------------------------
// purchase_debit_note_lines
// ---------------------------------------------------------------------------
export const purchaseDebitNoteLines = herobmCore.table(
  'purchase_debit_note_lines',
  {
    debitNoteLineId: uuid('debit_note_line_id').primaryKey().defaultRandom(),
    debitNoteId: uuid('debit_note_id')
      .notNull()
      .references(() => purchaseDebitNotes.debitNoteId),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLineItems.purchaseOrderLineId),
    quantityInvoiced: numeric('quantity_invoiced').notNull(),
    pricePerUnit: numeric('price_per_unit').notNull(),
    amount: numeric('amount').notNull(),
    taxAmount: numeric('tax_amount'),
  },
);

// ---------------------------------------------------------------------------
// purchase_invoices  (AP header)
// ---------------------------------------------------------------------------
export const purchaseInvoices = herobmCore.table(
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
    outstandingAmount: numeric('outstanding_amount').notNull(),
    taxAmount: numeric('tax_amount'),
    baseTotalAmount: numeric('base_total_amount'),
    baseOutstandingAmount: numeric('base_outstanding_amount'),
    currencyCode: text('currency_code').notNull(),
    exchangeRate: numeric('exchange_rate').notNull(),
    stateCode: text('state_code').notNull(),
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
    currencyCheck: validCurrencyCheck('purchase_invoices'),
  }),
);

// ---------------------------------------------------------------------------
// purchase_invoice_lines  (AP details)
// ---------------------------------------------------------------------------
export const purchaseInvoiceLines = herobmCore.table(
  'purchase_invoice_lines',
  {
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
    matchStatus: text('match_status').notNull(),
  },
  (t) => ({
    poLineIdx: index('idx_purchase_invoice_lines_po_line').on(
      t.purchaseOrderLineId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// purchase_invoice_receipts  (N:N mapping for 3-way matching between invoice lines and received goods lines)
// ---------------------------------------------------------------------------
export const purchaseInvoiceReceipts = herobmCore.table(
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

// ---------------------------------------------------------------------------
export const goodsReceived = herobmCore.table('goods_received', {
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
  stateCode: text('state_code').$type<GoodsReceivedState>().notNull(), // received | invoiced | archived
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// goods_received_lines  (Per-product quantities from the packing slip)
// ---------------------------------------------------------------------------
export const goodsReceivedLines = herobmCore.table('goods_received_lines', {
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
  unitCost: numeric('unit_cost'),
  matchStatus: text('match_status').notNull(), // matched | unmatched | ambiguous
  putawayStatus: text('putaway_status', {
    enum: [
      PUTAWAY_STATUS.AWAITING_MATCHING,
      PUTAWAY_STATUS.PENDING_PUTAWAY,
      PUTAWAY_STATUS.QUARANTINED,
      PUTAWAY_STATUS.COMPLETED,
    ],
  }).notNull(),
  purchaseOrderLineId: uuid('purchase_order_line_id').references(
    () => purchaseOrderLineItems.purchaseOrderLineId,
  ),
  purchaseOrderId: uuid('purchase_order_id').references(
    () => purchaseOrders.purchaseOrderId,
  ),
});

// ---------------------------------------------------------------------------
// supplier_expiries  (Generic tracking for compliance dates like insurance, tax certs)
// ---------------------------------------------------------------------------
export const supplierExpiries = herobmCore.table('supplier_expiries', {
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

// procurement_events  (Procurement domain audit log)
// ---------------------------------------------------------------------------
export const procurementEvents = herobmCore.table('procurement_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// END
