import {
  text,
  numeric,
  boolean,
  timestamp,
  uuid,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { herobmCore } from './core.schema';
import {
  TransferOrderPickState,
  ShipmentState,
  PUTAWAY_STATUS,
} from '@herobm/shared';
import { products } from './products.schema';

// ---------------------------------------------------------------------------
// locations  (Physical warehouses or regional centers)
// ---------------------------------------------------------------------------
export const locations = herobmCore.table('locations', {
  locationId: uuid('location_id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // e.g. "SIN"
  name: text('name').notNull(),
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  stateOrProvince: text('state_or_province'),
  country: text('country'),
  postalCode: text('postal_code'),
  sourceId: text('source_id').unique(),
  source: text('source').notNull(),
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// zones  (Logical or physical areas within a location, e.g. 'Bulk', 'Picking')
// ---------------------------------------------------------------------------
export const zones = herobmCore.table(
  'zones',
  {
    zoneId: uuid('zone_id').primaryKey().defaultRandom(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.locationId),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sourceId: text('source_id').unique(),
    source: text('source').notNull(),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('zones_code_location_unq').on(t.code, t.locationId),
  }),
);

// ---------------------------------------------------------------------------
// bins  (Physical storage locations within a location)
// ---------------------------------------------------------------------------
export const binTypeEnum = herobmCore.enum('bin_type_enum', [
  'storage', // Standard racking or shelving intended for general long-term or short-term storage
  'pick', // Forward active picking locations designed for high-velocity fulfillment
  'bulk', // Bulk floor locations or overstock storage for pallets and large items
  'staging', // Temporary holding areas (e.g. shipping docks, temporary transit)
  'quarantine', // Restricted bins for quality inspection, damaged goods, or blocked inventory
  'in_transit', // Virtual bins representing inventory currently moving between physical locations
  'wip', // Work in progress bin for manufacturing component staging and build output
]);

export const bins = herobmCore.table(
  'bins',
  {
    binId: uuid('bin_id').primaryKey().defaultRandom(),
    binNumber: text('bin_number').notNull(),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => zones.zoneId),
    binType: binTypeEnum('bin_type').notNull(),
    isConsignment: boolean('is_consignment'),
    isBonded: boolean('is_bonded'),
    isUnavailable: boolean('is_unavailable'),
    sourceId: text('source_id').unique(),
    source: text('source').notNull(),
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
export const inventoryEntries = herobmCore.table(
  'inventory_entries',
  {
    entryId: uuid('entry_id').primaryKey().defaultRandom(),
    entryNumber: text('entry_number').unique().notNull(), // e.g. STK-20260325-001
    entryDate: timestamp('entry_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    memo: text('memo'),
    sourceType: text('source_type').notNull(), // INITIAL_IMPORT, PO_RECEIPT, SO_SHIPMENT, RETURN, ADJUSTMENT, TRANSFER
    sourceId: uuid('source_id'), // FK to originating document
    isReversed: boolean('is_reversed').notNull(),
    reversedBy: uuid('reversed_by'), // self-ref to reversing entry
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    dateIdx: index('idx_inventory_entries_entry_date').on(t.entryDate),
  }),
);

// ---------------------------------------------------------------------------
// inventory_ledger (Immutable double-entry ledger of all stock movement lines)
// ---------------------------------------------------------------------------
export const inventoryLedger = herobmCore.table(
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
    entryIdx: index('idx_inventory_ledger_entry_id').on(t.entryId),
  }),
);

// ---------------------------------------------------------------------------
// bin_contents (Real-time calculated snapshot cache of current stock)
// ---------------------------------------------------------------------------
export const binContents = herobmCore.table(
  'bin_contents',
  {
    binContentId: uuid('bin_content_id').primaryKey().defaultRandom(),
    binId: uuid('bin_id')
      .notNull()
      .references(() => bins.binId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    actualQuantity: numeric('actual_quantity').notNull(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unq: unique('bin_contents_bin_product_unq').on(t.binId, t.productId),
    productIdx: index('idx_bin_contents_product_id').on(t.productId),
  }),
);

// ---------------------------------------------------------------------------
// product_default_bins (WMS Directed Putaway & Replenishment routing)
// ---------------------------------------------------------------------------
export const productDefaultBins = herobmCore.table(
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
    isPrimaryPerLocation: boolean('is_primary_per_loc').notNull(),
    minQuantity: numeric('min_quantity'),
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

export const transferOrders = herobmCore.table(
  'transfer_orders',
  {
    transferOrderId: uuid('transfer_order_id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').unique().notNull(),
    sourceLocationId: uuid('source_location_id')
      .notNull()
      .references(() => locations.locationId),
    destinationLocationId: uuid('destination_location_id')
      .notNull()
      .references(() => locations.locationId),
    stateCode: text('state_code').notNull(),
    notes: text('notes'),
    shippingNotes: text('shipping_notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    sourceLocIdx: index('idx_transfer_orders_source_location').on(
      t.sourceLocationId,
    ),
    destLocIdx: index('idx_transfer_orders_dest_location').on(
      t.destinationLocationId,
    ),
  }),
);

export const transferOrderLines = herobmCore.table(
  'transfer_order_lines',
  {
    transferOrderLineId: uuid('transfer_order_line_id')
      .primaryKey()
      .defaultRandom(),
    transferOrderId: uuid('transfer_order_id')
      .notNull()
      .references(() => transferOrders.transferOrderId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    quantity: numeric('quantity').notNull(),
    quantityShipped: numeric('quantity_shipped'),
    quantityReceived: numeric('quantity_received'),
  },
  (t) => ({
    productIdx: index('idx_transfer_order_lines_product').on(t.productId),
  }),
);

export const transferOrderPicks = herobmCore.table(
  'transfer_order_picks',
  {
    pickId: uuid('pick_id').primaryKey().defaultRandom(),
    transferOrderId: uuid('transfer_order_id')
      .notNull()
      .references(() => transferOrders.transferOrderId),
    transferOrderLineId: uuid('transfer_order_line_id')
      .notNull()
      .references(() => transferOrderLines.transferOrderLineId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    binId: uuid('bin_id').references(() => bins.binId),
    quantity: numeric('quantity').notNull(),
    stateCode: text('state_code').$type<TransferOrderPickState>().notNull(),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_transfer_order_picks_order').on(t.transferOrderId),
    lineIdx: index('idx_transfer_order_picks_line').on(t.transferOrderLineId),
  }),
);

export const transferOrderShipments = herobmCore.table(
  'transfer_order_shipments',
  {
    shipmentId: uuid('shipment_id').primaryKey().defaultRandom(),
    transferOrderId: uuid('transfer_order_id')
      .notNull()
      .references(() => transferOrders.transferOrderId),
    shipmentNumber: text('shipment_number').unique().notNull(),
    trackingNumber: text('tracking_number'),
    carrierId: uuid('carrier_id'), // if carriers exist
    notes: text('notes'),
    stateCode: text('state_code').$type<ShipmentState>().notNull(),
    shippedBy: text('shipped_by'),
    shippedOn: timestamp('shipped_on', { withTimezone: true }).defaultNow(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_transfer_order_shipments_order').on(t.transferOrderId),
  }),
);

export const transferOrderShipmentLines = herobmCore.table(
  'transfer_order_shipment_lines',
  {
    shipmentLineId: uuid('shipment_line_id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => transferOrderShipments.shipmentId),
    transferOrderLineId: uuid('transfer_order_line_id')
      .notNull()
      .references(() => transferOrderLines.transferOrderLineId),
    pickId: uuid('pick_id').references(() => transferOrderPicks.pickId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    quantity: numeric('quantity').notNull(),
  },
  (t) => ({
    shipmentIdx: index('idx_transfer_order_shipment_lines_shipment').on(
      t.shipmentId,
    ),
  }),
);

export const transferOrderReceipts = herobmCore.table(
  'transfer_order_receipts',
  {
    receiptId: uuid('receipt_id').primaryKey().defaultRandom(),
    transferOrderId: uuid('transfer_order_id')
      .notNull()
      .references(() => transferOrders.transferOrderId),
    receiptNumber: text('receipt_number').unique().notNull(),
    stateCode: text('state_code').notNull(),
    receivedBy: text('received_by'),
    receivedOn: timestamp('received_on', { withTimezone: true }).defaultNow(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_transfer_order_receipts_order').on(t.transferOrderId),
  }),
);

export const transferOrderReceiptLines = herobmCore.table(
  'transfer_order_receipt_lines',
  {
    receiptLineId: uuid('receipt_line_id').primaryKey().defaultRandom(),
    receiptId: uuid('receipt_id')
      .notNull()
      .references(() => transferOrderReceipts.receiptId),
    transferOrderLineId: uuid('transfer_order_line_id')
      .notNull()
      .references(() => transferOrderLines.transferOrderLineId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    binId: uuid('bin_id')
      .notNull()
      .references(() => bins.binId),
    quantity: numeric('quantity').notNull(),
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
    receiptIdx: index('idx_transfer_order_receipt_lines_receipt').on(
      t.receiptId,
    ),
  }),
);

export const inventoryLevels = herobmCore
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
