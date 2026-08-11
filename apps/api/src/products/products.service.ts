import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  eq,
  ilike,
  or,
  sql,
  and,
  getTableColumns,
  asc,
  desc,
  inArray,
} from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  masterDataEvents,
  productGroups,
  productUoms,
  productDefaultBins,
  locations,
  bins,
  inventoryLedger,
  productComponents,
  inventoryLevels,
} from '@herobm/db-schema';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { PRODUCT_STATE } from '@herobm/shared';

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${coreProducts.name} ILIKE ${rawSearchTerm}::text THEN 3
            WHEN ${coreProducts.name} ILIKE ${rawSearchTerm + '%'}::text THEN 2
            WHEN ${coreProducts.productNumber} ILIKE ${rawSearchTerm}::text THEN 3
            WHEN ${coreProducts.productNumber} ILIKE ${rawSearchTerm + '%'}::text THEN 2
            WHEN ${coreProducts.barcode} ILIKE ${rawSearchTerm}::text THEN 3
            WHEN ${coreProducts.barcode} ILIKE ${rawSearchTerm + '%'}::text THEN 2
            WHEN ${coreProducts.alternateProductNumber} ILIKE ${rawSearchTerm}::text THEN 3
            WHEN ${coreProducts.alternateProductNumber} ILIKE ${rawSearchTerm + '%'}::text THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    let qb = this.db
      .select({
        ...getTableColumns(coreProducts),
        productGroupName: productGroups.name,
        productGroupCode: productGroups.groupCode,
        score: scoreSql,
        quantityOnHand:
          sql<number>`(SELECT COALESCE(SUM(quantity_on_hand), 0) FROM herobm_core.inventory_levels WHERE product_id = ${coreProducts.productId})`.mapWith(
            Number,
          ),
      })
      .from(coreProducts)
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .$dynamic();

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(coreProducts.name, `%${rawSearchTerm}%`),
          ilike(coreProducts.productNumber, `%${rawSearchTerm}%`),
          ilike(coreProducts.barcode, `%${rawSearchTerm}%`),
          ilike(coreProducts.alternateProductNumber, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(
        sql`${coreProducts.stateCode} != ${PRODUCT_STATE.ARCHIVED}`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    // Keyset Pagination Setup
    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        score: number;
        name: string;
        productId: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const strOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(
            eq(scoreSql, c.score),
            sql`${coreProducts.name} ${strOp} ${c.name}`,
          ),
          and(
            eq(scoreSql, c.score),
            eq(coreProducts.name, c.name),
            sql`${coreProducts.productId} ${strOp} ${c.productId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const scoreOp = dir === 'next' ? desc : asc;
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(coreProducts.name),
          orderFn(coreProducts.productId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        name: row.name,
        productId: row.productId,
      }),
    });

    // Post-process kit product quantities based on components
    const kitProducts = data.filter((p) => p.structureType === 'kit');
    if (kitProducts.length > 0) {
      const kitIds = kitProducts.map((p) => p.productId);
      const components = await this.db
        .select()
        .from(productComponents)
        .where(inArray(productComponents.parentProductId, kitIds));

      if (components.length > 0) {
        const childIds = Array.from(
          new Set(components.map((c) => c.childProductId).filter(Boolean)),
        );

        if (childIds.length > 0) {
          const compLevels = await this.db
            .select({
              productId: inventoryLevels.productId,
              totalOnHand:
                sql<number>`COALESCE(SUM(${inventoryLevels.quantityOnHand}), 0)`.mapWith(
                  Number,
                ),
              totalCommitted:
                sql<number>`COALESCE(SUM(${inventoryLevels.quantityCommitted}), 0)`.mapWith(
                  Number,
                ),
            })
            .from(inventoryLevels)
            .where(inArray(inventoryLevels.productId, childIds))
            .groupBy(inventoryLevels.productId);

          const availableMap = new Map<string, number>();
          for (const lvl of compLevels) {
            if (lvl.productId) {
              const avail = Math.max(0, lvl.totalOnHand - lvl.totalCommitted);
              availableMap.set(lvl.productId, avail);
            }
          }

          const componentsByParent = new Map<string, typeof components>();
          for (const c of components) {
            const list = componentsByParent.get(c.parentProductId) || [];
            list.push(c);
            componentsByParent.set(c.parentProductId, list);
          }

          for (const row of data) {
            if (row.structureType === 'kit') {
              const comps = componentsByParent.get(row.productId);
              if (comps && comps.length > 0) {
                let maxBuildable = Number.MAX_SAFE_INTEGER;
                for (const c of comps) {
                  if (!c.childProductId) continue;
                  const avail = availableMap.get(c.childProductId) || 0;
                  const req = Number(c.quantity) || 1;
                  const buildable = Math.floor(avail / req);
                  if (buildable < maxBuildable) {
                    maxBuildable = buildable;
                  }
                }
                if (maxBuildable === Number.MAX_SAFE_INTEGER) maxBuildable = 0;

                const physicalOnHand = Number(row.quantityOnHand) || 0;
                if (row.productType === 'non-stock') {
                  row.quantityOnHand = maxBuildable;
                } else {
                  row.quantityOnHand = physicalOnHand + maxBuildable;
                }
              }
            }
          }
        }
      }
    }

    // Count query for total (optional, could be removed later if too slow)
    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(coreProducts)
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count: total }] = await countQb;

    return { data, page, limit, total: Number(total), nextCursor, prevCursor };
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    // Reject non-UUID strings early — product_id is a uuid column
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Product '${id}' not found`);
    }

    const rows = await db
      .select({
        ...getTableColumns(coreProducts),
        productGroupName: productGroups.name,
        productGroupCode: productGroups.groupCode,
      })
      .from(coreProducts)
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .where(eq(coreProducts.productId, id))
      .limit(1);

    if (rows.length > 0) {
      const events = await db
        .select()
        .from(masterDataEvents)
        .where(eq(masterDataEvents.entityId, id))
        .orderBy(sql`${masterDataEvents.createdOn} DESC`);

      const uoms = await db
        .select()
        .from(productUoms)
        .where(eq(productUoms.productId, id));

      const defaultBins = await db
        .select({
          productDefaultBinId: productDefaultBins.productDefaultBinId,
          productId: productDefaultBins.productId,
          locationId: productDefaultBins.locationId,
          binId: productDefaultBins.binId,
          isPrimaryPerLocation: productDefaultBins.isPrimaryPerLocation,
          minQuantity: productDefaultBins.minQuantity,
          maxQuantity: productDefaultBins.maxQuantity,
          locationName: locations.name,
          locationNo: locations.code,
          binNumber: bins.binNumber,
          binType: bins.binType,
          quantityOnHand:
            sql<number>`COALESCE(SUM(${inventoryLedger.quantity}), 0)`.mapWith(
              Number,
            ),
        })
        .from(productDefaultBins)
        .leftJoin(
          locations,
          eq(productDefaultBins.locationId, locations.locationId),
        )
        .leftJoin(bins, eq(productDefaultBins.binId, bins.binId))
        .leftJoin(
          inventoryLedger,
          and(
            eq(productDefaultBins.binId, inventoryLedger.binId),
            eq(productDefaultBins.productId, inventoryLedger.productId),
          ),
        )
        .where(eq(productDefaultBins.productId, id))
        .groupBy(
          productDefaultBins.productDefaultBinId,
          locations.name,
          locations.code,
          bins.binNumber,
          bins.binType,
        );

      return { ...rows[0], events, productUoms: uoms, defaultBins };
    }

    throw new NotFoundException(`Product '${id}' not found`);
  }

  async getComponents(productId: string) {
    const components = await this.db
      .select({
        componentId: productComponents.componentId,
        parentProductId: productComponents.parentProductId,
        childProductId: productComponents.childProductId,
        parentQuantity: productComponents.parentQuantity,
        quantity: productComponents.quantity,
        sequenceNumber: productComponents.sequenceNumber,
        fractionalBehavior: productComponents.fractionalBehavior,
        productNumber: coreProducts.productNumber,
        name: coreProducts.name,
        baseUom: coreProducts.baseUom,
        stateCode: coreProducts.stateCode,
      })
      .from(productComponents)
      .innerJoin(
        coreProducts,
        eq(productComponents.childProductId, coreProducts.productId),
      )
      .where(eq(productComponents.parentProductId, productId))
      .orderBy(productComponents.sequenceNumber, coreProducts.productNumber);

    return {
      data: components.map((c) => ({
        ...c,
        parentQuantity: Number(c.parentQuantity),
        quantity: Number(c.quantity),
      })),
    };
  }
}
