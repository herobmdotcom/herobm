"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productStructureEnum = exports.productTypeEnum = exports.discountMatrix = exports.productGroups = exports.supplierGroups = exports.customerGroups = exports.macros = exports.tradingTerms = exports.inventoryLevels = exports.outbox = exports.productDefaultBins = exports.binContents = exports.inventoryLedger = exports.inventoryEntries = exports.bins = exports.binTypeEnum = exports.zones = exports.locations = exports.backorders = exports.transferOrderEvents = exports.transferOrderReceiptLines = exports.transferOrderReceipts = exports.transferOrderShipmentLines = exports.transferOrderShipments = exports.transferOrderPicks = exports.transferOrderLines = exports.transferOrders = exports.purchaseDebitNoteLines = exports.purchaseDebitNotes = exports.purchaseOrderReturnShipmentLines = exports.purchaseOrderReturnShipments = exports.purchaseOrderReturnLines = exports.purchaseOrderReturns = exports.purchaseOrderEvents = exports.purchaseOrderLineItems = exports.purchaseOrders = exports.salesOrderShipmentLines = exports.salesOrderShipments = exports.salesCreditNoteLines = exports.salesCreditNotes = exports.salesOrderReturnLines = exports.salesOrderReturns = exports.shipmentEvents = exports.orderEvents = exports.salesOrderPicks = exports.salesOrderLineItems = exports.salesOrders = exports.exchangeRates = exports.taxCategories = exports.modbmCore = void 0;
exports.bankStatementLines = exports.reconciliationRules = exports.csvMappingProfiles = exports.casbinRule = exports.webhooks = exports.apiKeys = exports.dashboardTimeline = exports.goodsReceivedLines = exports.goodsReceived = exports.systemEvents = exports.reportHookAssignments = exports.reportContexts = exports.reports = exports.appSettings = exports.glSettings = exports.organization = exports.glJournalLines = exports.glReconciliations = exports.glJournalEntries = exports.glAccounts = exports.activities = exports.costCenters = exports.paymentEvents = exports.paymentAllocations = exports.paymentEntries = exports.purchaseInvoiceReceipts = exports.purchaseInvoiceLines = exports.purchaseInvoices = exports.salesInvoiceLines = exports.salesInvoices = exports.userEvents = exports.users = exports.productSupplierEvents = exports.productSuppliers = exports.supplierExpiries = exports.supplierEvents = exports.suppliers = exports.customerEvents = exports.customers = exports.productEvents = exports.productUoms = exports.uomDictionary = exports.productComponents = exports.fractionalBehaviorEnum = exports.products = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
var shared_1 = require("@modbm/shared");
var validCurrencyCheck = function (tableName, columnName) {
    if (columnName === void 0) { columnName = 'currency_code'; }
    return (0, pg_core_1.check)("".concat(tableName, "_currency_check"), drizzle_orm_1.sql.raw("".concat(columnName, " IN (").concat(shared_1.CURRENCIES.map(function (c) { return "'".concat(c.code, "'"); }).join(', '), ")")));
};
/**
 * Drizzle schema for modbm_core — application-owned operational data.
 *
 * Column naming follows Microsoft CDM conventions (snake_case in Postgres).
 * All tables use UUID primary keys with gen_random_uuid() defaults.
 * Foreign keys reference other modbm_core tables (e.g. customer_id → customers).
 * Schema is managed via migrations in apps/api/migrations/.
 */
