// ---------------------------------------------------------------------------
// Shared Event Emitter — the ONLY code path that writes to audit + outbox
// ---------------------------------------------------------------------------

import type { AggregateTypeValue } from './event-types';
import { OUTBOX_EVENT_TYPES } from './event-types';
import {
  orderEvents,
  purchaseOrderEvents,
  productEvents,
  accountEvents,
  supplierEvents,
  productSupplierEvents,
  systemEvents,
  shipmentEvents,
  paymentEvents,
  transferOrderEvents,
  outbox,
} from '../drizzle/modbm-core-schema';

// ---------------------------------------------------------------------------
// Routing table: aggregateType → { table, fkField }
// For entity tables, fkField is the foreign key column name.
// For system events, fkField is null (uses aggregateType/aggregateId columns).
// ---------------------------------------------------------------------------
const EVENT_TABLE_MAP: Record<string, { table: any; fkField: string | null }> =
  {
    sales_order: { table: orderEvents, fkField: 'salesOrderId' },
    purchase_order: { table: purchaseOrderEvents, fkField: 'purchaseOrderId' },
    product: { table: productEvents, fkField: 'productId' },
    account: { table: accountEvents, fkField: 'accountId' },
    supplier: { table: supplierEvents, fkField: 'vendorId' },
    product_supplier: {
      table: productSupplierEvents,
      fkField: 'productSupplierId',
    },
    shipment: { table: shipmentEvents, fkField: 'shipmentId' },
    payment: { table: paymentEvents, fkField: 'paymentId' },
    goods_receipt: { table: systemEvents, fkField: null },
    sales_invoice: { table: systemEvents, fkField: null },
    purchase_invoice: { table: systemEvents, fkField: null },
    transfer_order: {
      table: transferOrderEvents,
      fkField: 'transferOrderId',
    },
    system: { table: systemEvents, fkField: null },
  };

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EmitEventParams {
  aggregateType: AggregateTypeValue;
  aggregateId: string;
  eventType: string;
  payload: any;
  actor?: string;
}

/**
 * Write an audit event to the correct per-entity table (or system_events)
 * and conditionally enqueue an outbox row for integration relay.
 *
 * MUST be called inside a transaction (`tx`). If the insert fails,
 * the error propagates and the caller's transaction rolls back.
 * This function intentionally does NOT catch errors — silent failure
 * of audit logging is unacceptable.
 *
 * This is the ONLY function that should write to the outbox table.
 */
export async function emitEvent(
  tx: any,
  params: EmitEventParams,
): Promise<void> {
  const route = EVENT_TABLE_MAP[params.aggregateType];
  if (!route) {
    throw new Error(
      `emitEvent: unknown aggregateType '${params.aggregateType}'. ` +
        `Valid types: ${Object.keys(EVENT_TABLE_MAP).join(', ')}`,
    );
  }

  // 1. Write to the entity audit table (or system_events)
  if (route.fkField === null) {
    // System events: use aggregateType + aggregateId columns
    await tx.insert(route.table).values({
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payload: params.payload,
      actor: params.actor,
    });
  } else {
    // Entity events: use the FK field
    await tx.insert(route.table).values({
      [route.fkField]: params.aggregateId,
      eventType: params.eventType,
      payload: params.payload,
      actor: params.actor,
    });
  }

  // 2. Conditionally enqueue for integration relay
  if (OUTBOX_EVENT_TYPES.has(params.eventType)) {
    await tx.insert(outbox).values({
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payload: params.payload,
    });
  }
}
