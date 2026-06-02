// ---------------------------------------------------------------------------
// Event Type Registry — Single source of truth for all event type strings
// ---------------------------------------------------------------------------

/**
 * Aggregate types map to specific per-entity event tables.
 * 'system' routes to the system_events table for cross-cutting concerns.
 */
export const AggregateType = {
  SALES_ORDER: 'sales_order',
  SHIPMENT: 'shipment',
  PURCHASE_ORDER: 'purchase_order',
  PRODUCT: 'product',
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  PRODUCT_SUPPLIER: 'product_supplier',
  PAYMENT: 'payment',
  GOODS_RECEIPT: 'goods_receipt',
  SALES_INVOICE: 'sales_invoice',
  PURCHASE_INVOICE: 'purchase_invoice',
  TRANSFER_ORDER: 'transfer_order',
  SYSTEM: 'system',
} as const;

export type AggregateTypeValue =
  (typeof AggregateType)[keyof typeof AggregateType];

import {
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  PURCHASE_ORDER_STATE,
} from '@modbm/shared';

/**
 * All known event types across the platform.
 * Grouped by domain for readability.
 */
export const EventType = {
  // ── Lifecycle (shared across entities) ──────────────────────────────
  CREATED: 'created',
  UPDATED: 'updated',
  STATUS_CHANGED: 'status_changed',
  AUTO_STATUS_CHANGED: 'auto_status_changed',
  ARCHIVED: SALES_ORDER_STATE.ARCHIVED,
  UNARCHIVED: 'unarchived',
  RELEASED: 'released',
  DELETED: 'deleted',

  // ── Line operations ─────────────────────────────────────────────────
  LINE_ADDED: 'line_added',
  LINE_UPDATED: 'line_updated',
  LINE_REMOVED: 'line_removed',
  POST_CONFIRMATION_LINE_ADDED: 'post_confirmation_line_added',

  // ── Sales domain ────────────────────────────────────────────────────
  SALES_INVOICED: 'sales_invoiced',
  STOCK_DISPATCHED: 'stock_dispatched',
  STOCK_DISPATCH_REVERTED: 'stock_dispatch_reverted',
  BACKORDERS_ALLOCATED: 'backorders_allocated',
  CREDIT_NOTE_POSTED: 'credit_note_posted',

  // ── Procurement domain ──────────────────────────────────────────────
  PURCHASE_INVOICED: 'purchase_invoiced',
  STOCK_RECEIVED: 'stock_received',
  DEMAND_ALLOCATED: 'demand_allocated',
  DEMAND_UNALLOCATED: 'demand_unallocated',
  DEMAND_REALLOCATED: 'demand_reallocated',
  RECEIPT_MATCHED: 'receipt_matched',
  RECEIPT_UNMATCHED: 'receipt_unmatched',
  INVOICE_MATCHED: 'invoice_matched',
  INVOICE_UNMATCHED: 'invoice_unmatched',
  RETURN_CREATED: 'return_created',
  RETURN_PROCESSED: 'return_processed',
  LOCATION_DISCREPANCY_WARNING: 'location_discrepancy_warning',
  OVER_RECEIVED_WARNING: 'over_received_warning',
  PRICE_DISCREPANCY_WARNING: 'price_discrepancy_warning',

  // ── Product domain ──────────────────────────────────────────────────
  LINKED: 'linked',
  UNLINKED: 'unlinked',
  UOM_ADDED: 'uom_added',
  UOM_REMOVED: 'uom_removed',

  // ── Supplier domain ─────────────────────────────────────────────────
  ADDED_EXPIRY: 'added_expiry',
  UPDATED_EXPIRY: 'updated_expiry',
  DELETED_EXPIRY: 'deleted_expiry',

  // ── System domain ───────────────────────────────────────────────────
  GL_POSTED: 'gl_posted',
  STOCK_ADJUSTED: 'stock_adjusted',

  // ── Payment domain ──────────────────────────────────────────────────
  PAYMENT_SUBMITTED: 'payment_submitted',
  PAYMENT_ALLOCATED: 'payment_allocated',
  PAYMENT_CANCELLED: 'payment_cancelled',
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

/**
 * Outbox gating: which event types should be enqueued for integration relay.
 * Only events in this set produce an outbox row in addition to the audit row.
 */
export const OUTBOX_EVENT_TYPES: ReadonlySet<string> = new Set([
  // Sales
  'sales_order.created',
  'sales_order.status_changed',
  'sales_order.released',
  'sales_order.archived',
  'sales_order.unarchived',
  'sales_order.deleted',
  'sales_invoice.created',
  'sales_invoice.status_changed',
  'sales_invoice.deleted',
  'sales_return.created',
  'sales_return.status_changed',
  'sales_return.processed',

  // Procurement
  'purchase_order.created',
  'purchase_order.status_changed',
  'purchase_order.released',
  'purchase_order.archived',
  'purchase_order.unarchived',
  'purchase_order.deleted',
  'purchase_invoice.created',
  'purchase_invoice.status_changed',
  'purchase_invoice.deleted',
  'purchase_return.created',
  'purchase_return.status_changed',
  'purchase_return.processed',

  // Warehouse
  'shipment.created',
  'shipment.status_changed',
  'shipment.dispatched',
  'goods_receipt.created',
  'goods_receipt.status_changed',
  'goods_receipt.received',
  'transfer_order.created',
  'transfer_order.status_changed',
  'transfer_order.released',
  'transfer_order.deleted',
  'stock_adjustment.processed',

  // Master Data
  'product.created',
  'product.updated',
  'product.deleted',
  'product.archived',
  'product.unarchived',
  'customer.created',
  'customer.updated',
  'customer.archived',
  'customer.unarchived',
  'supplier.created',
  'supplier.updated',
  'supplier.archived',
  'supplier.unarchived',

  // Financials
  'payment.submitted',
  'payment.allocated',
  'payment.cancelled',
  'journal_entry.posted',
]);