exports.modbmCore = (0, pg_core_1.pgSchema)('modbm_core');
// ---------------------------------------------------------------------------
// tax_categories  (Tax classification for order lines)
// ---------------------------------------------------------------------------
exports.taxCategories = exports.modbmCore.table('tax_categories', {
    taxCategoryId: (0, pg_core_1.uuid)('tax_category_id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.text)('code').unique().notNull(),
    title: (0, pg_core_1.text)('title').notNull(),
    type: (0, pg_core_1.text)('type').notNull(), // not_relevant | exempt | zero_rated | tax_applies
    rate: (0, pg_core_1.numeric)('rate').default('0'), // percentage, e.g. '9' = 9%
    isDefault: (0, pg_core_1.boolean)('is_default').default(false),
}, function (table) {
    return {
        singleDefaultIndex: (0, pg_core_1.uniqueIndex)('tax_categories_single_default_idx')
            .on(table.isDefault)
            .where((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " = true"], ["", " = true"])), table.isDefault)),
    };
});
// ---------------------------------------------------------------------------
// exchange_rates  (Static currency exchange rates)
// ---------------------------------------------------------------------------
exports.exchangeRates = exports.modbmCore.table('exchange_rates', {
    exchangeRateId: (0, pg_core_1.uuid)('exchange_rate_id').primaryKey().defaultRandom(),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull().unique(), // ISO 4217
    currencyName: (0, pg_core_1.text)('currency_name').notNull(),
    buyRate: (0, pg_core_1.numeric)('buy_rate').notNull(), // units of this currency per 1 EUR
    sellRate: (0, pg_core_1.numeric)('sell_rate').notNull(), // units of this currency per 1 EUR
    effectiveDate: (0, pg_core_1.timestamp)('effective_date').defaultNow(),
    updatedOn: (0, pg_core_1.timestamp)('updated_on').defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('exchange_rates'),
}); });
// ---------------------------------------------------------------------------
// sales_orders  (CDM: SalesOrder)
// ---------------------------------------------------------------------------
exports.salesOrders = exports.modbmCore.table('sales_orders', {
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id').primaryKey().defaultRandom(),
    orderNumber: (0, pg_core_1.text)('order_number').unique().notNull(),
    name: (0, pg_core_1.text)('name'),
    customerId: (0, pg_core_1.uuid)('customer_id').references(function () { return exports.customers.customerId; }),
    customerOrderNumber: (0, pg_core_1.text)('customer_order_number'),
    fulfillmentLocationId: (0, pg_core_1.uuid)('fulfillment_location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.SALES_ORDER_STATE.DRAFT),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    notes: (0, pg_core_1.text)('notes'),
    customFields: (0, pg_core_1.jsonb)('custom_fields'),
    discrepanciesAcknowledged: (0, pg_core_1.boolean)('discrepancies_acknowledged')
        .notNull()
        .default(false),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('sales_orders'),
    stateCheck: (0, pg_core_1.check)('sales_order_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.SALES_ORDER_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// sales_order_lines  (CDM: SalesOrderProduct)
// ---------------------------------------------------------------------------
exports.salesOrderLineItems = exports.modbmCore.table('sales_order_lines', {
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id').primaryKey().defaultRandom(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    lineNumber: (0, pg_core_1.integer)('line_number').notNull(),
    productId: (0, pg_core_1.uuid)('product_id').references(function () { return exports.products.productId; }),
    productDescription: (0, pg_core_1.text)('product_description'),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
    pricePerUnit: (0, pg_core_1.numeric)('price_per_unit').notNull(),
    discountPercentage: (0, pg_core_1.numeric)('discount_percentage').default('0'),
    amount: (0, pg_core_1.numeric)('amount'),
    taxCategoryId: (0, pg_core_1.uuid)('tax_category_id')
        .notNull()
        .references(function () { return exports.taxCategories.taxCategoryId; }),
    tax: (0, pg_core_1.numeric)('tax').default('0'),
    totalAmount: (0, pg_core_1.numeric)('total_amount'),
    unitOfMeasure: (0, pg_core_1.text)('unit_of_measure'),
    quantityPicked: (0, pg_core_1.numeric)('quantity_picked').default('0'),
    fulfillmentLocationId: (0, pg_core_1.uuid)('fulfillment_location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    isPostConfirmation: (0, pg_core_1.boolean)('is_post_confirmation').default(false),
    parentLineId: (0, pg_core_1.uuid)('parent_line_id'),
}, function (t) { return ({
    productLocationIdx: (0, pg_core_1.index)('idx_sales_order_lines_product_location').on(t.productId, t.fulfillmentLocationId),
    parentLineFk: (0, pg_core_1.foreignKey)({
        columns: [t.parentLineId],
        foreignColumns: [t.salesOrderLineId],
    }),
}); });
// ---------------------------------------------------------------------------
// sales_order_picks  (Pick allocations against sales orders)
// ---------------------------------------------------------------------------
exports.salesOrderPicks = exports.modbmCore.table('sales_order_picks', {
    pickId: (0, pg_core_1.uuid)('pick_id').primaryKey().defaultRandom(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id')
        .notNull()
        .references(function () { return exports.salesOrderLineItems.salesOrderLineId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    binId: (0, pg_core_1.uuid)('bin_id').references(function () { return exports.bins.binId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.SALES_ORDER_PICK_STATE.PICKED),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    orderIdx: (0, pg_core_1.index)('idx_sales_order_picks_order').on(t.salesOrderId),
    lineIdx: (0, pg_core_1.index)('idx_sales_order_picks_line').on(t.salesOrderLineId),
    stateCheck: (0, pg_core_1.check)('sales_order_pick_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.SALES_ORDER_PICK_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// order_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.orderEvents = exports.modbmCore.table('order_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// shipment_events  (Audit log + event sourcing for shipments)
// ---------------------------------------------------------------------------
exports.shipmentEvents = exports.modbmCore.table('shipment_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    shipmentId: (0, pg_core_1.uuid)('shipment_id')
        .notNull()
        .references(function () { return exports.salesOrderShipments.shipmentId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// sales_order_returns  (Return header against an invoiced order)
// ---------------------------------------------------------------------------
exports.salesOrderReturns = exports.modbmCore.table('sales_order_returns', {
    returnId: (0, pg_core_1.uuid)('return_id').primaryKey().defaultRandom(),
    returnNumber: (0, pg_core_1.text)('return_number').unique().notNull(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.RETURN_STATE.DRAFT),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    stateCheck: (0, pg_core_1.check)('return_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.RETURN_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// sales_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
exports.salesOrderReturnLines = exports.modbmCore.table('sales_order_return_lines', {
    returnLineId: (0, pg_core_1.uuid)('return_line_id').primaryKey().defaultRandom(),
    returnId: (0, pg_core_1.uuid)('return_id')
        .notNull()
        .references(function () { return exports.salesOrderReturns.returnId; }),
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id')
        .notNull()
        .references(function () { return exports.salesOrderLineItems.salesOrderLineId; }),
    quantityReturned: (0, pg_core_1.numeric)('quantity_returned').notNull(),
    quantityReceived: (0, pg_core_1.numeric)('quantity_received').default('0'),
    reason: (0, pg_core_1.text)('reason'),
    returnFee: (0, pg_core_1.numeric)('return_fee').default('0'), // absolute fee in order currency
    putawayStatus: (0, pg_core_1.text)('putaway_status', {
        enum: [
            shared_1.PUTAWAY_STATUS.AWAITING_MATCHING,
            shared_1.PUTAWAY_STATUS.PENDING_PUTAWAY,
            shared_1.PUTAWAY_STATUS.QUARANTINED,
            shared_1.PUTAWAY_STATUS.COMPLETED,
        ],
    })
        .notNull()
        .default(shared_1.PUTAWAY_STATUS.PENDING_PUTAWAY),
});
// ---------------------------------------------------------------------------
// sales_credit_notes  (Credit Note header — reverses a sales invoice)
// ---------------------------------------------------------------------------
exports.salesCreditNotes = exports.modbmCore.table('sales_credit_notes', {
    creditNoteId: (0, pg_core_1.uuid)('credit_note_id').primaryKey().defaultRandom(),
    creditNoteNumber: (0, pg_core_1.text)('credit_note_number').unique().notNull(),
    returnId: (0, pg_core_1.uuid)('return_id')
        .notNull()
        .references(function () { return exports.salesOrderReturns.returnId; }),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    invoiceId: (0, pg_core_1.uuid)('invoice_id').references(function () { return exports.salesInvoices.invoiceId; }),
    totalAmount: (0, pg_core_1.numeric)('total_amount').notNull(),
    taxAmount: (0, pg_core_1.numeric)('tax_amount').default('0'),
    feeAmount: (0, pg_core_1.numeric)('fee_amount').default('0'),
    outstandingAmount: (0, pg_core_1.numeric)('outstanding_amount').notNull().default('0'),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.SALES_CREDIT_NOTE_STATE.DRAFT),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('sales_credit_notes'),
}); });
// ---------------------------------------------------------------------------
// sales_credit_note_lines  (Per-line credit amounts)
// ---------------------------------------------------------------------------
exports.salesCreditNoteLines = exports.modbmCore.table('sales_credit_note_lines', {
    creditNoteLineId: (0, pg_core_1.uuid)('credit_note_line_id').primaryKey().defaultRandom(),
    creditNoteId: (0, pg_core_1.uuid)('credit_note_id')
        .notNull()
        .references(function () { return exports.salesCreditNotes.creditNoteId; }),
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id')
        .notNull()
        .references(function () { return exports.salesOrderLineItems.salesOrderLineId; }),
    quantityCredited: (0, pg_core_1.numeric)('quantity_credited').notNull(),
    pricePerUnit: (0, pg_core_1.numeric)('price_per_unit').notNull(),
    amount: (0, pg_core_1.numeric)('amount').notNull(),
    taxAmount: (0, pg_core_1.numeric)('tax_amount').default('0'),
});
// ---------------------------------------------------------------------------
// sales_order_shipments  (Shipment/delivery batch header)
// ---------------------------------------------------------------------------
exports.salesOrderShipments = exports.modbmCore.table('sales_order_shipments', {
    shipmentId: (0, pg_core_1.uuid)('shipment_id').primaryKey().defaultRandom(),
    shipmentNumber: (0, pg_core_1.text)('shipment_number').unique().notNull(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.SHIPMENT_STATE.DISPATCHED),
    notes: (0, pg_core_1.text)('notes'),
    trackingNumber: (0, pg_core_1.text)('tracking_number'),
    fulfillmentLocationId: (0, pg_core_1.uuid)('fulfillment_location_id').references(function () { return exports.locations.locationId; }),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    stateCheck: (0, pg_core_1.check)('shipment_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.SHIPMENT_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// sales_order_shipment_lines  (Per-line quantities in each shipment)
// ---------------------------------------------------------------------------
exports.salesOrderShipmentLines = exports.modbmCore.table('sales_order_shipment_lines', {
    shipmentLineId: (0, pg_core_1.uuid)('shipment_line_id').primaryKey().defaultRandom(),
    shipmentId: (0, pg_core_1.uuid)('shipment_id')
        .notNull()
        .references(function () { return exports.salesOrderShipments.shipmentId; }),
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id')
        .notNull()
        .references(function () { return exports.salesOrderLineItems.salesOrderLineId; }),
    quantityShipped: (0, pg_core_1.numeric)('quantity_shipped').notNull(),
});
// ---------------------------------------------------------------------------
// purchase_orders  (CDM: PurchaseOrder)
// ---------------------------------------------------------------------------
exports.purchaseOrders = exports.modbmCore.table('purchase_orders', {
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id').primaryKey().defaultRandom(),
    orderNumber: (0, pg_core_1.text)('order_number').unique().notNull(),
    name: (0, pg_core_1.text)('name'),
    vendorId: (0, pg_core_1.uuid)('vendor_id').references(function () { return exports.suppliers.vendorId; }),
    deliveryLocationId: (0, pg_core_1.uuid)('delivery_location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    referenceNumber: (0, pg_core_1.text)('reference_number'),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.PURCHASE_ORDER_STATE.DRAFT),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    notes: (0, pg_core_1.text)('notes'),
    customFields: (0, pg_core_1.jsonb)('custom_fields'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('purchase_orders'),
    stateCheck: (0, pg_core_1.check)('purchase_order_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.PURCHASE_ORDER_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
    deliveryLocIdx: (0, pg_core_1.index)('idx_purchase_orders_delivery_location').on(t.deliveryLocationId),
}); });
// ---------------------------------------------------------------------------
// purchase_order_lines  (CDM: PurchaseOrderProduct)
// ---------------------------------------------------------------------------
exports.purchaseOrderLineItems = exports.modbmCore.table('purchase_order_lines', {
    purchaseOrderLineId: (0, pg_core_1.uuid)('purchase_order_line_id')
        .primaryKey()
        .defaultRandom(),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id')
        .notNull()
        .references(function () { return exports.purchaseOrders.purchaseOrderId; }),
    lineNumber: (0, pg_core_1.integer)('line_number').notNull(),
    productId: (0, pg_core_1.uuid)('product_id').references(function () { return exports.products.productId; }),
    productDescription: (0, pg_core_1.text)('product_description'),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
    pricePerUnit: (0, pg_core_1.numeric)('price_per_unit').notNull(),
    discountPercentage: (0, pg_core_1.numeric)('discount_percentage').default('0'),
    amount: (0, pg_core_1.numeric)('amount'),
    taxCategoryId: (0, pg_core_1.uuid)('tax_category_id')
        .notNull()
        .references(function () { return exports.taxCategories.taxCategoryId; }),
    tax: (0, pg_core_1.numeric)('tax').default('0'),
    totalAmount: (0, pg_core_1.numeric)('total_amount'),
    unitOfMeasure: (0, pg_core_1.text)('unit_of_measure'),
    quantityReceived: (0, pg_core_1.numeric)('quantity_received').default('0'),
}, function (t) { return ({
    productIdx: (0, pg_core_1.index)('idx_purchase_order_lines_product').on(t.productId),
}); });
// ---------------------------------------------------------------------------
// purchase_order_events (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.purchaseOrderEvents = exports.modbmCore.table('purchase_order_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id')
        .notNull()
        .references(function () { return exports.purchaseOrders.purchaseOrderId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// purchase_order_returns  (Return header against a PO)
// ---------------------------------------------------------------------------
exports.purchaseOrderReturns = exports.modbmCore.table('purchase_order_returns', {
    returnId: (0, pg_core_1.uuid)('return_id').primaryKey().defaultRandom(),
    returnNumber: (0, pg_core_1.text)('return_number').unique().notNull(),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id')
        .notNull()
        .references(function () { return exports.purchaseOrders.purchaseOrderId; }),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.PURCHASE_RETURN_STATE.DRAFT),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    stateCheck: (0, pg_core_1.check)('po_return_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.PURCHASE_RETURN_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// purchase_order_return_lines  (Per-line return quantities + reason + fee)
// ---------------------------------------------------------------------------
exports.purchaseOrderReturnLines = exports.modbmCore.table('purchase_order_return_lines', {
    returnLineId: (0, pg_core_1.uuid)('return_line_id').primaryKey().defaultRandom(),
    returnId: (0, pg_core_1.uuid)('return_id')
        .notNull()
        .references(function () { return exports.purchaseOrderReturns.returnId; }),
    purchaseOrderLineId: (0, pg_core_1.uuid)('purchase_order_line_id')
        .notNull()
        .references(function () { return exports.purchaseOrderLineItems.purchaseOrderLineId; }),
    quantityReturned: (0, pg_core_1.numeric)('quantity_returned').notNull(),
    reason: (0, pg_core_1.text)('reason'),
    returnFee: (0, pg_core_1.numeric)('return_fee').default('0'), // absolute fee in order currency
});
// ---------------------------------------------------------------------------
// purchase_order_return_shipments
// ---------------------------------------------------------------------------
exports.purchaseOrderReturnShipments = exports.modbmCore.table('purchase_order_return_shipments', {
    shipmentId: (0, pg_core_1.uuid)('shipment_id').primaryKey().defaultRandom(),
    shipmentNumber: (0, pg_core_1.text)('shipment_number').unique().notNull(),
    returnId: (0, pg_core_1.uuid)('return_id')
        .notNull()
        .references(function () { return exports.purchaseOrderReturns.returnId; }),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.PURCHASE_RETURN_SHIPMENT_STATE.DISPATCHED),
    notes: (0, pg_core_1.text)('notes'),
    trackingNumber: (0, pg_core_1.text)('tracking_number'),
    fulfillmentLocationId: (0, pg_core_1.uuid)('fulfillment_location_id').references(function () { return exports.locations.locationId; }),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    stateCheck: (0, pg_core_1.check)('po_return_shipment_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.PURCHASE_RETURN_SHIPMENT_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// purchase_order_return_shipment_lines
// ---------------------------------------------------------------------------
exports.purchaseOrderReturnShipmentLines = exports.modbmCore.table('purchase_order_return_shipment_lines', {
    shipmentLineId: (0, pg_core_1.uuid)('shipment_line_id').primaryKey().defaultRandom(),
    shipmentId: (0, pg_core_1.uuid)('shipment_id')
        .notNull()
        .references(function () { return exports.purchaseOrderReturnShipments.shipmentId; }),
    returnLineId: (0, pg_core_1.uuid)('return_line_id')
        .notNull()
        .references(function () { return exports.purchaseOrderReturnLines.returnLineId; }),
    quantityShipped: (0, pg_core_1.numeric)('quantity_shipped').notNull(),
});
// ---------------------------------------------------------------------------
// purchase_debit_notes
// ---------------------------------------------------------------------------
exports.purchaseDebitNotes = exports.modbmCore.table('purchase_debit_notes', {
    debitNoteId: (0, pg_core_1.uuid)('debit_note_id').primaryKey().defaultRandom(),
    debitNoteNumber: (0, pg_core_1.text)('debit_note_number').unique().notNull(),
    supplierReferenceNumber: (0, pg_core_1.text)('supplier_reference_number'),
    returnId: (0, pg_core_1.uuid)('return_id')
        .notNull()
        .references(function () { return exports.purchaseOrderReturns.returnId; }),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id')
        .notNull()
        .references(function () { return exports.purchaseOrders.purchaseOrderId; }),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(function () { return exports.suppliers.vendorId; }),
    totalAmount: (0, pg_core_1.numeric)('total_amount').notNull(),
    taxAmount: (0, pg_core_1.numeric)('tax_amount').default('0'),
    feeAmount: (0, pg_core_1.numeric)('fee_amount').default('0'),
    outstandingAmount: (0, pg_core_1.numeric)('outstanding_amount').notNull().default('0'),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .$type()
        .notNull()
        .default(shared_1.PURCHASE_DEBIT_NOTE_STATE.DRAFT),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('purchase_debit_notes'),
    stateCheck: (0, pg_core_1.check)('purchase_debit_note_state_check', drizzle_orm_1.sql.raw("state_code IN (".concat((0, shared_1.getValidStates)(shared_1.PURCHASE_DEBIT_NOTE_TRANSITIONS)
        .map(function (s) { return "'".concat(s, "'"); })
        .join(', '), ")"))),
}); });
// ---------------------------------------------------------------------------
// purchase_debit_note_lines
// ---------------------------------------------------------------------------
exports.purchaseDebitNoteLines = exports.modbmCore.table('purchase_debit_note_lines', {
    debitNoteLineId: (0, pg_core_1.uuid)('debit_note_line_id').primaryKey().defaultRandom(),
    debitNoteId: (0, pg_core_1.uuid)('debit_note_id')
        .notNull()
        .references(function () { return exports.purchaseDebitNotes.debitNoteId; }),
    purchaseOrderLineId: (0, pg_core_1.uuid)('purchase_order_line_id')
        .notNull()
        .references(function () { return exports.purchaseOrderLineItems.purchaseOrderLineId; }),
    quantityInvoiced: (0, pg_core_1.numeric)('quantity_invoiced').notNull(),
    pricePerUnit: (0, pg_core_1.numeric)('price_per_unit').notNull(),
    amount: (0, pg_core_1.numeric)('amount').notNull(),
    taxAmount: (0, pg_core_1.numeric)('tax_amount').default('0'),
});
// ---------------------------------------------------------------------------
// transfer_orders (Internal Stock Transfers)
// ---------------------------------------------------------------------------
exports.transferOrders = exports.modbmCore.table('transfer_orders', {
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id').primaryKey().defaultRandom(),
    orderNumber: (0, pg_core_1.text)('order_number').unique().notNull(),
    sourceLocationId: (0, pg_core_1.uuid)('source_location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    destinationLocationId: (0, pg_core_1.uuid)('destination_location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.TRANSFER_ORDER_STATE.CONFIRMED),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    sourceLocIdx: (0, pg_core_1.index)('idx_transfer_orders_source_location').on(t.sourceLocationId),
    destLocIdx: (0, pg_core_1.index)('idx_transfer_orders_dest_location').on(t.destinationLocationId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_lines
// ---------------------------------------------------------------------------
exports.transferOrderLines = exports.modbmCore.table('transfer_order_lines', {
    transferOrderLineId: (0, pg_core_1.uuid)('transfer_order_line_id')
        .primaryKey()
        .defaultRandom(),
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id')
        .notNull()
        .references(function () { return exports.transferOrders.transferOrderId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
    quantityShipped: (0, pg_core_1.numeric)('quantity_shipped').default('0'),
    quantityReceived: (0, pg_core_1.numeric)('quantity_received').default('0'),
}, function (t) { return ({
    productIdx: (0, pg_core_1.index)('idx_transfer_order_lines_product').on(t.productId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_picks
// ---------------------------------------------------------------------------
exports.transferOrderPicks = exports.modbmCore.table('transfer_order_picks', {
    pickId: (0, pg_core_1.uuid)('pick_id').primaryKey().defaultRandom(),
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id')
        .notNull()
        .references(function () { return exports.transferOrders.transferOrderId; }),
    transferOrderLineId: (0, pg_core_1.uuid)('transfer_order_line_id')
        .notNull()
        .references(function () { return exports.transferOrderLines.transferOrderLineId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    binId: (0, pg_core_1.uuid)('bin_id').references(function () { return exports.bins.binId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.SALES_ORDER_PICK_STATE.PICKED),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    orderIdx: (0, pg_core_1.index)('idx_transfer_order_picks_order').on(t.transferOrderId),
    lineIdx: (0, pg_core_1.index)('idx_transfer_order_picks_line').on(t.transferOrderLineId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_shipments
// ---------------------------------------------------------------------------
exports.transferOrderShipments = exports.modbmCore.table('transfer_order_shipments', {
    shipmentId: (0, pg_core_1.uuid)('shipment_id').primaryKey().defaultRandom(),
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id')
        .notNull()
        .references(function () { return exports.transferOrders.transferOrderId; }),
    shipmentNumber: (0, pg_core_1.text)('shipment_number').unique().notNull(),
    trackingNumber: (0, pg_core_1.text)('tracking_number'),
    carrierId: (0, pg_core_1.uuid)('carrier_id'), // if carriers exist
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.SHIPMENT_STATE.DISPATCHED),
    shippedBy: (0, pg_core_1.text)('shipped_by'),
    shippedOn: (0, pg_core_1.timestamp)('shipped_on', { withTimezone: true }).defaultNow(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    orderIdx: (0, pg_core_1.index)('idx_transfer_order_shipments_order').on(t.transferOrderId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_shipment_lines
// ---------------------------------------------------------------------------
exports.transferOrderShipmentLines = exports.modbmCore.table('transfer_order_shipment_lines', {
    shipmentLineId: (0, pg_core_1.uuid)('shipment_line_id').primaryKey().defaultRandom(),
    shipmentId: (0, pg_core_1.uuid)('shipment_id')
        .notNull()
        .references(function () { return exports.transferOrderShipments.shipmentId; }),
    transferOrderLineId: (0, pg_core_1.uuid)('transfer_order_line_id')
        .notNull()
        .references(function () { return exports.transferOrderLines.transferOrderLineId; }),
    pickId: (0, pg_core_1.uuid)('pick_id').references(function () { return exports.transferOrderPicks.pickId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
}, function (t) { return ({
    shipmentIdx: (0, pg_core_1.index)('idx_transfer_order_shipment_lines_shipment').on(t.shipmentId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_receipts
// ---------------------------------------------------------------------------
exports.transferOrderReceipts = exports.modbmCore.table('transfer_order_receipts', {
    receiptId: (0, pg_core_1.uuid)('receipt_id').primaryKey().defaultRandom(),
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id')
        .notNull()
        .references(function () { return exports.transferOrders.transferOrderId; }),
    receiptNumber: (0, pg_core_1.text)('receipt_number').unique().notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.GOODS_RECEIVED_STATE.RECEIVED),
    receivedBy: (0, pg_core_1.text)('received_by'),
    receivedOn: (0, pg_core_1.timestamp)('received_on', { withTimezone: true }).defaultNow(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    orderIdx: (0, pg_core_1.index)('idx_transfer_order_receipts_order').on(t.transferOrderId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_receipt_lines
// ---------------------------------------------------------------------------
exports.transferOrderReceiptLines = exports.modbmCore.table('transfer_order_receipt_lines', {
    receiptLineId: (0, pg_core_1.uuid)('receipt_line_id').primaryKey().defaultRandom(),
    receiptId: (0, pg_core_1.uuid)('receipt_id')
        .notNull()
        .references(function () { return exports.transferOrderReceipts.receiptId; }),
    transferOrderLineId: (0, pg_core_1.uuid)('transfer_order_line_id')
        .notNull()
        .references(function () { return exports.transferOrderLines.transferOrderLineId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    binId: (0, pg_core_1.uuid)('bin_id')
        .notNull()
        .references(function () { return exports.bins.binId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
}, function (t) { return ({
    receiptIdx: (0, pg_core_1.index)('idx_transfer_order_receipt_lines_receipt').on(t.receiptId),
}); });
// ---------------------------------------------------------------------------
// transfer_order_events (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.transferOrderEvents = exports.modbmCore.table('transfer_order_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id')
        .notNull()
        .references(function () { return exports.transferOrders.transferOrderId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// backorders (Order Allocations for Cross-Dock/Picked bridging)
// ---------------------------------------------------------------------------
exports.backorders = exports.modbmCore.table('backorders', {
    backorderId: (0, pg_core_1.uuid)('backorder_id').primaryKey().defaultRandom(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id')
        .notNull()
        .references(function () { return exports.salesOrderLineItems.salesOrderLineId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id').references(function () { return exports.purchaseOrders.purchaseOrderId; }),
    purchaseOrderLineId: (0, pg_core_1.uuid)('purchase_order_line_id').references(function () { return exports.purchaseOrderLineItems.purchaseOrderLineId; }),
    transferOrderId: (0, pg_core_1.uuid)('transfer_order_id').references(function () { return exports.transferOrders.transferOrderId; }),
    transferOrderLineId: (0, pg_core_1.uuid)('transfer_order_line_id').references(function () { return exports.transferOrderLines.transferOrderLineId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.BACKORDER_STATE.PENDING_SUPPLY),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    solStateIdx: (0, pg_core_1.index)('idx_backorders_sol_state').on(t.salesOrderLineId, t.stateCode),
    productIdx: (0, pg_core_1.index)('idx_backorders_product').on(t.productId),
}); });
// ---------------------------------------------------------------------------
// locations  (Physical warehouses or regional centers)
// ---------------------------------------------------------------------------
exports.locations = exports.modbmCore.table('locations', {
    locationId: (0, pg_core_1.uuid)('location_id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.text)('code').notNull().unique(), // e.g. "SIN"
    name: (0, pg_core_1.text)('name').notNull(),
    addressLine1: (0, pg_core_1.text)('address_line_1'),
    city: (0, pg_core_1.text)('city'),
    state: (0, pg_core_1.text)('state'),
    country: (0, pg_core_1.text)('country'),
    postCode: (0, pg_core_1.text)('post_code'),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// zones  (Logical or physical areas within a location, e.g. 'Bulk', 'Picking')
// ---------------------------------------------------------------------------
exports.zones = exports.modbmCore.table('zones', {
    zoneId: (0, pg_core_1.uuid)('zone_id').primaryKey().defaultRandom(),
    locationId: (0, pg_core_1.uuid)('location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    code: (0, pg_core_1.text)('code').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    unq: (0, pg_core_1.unique)('zones_code_location_unq').on(t.code, t.locationId),
}); });
// inventory_levels — Legacy table removed. Now defined as a dynamic VIEW below.
// ---------------------------------------------------------------------------
// bins  (Physical storage locations within a location)
// ---------------------------------------------------------------------------
exports.binTypeEnum = exports.modbmCore.enum('bin_type_enum', [
    'storage',
    'pick',
    'bulk',
    'receiving',
    'staging',
    'quarantine',
    'in_transit',
]);
exports.bins = exports.modbmCore.table('bins', {
    binId: (0, pg_core_1.uuid)('bin_id').primaryKey().defaultRandom(),
    binNumber: (0, pg_core_1.text)('bin_number').notNull(),
    zoneId: (0, pg_core_1.uuid)('zone_id')
        .notNull()
        .references(function () { return exports.zones.zoneId; }),
    binType: (0, exports.binTypeEnum)('bin_type').notNull().default('storage'),
    isConsignment: (0, pg_core_1.boolean)('is_consignment').default(false),
    isBonded: (0, pg_core_1.boolean)('is_bonded').default(false),
    isUnavailable: (0, pg_core_1.boolean)('is_unavailable').default(false),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    unq: (0, pg_core_1.unique)('bins_bin_number_zone_unq').on(t.binNumber, t.zoneId),
}); });
// ---------------------------------------------------------------------------
// inventory_entries (Header grouping for stock movements)
// ---------------------------------------------------------------------------
exports.inventoryEntries = exports.modbmCore.table('inventory_entries', {
    entryId: (0, pg_core_1.uuid)('entry_id').primaryKey().defaultRandom(),
    entryNumber: (0, pg_core_1.text)('entry_number').unique().notNull(), // e.g. STK-20260325-001
    entryDate: (0, pg_core_1.timestamp)('entry_date', { withTimezone: true })
        .notNull()
        .defaultNow(),
    memo: (0, pg_core_1.text)('memo'),
    sourceType: (0, pg_core_1.text)('source_type').notNull(), // INITIAL_IMPORT, PO_RECEIPT, SO_SHIPMENT, RETURN, ADJUSTMENT, TRANSFER
    sourceId: (0, pg_core_1.uuid)('source_id'), // FK to originating document
    isReversed: (0, pg_core_1.boolean)('is_reversed').notNull().default(false),
    reversedBy: (0, pg_core_1.uuid)('reversed_by'), // self-ref to reversing entry
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// inventory_ledger (Immutable double-entry ledger of all stock movement lines)
// ---------------------------------------------------------------------------
exports.inventoryLedger = exports.modbmCore.table('inventory_ledger', {
    ledgerId: (0, pg_core_1.uuid)('ledger_id').primaryKey().defaultRandom(),
    entryId: (0, pg_core_1.uuid)('entry_id')
        .notNull()
        .references(function () { return exports.inventoryEntries.entryId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    binId: (0, pg_core_1.uuid)('bin_id')
        .notNull()
        .references(function () { return exports.bins.binId; }),
    locationId: (0, pg_core_1.uuid)('location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    zoneId: (0, pg_core_1.uuid)('zone_id')
        .notNull()
        .references(function () { return exports.zones.zoneId; }),
    quantity: (0, pg_core_1.numeric)('quantity').notNull(),
}, function (t) { return ({
    productLocationIdx: (0, pg_core_1.index)('idx_inventory_ledger_product_location').on(t.productId, t.locationId),
}); });
// ---------------------------------------------------------------------------
// bin_contents (Real-time calculated snapshot cache of current stock)
// ---------------------------------------------------------------------------
exports.binContents = exports.modbmCore.table('bin_contents', {
    binContentId: (0, pg_core_1.uuid)('bin_content_id').primaryKey().defaultRandom(),
    binId: (0, pg_core_1.uuid)('bin_id')
        .notNull()
        .references(function () { return exports.bins.binId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    actualQuantity: (0, pg_core_1.numeric)('actual_quantity').notNull().default('0'),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    unq: (0, pg_core_1.unique)('bin_contents_bin_product_unq').on(t.binId, t.productId),
}); });
// ---------------------------------------------------------------------------
// product_default_bins (WMS Directed Putaway & Replenishment routing)
// ---------------------------------------------------------------------------
exports.productDefaultBins = exports.modbmCore.table('product_default_bins', {
    productDefaultBinId: (0, pg_core_1.uuid)('product_default_bin_id')
        .primaryKey()
        .defaultRandom(),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    locationId: (0, pg_core_1.uuid)('location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    binId: (0, pg_core_1.uuid)('bin_id')
        .notNull()
        .references(function () { return exports.bins.binId; }),
    isPrimaryPerLocation: (0, pg_core_1.boolean)('is_primary_per_loc').notNull().default(true),
    minQuantity: (0, pg_core_1.numeric)('min_quantity').default('0'),
    maxQuantity: (0, pg_core_1.numeric)('max_quantity'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    unq: (0, pg_core_1.unique)('product_default_bins_prod_loc_bin_unq').on(t.productId, t.locationId, t.binId),
}); });
// ---------------------------------------------------------------------------
// outbox  (Transactional outbox for async BullMQ/External sync)
// ---------------------------------------------------------------------------
exports.outbox = exports.modbmCore.table('outbox', {
    outboxId: (0, pg_core_1.uuid)('outbox_id').primaryKey().defaultRandom(),
    aggregateType: (0, pg_core_1.text)('aggregate_type').notNull(),
    aggregateId: (0, pg_core_1.uuid)('aggregate_id').notNull(),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    processedAt: (0, pg_core_1.timestamp)('processed_at', { withTimezone: true }),
    lockedUntil: (0, pg_core_1.timestamp)('locked_until', { withTimezone: true }),
    lastError: (0, pg_core_1.text)('last_error'),
});
// ---------------------------------------------------------------------------
// inventory_levels  (Dynamic stock resourcing view)
// ---------------------------------------------------------------------------
exports.inventoryLevels = exports.modbmCore
    .view('inventory_levels', {
    inventoryLevelId: (0, pg_core_1.uuid)('inventory_level_id'), // Fake ID for backwards compatibility
    locationId: (0, pg_core_1.uuid)('location_id'),
    productId: (0, pg_core_1.uuid)('product_id'),
    quantityOnHand: (0, pg_core_1.numeric)('quantity_on_hand'),
    quantityCommitted: (0, pg_core_1.numeric)('quantity_committed'),
    quantityReserved: (0, pg_core_1.numeric)('quantity_reserved'),
    quantityOnOrder: (0, pg_core_1.numeric)('quantity_on_order'),
})
    .existing();
// ---------------------------------------------------------------------------
// trading_terms  (Dictionary of standard payment cycles)
// ---------------------------------------------------------------------------
exports.tradingTerms = exports.modbmCore.table('trading_terms', {
    tradingTermsId: (0, pg_core_1.uuid)('trading_terms_id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.text)('code').unique().notNull(), // e.g., 'NET30', 'COD', 'EOM'
    description: (0, pg_core_1.text)('description').notNull(),
    days: (0, pg_core_1.integer)('days').notNull(), // Number of days allowed
    type: (0, pg_core_1.text)('type').notNull(), // 'net' | 'end_of_month' | 'cash_on_delivery'
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// macros  (Standard texts and dynamic automations)
// ---------------------------------------------------------------------------
exports.macros = exports.modbmCore.table('macros', {
    macroId: (0, pg_core_1.uuid)('macro_id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').unique().notNull(),
    macroType: (0, pg_core_1.text)('macro_type').notNull().default('text_template'),
    content: (0, pg_core_1.text)('content').notNull(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// account_groups  (Administrative grouping and GL routing)
// ---------------------------------------------------------------------------
exports.customerGroups = exports.modbmCore.table('customer_groups', {
    customerGroupId: (0, pg_core_1.uuid)('customer_group_id').primaryKey().defaultRandom(),
    groupCode: (0, pg_core_1.text)('group_code').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    defaultArAccountId: (0, pg_core_1.uuid)('default_ar_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultRevenueAccountId: (0, pg_core_1.uuid)('default_revenue_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    tradingTermsId: (0, pg_core_1.uuid)('trading_terms_id').references(function () { return exports.tradingTerms.tradingTermsId; }),
    defaultCostCenterId: (0, pg_core_1.uuid)('default_cost_center_id').references(function () { return exports.costCenters.costCenterId; }),
    defaultActivityId: (0, pg_core_1.uuid)('default_activity_id').references(function () { return exports.activities.activityId; }),
    creditLimit: (0, pg_core_1.numeric)('credit_limit').default('0'), // 0 = cash only/no limit policy
    isOnCreditHold: (0, pg_core_1.boolean)('is_on_credit_hold').notNull().default(false),
});
// ---------------------------------------------------------------------------
// supplier_groups  (Administrative grouping and GL routing)
// ---------------------------------------------------------------------------
exports.supplierGroups = exports.modbmCore.table('supplier_groups', {
    supplierGroupId: (0, pg_core_1.uuid)('supplier_group_id').primaryKey().defaultRandom(),
    groupCode: (0, pg_core_1.text)('group_code').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    defaultApAccountId: (0, pg_core_1.uuid)('default_ap_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultExpenseAccountId: (0, pg_core_1.uuid)('default_expense_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultCostCenterId: (0, pg_core_1.uuid)('default_cost_center_id').references(function () { return exports.costCenters.costCenterId; }),
    defaultActivityId: (0, pg_core_1.uuid)('default_activity_id').references(function () { return exports.activities.activityId; }),
    tradingTermsId: (0, pg_core_1.uuid)('trading_terms_id').references(function () { return exports.tradingTerms.tradingTermsId; }),
    earlyPaymentDiscount: (0, pg_core_1.numeric)('early_payment_discount').default('0'),
    creditLimit: (0, pg_core_1.numeric)('credit_limit').default('0'),
    isPurchasingBlocked: (0, pg_core_1.boolean)('is_purchasing_blocked')
        .notNull()
        .default(false),
    purchasingBlockReason: (0, pg_core_1.text)('purchasing_block_reason', {
        enum: [
            'compliance_breach',
            'quality_issues',
            'dispute',
            'financial_risk',
            'other',
        ],
    }),
    isPaymentBlocked: (0, pg_core_1.boolean)('is_payment_blocked').notNull().default(false),
    paymentBlockReason: (0, pg_core_1.text)('payment_block_reason', {
        enum: ['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'],
    }),
    blockNotes: (0, pg_core_1.text)('block_notes'),
});
// ---------------------------------------------------------------------------
// product_groups  (Administrative grouping and GL routing)
// ---------------------------------------------------------------------------
exports.productGroups = exports.modbmCore.table('product_groups', {
    productGroupId: (0, pg_core_1.uuid)('product_group_id').primaryKey().defaultRandom(),
    groupCode: (0, pg_core_1.text)('group_code').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    defaultRevenueAccountId: (0, pg_core_1.uuid)('default_revenue_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultExpenseAccountId: (0, pg_core_1.uuid)('default_expense_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultCostCenterId: (0, pg_core_1.uuid)('default_cost_center_id').references(function () { return exports.costCenters.costCenterId; }),
    defaultActivityId: (0, pg_core_1.uuid)('default_activity_id').references(function () { return exports.activities.activityId; }),
});
// ---------------------------------------------------------------------------
// discount_matrix  (Multi-dimensional default discount rules)
//
// Each row encodes a discount percentage for a specific intersection of
// (account OR account_group) × (product_group OR wildcard).
// Exactly one of account_group_id / account_id must be set (CHECK constraint).
// product_group_id = NULL means "all product groups" (wildcard).
// ---------------------------------------------------------------------------
exports.discountMatrix = exports.modbmCore.table('discount_matrix', {
    discountMatrixId: (0, pg_core_1.uuid)('discount_matrix_id').primaryKey().defaultRandom(),
    customerGroupId: (0, pg_core_1.uuid)('customer_group_id').references(function () { return exports.customerGroups.customerGroupId; }),
    customerId: (0, pg_core_1.uuid)('customer_id').references(function () { return exports.customers.customerId; }),
    productGroupId: (0, pg_core_1.uuid)('product_group_id').references(function () { return exports.productGroups.productGroupId; }), // NULL = wildcard (all product groups)
    discountPercentage: (0, pg_core_1.numeric)('discount_percentage').notNull().default('0'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    // Exactly one of customer_group_id or customer_id must be set
    exactlyOneOwner: (0, pg_core_1.check)('discount_matrix_owner_check', (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["(customer_group_id IS NOT NULL AND customer_id IS NULL) OR\n          (customer_group_id IS NULL AND customer_id IS NOT NULL)"], ["(customer_group_id IS NOT NULL AND customer_id IS NULL) OR\n          (customer_group_id IS NULL AND customer_id IS NOT NULL)"])))),
    // Unique per intersection
    unqGroup: (0, pg_core_1.unique)('discount_matrix_group_product_unq').on(t.customerGroupId, t.productGroupId),
    unqCustomer: (0, pg_core_1.unique)('discount_matrix_customer_product_unq').on(t.customerId, t.productGroupId),
    // Indexes for lookup performance
    customerGroupIdx: (0, pg_core_1.index)('idx_discount_matrix_customer_group').on(t.customerGroupId),
    customerIdx: (0, pg_core_1.index)('idx_discount_matrix_customer').on(t.customerId),
}); });
// ---------------------------------------------------------------------------
exports.productTypeEnum = exports.modbmCore.enum('product_type', [
    'inventory',
    'non-stock',
    'service',
]);
exports.productStructureEnum = exports.modbmCore.enum('product_structure', [
    'standard',
    'kit',
]);
// ---------------------------------------------------------------------------
// products  (Native schema structure mapped to CDM product definitions)
// ---------------------------------------------------------------------------
exports.products = exports.modbmCore.table('products', {
    productId: (0, pg_core_1.uuid)('product_id').primaryKey().defaultRandom(),
    productNumber: (0, pg_core_1.text)('product_number').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    productType: (0, exports.productTypeEnum)('product_type').notNull().default('inventory'),
    structureType: (0, exports.productStructureEnum)('structure_type')
        .notNull()
        .default('standard'),
    productGroupId: (0, pg_core_1.uuid)('product_group_id').references(function () { return exports.productGroups.productGroupId; }),
    barcode: (0, pg_core_1.text)('barcode'),
    listPrice: (0, pg_core_1.numeric)('list_price', { precision: 12, scale: 2 }).default('0'),
    standardCost: (0, pg_core_1.numeric)('standard_cost', { precision: 12, scale: 2 }).default('0'),
    tradePrice: (0, pg_core_1.numeric)('trade_price', { precision: 12, scale: 2 }).default('0'),
    priceLevel3: (0, pg_core_1.numeric)('price_level_3', { precision: 12, scale: 2 }).default('0'),
    priceLevel4: (0, pg_core_1.numeric)('price_level_4', { precision: 12, scale: 2 }).default('0'),
    weightedAverageCost: (0, pg_core_1.numeric)('weighted_average_cost').default('0'),
    alternateInvoiceDescription: (0, pg_core_1.text)('alternate_invoice_description'),
    boxQuantity: (0, pg_core_1.numeric)('box_quantity').default('1'),
    baseUom: (0, pg_core_1.text)('base_uom')
        .notNull()
        .default('EA')
        .references(function () { return exports.uomDictionary.uomCode; }),
    defaultSalesUomId: (0, pg_core_1.uuid)('default_sales_uom_id'),
    defaultPurchaseUomId: (0, pg_core_1.uuid)('default_purchase_uom_id'),
    purchaseTaxCategoryId: (0, pg_core_1.uuid)('purchase_tax_category_id').references(function () { return exports.taxCategories.taxCategoryId; }),
    salesTaxCategoryId: (0, pg_core_1.uuid)('sales_tax_category_id').references(function () { return exports.taxCategories.taxCategoryId; }),
    alternateProductNumber: (0, pg_core_1.text)('alternate_product_number'),
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.PRODUCT_STATE.ACTIVE),
    notes: (0, pg_core_1.text)('notes'),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// product_components  (Master Bill of Materials / Kits)
// ---------------------------------------------------------------------------
exports.fractionalBehaviorEnum = exports.modbmCore.enum('fractional_behavior', [
    'allow_fractional',
    'round_up',
    'round_down',
    'force_multiple',
]);
exports.productComponents = exports.modbmCore.table('product_components', {
    componentId: (0, pg_core_1.uuid)('component_id').primaryKey().defaultRandom(),
    parentProductId: (0, pg_core_1.uuid)('parent_product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    childProductId: (0, pg_core_1.uuid)('child_product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    parentQuantity: (0, pg_core_1.numeric)('parent_quantity', { precision: 14, scale: 4 })
        .notNull()
        .default('1'),
    quantity: (0, pg_core_1.numeric)('quantity', { precision: 14, scale: 4 }).notNull(),
    sequenceNumber: (0, pg_core_1.integer)('sequence_number').default(0),
    fractionalBehavior: (0, exports.fractionalBehaviorEnum)('fractional_behavior')
        .notNull()
        .default('allow_fractional'),
});
// ---------------------------------------------------------------------------
// uom_dictionary  (Global unit of measure definitions)
// ---------------------------------------------------------------------------
exports.uomDictionary = exports.modbmCore.table('uom_dictionary', {
    uomCode: (0, pg_core_1.text)('uom_code').primaryKey(),
    description: (0, pg_core_1.text)('description').notNull(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// product_uoms  (Product-specific unit of measure definitions)
// ---------------------------------------------------------------------------
exports.productUoms = exports.modbmCore.table('product_uoms', {
    productUomId: (0, pg_core_1.uuid)('product_uom_id').primaryKey().defaultRandom(),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    uomCode: (0, pg_core_1.text)('uom_code')
        .notNull()
        .references(function () { return exports.uomDictionary.uomCode; }),
    ratio: (0, pg_core_1.numeric)('ratio', { precision: 14, scale: 6 }).notNull(),
    barcode: (0, pg_core_1.text)('barcode'),
    isSalesDefault: (0, pg_core_1.boolean)('is_sales_default').default(false),
    isPurchaseDefault: (0, pg_core_1.boolean)('is_purchase_default').default(false),
}, function (t) { return ({
    unq: (0, pg_core_1.unique)('product_uoms_product_code_unq').on(t.productId, t.uomCode),
}); });
// ---------------------------------------------------------------------------
// product_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.productEvents = exports.modbmCore.table('product_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(), // created, updated, price_changed, etc.
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// customers  (CDM: Account)
// ---------------------------------------------------------------------------
exports.customers = exports.modbmCore.table('customers', {
    customerId: (0, pg_core_1.uuid)('customer_id').primaryKey().defaultRandom(),
    customerNumber: (0, pg_core_1.text)('customer_number').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    address1Line1: (0, pg_core_1.text)('address1_line1'),
    address1Line2: (0, pg_core_1.text)('address1_line2'),
    address1City: (0, pg_core_1.text)('address1_city'),
    address1StateOrProvince: (0, pg_core_1.text)('address1_state_or_province'),
    address1PostalCode: (0, pg_core_1.text)('address1_postal_code'),
    address1Country: (0, pg_core_1.text)('address1_country'),
    telephone1: (0, pg_core_1.text)('telephone1'),
    fax: (0, pg_core_1.text)('fax'),
    emailAddress1: (0, pg_core_1.text)('email_address1'),
    primaryContactName: (0, pg_core_1.text)('primary_contact_name'),
    primaryContactEmail: (0, pg_core_1.text)('primary_contact_email'),
    primaryContactPhone: (0, pg_core_1.text)('primary_contact_phone'),
    customerGroupId: (0, pg_core_1.uuid)('customer_group_id').references(function () { return exports.customerGroups.customerGroupId; }),
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.CUSTOMER_STATE.ACTIVE),
    taxCategoryId: (0, pg_core_1.uuid)('tax_category_id').references(function () { return exports.taxCategories.taxCategoryId; }),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    tradingTermsId: (0, pg_core_1.uuid)('trading_terms_id').references(function () { return exports.tradingTerms.tradingTermsId; }),
    creditLimit: (0, pg_core_1.numeric)('credit_limit'), // Nullable. Overrides group if NOT NULL.
    isOnCreditHold: (0, pg_core_1.boolean)('is_on_credit_hold').notNull().default(false), // Manual override per account
    bankAccountName: (0, pg_core_1.text)('bank_account_name'),
    bankBsb: (0, pg_core_1.text)('bank_bsb'),
    bankAccountNumber: (0, pg_core_1.text)('bank_account_number'),
    externalId: (0, pg_core_1.text)('external_id'),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    priceTier: (0, pg_core_1.text)('price_tier'),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('customers'),
}); });
// ---------------------------------------------------------------------------
// account_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.customerEvents = exports.modbmCore.table('customer_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    customerId: (0, pg_core_1.uuid)('customer_id')
        .notNull()
        .references(function () { return exports.customers.customerId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// suppliers  (CDM: Vendor)
// ---------------------------------------------------------------------------
exports.suppliers = exports.modbmCore.table('suppliers', {
    vendorId: (0, pg_core_1.uuid)('vendor_id').primaryKey().defaultRandom(),
    vendorNumber: (0, pg_core_1.text)('vendor_number').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    supplierGroupId: (0, pg_core_1.uuid)('supplier_group_id').references(function () { return exports.supplierGroups.supplierGroupId; }),
    address1Line1: (0, pg_core_1.text)('address1_line1'),
    address1Line2: (0, pg_core_1.text)('address1_line2'),
    address1City: (0, pg_core_1.text)('address1_city'),
    address1StateOrProvince: (0, pg_core_1.text)('address1_state_or_province'),
    address1PostalCode: (0, pg_core_1.text)('address1_postal_code'),
    address1Country: (0, pg_core_1.text)('address1_country'),
    telephone1: (0, pg_core_1.text)('telephone1'),
    fax: (0, pg_core_1.text)('fax'),
    emailAddress1: (0, pg_core_1.text)('email_address1'),
    tradingTermsId: (0, pg_core_1.uuid)('trading_terms_id').references(function () { return exports.tradingTerms.tradingTermsId; }),
    earlyPaymentDiscount: (0, pg_core_1.numeric)('early_payment_discount'),
    creditLimit: (0, pg_core_1.numeric)('credit_limit'),
    isPurchasingBlocked: (0, pg_core_1.boolean)('is_purchasing_blocked')
        .notNull()
        .default(false),
    purchasingBlockReason: (0, pg_core_1.text)('purchasing_block_reason', {
        enum: [
            'compliance_breach',
            'quality_issues',
            'dispute',
            'financial_risk',
            'other',
        ],
    }),
    isPaymentBlocked: (0, pg_core_1.boolean)('is_payment_blocked').notNull().default(false),
    paymentBlockReason: (0, pg_core_1.text)('payment_block_reason', {
        enum: ['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'],
    }),
    blockNotes: (0, pg_core_1.text)('block_notes'),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.CUSTOMER_STATE.ACTIVE),
    externalId: (0, pg_core_1.text)('external_id'),
    notes: (0, pg_core_1.text)('notes'),
    bankAccountName: (0, pg_core_1.text)('bank_account_name'),
    bankBsb: (0, pg_core_1.text)('bank_bsb'),
    bankAccountNumber: (0, pg_core_1.text)('bank_account_number'),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('suppliers'),
}); });
// ---------------------------------------------------------------------------
// supplier_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.supplierEvents = exports.modbmCore.table('supplier_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(function () { return exports.suppliers.vendorId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// supplier_expiries  (Generic tracking for compliance dates like insurance, tax certs)
// ---------------------------------------------------------------------------
exports.supplierExpiries = exports.modbmCore.table('supplier_expiries', {
    expiryId: (0, pg_core_1.uuid)('expiry_id').primaryKey().defaultRandom(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(function () { return exports.suppliers.vendorId; }),
    expiryType: (0, pg_core_1.text)('expiry_type', {
        enum: ['insurance', 'tax_certificate', 'trial_period', 'other'],
    }).notNull(),
    expiryDate: (0, pg_core_1.date)('expiry_date').notNull(),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// product_suppliers  (Native product-supplier catalogue mapping)
// ---------------------------------------------------------------------------
exports.productSuppliers = exports.modbmCore.table('product_suppliers', {
    productSupplierId: (0, pg_core_1.uuid)('product_supplier_id').primaryKey().defaultRandom(),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(function () { return exports.suppliers.vendorId; }),
    supplierPartNumber: (0, pg_core_1.text)('supplier_part_number'),
    costPrice: (0, pg_core_1.numeric)('cost_price').default('0'),
    discountPercent: (0, pg_core_1.numeric)('discount_percent').default('0'),
    priceBreakQuantity: (0, pg_core_1.numeric)('price_break_quantity'),
    isPreferred: (0, pg_core_1.boolean)('is_preferred').notNull().default(false),
    minPurchaseQty: (0, pg_core_1.numeric)('min_purchase_qty'),
    purchaseUnit: (0, pg_core_1.text)('purchase_unit'),
    effectiveFrom: (0, pg_core_1.timestamp)('effective_from', { withTimezone: true }),
    effectiveTo: (0, pg_core_1.timestamp)('effective_to', { withTimezone: true }),
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.SUPPLIER_STATE.ACTIVE),
    sourceId: (0, pg_core_1.text)('source_id').unique(),
    source: (0, pg_core_1.text)('source').notNull().default('app'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    unq: (0, pg_core_1.unique)('product_suppliers_supplier_product_unq').on(t.vendorId, t.productId),
}); });
// ---------------------------------------------------------------------------
// product_supplier_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.productSupplierEvents = exports.modbmCore.table('product_supplier_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    productSupplierId: (0, pg_core_1.uuid)('product_supplier_id')
        .notNull()
        .references(function () { return exports.productSuppliers.productSupplierId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// users  (Application users for portal auth + RBAC)
// ---------------------------------------------------------------------------
exports.users = exports.modbmCore.table('users', {
    userId: (0, pg_core_1.uuid)('user_id').primaryKey().defaultRandom(),
    username: (0, pg_core_1.text)('username').unique().notNull(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    displayName: (0, pg_core_1.text)('display_name'),
    email: (0, pg_core_1.text)('email'),
    role: (0, pg_core_1.text)('role').notNull(), // admin | sales | warehouse | procurement
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// ---------------------------------------------------------------------------
// user_events  (Audit log for user management actions)
// ---------------------------------------------------------------------------
exports.userEvents = exports.modbmCore.table('user_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(function () { return exports.users.userId; }, { onDelete: 'cascade' }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// sales_invoices  (AR header)
// ---------------------------------------------------------------------------
exports.salesInvoices = exports.modbmCore.table('sales_invoices', {
    invoiceId: (0, pg_core_1.uuid)('invoice_id').primaryKey().defaultRandom(),
    invoiceNumber: (0, pg_core_1.text)('invoice_number').unique().notNull(),
    salesOrderId: (0, pg_core_1.uuid)('sales_order_id')
        .notNull()
        .references(function () { return exports.salesOrders.salesOrderId; }),
    totalAmount: (0, pg_core_1.numeric)('total_amount').notNull(),
    outstandingAmount: (0, pg_core_1.numeric)('outstanding_amount').notNull().default('0'),
    taxAmount: (0, pg_core_1.numeric)('tax_amount').default('0'),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.SALES_INVOICE_STATE.DRAFT),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('sales_invoices'),
}); });
// ---------------------------------------------------------------------------
// sales_invoice_lines  (AR details)
// ---------------------------------------------------------------------------
exports.salesInvoiceLines = exports.modbmCore.table('sales_invoice_lines', {
    invoiceLineId: (0, pg_core_1.uuid)('invoice_line_id').primaryKey().defaultRandom(),
    invoiceId: (0, pg_core_1.uuid)('invoice_id')
        .notNull()
        .references(function () { return exports.salesInvoices.invoiceId; }),
    salesOrderLineId: (0, pg_core_1.uuid)('sales_order_line_id')
        .notNull()
        .references(function () { return exports.salesOrderLineItems.salesOrderLineId; }),
    quantityInvoiced: (0, pg_core_1.numeric)('quantity_invoiced').notNull(),
    pricePerUnit: (0, pg_core_1.numeric)('price_per_unit').notNull(),
    amount: (0, pg_core_1.numeric)('amount').notNull(),
});
// ---------------------------------------------------------------------------
// purchase_invoices  (AP header)
// ---------------------------------------------------------------------------
exports.purchaseInvoices = exports.modbmCore.table('purchase_invoices', {
    invoiceId: (0, pg_core_1.uuid)('invoice_id').primaryKey().defaultRandom(),
    invoiceNumber: (0, pg_core_1.text)('invoice_number').unique().notNull(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(function () { return exports.suppliers.vendorId; }),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id').references(function () { return exports.purchaseOrders.purchaseOrderId; }),
    supplierInvoiceNumber: (0, pg_core_1.text)('supplier_invoice_number'),
    receiptFilename: (0, pg_core_1.text)('receipt_filename'),
    totalAmount: (0, pg_core_1.numeric)('total_amount').notNull(),
    outstandingAmount: (0, pg_core_1.numeric)('outstanding_amount').notNull().default('0'),
    taxAmount: (0, pg_core_1.numeric)('tax_amount').default('0'),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.PURCHASE_INVOICE_STATE.DRAFT),
    notes: (0, pg_core_1.text)('notes'),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('purchase_invoices'),
}); });
// ---------------------------------------------------------------------------
// purchase_invoice_lines  (AP details)
// ---------------------------------------------------------------------------
exports.purchaseInvoiceLines = exports.modbmCore.table('purchase_invoice_lines', {
    invoiceLineId: (0, pg_core_1.uuid)('invoice_line_id').primaryKey().defaultRandom(),
    invoiceId: (0, pg_core_1.uuid)('invoice_id')
        .notNull()
        .references(function () { return exports.purchaseInvoices.invoiceId; }),
    purchaseOrderLineId: (0, pg_core_1.uuid)('purchase_order_line_id').references(function () { return exports.purchaseOrderLineItems.purchaseOrderLineId; }),
    productId: (0, pg_core_1.uuid)('product_id').references(function () { return exports.products.productId; }),
    glAccountId: (0, pg_core_1.uuid)('gl_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    description: (0, pg_core_1.text)('description'),
    quantityInvoiced: (0, pg_core_1.numeric)('quantity_invoiced').notNull(),
    pricePerUnit: (0, pg_core_1.numeric)('price_per_unit').notNull(),
    amount: (0, pg_core_1.numeric)('amount').notNull(),
    matchStatus: (0, pg_core_1.text)('match_status').notNull().default(shared_1.MATCH_STATUS.UNMATCHED),
});
// ---------------------------------------------------------------------------
// purchase_invoice_receipts  (N:N mapping for 3-way matching between invoice lines and received goods lines)
// ---------------------------------------------------------------------------
exports.purchaseInvoiceReceipts = exports.modbmCore.table('purchase_invoice_receipts', {
    invoiceReceiptId: (0, pg_core_1.uuid)('invoice_receipt_id').primaryKey().defaultRandom(),
    invoiceLineId: (0, pg_core_1.uuid)('invoice_line_id')
        .notNull()
        .references(function () { return exports.purchaseInvoiceLines.invoiceLineId; }),
    goodsReceivedLineId: (0, pg_core_1.uuid)('goods_received_line_id')
        .notNull()
        .references(function () { return exports.goodsReceivedLines.goodsReceivedLineId; }),
    quantityBilled: (0, pg_core_1.numeric)('quantity_billed').notNull(),
});
// ---------------------------------------------------------------------------
// payment_entries  (Cash flow records)
// ---------------------------------------------------------------------------
exports.paymentEntries = exports.modbmCore.table('payment_entries', {
    paymentId: (0, pg_core_1.uuid)('payment_id').primaryKey().defaultRandom(),
    paymentNumber: (0, pg_core_1.text)('payment_number').unique().notNull(),
    paymentType: (0, pg_core_1.text)('payment_type').notNull(), // 'receive' | 'pay'
    partyType: (0, pg_core_1.text)('party_type').notNull(), // 'customer' | 'supplier'
    partyId: (0, pg_core_1.uuid)('party_id').notNull(), // Logic enforces reference to customers/suppliers
    paymentDate: (0, pg_core_1.timestamp)('payment_date', { withTimezone: true }).notNull(),
    modeOfPayment: (0, pg_core_1.text)('mode_of_payment').notNull(), // 'Cash', 'Wire', 'Credit Card'
    totalAmount: (0, pg_core_1.numeric)('total_amount').notNull(),
    unallocatedAmount: (0, pg_core_1.numeric)('unallocated_amount').notNull(),
    glAccountBank: (0, pg_core_1.uuid)('gl_account_bank')
        .notNull()
        .references(function () { return exports.glAccounts.glAccountId; }),
    referenceNumber: (0, pg_core_1.text)('reference_number'),
    stateCode: (0, pg_core_1.text)('state_code').notNull().default(shared_1.PAYMENT_STATE.DRAFT),
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(),
    createdBy: (0, pg_core_1.text)('created_by'),
    abaExportedAt: (0, pg_core_1.timestamp)('aba_exported_at', { withTimezone: true }),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// payment_allocations  (Linking cash to subledgers)
// ---------------------------------------------------------------------------
exports.paymentAllocations = exports.modbmCore.table('payment_allocations', {
    allocationId: (0, pg_core_1.uuid)('allocation_id').primaryKey().defaultRandom(),
    paymentId: (0, pg_core_1.uuid)('payment_id')
        .notNull()
        .references(function () { return exports.paymentEntries.paymentId; }),
    referenceType: (0, pg_core_1.text)('reference_type').notNull(), // 'sales_invoice' | 'purchase_invoice'
    referenceId: (0, pg_core_1.uuid)('reference_id').notNull(),
    allocatedAmount: (0, pg_core_1.numeric)('allocated_amount').notNull(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// payment_events  (Audit log + event sourcing)
// ---------------------------------------------------------------------------
exports.paymentEvents = exports.modbmCore.table('payment_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    paymentId: (0, pg_core_1.uuid)('payment_id')
        .notNull()
        .references(function () { return exports.paymentEntries.paymentId; }),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// cost_centers  (Financial dimensions for expense allocation)
// ---------------------------------------------------------------------------
exports.costCenters = exports.modbmCore.table('cost_centers', {
    costCenterId: (0, pg_core_1.uuid)('cost_center_id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.text)('code').unique().notNull(), // e.g. "00"
    name: (0, pg_core_1.text)('name').notNull(),
    isSystem: (0, pg_core_1.boolean)('is_system').notNull().default(false),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// activities  (Financial dimensions for expense allocation)
// ---------------------------------------------------------------------------
exports.activities = exports.modbmCore.table('activities', {
    activityId: (0, pg_core_1.uuid)('activity_id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.text)('code').unique().notNull(), // e.g. "00"
    name: (0, pg_core_1.text)('name').notNull(),
    isSystem: (0, pg_core_1.boolean)('is_system').notNull().default(false),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ===========================================================================
// GENERAL LEDGER (Native Double-Entry Accounting)
// ===========================================================================
// ---------------------------------------------------------------------------
// gl_accounts  (Chart of Accounts — hierarchical, customisable)
// ---------------------------------------------------------------------------
exports.glAccounts = exports.modbmCore.table('gl_accounts', {
    glAccountId: (0, pg_core_1.uuid)('gl_account_id').primaryKey().defaultRandom(),
    accountCode: (0, pg_core_1.text)('account_code').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    accountType: (0, pg_core_1.text)('account_type', {
        enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    }).notNull(),
    parentAccountId: (0, pg_core_1.uuid)('parent_account_id'), // self-ref for hierarchy
    isGroup: (0, pg_core_1.boolean)('is_group').notNull().default(false),
    isSystem: (0, pg_core_1.boolean)('is_system').notNull().default(false), // prevents deletion
    isBankAccount: (0, pg_core_1.boolean)('is_bank_account').notNull().default(false), // determines if it appears in payment/recon modules
    currencyCode: (0, pg_core_1.text)('currency_code').notNull(), // GL customers can have different currencies
    metadata: (0, pg_core_1.jsonb)('metadata').$type().default({}), // stores bank numbers, BSBs, routing, SWIFT, etc.
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
}, function (t) { return ({
    currencyCheck: validCurrencyCheck('gl_accounts'),
}); });
// ---------------------------------------------------------------------------
// gl_journal_entries  (Journal Entry header — one per financial event)
// ---------------------------------------------------------------------------
exports.glJournalEntries = exports.modbmCore.table('gl_journal_entries', {
    journalEntryId: (0, pg_core_1.uuid)('journal_entry_id').primaryKey().defaultRandom(),
    entryNumber: (0, pg_core_1.text)('entry_number').unique().notNull(),
    entryDate: (0, pg_core_1.date)('entry_date').notNull(),
    memo: (0, pg_core_1.text)('memo'),
    sourceType: (0, pg_core_1.text)('source_type').notNull(), // sales_invoice | purchase_invoice | sales_credit_note | purchase_debit_note | manual | adjustment
    sourceId: (0, pg_core_1.uuid)('source_id'), // FK to originating document (nullable for manual)
    isReversed: (0, pg_core_1.boolean)('is_reversed').notNull().default(false),
    reversedBy: (0, pg_core_1.uuid)('reversed_by'), // self-ref to reversing JE
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// gl_reconciliations (Bank Reconciliation header)
// ---------------------------------------------------------------------------
exports.glReconciliations = exports.modbmCore.table('gl_reconciliations', {
    reconciliationId: (0, pg_core_1.uuid)('reconciliation_id').primaryKey().defaultRandom(),
    glAccountId: (0, pg_core_1.uuid)('gl_account_id')
        .notNull()
        .references(function () { return exports.glAccounts.glAccountId; }),
    statementDate: (0, pg_core_1.date)('statement_date').notNull(),
    statementBalance: (0, pg_core_1.numeric)('statement_balance').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default(shared_1.RECONCILIATION_STATE.DRAFT), // 'draft' | 'posted'
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    postedOn: (0, pg_core_1.timestamp)('posted_on', { withTimezone: true }),
});
// ---------------------------------------------------------------------------
// gl_journal_lines  (Debits and Credits — the core of double-entry)
// ---------------------------------------------------------------------------
exports.glJournalLines = exports.modbmCore.table('gl_journal_lines', {
    journalLineId: (0, pg_core_1.uuid)('journal_line_id').primaryKey().defaultRandom(),
    journalEntryId: (0, pg_core_1.uuid)('journal_entry_id')
        .notNull()
        .references(function () { return exports.glJournalEntries.journalEntryId; }),
    glAccountId: (0, pg_core_1.uuid)('gl_account_id')
        .notNull()
        .references(function () { return exports.glAccounts.glAccountId; }),
    partyType: (0, pg_core_1.text)('party_type'), // 'customer' | 'supplier'
    partyId: (0, pg_core_1.text)('party_id'), // generic reference to customers/suppliers
    debit: (0, pg_core_1.numeric)('debit').notNull().default('0'),
    credit: (0, pg_core_1.numeric)('credit').notNull().default('0'),
    memo: (0, pg_core_1.text)('memo'),
    isReconciled: (0, pg_core_1.boolean)('is_reconciled').notNull().default(false),
    reconciliationId: (0, pg_core_1.uuid)('reconciliation_id').references(function () { return exports.glReconciliations.reconciliationId; }),
    costCenterId: (0, pg_core_1.uuid)('cost_center_id').references(function () { return exports.costCenters.costCenterId; }),
    activityId: (0, pg_core_1.uuid)('activity_id').references(function () { return exports.activities.activityId; }),
});
// ---------------------------------------------------------------------------
// organization  (Singleton config for company identity)
// ---------------------------------------------------------------------------
exports.organization = exports.modbmCore.table('organization', {
    organizationId: (0, pg_core_1.uuid)('organization_id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    addressLine1: (0, pg_core_1.text)('address_line_1'),
    addressLine2: (0, pg_core_1.text)('address_line_2'),
    city: (0, pg_core_1.text)('city'),
    state: (0, pg_core_1.text)('state'),
    country: (0, pg_core_1.text)('country'),
    postCode: (0, pg_core_1.text)('post_code'),
    email: (0, pg_core_1.text)('email'),
    phone: (0, pg_core_1.text)('phone'),
    website: (0, pg_core_1.text)('website'),
    companyNumber: (0, pg_core_1.text)('company_number'),
    taxNumber: (0, pg_core_1.text)('tax_number'),
    logoUrl: (0, pg_core_1.text)('logo_url'),
    bankName: (0, pg_core_1.text)('bank_name'),
    bankAccountName: (0, pg_core_1.text)('bank_account_name'),
    bankAccountNumber: (0, pg_core_1.text)('bank_account_number'),
    bankSwiftBic: (0, pg_core_1.text)('bank_swift_bic'),
    bankIban: (0, pg_core_1.text)('bank_iban'),
});
// ---------------------------------------------------------------------------
// gl_settings  (Singleton config — fiscal year + default account mappings)
// ---------------------------------------------------------------------------
exports.glSettings = exports.modbmCore.table('gl_settings', {
    settingsId: (0, pg_core_1.uuid)('settings_id').primaryKey().defaultRandom(),
    accountMetadataSchema: (0, pg_core_1.jsonb)('account_metadata_schema')
        .$type()
        .default([]),
    fiscalYearStartMonth: (0, pg_core_1.integer)('fiscal_year_start_month').notNull(), // Sourced from settings JSON
    defaultArAccountId: (0, pg_core_1.uuid)('default_ar_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultApAccountId: (0, pg_core_1.uuid)('default_ap_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultRevenueAccountId: (0, pg_core_1.uuid)('default_revenue_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultCogsAccountId: (0, pg_core_1.uuid)('default_cogs_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultTaxAccountId: (0, pg_core_1.uuid)('default_tax_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultExpenseAccountId: (0, pg_core_1.uuid)('default_expense_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultInventoryAccountId: (0, pg_core_1.uuid)('default_inventory_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultGrniAccountId: (0, pg_core_1.uuid)('default_grni_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    defaultShrinkageAccountId: (0, pg_core_1.uuid)('default_shrinkage_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    baseCurrency: (0, pg_core_1.text)('base_currency').notNull(),
    supportedBatchPaymentFormats: (0, pg_core_1.jsonb)('supported_batch_payment_formats')
        .$type()
        .default([]),
    revenueRoutingPrecedence: (0, pg_core_1.text)('revenue_routing_precedence')
        .notNull()
        .default('product_first'), // 'product_first' | 'customer_first'
    expenseRoutingPrecedence: (0, pg_core_1.text)('expense_routing_precedence')
        .notNull()
        .default('product_first'), // 'product_first' | 'supplier_first'
    defaultFeeRevenueAccountId: (0, pg_core_1.uuid)('default_fee_revenue_account_id').references(function () { return exports.glAccounts.glAccountId; }),
});
// ---------------------------------------------------------------------------
// app_settings  (Singleton config — operational defaults)
// ---------------------------------------------------------------------------
exports.appSettings = exports.modbmCore.table('app_settings', {
    settingsId: (0, pg_core_1.uuid)('settings_id').primaryKey().defaultRandom(),
    defaultFulfillmentLocationId: (0, pg_core_1.uuid)('default_fulfillment_location_id').references(function () { return exports.locations.locationId; }),
    inventoryValuationMethod: (0, pg_core_1.text)('inventory_valuation_method')
        .notNull()
        .default('weighted_average'), // 'weighted_average' | 'fifo' | 'standard'
    inventoryAccountingMode: (0, pg_core_1.text)('inventory_accounting_mode')
        .notNull()
        .default('periodic'), // 'periodic' | 'perpetual'
    nonStockBillingMode: (0, pg_core_1.text)('non_stock_billing_mode')
        .notNull()
        .default('per_shipment'), // 'per_shipment' | 'final_invoice'
    creditLimitBehavior: (0, pg_core_1.text)('credit_limit_behavior').notNull().default('soft'), // 'hard' (block creation) | 'soft' (allow draft, block dispatch)
    apiRateLimit: (0, pg_core_1.numeric)('api_rate_limit').notNull().default('1000'),
    setupCompletedAt: (0, pg_core_1.timestamp)('setup_completed_at', { withTimezone: true }),
});
// ===========================================================================
// DYNAMIC REPORTING
// ===========================================================================
exports.reports = exports.modbmCore.table('reports', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    slug: (0, pg_core_1.text)('slug').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    template: (0, pg_core_1.text)('template').notNull(),
    mockData: (0, pg_core_1.jsonb)('mock_data').$type(),
    outputNamePattern: (0, pg_core_1.text)('output_name_pattern').default('Report.pdf'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.reportContexts = exports.modbmCore.table('report_contexts', {
    reportId: (0, pg_core_1.uuid)('report_id')
        .references(function () { return exports.reports.id; }, { onDelete: 'cascade' })
        .notNull(),
    context: (0, pg_core_1.text)('context').notNull(),
}, function (t) { return ({
    pk: (0, pg_core_1.primaryKey)({ columns: [t.reportId, t.context] }),
}); });
exports.reportHookAssignments = exports.modbmCore.table('report_hook_assignments', {
    hookSlug: (0, pg_core_1.text)('hook_slug').primaryKey(),
    reportId: (0, pg_core_1.uuid)('report_id')
        .references(function () { return exports.reports.id; }, { onDelete: 'cascade' })
        .notNull(),
    contextSlug: (0, pg_core_1.text)('context_slug').notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// ---------------------------------------------------------------------------
// system_events  (Cross-cutting audit log for GL, inventory, and other
//                 domain events that don't belong to a specific entity table)
// ---------------------------------------------------------------------------
exports.systemEvents = exports.modbmCore.table('system_events', {
    eventId: (0, pg_core_1.uuid)('event_id').primaryKey().defaultRandom(),
    aggregateType: (0, pg_core_1.text)('aggregate_type').notNull(),
    aggregateId: (0, pg_core_1.uuid)('aggregate_id').notNull(),
    eventType: (0, pg_core_1.text)('event_type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// goods_received  (Physical dock manifest — one per incoming package/packing slip)
// ---------------------------------------------------------------------------
exports.goodsReceived = exports.modbmCore.table('goods_received', {
    goodsReceivedId: (0, pg_core_1.uuid)('goods_received_id').primaryKey().defaultRandom(),
    receiptNumber: (0, pg_core_1.text)('receipt_number').unique().notNull(),
    vendorId: (0, pg_core_1.uuid)('vendor_id')
        .notNull()
        .references(function () { return exports.suppliers.vendorId; }),
    locationId: (0, pg_core_1.uuid)('location_id')
        .notNull()
        .references(function () { return exports.locations.locationId; }),
    packingSlipNumber: (0, pg_core_1.text)('packing_slip_number'),
    notes: (0, pg_core_1.text)('notes'),
    stateCode: (0, pg_core_1.text)('state_code')
        .notNull()
        .default(shared_1.GOODS_RECEIVED_STATE.RECEIVED), // received | invoiced | archived
    createdBy: (0, pg_core_1.text)('created_by'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// goods_received_lines  (Per-product quantities from the packing slip)
// ---------------------------------------------------------------------------
exports.goodsReceivedLines = exports.modbmCore.table('goods_received_lines', {
    goodsReceivedLineId: (0, pg_core_1.uuid)('goods_received_line_id')
        .primaryKey()
        .defaultRandom(),
    goodsReceivedId: (0, pg_core_1.uuid)('goods_received_id')
        .notNull()
        .references(function () { return exports.goodsReceived.goodsReceivedId; }),
    productId: (0, pg_core_1.uuid)('product_id')
        .notNull()
        .references(function () { return exports.products.productId; }),
    quantityReceived: (0, pg_core_1.numeric)('quantity_received').notNull(),
    matchStatus: (0, pg_core_1.text)('match_status').notNull().default(shared_1.MATCH_STATUS.UNMATCHED), // matched | unmatched | ambiguous
    putawayStatus: (0, pg_core_1.text)('putaway_status', {
        enum: [
            shared_1.PUTAWAY_STATUS.AWAITING_MATCHING,
            shared_1.PUTAWAY_STATUS.PENDING_PUTAWAY,
            shared_1.PUTAWAY_STATUS.QUARANTINED,
            shared_1.PUTAWAY_STATUS.COMPLETED,
        ],
    })
        .notNull()
        .default(shared_1.PUTAWAY_STATUS.PENDING_PUTAWAY),
    purchaseOrderLineId: (0, pg_core_1.uuid)('purchase_order_line_id').references(function () { return exports.purchaseOrderLineItems.purchaseOrderLineId; }),
    purchaseOrderId: (0, pg_core_1.uuid)('purchase_order_id').references(function () { return exports.purchaseOrders.purchaseOrderId; }),
});
// ---------------------------------------------------------------------------
// dashboard_timeline  (Unified operational timeline combining all entity and
//                      system events for the dashboard chronological feed)
// ---------------------------------------------------------------------------
exports.dashboardTimeline = exports.modbmCore
    .view('dashboard_timeline', {
    eventId: (0, pg_core_1.uuid)('event_id'),
    aggregateType: (0, pg_core_1.text)('aggregate_type'),
    aggregateId: (0, pg_core_1.uuid)('aggregate_id'),
    eventType: (0, pg_core_1.text)('event_type'),
    payload: (0, pg_core_1.jsonb)('payload'),
    actor: (0, pg_core_1.text)('actor'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }),
})
    .existing();
// ---------------------------------------------------------------------------
// api_keys (Headless integrations)
// ---------------------------------------------------------------------------
exports.apiKeys = exports.modbmCore.table('api_keys', {
    apiKeyId: (0, pg_core_1.uuid)('api_key_id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    keyHash: (0, pg_core_1.text)('key_hash').notNull(),
    prefix: (0, pg_core_1.text)('prefix').notNull(),
    role: (0, pg_core_1.text)('role').notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdBy: (0, pg_core_1.text)('created_by').notNull(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// webhooks (Event dispatch targets)
// ---------------------------------------------------------------------------
exports.webhooks = exports.modbmCore.table('webhooks', {
    webhookId: (0, pg_core_1.uuid)('webhook_id').primaryKey().defaultRandom(),
    targetUrl: (0, pg_core_1.text)('target_url').notNull(),
    eventTypes: (0, pg_core_1.jsonb)('event_types').notNull(),
    secretKey: (0, pg_core_1.text)('secret_key').notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// casbin_rule (Dynamic RBAC Policies)
// ---------------------------------------------------------------------------
exports.casbinRule = exports.modbmCore.table('casbin_rule', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    ptype: (0, pg_core_1.text)('ptype').notNull(),
    v0: (0, pg_core_1.text)('v0'),
    v1: (0, pg_core_1.text)('v1'),
    v2: (0, pg_core_1.text)('v2'),
    v3: (0, pg_core_1.text)('v3'),
    v4: (0, pg_core_1.text)('v4'),
    v5: (0, pg_core_1.text)('v5'),
});
// ---------------------------------------------------------------------------
// csv_mapping_profiles (Saved column mappings for bank CSV imports)
// ---------------------------------------------------------------------------
exports.csvMappingProfiles = exports.modbmCore.table('csv_mapping_profiles', {
    profileId: (0, pg_core_1.uuid)('profile_id').primaryKey().defaultRandom(),
    glAccountId: (0, pg_core_1.uuid)('gl_account_id').references(function () { return exports.glAccounts.glAccountId; }),
    name: (0, pg_core_1.text)('name').notNull(),
    dateColumn: (0, pg_core_1.text)('date_column').notNull(),
    amountColumn: (0, pg_core_1.text)('amount_column').notNull(),
    descriptionColumn: (0, pg_core_1.text)('description_column').notNull(),
    referenceColumn: (0, pg_core_1.text)('reference_column'),
    headerRows: (0, pg_core_1.integer)('header_rows').notNull().default(1),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// reconciliation_rules (Rules engine for auto-tagging bank statement lines)
// ---------------------------------------------------------------------------
exports.reconciliationRules = exports.modbmCore.table('reconciliation_rules', {
    ruleId: (0, pg_core_1.uuid)('rule_id').primaryKey().defaultRandom(),
    glAccountId: (0, pg_core_1.uuid)('gl_account_id').references(function () { return exports.glAccounts.glAccountId; }), // Nullable for global rules
    conditionType: (0, pg_core_1.text)('condition_type').notNull(), // 'contains', 'starts_with', 'exact_match'
    conditionValue: (0, pg_core_1.text)('condition_value').notNull(),
    targetGlAccountId: (0, pg_core_1.uuid)('target_gl_account_id')
        .notNull()
        .references(function () { return exports.glAccounts.glAccountId; }),
    priority: (0, pg_core_1.integer)('priority').notNull().default(10),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
// ---------------------------------------------------------------------------
// bank_statement_lines (Staging queue for unmatched bank import rows)
// ---------------------------------------------------------------------------
exports.bankStatementLines = exports.modbmCore.table('bank_statement_lines', {
    lineId: (0, pg_core_1.uuid)('line_id').primaryKey().defaultRandom(),
    glAccountId: (0, pg_core_1.uuid)('gl_account_id')
        .notNull()
        .references(function () { return exports.glAccounts.glAccountId; }),
    date: (0, pg_core_1.date)('date').notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    amount: (0, pg_core_1.numeric)('amount').notNull(),
    reference: (0, pg_core_1.text)('reference'),
    isReconciled: (0, pg_core_1.boolean)('is_reconciled').notNull().default(false),
    reconciliationId: (0, pg_core_1.uuid)('reconciliation_id').references(function () { return exports.glReconciliations.reconciliationId; }),
    matchedJournalLineId: (0, pg_core_1.uuid)('matched_journal_line_id').references(function () { return exports.glJournalLines.journalLineId; }),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
});
var templateObject_1, templateObject_2;
