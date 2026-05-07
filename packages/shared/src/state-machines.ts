/**
 * @module @modbm/shared/state-machines
 *
 * Single source of truth for every entity state machine in the platform.
 * Both the API (NestJS) and the portal UI (Next.js) import from here.
 *
 * Rules:
 *   1. Never duplicate these maps in consumer code.
 *   2. Every `changeState` endpoint MUST validate against its transition map.
 *   3. If a new entity needs states, add its map here first.
 */

// ============================================================================
// Transition maps  (from → allowed next states)
// ============================================================================

export const SALES_ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ['quoted', 'cancelled'],
  quoted: ['confirmed', 'draft', 'cancelled'],
  confirmed: ['picking', 'cancelled'],
  picking: ['shipped', 'confirmed'],
  shipped: ['invoiced'],
  invoiced: [],
  cancelled: ['draft'],
  archived: [],
  legacy: [],
};

export const PURCHASE_ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['partially_received', 'received', 'cancelled', 'closed_short'],
  partially_received: ['received', 'closed_short'],
  received: ['invoiced'],
  invoiced: [],
  cancelled: ['draft'],
  closed_short: [],
  legacy: [],
  archived: [],
};

export const PURCHASE_INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft: ['invoiced', 'cancelled'],
  invoiced: ['partially_paid', 'paid'],
  partially_paid: ['invoiced', 'paid'],
  paid: ['partially_paid', 'invoiced'],
  cancelled: ['draft'],
  legacy: [],
  archived: [],
};

export const SALES_INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft: ['invoiced', 'cancelled'],
  invoiced: ['partially_paid', 'paid'],
  partially_paid: ['invoiced', 'paid'],
  paid: ['partially_paid', 'invoiced'],
  cancelled: ['draft'],
  legacy: [],
  archived: [],
};

export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ['dispatched', 'cancelled'],
  dispatched: ['cancelled'],
  cancelled: [],
};

export const GOODS_RECEIVED_TRANSITIONS: Record<string, string[]> = {
  received: ['cancelled'],
  cancelled: [],
};

export const SALES_ORDER_PICK_TRANSITIONS: Record<string, string[]> = {
  picked: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};

export const RETURN_TRANSITIONS: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['processed', 'draft'],
  processed: [],
  cancelled: [],
};

export type SalesOrderState = keyof typeof SALES_ORDER_TRANSITIONS;
export type PurchaseOrderState = keyof typeof PURCHASE_ORDER_TRANSITIONS;
export type PurchaseInvoiceState = keyof typeof PURCHASE_INVOICE_TRANSITIONS;
export type SalesInvoiceState = keyof typeof SALES_INVOICE_TRANSITIONS;
export type ShipmentState = keyof typeof SHIPMENT_TRANSITIONS;
export type GoodsReceivedState = keyof typeof GOODS_RECEIVED_TRANSITIONS;
export type ReturnState = keyof typeof RETURN_TRANSITIONS;
export type SalesOrderPickState = keyof typeof SALES_ORDER_PICK_TRANSITIONS;

// ============================================================================
// Lifecycle ordinals  (higher = further along the happy path)
//
// Used by the UI to decide whether a transition button is "forward" (primary)
// or "backward" (secondary).  `cancelled` is always ordinal 0.
// ============================================================================

export const SALES_ORDER_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, quoted: 2, confirmed: 3,
  picking: 4, shipped: 5, invoiced: 6, legacy: 7, archived: 8,
};

export const PURCHASE_ORDER_LIFECYCLE: Record<string, number> = {
  cancelled: 0, closed_short: 0, draft: 1, ordered: 2, partially_received: 3, received: 4, invoiced: 5, legacy: 6, archived: 7,
};

export const OPEN_PURCHASE_ORDER_STATES: PurchaseOrderState[] = ['draft', 'ordered', 'partially_received'];


export const PURCHASE_INVOICE_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, invoiced: 2, partially_paid: 3, paid: 4, legacy: 5, archived: 6,
};

export const SALES_INVOICE_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, invoiced: 2, partially_paid: 3, paid: 4, legacy: 5, archived: 6,
};

export const SHIPMENT_LIFECYCLE: Record<string, number> = {
  cancelled: 0, dispatched: 1,
};

export const GOODS_RECEIVED_LIFECYCLE: Record<string, number> = {
  cancelled: 0, received: 1,
};

export const RETURN_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, confirmed: 2, processed: 3,
};

export const SALES_ORDER_PICK_LIFECYCLE: Record<string, number> = {
  cancelled: 0, picked: 1, shipped: 2,
};

// ============================================================================
// Helpers
// ============================================================================

/** Get the allowed next states for a given current state. */
export function getAllowedTransitions(
  map: Record<string, string[]>,
  currentState: string,
): string[] {
  return map[currentState] ?? [];
}

/** Get all valid state names from a transition map. */
export function getValidStates(map: Record<string, string[]>): string[] {
  return Object.keys(map);
}

/**
 * Is the transition a "backward" move on the lifecycle?
 * Used by UI to render ← buttons for demotions and → for promotions.
 * `cancelled` is never treated as a backward transition (it gets its own styling).
 */
export function isBackTransition(
  lifecycle: Record<string, number>,
  from: string,
  to: string,
): boolean {
  return (lifecycle[to] ?? 99) < (lifecycle[from] ?? 99) && to !== 'cancelled';
}

/** Capitalise the first letter of a string. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
