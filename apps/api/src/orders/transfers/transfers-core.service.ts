import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  transferOrders,
  transferOrderLines,
  transferOrderShipments,
  transferOrderShipmentLines,
  warehouseEvents,
  locations,
  products as coreProducts,
} from '@herobm/db-schema';
import { eq, and, inArray, sql, desc, or, ilike, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../../common/pagination';
import { TransferPaginationQuery } from './dto';
import { EntityType } from '../../common/event-types';
import { transferOrderReceipts } from '@herobm/db-schema';

@Injectable()
export class TransfersCoreService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async generateTransferNumber(tx: DrizzleDB): Promise<string> {
    const prefix = `TO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
    const lastOrder = await tx
      .select({ orderNumber: transferOrders.orderNumber })
      .from(transferOrders)
      .where(sql`${transferOrders.orderNumber} LIKE ${prefix + '%'}`)
      .orderBy(desc(transferOrders.orderNumber))
      .limit(1);

    let nextNum = 1;
    if (lastOrder.length > 0) {
      const parts = lastOrder[0].orderNumber.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async generateShipmentNumber(tx: DrizzleDB): Promise<string> {
    const shipmentPrefix = `TSH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
    const lastShipment = await tx
      .select({ shipmentNumber: transferOrderShipments.shipmentNumber })
      .from(transferOrderShipments)
      .where(
        sql`${transferOrderShipments.shipmentNumber} LIKE ${shipmentPrefix + '%'}`,
      )
      .orderBy(desc(transferOrderShipments.shipmentNumber))
      .limit(1);

    let nextNum = 1;
    if (lastShipment.length > 0) {
      const parts = lastShipment[0].shipmentNumber.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    return `${shipmentPrefix}${String(nextNum).padStart(3, '0')}`;
  }

  async generateReceiptNumber(tx: DrizzleDB): Promise<string> {
    const receiptPrefix = `TRC-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
    const lastReceipt = await tx
      .select({ receiptNumber: transferOrderReceipts.receiptNumber })
      .from(transferOrderReceipts)
      .where(
        sql`${transferOrderReceipts.receiptNumber} LIKE ${receiptPrefix + '%'}`,
      )
      .orderBy(desc(transferOrderReceipts.receiptNumber))
      .limit(1);

    let nextNum = 1;
    if (lastReceipt.length > 0) {
      const parts = lastReceipt[0].receiptNumber.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    return `${receiptPrefix}${String(nextNum).padStart(3, '0')}`;
  }

  async findAll(query?: TransferPaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, states } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${transferOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${transferOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${transferOrders.notes} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${transferOrders.notes} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(transferOrders.orderNumber, `%${rawSearchTerm}%`),
          ilike(transferOrders.notes, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (states && states.length > 0) {
      if (states.length === 1) {
        conditions.push(eq(transferOrders.stateCode, states[0]));
      } else {
        conditions.push(inArray(transferOrders.stateCode, states));
      }
    }

    if (query?.destinationLocationId) {
      conditions.push(
        eq(transferOrders.destinationLocationId, query.destinationLocationId),
      );
    }

    const destLoc = alias(locations, 'destLoc');
    const sourceLoc = alias(locations, 'sourceLoc');

    let qb = this.db
      .select({
        id: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        stateCode: transferOrders.stateCode,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        destinationLocationId: transferOrders.destinationLocationId,
        destinationLocationName: destLoc.name,
        createdBy: transferOrders.createdBy,
        createdOn: transferOrders.createdOn,
        notes: transferOrders.notes,
        shippingNotes: transferOrders.shippingNotes,
        score: scoreSql,
      })
      .from(transferOrders)
      .leftJoin(
        sourceLoc,
        eq(transferOrders.sourceLocationId, sourceLoc.locationId),
      )
      .leftJoin(
        destLoc,
        eq(transferOrders.destinationLocationId, destLoc.locationId),
      )
      .$dynamic();

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        id: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const cDate = c.createdOn;
        if (dir === 'next') {
          const cursorCond = or(
            sql`${scoreSql} < ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`${transferOrders.createdOn} < ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              eq(transferOrders.createdOn, sql`${cDate}::timestamp`),
              sql`${transferOrders.transferOrderId} < ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        } else {
          const cursorCond = or(
            sql`${scoreSql} > ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`${transferOrders.createdOn} > ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              eq(transferOrders.createdOn, sql`${cDate}::timestamp`),
              sql`${transferOrders.transferOrderId} > ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        }
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        return q.orderBy(
          orderFn(scoreSql),
          orderFn(transferOrders.createdOn),
          orderFn(transferOrders.transferOrderId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: (row.createdOn || new Date()).toISOString(),
        id: row.id,
      }),
    });

    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(transferOrders)
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count }] = await countQb;

    return { data, page, limit, total: Number(count), nextCursor, prevCursor };
  }

  async findShipments(transferOrderId: string) {
    const data = await this.db
      .select({
        shipmentId: transferOrderShipments.shipmentId,
        shipmentNumber: transferOrderShipments.shipmentNumber,
        stateCode: transferOrderShipments.stateCode,
        notes: sql<string | null>`NULL`,
        trackingNumber: transferOrderShipments.trackingNumber,
        createdOn: transferOrderShipments.createdOn,
        createdBy: transferOrderShipments.shippedBy,
      })
      .from(transferOrderShipments)
      .where(eq(transferOrderShipments.transferOrderId, transferOrderId))
      .orderBy(desc(transferOrderShipments.createdOn));

    if (data.length === 0) return [];

    const shipmentIds = data.map((s) => s.shipmentId);

    const linesData = await this.db
      .select({
        shipmentLineId: transferOrderShipmentLines.shipmentLineId,
        shipmentId: transferOrderShipmentLines.shipmentId,
        salesOrderLineId: transferOrderShipmentLines.transferOrderLineId,
        quantityShipped: transferOrderShipmentLines.quantity,
      })
      .from(transferOrderShipmentLines)
      .where(
        sql`${transferOrderShipmentLines.shipmentId} IN (${sql.join(
          shipmentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const linesMap = new Map<string, typeof linesData>();
    for (const line of linesData) {
      if (!linesMap.has(line.shipmentId)) linesMap.set(line.shipmentId, []);
      linesMap.get(line.shipmentId)!.push(line);
    }

    return data.map((s) => ({
      ...s,
      lines: linesMap.get(s.shipmentId) || [],
    }));
  }

  async findOne(id: string) {
    const destLoc = alias(locations, 'destLoc');
    const sourceLoc = alias(locations, 'sourceLoc');

    const [order] = await this.db
      .select({
        id: transferOrders.transferOrderId,
        transferOrderId: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        stateCode: transferOrders.stateCode,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        destinationLocationId: transferOrders.destinationLocationId,
        destinationLocationName: destLoc.name,
        createdBy: transferOrders.createdBy,
        createdOn: transferOrders.createdOn,
        notes: transferOrders.notes,
        shippingNotes: transferOrders.shippingNotes,
      })
      .from(transferOrders)
      .leftJoin(
        sourceLoc,
        eq(transferOrders.sourceLocationId, sourceLoc.locationId),
      )
      .leftJoin(
        destLoc,
        eq(transferOrders.destinationLocationId, destLoc.locationId),
      )
      .where(eq(transferOrders.transferOrderId, id));

    if (!order) {
      throw new NotFoundException('Transfer Order not found');
    }

    const lines = await this.db
      .select({
        id: transferOrderLines.transferOrderLineId,
        transferOrderLineId: transferOrderLines.transferOrderLineId,
        productId: transferOrderLines.productId,
        productNumber: coreProducts.productNumber,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
        quantityShipped: transferOrderLines.quantityShipped,
        quantityReceived: transferOrderLines.quantityReceived,
      })
      .from(transferOrderLines)
      .innerJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(eq(transferOrderLines.transferOrderId, id));

    const events = await this.db
      .select({
        eventId: warehouseEvents.eventId,
        eventType: warehouseEvents.eventType,
        payload: warehouseEvents.payload,
        actor: warehouseEvents.actor,
        createdOn: warehouseEvents.createdOn,
      })
      .from(warehouseEvents)
      .where(
        and(
          eq(warehouseEvents.entityType, EntityType.TRANSFER_ORDER),
          eq(warehouseEvents.entityId, id),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return { ...order, lines, events };
  }

  async findEvents(transferOrderId: string) {
    const events = await this.db
      .select({
        eventId: warehouseEvents.eventId,
        eventType: warehouseEvents.eventType,
        payload: warehouseEvents.payload,
        actor: warehouseEvents.actor,
        createdOn: warehouseEvents.createdOn,
      })
      .from(warehouseEvents)
      .where(
        and(
          eq(warehouseEvents.entityType, EntityType.TRANSFER_ORDER),
          eq(warehouseEvents.entityId, transferOrderId),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return events;
  }
}
