import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
  locations,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  customers as coreAccounts,
  customerGroups,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  actors,
} from '@herobm/db-schema';
import { findOrder, getCommittedPerLine } from './shipment-helpers';
import { getCreditBlockedSql } from './orders.sql';
import {
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_STATE,
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_PICK_STATE,
} from '@herobm/shared';

@Injectable()
export class PickingShippingQueryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Returns a queue of orders pending shipment, enriched with shippability status.
   * Shippability is determined by comparing picked quantities to shipped quantities.
   */
  async getShippingQueue(locationId?: string) {
    const rawLines = await this.db
      .select({
        id: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        name: salesOrders.name,
        customerName: actors.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        stateCode: salesOrders.stateCode,
        createdOn: salesOrders.createdOn,
        createdBy: salesOrders.createdBy,
        currencyCode: salesOrders.currencyCode,
        isCreditBlocked: getCreditBlockedSql(),
        lineId: salesOrderLineItems.salesOrderLineId,
        lineQuantity: salesOrderLineItems.quantity,
        isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' OR ${coreProducts.productType} IS NULL THEN true ELSE false END`,
        pickedQty: sql<number>`COALESCE((
          SELECT SUM(quantity)
          FROM herobm_core.sales_order_picks
          WHERE sales_order_line_id = ${salesOrderLineItems.salesOrderLineId}
            AND state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
        shippedQty: sql<number>`COALESCE((
          SELECT SUM(sl.quantity_shipped)
          FROM herobm_core.sales_order_shipment_lines sl
          JOIN herobm_core.sales_order_shipments s ON s.shipment_id = sl.shipment_id
          WHERE sl.sales_order_line_id = ${salesOrderLineItems.salesOrderLineId}
             AND s.state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
      })
      .from(salesOrders)
      .innerJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(
        and(
          eq(salesOrders.stateCode, SALES_ORDER_STATE.PICKING),
          locationId
            ? eq(salesOrderLineItems.fulfillmentLocationId, locationId)
            : undefined,
        ),
      )
      .orderBy(salesOrders.createdOn);

    const rawTransferLines = await this.db
      .select({
        id: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        name: sql<string | null>`NULL`,
        customerName: locations.name,
        customerOrderNumber: sql<string | null>`NULL`,
        stateCode: transferOrders.stateCode,
        createdOn: transferOrders.createdOn,
        createdBy: transferOrders.createdBy,
        currencyCode: sql<string | null>`NULL`,
        isCreditBlocked: sql<boolean>`false`,
        lineId: transferOrderLines.transferOrderLineId,
        lineQuantity: transferOrderLines.quantity,
        isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' OR ${coreProducts.productType} IS NULL THEN true ELSE false END`,
        pickedQty: sql<number>`COALESCE((
          SELECT SUM(quantity)
          FROM herobm_core.transfer_order_picks
          WHERE transfer_order_line_id = ${transferOrderLines.transferOrderLineId}
            AND state_code != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
        shippedQty: sql<number>`COALESCE((
          SELECT SUM(sl.quantity)
          FROM herobm_core.transfer_order_shipment_lines sl
          JOIN herobm_core.transfer_order_shipments s ON s.shipment_id = sl.shipment_id
          WHERE sl.transfer_order_line_id = ${transferOrderLines.transferOrderLineId}
             AND s.state_code != 'cancelled'
        ), 0)`,
      })
      .from(transferOrders)
      .innerJoin(
        transferOrderLines,
        eq(transferOrders.transferOrderId, transferOrderLines.transferOrderId),
      )
      .leftJoin(
        locations,
        eq(transferOrders.destinationLocationId, locations.locationId),
      )
      .leftJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(
        and(
          eq(transferOrders.stateCode, TRANSFER_ORDER_STATE.PICKING),
          locationId
            ? eq(transferOrders.sourceLocationId, locationId)
            : undefined,
        ),
      )
      .orderBy(transferOrders.createdOn);

    const allLines = [
      ...rawLines.map((r) => ({ ...r, type: 'sales_order' })),
      ...rawTransferLines.map((r) => ({ ...r, type: 'transfer_order' })),
    ];

    const orderMap = new Map<
      string,
      Record<string, unknown> & {
        id: string;
        orderNumber: string;
        name: string | null;
        customerName: string | null;
        customerOrderNumber: string | null;
        stateCode: string;
        createdOn: Date | null;
        createdBy: string | null;
        currencyCode: string | null;
        type: string;
        _totalPhysicalLines?: number;
        _fullyPickedLines?: number;
        _shippableLines?: number;
      }
    >();

    for (const row of allLines) {
      if (!orderMap.has(row.id)) {
        orderMap.set(row.id, {
          id: row.id,
          orderNumber: row.orderNumber,
          name: row.name,
          customerName: row.customerName,
          customerOrderNumber: row.customerOrderNumber,
          // eslint-disable-next-line no-restricted-syntax -- State initialization on map object result.
          stateCode: row.stateCode,
          createdOn: row.createdOn,
          createdBy: row.createdBy,
          currencyCode: row.currencyCode,
          type: row.type,
          _totalPhysicalLines: 0,
          _fullyPickedLines: 0,
          _shippableLines: 0,
        });
      }

      const order = orderMap.get(row.id);
      if (!order) continue;

      const ordered = parseFloat(row.lineQuantity ?? '0');
      if (row.isPhysical && ordered > 0) {
        order._totalPhysicalLines = (order._totalPhysicalLines || 0) + 1;
        const picked = parseFloat(row.pickedQty?.toString() ?? '0');
        const shipped = parseFloat(row.shippedQty?.toString() ?? '0');
        const availableToShip = picked - shipped;

        if (picked >= ordered) {
          order._fullyPickedLines = (order._fullyPickedLines || 0) + 1;
        }

        if (availableToShip > 0) {
          order._shippableLines = (order._shippableLines || 0) + 1;
        }
      }
    }

    const queue = Array.from(orderMap.values())
      .filter((order) => (order._shippableLines || 0) > 0)
      .map((order) => {
        let shippabilityStatus: 'ready' | 'partial';

        if (
          (order._totalPhysicalLines || 0) > 0 &&
          order._fullyPickedLines === order._totalPhysicalLines
        ) {
          shippabilityStatus = 'ready';
        } else {
          shippabilityStatus = 'partial';
        }

        const totalShippableLines = order._shippableLines || 0;
        const totalLines = order._totalPhysicalLines || 0;
        delete order._totalPhysicalLines;
        delete order._fullyPickedLines;
        delete order._shippableLines;

        return {
          ...order,
          shippabilityStatus,
          totalShippableLines,
          totalLines,
        };
      });

    return queue;
  }

  /**
   * Returns shipping context for an order: lines enriched with picked/shipped
   * quantities and available-to-ship amounts, plus existing shipment summaries.
   */
  async getShippingContext(orderId: string) {
    const [transferOrder] = await this.db
      .select()
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, orderId));
    if (transferOrder) {
      return this.getTransferShippingContext(orderId, transferOrder);
    }

    const order = await findOrder(this.db, orderId);

    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
        productId: salesOrderLineItems.productId,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    const lineIds = lines.map((l) => l.salesOrderLineId);
    const pickedMap = new Map<string, number>();
    if (lineIds.length > 0) {
      const pickSums = await this.db
        .select({
          salesOrderLineId: salesOrderPicks.salesOrderLineId,
          totalPicked:
            sql<number>`COALESCE(SUM(${salesOrderPicks.quantity}), 0)`.mapWith(
              Number,
            ),
        })
        .from(salesOrderPicks)
        .where(
          and(
            inArray(salesOrderPicks.salesOrderLineId, lineIds),
            sql`${salesOrderPicks.stateCode} != ${SALES_ORDER_PICK_STATE.CANCELLED}`,
          ),
        )
        .groupBy(salesOrderPicks.salesOrderLineId);

      for (const row of pickSums) {
        pickedMap.set(
          row.salesOrderLineId,
          parseFloat(String(row.totalPicked)),
        );
      }
    }

    const committedMap = await getCommittedPerLine(this.db, orderId);

    const enrichedLines = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const isPhysical = !line.productType || line.productType === 'inventory';
      const picked = isPhysical
        ? (pickedMap.get(line.salesOrderLineId) ?? 0)
        : ordered;
      const shipped = committedMap.get(line.salesOrderLineId) ?? 0;
      const availableToShip = Math.max(0, picked - shipped);

      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productDescription: line.productDescription,
        isPhysical,
        quantity: line.quantity,
        quantityPicked: String(picked),
        quantityShipped: String(shipped),
        availableToShip: String(availableToShip),
      };
    });

    const shipments = await this.db
      .select({
        shipmentId: salesOrderShipments.shipmentId,
        shipmentNumber: salesOrderShipments.shipmentNumber,
        stateCode: salesOrderShipments.stateCode,
        notes: salesOrderShipments.notes,
        trackingNumber: salesOrderShipments.trackingNumber,
        createdOn: salesOrderShipments.createdOn,
      })
      .from(salesOrderShipments)
      .where(
        and(
          eq(salesOrderShipments.salesOrderId, orderId),
          sql`${salesOrderShipments.stateCode} != ${SALES_ORDER_STATE.CANCELLED}`,
        ),
      )
      .orderBy(desc(salesOrderShipments.createdOn));

    const shipmentIds = shipments.map((s) => s.shipmentId);
    const lineCountMap = new Map<string, number>();
    if (shipmentIds.length > 0) {
      const lineCounts = await this.db
        .select({
          shipmentId: salesOrderShipmentLines.shipmentId,
          lineCount: sql<number>`COUNT(*)`,
        })
        .from(salesOrderShipmentLines)
        .where(inArray(salesOrderShipmentLines.shipmentId, shipmentIds))
        .groupBy(salesOrderShipmentLines.shipmentId);

      for (const row of lineCounts) {
        lineCountMap.set(row.shipmentId, Number(row.lineCount));
      }
    }

    return {
      order,
      lines: enrichedLines,
      shipments: shipments.map((s) => ({
        ...s,
        lineCount: lineCountMap.get(s.shipmentId) ?? 0,
      })),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for legacy code
  private async getTransferShippingContext(orderId: string, order: any) {
    const lines = await this.db
      .select({
        salesOrderLineId: transferOrderLines.transferOrderLineId,
        lineNumber: sql<number>`0`,
        productId: transferOrderLines.productId,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
      })
      .from(transferOrderLines)
      .leftJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(eq(transferOrderLines.transferOrderId, orderId));

    const pickedMap = new Map<string, number>();
    const picks = await this.db
      .select({
        lineId: transferOrderPicks.transferOrderLineId,
        totalPicked:
          sql<number>`COALESCE(SUM(${transferOrderPicks.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transferOrderPicks)
      .where(
        and(
          eq(transferOrderPicks.transferOrderId, orderId),
          sql`${transferOrderPicks.stateCode} != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}`,
        ),
      )
      .groupBy(transferOrderPicks.transferOrderLineId);

    for (const p of picks) {
      pickedMap.set(p.lineId, p.totalPicked);
    }

    const shippedMap = new Map<string, number>();
    const shipmentsLines = await this.db
      .select({
        lineId: transferOrderShipmentLines.transferOrderLineId,
        totalShipped:
          sql<number>`COALESCE(SUM(${transferOrderShipmentLines.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transferOrderShipmentLines)
      .innerJoin(
        transferOrderShipments,
        eq(
          transferOrderShipmentLines.shipmentId,
          transferOrderShipments.shipmentId,
        ),
      )
      .where(
        and(
          eq(transferOrderShipments.transferOrderId, orderId),
          sql`${transferOrderShipments.stateCode} != 'cancelled'`,
        ),
      )
      .groupBy(transferOrderShipmentLines.transferOrderLineId);

    for (const s of shipmentsLines) {
      shippedMap.set(s.lineId, s.totalShipped);
    }

    const enrichedLines = lines.map((line) => {
      const isPhysical = true;
      const picked = pickedMap.get(line.salesOrderLineId) ?? 0;
      const shipped = shippedMap.get(line.salesOrderLineId) ?? 0;
      const availableToShip = Math.max(0, picked - shipped);

      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productDescription: line.productDescription || '',
        isPhysical,
        quantity: line.quantity,
        quantityPicked: String(picked),
        quantityShipped: String(shipped),
        availableToShip: String(availableToShip),
      };
    });

    const shipments = await this.db
      .select({
        shipmentId: transferOrderShipments.shipmentId,
        shipmentNumber: transferOrderShipments.shipmentNumber,
        stateCode: transferOrderShipments.stateCode,
        notes: sql<string>`''`,
        trackingNumber: sql<string>`''`,
        createdOn: transferOrderShipments.createdOn,
      })
      .from(transferOrderShipments)
      .where(
        and(
          eq(transferOrderShipments.transferOrderId, orderId),
          sql`${transferOrderShipments.stateCode} != 'cancelled'`,
        ),
      )
      .orderBy(desc(transferOrderShipments.createdOn));

    const shipmentIds = shipments.map((s) => s.shipmentId);
    const lineCountMap = new Map<string, number>();
    if (shipmentIds.length > 0) {
      const lineCounts = await this.db
        .select({
          shipmentId: transferOrderShipmentLines.shipmentId,
          lineCount: sql<number>`COUNT(*)`,
        })
        .from(transferOrderShipmentLines)
        .where(inArray(transferOrderShipmentLines.shipmentId, shipmentIds))
        .groupBy(transferOrderShipmentLines.shipmentId);

      for (const row of lineCounts) {
        lineCountMap.set(row.shipmentId, Number(row.lineCount));
      }
    }

    const destLocation = await this.db.query.locations.findFirst({
      where: eq(locations.locationId, order.destinationLocationId as string),
    });

    return {
      order: {
        id: order.transferOrderId,
        orderNumber: order.orderNumber,
        name: 'Internal Transfer',
        type: 'transfer_order',
        deliveryAddressLine1: destLocation?.name ?? 'Unknown Location',
        shippingNotes: order.shippingNotes ?? null,
      },
      lines: enrichedLines,
      shipments: shipments.map((s) => ({
        ...s,
        lineCount: lineCountMap.get(s.shipmentId) ?? 0,
      })),
    };
  }
}
