import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesInvoices,
  salesInvoiceLines,
  orderEvents,
  outbox,
} from '../drizzle/modbm-core-schema';

// ============================================================================
// Shared query helpers for picking & shipment services
// ============================================================================

/**
 * Sum committed (non-cancelled) shipment quantities per order line.
 * Includes both draft and dispatched shipments so that pick-all and
 * shipment validation never over-allocate.
 */
export async function getCommittedPerLine(
  db: DrizzleDB,
  salesOrderId: string,
): Promise<Map<string, number>> {
  const shipments = await db
    .select()
    .from(salesOrderShipments)
    .where(
      and(
        eq(salesOrderShipments.salesOrderId, salesOrderId),
        sql`${salesOrderShipments.stateCode} != 'cancelled'`,
      ),
    );

  const shippedMap = new Map<string, number>();

  for (const shipment of shipments) {
    const lines = await db
      .select()
      .from(salesOrderShipmentLines)
      .where(eq(salesOrderShipmentLines.shipmentId, shipment.shipmentId));

    for (const line of lines) {
      const current = shippedMap.get(line.salesOrderLineId) ?? 0;
      shippedMap.set(
        line.salesOrderLineId,
        current + parseFloat(line.quantityShipped),
      );
    }
  }

  return shippedMap;
}

/**
 * Sum invoiced quantities per order line.
 */
export async function getInvoicedPerLine(
  db: DrizzleDB,
  salesOrderId: string,
): Promise<Map<string, number>> {
  const priorInvoices = await db
    .select({
      salesOrderLineId: salesInvoiceLines.salesOrderLineId,
      quantityInvoiced: salesInvoiceLines.quantityInvoiced,
    })
    .from(salesInvoiceLines)
    .innerJoin(
      salesInvoices,
      eq(salesInvoiceLines.invoiceId, salesInvoices.invoiceId),
    )
    .where(eq(salesInvoices.salesOrderId, salesOrderId));

  const invoicedQtyByLine = new Map<string, number>();
  for (const invLine of priorInvoices) {
    const current = invoicedQtyByLine.get(invLine.salesOrderLineId) || 0;
    invoicedQtyByLine.set(
      invLine.salesOrderLineId,
      current + parseFloat(invLine.quantityInvoiced),
    );
  }

  return invoicedQtyByLine;
}

/**
 * Assert that a requested shipment quantity is available for a given order line.
 * Available = quantityPicked - alreadyShipped (across all non-cancelled shipments).
 *
 * @param excludeShipmentLineId  When updating an existing shipment line, exclude
 *   its current quantity from the "already shipped" total.
 */
export async function assertShipmentQtyAvailable(
  db: DrizzleDB,
  salesOrderId: string,
  salesOrderLineId: string,
  requestedQty: number,
  lineNumber: number | string,
  excludeShipmentLineId?: string,
): Promise<void> {
  if (isNaN(requestedQty) || requestedQty <= 0) {
    throw new BadRequestException('Shipped quantity must be greater than 0');
  }

  const orderLine = await findOrderLine(db, salesOrderLineId, salesOrderId);
  const picked = parseFloat(orderLine.quantityPicked ?? '0');
  const committedMap = await getCommittedPerLine(db, salesOrderId);
  let alreadyCommitted = committedMap.get(salesOrderLineId) ?? 0;

  // When updating a shipment line, exclude its own quantity (we're replacing it)
  if (excludeShipmentLineId) {
    const existing = await findShipmentLineById(db, excludeShipmentLineId);
    alreadyCommitted -= parseFloat(existing.quantityShipped);
  }

  const available = picked - alreadyCommitted;

  if (requestedQty > available) {
    throw new BadRequestException(
      `Cannot ship ${requestedQty} of line ${lineNumber} — only ${available} available (${picked} picked, ${alreadyCommitted} already committed).`,
    );
  }
}

// ============================================================================
// Audit + outbox
// ============================================================================

/** Event types that have active ERPNext mappers in the outbox-relay worker. */
const OUTBOX_EVENT_TYPES = new Set([
  'goods_received',
  'goods_dispatched',
  'sales_invoiced',
  'purchase_invoiced',
]);

export async function writeEvent(
  tx: any,
  salesOrderId: string,
  eventType: string,
  payload: any,
  actor: string,
  aggregateType: string = 'sales_order',
): Promise<void> {
  // Always write to the entity event table (audit log)
  await tx.insert(orderEvents).values({
    salesOrderId,
    eventType,
    payload,
    actor,
  });

  // Only enqueue to the outbox if the worker has a mapper for this type
  if (OUTBOX_EVENT_TYPES.has(eventType)) {
    await tx.insert(outbox).values({
      aggregateType,
      aggregateId: salesOrderId,
      eventType,
      payload,
    });
  }
}

// ============================================================================
// Entity finders (lookup-or-throw)
// ============================================================================

export async function findOrder(db: DrizzleDB, salesOrderId: string) {
  const rows = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.salesOrderId, salesOrderId))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundException(`Order '${salesOrderId}' not found`);
  }
  return rows[0];
}

export async function findOrderLine(
  db: DrizzleDB,
  lineId: string,
  salesOrderId: string,
) {
  const rows = await db
    .select()
    .from(salesOrderLineItems)
    .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundException(`Order line '${lineId}' not found`);
  }

  if (rows[0].salesOrderId !== salesOrderId) {
    throw new BadRequestException(
      `Order line '${lineId}' does not belong to order '${salesOrderId}'`,
    );
  }

  return rows[0];
}

export async function findShipment(db: DrizzleDB, shipmentId: string) {
  const rows = await db
    .select()
    .from(salesOrderShipments)
    .where(eq(salesOrderShipments.shipmentId, shipmentId))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundException(`Shipment '${shipmentId}' not found`);
  }
  return rows[0];
}

export async function findShipmentLine(
  db: DrizzleDB,
  lineId: string,
  shipmentId: string,
) {
  const rows = await db
    .select()
    .from(salesOrderShipmentLines)
    .where(eq(salesOrderShipmentLines.shipmentLineId, lineId))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundException(`Shipment line '${lineId}' not found`);
  }

  if (rows[0].shipmentId !== shipmentId) {
    throw new BadRequestException(
      `Shipment line '${lineId}' does not belong to shipment '${shipmentId}'`,
    );
  }

  return rows[0];
}

/**
 * Find a shipment line by its own ID (without requiring the shipmentId).
 * Used internally by assertShipmentQtyAvailable for the exclude case.
 */
async function findShipmentLineById(db: DrizzleDB, lineId: string) {
  const rows = await db
    .select()
    .from(salesOrderShipmentLines)
    .where(eq(salesOrderShipmentLines.shipmentLineId, lineId))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundException(`Shipment line '${lineId}' not found`);
  }

  return rows[0];
}
