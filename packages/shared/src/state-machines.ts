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
  ordered: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received'],
  received: ['invoiced'],
  invoiced: [],
  cancelled: ['draft'],
  legacy: [],
};

export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ['dispatched', 'cancelled'],
  dispatched: ['draft'],
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
export type ShipmentState = keyof typeof SHIPMENT_TRANSITIONS;
export type ReturnState = keyof typeof RETURN_TRANSITIONS;

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
  cancelled: 0, draft: 1, ordered: 2, partially_received: 3, received: 4, invoiced: 5, legacy: 6,
};

export const SHIPMENT_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, dispatched: 2,
};

export const RETURN_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, confirmed: 2, processed: 3,
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
