// security-ignore: sql-raw
import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  goodsReceived,
  goodsReceivedLines,
  suppliers,
  locations,
  products,
  purchaseOrders,
  actors,
} from '@herobm/db-schema';
import {
  eq,
  and,
  sql,
  desc,
  or,
  ilike,
  asc,
  getTableColumns,
} from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';

@Injectable()
export class GoodsReceivedCoreService {
  private readonly logger = new Logger(GoodsReceivedCoreService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * List all goods receipts with pagination and optional filtering.
   */
  async findAll(params: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, days } =
      parsePagination(params);

    const conditions = [];

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${goodsReceived.receiptNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${goodsReceived.receiptNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${goodsReceived.packingSlipNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${goodsReceived.packingSlipNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(goodsReceived.receiptNumber, `%${rawSearchTerm}%`),
          ilike(goodsReceived.packingSlipNumber, `%${rawSearchTerm}%`),
          ilike(actors.name, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (days && days > 0) {
      conditions.push(
        sql`${goodsReceived.createdOn} >= now() - interval '1 day' * ${days}`,
      );
    }

    let qb = this.db
      .select({
        receipt: goodsReceived,
        vendorName: actors.name,
        vendorNumber: suppliers.vendorNumber,
        score: scoreSql,
      })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
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
              sql`${goodsReceived.createdOn} < ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              eq(goodsReceived.createdOn, sql`${cDate}::timestamp`),
              sql`${goodsReceived.goodsReceivedId} < ${c.id}`,
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
              sql`${goodsReceived.createdOn} > ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              eq(goodsReceived.createdOn, sql`${cDate}::timestamp`),
              sql`${goodsReceived.goodsReceivedId} > ${c.id}`,
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
          orderFn(goodsReceived.createdOn),
          orderFn(goodsReceived.goodsReceivedId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: (row.receipt.createdOn || new Date()).toISOString(),
        id: row.receipt.goodsReceivedId,
      }),
    });

    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count }] = await countQb;

    // For each receipt, count match statuses
    const receiptIds = data.map((d) => d.receipt.goodsReceivedId);
    let matchCounts: Map<string, { total: number; matched: number }> =
      new Map();

    if (receiptIds.length > 0) {
      const lineCounts = await this.db
        .select({
          goodsReceivedId: goodsReceivedLines.goodsReceivedId,
          total: sql<number>`count(*)`,
          matched: sql<number>`count(*) FILTER (WHERE ${goodsReceivedLines.matchStatus} = 'matched')`,
        })
        .from(goodsReceivedLines)
        .where(
          sql`${goodsReceivedLines.goodsReceivedId} IN (${sql.join(
            receiptIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(goodsReceivedLines.goodsReceivedId);

      matchCounts = new Map(
        lineCounts.map((lc) => [
          lc.goodsReceivedId,
          { total: Number(lc.total), matched: Number(lc.matched) },
        ]),
      );
    }

    return {
      data: data.map((d) => {
        const counts = matchCounts.get(d.receipt.goodsReceivedId) || {
          total: 0,
          matched: 0,
        };
        return {
          ...d.receipt,
          vendorName: d.vendorName,
          vendorNumber: d.vendorNumber,
          totalLines: counts.total,
          matchedLines: counts.matched,
        };
      }),
      page,
      limit,
      total: Number(count),
      nextCursor,
      prevCursor,
    };
  }

  /**
   * List all goods receipt lines with pagination and optional filtering.
   * This provides a flattened "Receipt Lines" view.
   */
  async findAllLines(
    params: PaginationQuery,
    purchaseOrderId?: string,
    putawayStatus?: string,
    locationId?: string,
  ) {
    const { page, limit, cursor, direction, searchTerm, days } =
      parsePagination(params);

    const conditions = [];

    if (purchaseOrderId) {
      conditions.push(eq(goodsReceivedLines.purchaseOrderId, purchaseOrderId));
    }

    if (putawayStatus) {
      conditions.push(
        eq(
          goodsReceivedLines.putawayStatus,
          putawayStatus as
            | 'awaiting_matching'
            | 'pending_putaway'
            | 'quarantined'
            | 'completed',
        ),
      );
    }

    if (locationId) {
      conditions.push(eq(goodsReceived.locationId, locationId));
    }

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${goodsReceived.receiptNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${goodsReceived.receiptNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${goodsReceived.packingSlipNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${goodsReceived.packingSlipNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.alternateProductNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.alternateProductNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(goodsReceived.receiptNumber, `%${rawSearchTerm}%`),
          ilike(goodsReceived.packingSlipNumber, `%${rawSearchTerm}%`),
          ilike(products.productNumber, `%${rawSearchTerm}%`),
          ilike(products.alternateProductNumber, `%${rawSearchTerm}%`),
          ilike(products.name, `%${rawSearchTerm}%`),
          ilike(actors.name, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (days && days > 0) {
      conditions.push(
        sql`${goodsReceived.createdOn} >= now() - interval '1 day' * ${days}`,
      );
    }

    let qb = this.db
      .select({
        line: getTableColumns(goodsReceivedLines),
        receiptNumber: goodsReceived.receiptNumber,
        packingSlipNumber: goodsReceived.packingSlipNumber,
        vendorId: suppliers.vendorId,
        vendorName: actors.name,
        vendorNumber: suppliers.vendorNumber,
        createdOn: goodsReceived.createdOn,
        locationId: goodsReceived.locationId,
        locationName: locations.name,
        productNumber: products.productNumber,
        productName: products.name,
        orderNumber: purchaseOrders.orderNumber,
        stateCode: goodsReceived.stateCode,
        score: scoreSql,
      })
      .from(goodsReceivedLines)
      .leftJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(locations, eq(goodsReceived.locationId, locations.locationId))
      .$dynamic();

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
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
          return q.where(
            or(
              sql`${scoreSql} < ${c.score}`,
              and(
                eq(scoreSql, c.score),
                sql`${goodsReceived.createdOn} < ${cDate}::timestamp`,
              ),
              and(
                eq(scoreSql, c.score),
                eq(goodsReceived.createdOn, sql`${cDate}::timestamp`),
                sql`${goodsReceivedLines.goodsReceivedLineId} > ${c.id}`,
              ),
            ),
          );
        } else {
          return q.where(
            or(
              sql`${scoreSql} > ${c.score}`,
              and(
                eq(scoreSql, c.score),
                sql`${goodsReceived.createdOn} > ${cDate}::timestamp`,
              ),
              and(
                eq(scoreSql, c.score),
                eq(goodsReceived.createdOn, sql`${cDate}::timestamp`),
                sql`${goodsReceivedLines.goodsReceivedLineId} < ${c.id}`,
              ),
            ),
          );
        }
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        const tieBreaker = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(scoreSql),
          orderFn(goodsReceived.createdOn),
          tieBreaker(goodsReceivedLines.goodsReceivedLineId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn,
        id: row.line.goodsReceivedLineId,
      }),
    });

    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceivedLines)
      .leftJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count }] = await countQb;

    return {
      data: data.map((d) => ({
        ...d.line,
        receiptNumber: d.receiptNumber,
        packingSlipNumber: d.packingSlipNumber,
        vendorId: d.vendorId,
        vendorName: d.vendorName,
        vendorNumber: d.vendorNumber,
        createdOn: d.createdOn,
        locationId: d.locationId,
        locationName: d.locationName,
        productNumber: d.productNumber,
        productName: d.productName,
        orderNumber: d.orderNumber,
        stateCode: d.stateCode,
      })),
      page,
      limit,
      total: Number(count),
      nextCursor,
      prevCursor,
    };
  }

  async getLines(query?: PaginationQuery & { productId?: string }) {
    const { page, limit, cursor, direction, searchTerm } =
      parsePagination(query);

    const conditions = [];
    if (query?.productId) {
      conditions.push(eq(goodsReceivedLines.productId, query.productId));
    }

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${goodsReceived.receiptNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${goodsReceived.receiptNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(goodsReceived.receiptNumber, `%${rawSearchTerm}%`),
          ilike(products.name, `%${rawSearchTerm}%`),
          ilike(products.productNumber, `%${rawSearchTerm}%`),
        ),
      );
    }

    let qb = this.db
      .select({
        line: getTableColumns(goodsReceivedLines),
        receiptNumber: goodsReceived.receiptNumber,
        packingSlipNumber: goodsReceived.packingSlipNumber,
        vendorId: goodsReceived.vendorId,
        vendorName: actors.name,
        createdOn: goodsReceived.createdOn,
        locationId: goodsReceived.locationId,
        locationName: locations.name,
        productNumber: products.productNumber,
        productName: products.name,
        orderNumber: purchaseOrders.orderNumber,
        stateCode: goodsReceived.stateCode,
        score: scoreSql,
      })
      .from(goodsReceivedLines)
      .leftJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(locations, eq(goodsReceived.locationId, locations.locationId))
      .$dynamic();

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
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
          return q.where(
            or(
              sql`${scoreSql} < ${c.score}`,
              and(
                eq(scoreSql, c.score),
                sql`${goodsReceived.createdOn} < ${cDate}::timestamp`,
              ),
              and(
                eq(scoreSql, c.score),
                eq(goodsReceived.createdOn, sql`${cDate}::timestamp`),
                sql`${goodsReceivedLines.goodsReceivedLineId} > ${c.id}`,
              ),
            ),
          );
        } else {
          return q.where(
            or(
              sql`${scoreSql} > ${c.score}`,
              and(
                eq(scoreSql, c.score),
                sql`${goodsReceived.createdOn} > ${cDate}::timestamp`,
              ),
              and(
                eq(scoreSql, c.score),
                eq(goodsReceived.createdOn, sql`${cDate}::timestamp`),
                sql`${goodsReceivedLines.goodsReceivedLineId} < ${c.id}`,
              ),
            ),
          );
        }
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        const tieBreaker = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(scoreSql),
          orderFn(goodsReceived.createdOn),
          tieBreaker(goodsReceivedLines.goodsReceivedLineId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn,
        id: row.line.goodsReceivedLineId,
      }),
    });

    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceivedLines)
      .leftJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count }] = await countQb;

    return {
      data: data.map((d) => ({
        ...d.line,
        receiptNumber: d.receiptNumber,
        packingSlipNumber: d.packingSlipNumber,
        vendorId: d.vendorId,
        vendorName: d.vendorName,
        createdOn: d.createdOn,
        locationId: d.locationId,
        locationName: d.locationName,
        productNumber: d.productNumber,
        productName: d.productName,
        orderNumber: d.orderNumber,
        stateCode: d.stateCode,
      })),
      page,
      limit,
      total: Number(count),
      nextCursor,
      prevCursor,
    };
  }

  /**
   * Get a single goods receipt with all lines.
   */
  async findOne(
    id: string,
    tx:
      | DrizzleDB
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] = this.db,
  ) {
    const receipt = await tx
      .select({
        receipt: goodsReceived,
        vendorName: actors.name,
        vendorNumber: suppliers.vendorNumber,
      })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .where(eq(goodsReceived.goodsReceivedId, id))
      .limit(1)
      .then(
        (
          res: {
            receipt: typeof goodsReceived.$inferSelect;
            vendorName: string | null;
            vendorNumber: string | null;
          }[],
        ) => res[0],
      );

    if (!receipt) {
      throw new NotFoundException(`Goods receipt ${id} not found`);
    }

    const lines = await tx
      .select({
        goodsReceivedLineId: goodsReceivedLines.goodsReceivedLineId,
        productId: goodsReceivedLines.productId,
        quantityReceived: goodsReceivedLines.quantityReceived,
        matchStatus: goodsReceivedLines.matchStatus,
        putawayStatus: goodsReceivedLines.putawayStatus,
        purchaseOrderLineId: goodsReceivedLines.purchaseOrderLineId,
        purchaseOrderId: goodsReceivedLines.purchaseOrderId,
        productNumber: products.productNumber,
        productName: products.name,
        orderNumber: purchaseOrders.orderNumber,
      })
      .from(goodsReceivedLines)
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(eq(goodsReceivedLines.goodsReceivedId, id));

    return {
      ...receipt.receipt,
      vendorName: receipt.vendorName,
      vendorNumber: receipt.vendorNumber,
      lines,
    };
  }
}
