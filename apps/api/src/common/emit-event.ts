// ---------------------------------------------------------------------------
// Shared Event Emitter — the ONLY code path that writes to audit + outbox
// ---------------------------------------------------------------------------

import type { EntityTypeValue } from './event-types';
import { OUTBOX_EVENT_TYPES, EntityType, EventType } from './event-types';
import {
  salesEvents,
  procurementEvents,
  warehouseEvents,
  masterDataEvents,
  financialEvents,
  inventoryEvents,
  systemEvents,
  userEvents,
  reconciliationEvents,
  groupEvents,
  outbox,
  salesOrders,
  purchaseOrders,
  customers,
  suppliers,
  products,
  goodsReceived,
  transferOrders,
  paymentEntries,
  inventoryEntries,
  emailEvents,
  businessReportEvents,
  integrationEvents,
} from '../drizzle/herobm-core-schema';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Routing table: entityType → table
// All domain event tables now share the same schema: entityType, entityId.
// ---------------------------------------------------------------------------
const EVENT_TABLE_MAP: Record<string, unknown> = {
  [EntityType.SALES_ORDER]: salesEvents,
  [EntityType.SALES_INVOICE]: salesEvents,
  [EntityType.SALES_RETURN]: salesEvents,
  [EntityType.PURCHASE_ORDER]: procurementEvents,
  [EntityType.PURCHASE_INVOICE]: procurementEvents,
  [EntityType.PURCHASE_RETURN]: procurementEvents,
  [EntityType.PRODUCT]: masterDataEvents,
  [EntityType.CUSTOMER]: masterDataEvents,
  [EntityType.SUPPLIER]: masterDataEvents,
  [EntityType.PRODUCT_SUPPLIER]: masterDataEvents,
  [EntityType.SHIPMENT]: warehouseEvents,
  [EntityType.TRANSFER_ORDER]: warehouseEvents,
  [EntityType.WAREHOUSE]: warehouseEvents,
  [EntityType.PAYMENT]: financialEvents,
  [EntityType.SYSTEM]: systemEvents, // or financialEvents if GL_POSTED, see domain mapping
  [EntityType.INVENTORY_LEDGER]: inventoryEvents,
  [EntityType.EMAIL]: emailEvents,
  [EntityType.BUSINESS_REPORT]: businessReportEvents,
  [EntityType.INTEGRATION]: integrationEvents,

  // Configuration / Auxiliary Mappings
  [EntityType.USER]: userEvents,
  [EntityType.API_KEY]: systemEvents,
  [EntityType.WEBHOOK]: systemEvents,
  [EntityType.APP_SETTINGS]: systemEvents,
  [EntityType.GL_SETTINGS]: systemEvents,
  [EntityType.MACRO]: systemEvents,

  [EntityType.RECONCILIATION_RULE]: reconciliationEvents,
  [EntityType.BANK_STATEMENT_LINE]: reconciliationEvents,
  [EntityType.GL_MATCH_GROUP]: reconciliationEvents,
  [EntityType.GL_RECONCILIATION]: reconciliationEvents,
  [EntityType.CSV_MAPPING_PROFILE]: financialEvents,

  [EntityType.PRODUCT_GROUP]: groupEvents,
  [EntityType.CUSTOMER_GROUP]: groupEvents,
  [EntityType.SUPPLIER_GROUP]: groupEvents,

  [EntityType.TAX_CATEGORY]: financialEvents,
  [EntityType.TAX_POSITION]: financialEvents,
  [EntityType.TAX_POSITION_MAPPING]: financialEvents,
  [EntityType.EXCHANGE_RATE]: financialEvents,
  [EntityType.COST_CENTER]: financialEvents,
  [EntityType.ACTIVITY]: financialEvents,
  [EntityType.GL_ACCOUNT]: financialEvents,

  [EntityType.LOCATION]: warehouseEvents,
  [EntityType.ZONE]: warehouseEvents,
  [EntityType.BIN]: warehouseEvents,
};

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EmitEventParams {
  entityType: EntityTypeValue;
  entityId: string;
  eventType: string;
  entityDisplayName: string;
  payload: unknown;
  actor?: string;
}

/**
 * Write an audit event to the correct domain table (or system_events)
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
  tx: {
    insert: (table: unknown) => {
      values: (payload: unknown) => Promise<unknown>;
    };
  },
  params: EmitEventParams,
): Promise<void> {
  let targetTable = EVENT_TABLE_MAP[params.entityType];

  if (!targetTable) {
    throw new Error(
      `emitEvent: unknown entityType '${params.entityType}'. ` +
        `Valid types: ${Object.keys(EVENT_TABLE_MAP).join(', ')}`,
    );
  }

  // Domain mappings for Webhooks Outbox & Event table routing
  let finalEventForOutbox = `${params.entityType}.${params.eventType}`;

  if (
    params.entityType === EntityType.SYSTEM &&
    params.eventType === EventType.GL_POSTED
  ) {
    finalEventForOutbox = 'general_ledger.entry_posted';
    targetTable = financialEvents;
  } else if (params.entityType === EntityType.SHIPMENT) {
    if (params.eventType === EventType.STOCK_DISPATCHED) {
      finalEventForOutbox = 'warehouse.shipment_dispatched';
    } else if (params.eventType === EventType.CREATED) {
      finalEventForOutbox = 'warehouse.shipment_created';
    } else if (params.eventType === EventType.STATUS_CHANGED) {
      finalEventForOutbox = 'warehouse.shipment_status_changed';
    }
  } else if (params.entityType === EntityType.WAREHOUSE) {
    finalEventForOutbox = `warehouse.${params.eventType}`;
  }

  // 1. Write to the domain audit table
  const insertPayload: Record<string, unknown> = {
    eventType: params.eventType,
    entityDisplayName: params.entityDisplayName,
    payload: params.payload,
    actor: params.actor,
    createdOn: sql`clock_timestamp()`,
  };

  if (targetTable === userEvents) {
    insertPayload.userId = params.entityId;
  } else {
    insertPayload.entityType = params.entityType;
    insertPayload.entityId = params.entityId;
  }

  await tx.insert(targetTable).values(insertPayload);

  // 2. Conditionally enqueue for integration relay
  if (OUTBOX_EVENT_TYPES.has(finalEventForOutbox)) {
    const outboxEntityType = finalEventForOutbox.includes('.')
      ? finalEventForOutbox.split('.')[0]
      : params.entityType;

    await tx.insert(outbox).values({
      entityType: outboxEntityType,
      entityId: params.entityId,
      eventType: finalEventForOutbox,
      entityDisplayName: params.entityDisplayName,
      payload: params.payload,
    });
  }
}
