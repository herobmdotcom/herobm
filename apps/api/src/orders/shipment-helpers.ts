import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SHIPMENT_STATE, SALES_ORDER_PICK_STATE } from '@herobm/shared';
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
  salesOrderPicks,
  products,
} from '@herobm/db-schema';

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
  const [shipmentRows, counterPickRows] = await Promise.all([
    db
      .select({
        salesOrderLineId: salesOrderShipmentLines.salesOrderLineId,
        quantityShipped:
          sql<number>`COALESCE(SUM(${salesOrderShipmentLines.quantityShipped}), 0)`.mapWith(
            Number,
          ),
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        salesOrderShipments,
        eq(salesOrderShipmentLines.shipmentId, salesOrderShipments.shipmentId),
      )
      .where(
        and(
          eq(salesOrderShipments.salesOrderId, salesOrderId),
          sql`${salesOrderShipments.stateCode} != ${SHIPMENT_STATE.CANCELLED}`,
        ),
      )
      .groupBy(salesOrderShipmentLines.salesOrderLineId),
    db
      .select({
        salesOrderLineId: salesOrderPicks.salesOrderLineId,
        quantityShipped:
          sql<number>`COALESCE(SUM(${salesOrderPicks.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(salesOrderPicks)
      .where(
        and(
          eq(salesOrderPicks.salesOrderId, salesOrderId),
          eq(salesOrderPicks.stateCode, SALES_ORDER_PICK_STATE.SHIPPED),
        ),
      )
      .groupBy(salesOrderPicks.salesOrderLineId),
  ]);

  const shippedMap = new Map<string, number>();
  for (const row of shipmentRows) {
    shippedMap.set(row.salesOrderLineId, row.quantityShipped);
  }
  for (const row of counterPickRows) {
    const fromShipments = shippedMap.get(row.salesOrderLineId) || 0;
    if (row.quantityShipped > fromShipments) {
      shippedMap.set(row.salesOrderLineId, row.quantityShipped);
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

import { validateShipmentQuantity } from './shipment-math.utils';

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
  const orderLine = await findOrderLine(db, salesOrderLineId, salesOrderId);

  // Check product type for inventory vs non-stock/custom line
  const [productRow] = orderLine.productId
    ? await db
        .select({ productType: products.productType })
        .from(products)
        .where(eq(products.productId, orderLine.productId))
        .limit(1)
    : [undefined];

  const isStocked =
    Boolean(orderLine.productId) &&
    (!productRow?.productType || productRow.productType === 'inventory');

  let picked: number;
  if (isStocked) {
    // Derive picked qty from the sub-ledger (replaces legacy quantityPicked column)
    const [pickSum] = await db
      .select({ sum: sql<number>`COALESCE(SUM(quantity), 0)`.mapWith(Number) })
      .from(salesOrderPicks)
      .where(
        and(
          eq(salesOrderPicks.salesOrderLineId, salesOrderLineId),
          sql`state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}`,
        ),
      );
    picked = parseFloat(String(pickSum?.sum ?? 0));
  } else {
    // Non-stock / custom line: does not require physical bin picking — treat ordered quantity as available
    picked = parseFloat(orderLine.quantity);
  }

  const committedMap = await getCommittedPerLine(db, salesOrderId);
  let alreadyCommitted = committedMap.get(salesOrderLineId) ?? 0;

  // When updating a shipment line, exclude its own quantity (we're replacing it)
  if (excludeShipmentLineId) {
    const existing = await findShipmentLineById(db, excludeShipmentLineId);
    alreadyCommitted -= parseFloat(existing.quantityShipped);
  }

  validateShipmentQuantity(requestedQty, picked, alreadyCommitted, lineNumber);
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
