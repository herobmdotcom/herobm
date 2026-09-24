import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, or, ilike, desc, asc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  stocktakes,
  stocktakeLines,
  stocktakeCounts,
  locations,
  bins,
  zones,
  products,
} from '@herobm/db-schema';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../../common/pagination';
import { STOCKTAKE_STATE, type StocktakeState } from '@herobm/shared';

@Injectable()
export class StocktakesQueryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(
    query: PaginationQuery & {
      locationId?: string;
      stateCode?: StocktakeState;
    },
  ) {
    const { page, limit, cursor, direction, searchTerm } =
      parsePagination(query);

    const conditions = [];

    if (query.locationId) {
      conditions.push(eq(stocktakes.locationId, query.locationId));
    }
    if (query.stateCode) {
      conditions.push(eq(stocktakes.stateCode, query.stateCode));
    }
    if (searchTerm) {
      conditions.push(
        or(
          ilike(stocktakes.stocktakeNumber, `%${searchTerm}%`),
          ilike(stocktakes.name, `%${searchTerm}%`),
          ilike(stocktakes.notes, `%${searchTerm}%`),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count of matching stocktakes
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(stocktakes)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    let qb = this.db
      .select({
        stocktake: stocktakes,
        locationCode: locations.code,
        locationName: locations.name,
        totalLines: sql<number>`count(${stocktakeLines.stocktakeLineId})::int`,
        countedLines: sql<number>`count(case when ${stocktakeLines.countedQuantity} is not null then 1 end)::int`,
        discrepancyLines: sql<number>`count(case when ${stocktakeLines.countedQuantity} is not null and (${stocktakeLines.countedQuantity} != ${stocktakeLines.expectedQuantity} or ${stocktakeLines.isUnlisted} = true) then 1 end)::int`,
      })
      .from(stocktakes)
      .innerJoin(locations, eq(stocktakes.locationId, locations.locationId))
      .leftJoin(
        stocktakeLines,
        eq(stocktakes.stocktakeId, stocktakeLines.stocktakeId),
      )
      .groupBy(stocktakes.stocktakeId, locations.code, locations.name)
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const {
      data: rows,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { createdOn: string; stocktakeId: string } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${stocktakes.createdOn} ${op} ${new Date(c.createdOn)}`,
          and(
            sql`${stocktakes.createdOn} = ${new Date(c.createdOn)}`,
            sql`${stocktakes.stocktakeId} ${idOp} ${c.stocktakeId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        const idOrderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(stocktakes.createdOn),
          idOrderFn(stocktakes.stocktakeId),
        );
      },
      encodeRow: (row) => ({
        createdOn: row.stocktake.createdOn
          ? new Date(row.stocktake.createdOn).toISOString()
          : new Date().toISOString(),
        stocktakeId: row.stocktake.stocktakeId,
      }),
    });

    const data = rows.map((r) => {
      const totalL = r.totalLines || 0;
      const countedL = r.countedLines || 0;
      const progress = totalL > 0 ? Math.round((countedL / totalL) * 100) : 0;
      const isBlindActive =
        r.stocktake.isBlindCount &&
        (r.stocktake.stateCode === STOCKTAKE_STATE.OPEN ||
          r.stocktake.stateCode === STOCKTAKE_STATE.DRAFT);

      return {
        stocktakeId: r.stocktake.stocktakeId,
        stocktakeNumber: r.stocktake.stocktakeNumber,
        name: r.stocktake.name,
        locationId: r.stocktake.locationId,
        locationCode: r.locationCode,
        locationName: r.locationName,
        stateCode: r.stocktake.stateCode,
        scopeType: r.stocktake.scopeType,
        zoneFilter: r.stocktake.zoneFilter,
        binPattern: r.stocktake.binPattern,
        isBlindCount: r.stocktake.isBlindCount,
        notes: r.stocktake.notes,
        inventoryEntryId: r.stocktake.inventoryEntryId,
        createdBy: r.stocktake.createdBy,
        createdOn: r.stocktake.createdOn,
        openedBy: r.stocktake.openedBy,
        openedAt: r.stocktake.openedAt,
        reviewedBy: r.stocktake.reviewedBy,
        reviewedAt: r.stocktake.reviewedAt,
        submittedBy: r.stocktake.submittedBy,
        submittedOn: r.stocktake.submittedOn,
        cancelledBy: r.stocktake.cancelledBy,
        cancelledAt: r.stocktake.cancelledAt,
        totalLines: totalL,
        countedLines: countedL,
        discrepancyLines: isBlindActive ? null : r.discrepancyLines || 0,
        progressPercentage: progress,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      nextCursor,
      prevCursor,
    };
  }

  async findOne(id: string) {
    const [row] = await this.db
      .select({
        stocktake: stocktakes,
        locationCode: locations.code,
        locationName: locations.name,
        totalLines: sql<number>`count(${stocktakeLines.stocktakeLineId})::int`,
        countedLines: sql<number>`count(case when ${stocktakeLines.countedQuantity} is not null then 1 end)::int`,
        discrepancyLines: sql<number>`count(case when ${stocktakeLines.countedQuantity} is not null and (${stocktakeLines.countedQuantity} != ${stocktakeLines.expectedQuantity} or ${stocktakeLines.isUnlisted} = true) then 1 end)::int`,
      })
      .from(stocktakes)
      .innerJoin(locations, eq(stocktakes.locationId, locations.locationId))
      .leftJoin(
        stocktakeLines,
        eq(stocktakes.stocktakeId, stocktakeLines.stocktakeId),
      )
      .where(eq(stocktakes.stocktakeId, id))
      .groupBy(stocktakes.stocktakeId, locations.code, locations.name)
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }

    const totalL = row.totalLines || 0;
    const countedL = row.countedLines || 0;
    const progress = totalL > 0 ? Math.round((countedL / totalL) * 100) : 0;
    const isBlindActive =
      row.stocktake.isBlindCount &&
      (row.stocktake.stateCode === STOCKTAKE_STATE.OPEN ||
        row.stocktake.stateCode === STOCKTAKE_STATE.DRAFT);

    return {
      stocktakeId: row.stocktake.stocktakeId,
      stocktakeNumber: row.stocktake.stocktakeNumber,
      name: row.stocktake.name,
      locationId: row.stocktake.locationId,
      locationCode: row.locationCode,
      locationName: row.locationName,
      stateCode: row.stocktake.stateCode,
      scopeType: row.stocktake.scopeType,
      zoneFilter: row.stocktake.zoneFilter,
      binPattern: row.stocktake.binPattern,
      isBlindCount: row.stocktake.isBlindCount,
      notes: row.stocktake.notes,
      inventoryEntryId: row.stocktake.inventoryEntryId,
      createdBy: row.stocktake.createdBy,
      createdOn: row.stocktake.createdOn,
      openedBy: row.stocktake.openedBy,
      openedAt: row.stocktake.openedAt,
      reviewedBy: row.stocktake.reviewedBy,
      reviewedAt: row.stocktake.reviewedAt,
      submittedBy: row.stocktake.submittedBy,
      submittedOn: row.stocktake.submittedOn,
      cancelledBy: row.stocktake.cancelledBy,
      cancelledAt: row.stocktake.cancelledAt,
      totalLines: totalL,
      countedLines: countedL,
      discrepancyLines: isBlindActive ? null : row.discrepancyLines || 0,
      progressPercentage: progress,
    };
  }

  async findLines(
    id: string,
    query: PaginationQuery & {
      binId?: string;
      zoneCode?: string;
      status?: string; // 'all' | 'counted' | 'uncounted' | 'discrepancies' | 'match'
      isUnlisted?: boolean;
    },
  ) {
    const { page, limit, cursor, direction, searchTerm } =
      parsePagination(query);

    const [stocktake] = await this.db
      .select({
        stocktakeId: stocktakes.stocktakeId,
        isBlindCount: stocktakes.isBlindCount,
        stateCode: stocktakes.stateCode,
      })
      .from(stocktakes)
      .where(eq(stocktakes.stocktakeId, id))
      .limit(1);

    if (!stocktake) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }

    const conditions = [eq(stocktakeLines.stocktakeId, id)];

    if (query.binId && query.binId !== 'all') {
      conditions.push(eq(stocktakeLines.binId, query.binId));
    }
    if (query.zoneCode && query.zoneCode !== 'all') {
      conditions.push(ilike(zones.code, query.zoneCode));
    }
    if (query.isUnlisted !== undefined) {
      conditions.push(eq(stocktakeLines.isUnlisted, query.isUnlisted));
    }
    if (searchTerm) {
      conditions.push(
        or(
          ilike(products.productNumber, `%${searchTerm}%`),
          ilike(products.name, `%${searchTerm}%`),
          ilike(products.barcode, `%${searchTerm}%`),
          ilike(bins.binNumber, `%${searchTerm}%`),
        )!,
      );
    }

    if (query.status === 'uncounted') {
      conditions.push(sql`${stocktakeLines.countedQuantity} is null`);
    } else if (query.status === 'counted') {
      conditions.push(sql`${stocktakeLines.countedQuantity} is not null`);
    } else if (query.status === 'discrepancies') {
      conditions.push(
        and(
          sql`${stocktakeLines.countedQuantity} is not null`,
          or(
            sql`${stocktakeLines.countedQuantity} != ${stocktakeLines.expectedQuantity}`,
            eq(stocktakeLines.isUnlisted, true),
          ),
        )!,
      );
    } else if (query.status === 'match') {
      conditions.push(
        and(
          sql`${stocktakeLines.countedQuantity} is not null`,
          sql`${stocktakeLines.countedQuantity} = ${stocktakeLines.expectedQuantity}`,
          eq(stocktakeLines.isUnlisted, false),
        )!,
      );
    } else if (query.status === 'surplus') {
      conditions.push(
        and(
          sql`${stocktakeLines.countedQuantity} is not null`,
          sql`${stocktakeLines.countedQuantity}::numeric > ${stocktakeLines.expectedQuantity}::numeric`,
        )!,
      );
    } else if (query.status === 'shortage') {
      conditions.push(
        and(
          sql`${stocktakeLines.countedQuantity} is not null`,
          sql`${stocktakeLines.countedQuantity}::numeric < ${stocktakeLines.expectedQuantity}::numeric`,
        )!,
      );
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(stocktakeLines)
      .innerJoin(products, eq(stocktakeLines.productId, products.productId))
      .innerJoin(bins, eq(stocktakeLines.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    let qb = this.db
      .select({
        line: stocktakeLines,
        productNumber: products.productNumber,
        productName: products.name,
        barcode: products.barcode,
        alternateProductNumber: products.alternateProductNumber,
        baseUom: products.baseUom,
        binNumber: bins.binNumber,
        zoneCode: zones.code,
      })
      .from(stocktakeLines)
      .innerJoin(products, eq(stocktakeLines.productId, products.productId))
      .innerJoin(bins, eq(stocktakeLines.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const {
      data: rows,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        binNumber: string;
        productNumber: string;
        lineId: string;
      } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${bins.binNumber} ${op} ${c.binNumber}`,
          and(
            sql`${bins.binNumber} = ${c.binNumber}`,
            sql`${products.productNumber} ${op} ${c.productNumber}`,
          ),
          and(
            sql`${bins.binNumber} = ${c.binNumber}`,
            sql`${products.productNumber} = ${c.productNumber}`,
            sql`${stocktakeLines.stocktakeLineId} ${op} ${c.lineId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(bins.binNumber),
          orderFn(products.productNumber),
          orderFn(stocktakeLines.stocktakeLineId),
        );
      },
      encodeRow: (row) => ({
        binNumber: row.binNumber,
        productNumber: row.productNumber,
        lineId: row.line.stocktakeLineId,
      }),
    });

    // Is blind count active? Blind count masks expectedQuantity when in open state
    const isBlindActive =
      stocktake.isBlindCount &&
      (stocktake.stateCode === STOCKTAKE_STATE.OPEN ||
        stocktake.stateCode === STOCKTAKE_STATE.DRAFT);

    const data = rows.map((r) => {
      const exp = parseFloat(r.line.expectedQuantity);
      const cnt =
        r.line.countedQuantity !== null
          ? parseFloat(r.line.countedQuantity)
          : null;

      let status: 'uncounted' | 'match' | 'surplus' | 'shortage' = 'uncounted';
      let variance: string | null = null;

      if (cnt !== null) {
        const diff = cnt - exp;
        variance = diff.toString();
        if (Math.abs(diff) < 0.0001) {
          status = 'match';
        } else if (diff > 0) {
          status = 'surplus';
        } else {
          status = 'shortage';
        }
      }

      return {
        stocktakeLineId: r.line.stocktakeLineId,
        stocktakeId: r.line.stocktakeId,
        productId: r.line.productId,
        productNumber: r.productNumber,
        productName: r.productName,
        barcode: r.barcode,
        alternateProductNumber: r.alternateProductNumber,
        baseUom: r.baseUom || 'EA',
        binId: r.line.binId,
        binNumber: r.binNumber,
        zoneCode: r.zoneCode,
        expectedQuantity: isBlindActive ? null : r.line.expectedQuantity,
        countedQuantity: r.line.countedQuantity,
        varianceQuantity: isBlindActive ? null : variance,
        status,
        isUnlisted: r.line.isUnlisted,
        notes: r.line.notes,
        lastCountedBy: r.line.lastCountedBy,
        lastCountedAt: r.line.lastCountedAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      nextCursor,
      prevCursor,
    };
  }

  async findCounts(
    id: string,
    query: PaginationQuery & {
      lineId?: string;
      binId?: string;
    },
  ) {
    const { page, limit, cursor, direction } = parsePagination(query);

    const conditions = [eq(stocktakeCounts.stocktakeId, id)];

    if (query.lineId) {
      conditions.push(eq(stocktakeCounts.stocktakeLineId, query.lineId));
    }
    if (query.binId) {
      conditions.push(eq(stocktakeCounts.binId, query.binId));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(stocktakeCounts)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    let qb = this.db
      .select({
        count: stocktakeCounts,
        productNumber: products.productNumber,
        productName: products.name,
        binNumber: bins.binNumber,
      })
      .from(stocktakeCounts)
      .innerJoin(products, eq(stocktakeCounts.productId, products.productId))
      .innerJoin(bins, eq(stocktakeCounts.binId, bins.binId))
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const {
      data: rows,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        countedAt: string;
        countId: string;
      } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${stocktakeCounts.countedAt} ${op} ${new Date(c.countedAt)}`,
          and(
            sql`${stocktakeCounts.countedAt} = ${new Date(c.countedAt)}`,
            sql`${stocktakeCounts.stocktakeCountId} ${idOp} ${c.countId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        const idOrderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(stocktakeCounts.countedAt),
          idOrderFn(stocktakeCounts.stocktakeCountId),
        );
      },
      encodeRow: (row) => ({
        countedAt: row.count.countedAt
          ? new Date(row.count.countedAt).toISOString()
          : new Date().toISOString(),
        countId: row.count.stocktakeCountId,
      }),
    });

    const data = rows.map((r) => ({
      stocktakeCountId: r.count.stocktakeCountId,
      stocktakeId: r.count.stocktakeId,
      stocktakeLineId: r.count.stocktakeLineId,
      productId: r.count.productId,
      productNumber: r.productNumber,
      productName: r.productName,
      binId: r.count.binId,
      binNumber: r.binNumber,
      quantity: r.count.quantity,
      countMode: r.count.countMode,
      countedBy: r.count.countedBy,
      countedAt: r.count.countedAt,
      notes: r.count.notes,
    }));

    return {
      data,
      total,
      page,
      limit,
      nextCursor,
      prevCursor,
    };
  }
}
