// ---------------------------------------------------------------------------
// Event Type Registry — Single source of truth for all event type strings
// ---------------------------------------------------------------------------

/**
 * Aggregate types map to specific per-entity event tables.
 * 'system' routes to the system_events table for cross-cutting concerns.
 */
export const AggregateType = {
  SALES_ORDER: 'sales_order',
  PURCHASE_ORDER: 'purchase_order',
  PRODUCT: 'product',
  ACCOUNT: 'account',
  SUPPLIER: 'supplier',
  PRODUCT_SUPPLIER: 'product_supplier',
  SYSTEM: 'system',
} as const;

export type AggregateTypeValue =
  (typeof AggregateType)[keyof typeof AggregateType];

/**
 * All known event types across the platform.
 * Grouped by domain for readability.
 */
export const EventType = {
  // ── Lifecycle (shared across entities) ──────────────────────────────
  CREATED: 'created',
  UPDATED: 'updated',
  STATUS_CHANGED: 'status_changed',
  ARCHIVED: 'archived',
  UNARCHIVED: 'unarchived',

  // ── Line operations ─────────────────────────────────────────────────
  LINE_ADDED: 'line_added',
  LINE_UPDATED: 'line_updated',
  LINE_REMOVED: 'line_removed',
  POST_CONFIRMATION_LINE_ADDED: 'post_confirmation_line_added',

  // ── Sales domain ────────────────────────────────────────────────────
  SALES_INVOICED: 'sales_invoiced',
  GOODS_DISPATCHED: 'goods_dispatched',
  GOODS_DISPATCH_REVERTED: 'goods_dispatch_reverted',
  BACKORDERS_ALLOCATED: 'backorders_allocated',
  CREDIT_NOTE_POSTED: 'credit_note_posted',

  // ── Procurement domain ──────────────────────────────────────────────
  PURCHASE_INVOICED: 'purchase_invoiced',
  GOODS_RECEIVED: 'goods_received',
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
  INVENTORY_ENTRY_CREATED: 'INVENTORY_ENTRY_CREATED',
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

/**
 * Outbox gating: which event types should be enqueued for integration relay.
 * Only events in this set produce an outbox row in addition to the audit row.
 */
export const OUTBOX_EVENT_TYPES: ReadonlySet<string> = new Set([
  EventType.GOODS_RECEIVED,
  EventType.GOODS_DISPATCHED,
  EventType.SALES_INVOICED,
  EventType.PURCHASE_INVOICED,
  EventType.GL_POSTED,
  EventType.INVENTORY_ENTRY_CREATED,
  EventType.CREDIT_NOTE_POSTED,
]);
