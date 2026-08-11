import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ilike,
  or,
  eq,
  inArray,
  sql,
  and,
  isNull,
  desc,
  asc,
  lte,
} from 'drizzle-orm';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  inventoryLevels,
  products,
  bins,
  binContents,
  inventoryEntries,
  inventoryLedger,
  outbox,
  zones,
  locations,
  salesOrders,
  salesOrderShipments,
  salesOrderReturns,
  salesOrderReturnLines,
  salesOrderLineItems,
  customers,
  purchaseOrders,
  suppliers,
  productUoms,
  productDefaultBins,
  goodsReceived,
  goodsReceivedLines,
  purchaseOrderLineItems,
  transferOrders,
  transferOrderReceipts,
  transferOrderReceiptLines,
  actors,
  productComponents,
} from '@herobm/db-schema';
import { randomUUID } from 'crypto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import {
  calculateAvailableQuantity,
  MATCH_STATUS,
  PUTAWAY_STATUS,
  RETURN_STATE,
} from '@herobm/shared';
import {
  isPickableBinSqlCondition,
  filterPickableBins,
  calculatePickableOnHand,
  isQuarantineBinCondition,
  isPickableBinCondition,
} from './inventory-math.utils';
import { BIN_TYPE } from '@herobm/shared';
import { UomService } from './uom.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from './valuation';
import { getAccountingStrategy } from './inventory-accounting';

@Injectable()
export class InventoryQueryService {
  private readonly logger = new Logger(InventoryQueryService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private appConfig: AppConfigService,
    private uomService: UomService,
    private glService: GlService,
  ) {}

  // =========================================================================
  // Read-only queries (from inventory_levels view / bin_contents cache)
  // =========================================================================

  async findAll(query?: PaginationQuery & { locationNo?: string }) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${products.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.alternateProductNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.alternateProductNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${locations.code} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${locations.code} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const filters = [];

    if (searchTerm) {
      const term = `%${rawSearchTerm}%`;
      filters.push(
        or(
          ilike(products.name, term),
          ilike(products.productNumber, term),
          ilike(products.alternateProductNumber, term),
          ilike(locations.code, term),
        ),
      );
    }

    if (query?.locationNo) {
      filters.push(eq(locations.code, query.locationNo));
    }

    if (!includeArchived) {
      filters.push(sql`${products.stateCode} != 'archived'`);
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    let qb = this.db
      .select({
        inventoryLevelId: inventoryLevels.inventoryLevelId,
        productId: inventoryLevels.productId,
        productName: products.name,
        productNumber: products.productNumber,
        locationId: inventoryLevels.locationId,
        locationName: locations.name,
        locationCode: locations.code,
        quantityOnHand: inventoryLevels.quantityOnHand,
        quantityCommitted: inventoryLevels.quantityCommitted,
        quantityReserved: inventoryLevels.quantityReserved,
        quantityOnOrder: inventoryLevels.quantityOnOrder,
        score: scoreSql,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.productId))
      .leftJoin(locations, eq(inventoryLevels.locationId, locations.locationId))
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { score: number; name: string; id: string } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const strOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(eq(scoreSql, c.score), sql`${products.name} ${strOp} ${c.name}`),
          and(
            eq(scoreSql, c.score),
            eq(products.name, c.name),
            sql`${inventoryLevels.inventoryLevelId} ${strOp} ${c.id}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const scoreOp = dir === 'next' ? desc : asc;
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(products.name),
          orderFn(inventoryLevels.inventoryLevelId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        name: row.productName,
        id: row.inventoryLevelId,
      }),
    });

    // Provide default backward-compatible fields
    const mappedRows = data.map((r) => ({
      ...r,
      quantityAvailable: calculateAvailableQuantity(
        r.quantityOnHand,
        r.quantityCommitted,
        r.quantityReserved,
      ),
      alternateProductNumber: null,
      defaultBinNumber: null,
    }));

    return { data: mappedRows, page, limit, nextCursor, prevCursor };
  }

  /**
   * Domain API: Retrieves the specific bins containing pickable stock for a given product.
   * Abstracts away the positive whitelist rules.
   */
  async getPickableBins(
    productId: string,
    locationId?: string,
    txClient?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const client = txClient || this.db;

    let qb = client
      .select({
        binId: bins.binId,
        binNumber: bins.binNumber,
        binType: bins.binType,
        isUnavailable: bins.isUnavailable,
        onHand: binContents.actualQuantity,
      })
      .from(binContents)
      .innerJoin(bins, eq(binContents.binId, bins.binId))
      .$dynamic();

    if (locationId) {
      qb = qb
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(binContents.productId, productId),
            eq(zones.locationId, locationId),
            sql`${binContents.actualQuantity}::numeric > 0`,
          ),
        );
    } else {
      qb = qb.where(
        and(
          eq(binContents.productId, productId),
          sql`${binContents.actualQuantity}::numeric > 0`,
        ),
      );
    }

    const rawBins = await qb;
    return filterPickableBins(rawBins);
  }

  /**
   * Domain API: Retrieves aggregate pickable inventory metrics for a single product.
   */
  async getAvailableInventory(productId: string, locationId?: string) {
    const { data } = await this.findByProductIds([productId], locationId);
    if (!data || data.length === 0) {
      return { quantityOnHand: 0, quantityCommitted: 0, quantityAvailable: 0 };
    }
    return data[0];
  }

  /**
   * Batch lookup: return all inventory rows for the given product IDs.
   * Used by the Sales Portal availability tab to show per-line stock info.
   */
  async findByProductIds(productIds: string[], locationId?: string) {
    if (productIds.length === 0) return { data: [] };

    const productsData = await this.db
      .select({
        productId: products.productId,
        productNumber: products.productNumber,
        name: products.name,
        structureType: products.structureType,
        productType: products.productType,
      })
      .from(products)
      .where(inArray(products.productId, productIds));

    const allKits = productsData.filter((p) => p.structureType === 'kit');
    const standardProducts = productsData.filter(
      (p) => p.structureType !== 'kit' || p.productType === 'inventory',
    );
    const standardProductIds = standardProducts.map((p) => p.productId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle results need untyped mapping
    let rows: any[] = [];
    if (standardProductIds.length > 0) {
      const filters = [inArray(inventoryLevels.productId, standardProductIds)];
      if (locationId) {
        filters.push(eq(inventoryLevels.locationId, locationId));
      }
      try {
        rows = await this.db
          .select({
            inventoryLevelId: inventoryLevels.inventoryLevelId,
            productId: inventoryLevels.productId,
            productNumber: products.productNumber,
            productName: products.name,
            locationId: inventoryLevels.locationId,
            locationNo: locations.code,
            locationName: locations.name,
            quantityOnHand: inventoryLevels.quantityOnHand,
            quantityCommitted: inventoryLevels.quantityCommitted,
            quantityReserved: inventoryLevels.quantityReserved,
            quantityOnOrder: inventoryLevels.quantityOnOrder,
          })
          .from(inventoryLevels)
          .leftJoin(products, eq(inventoryLevels.productId, products.productId))
          .leftJoin(
            locations,
            eq(inventoryLevels.locationId, locations.locationId),
          )
          .where(and(...filters))
          .orderBy(products.name, locations.code);
      } catch (err) {
        console.error('>>> CAUGHT ERROR IN findByProductIds <<<');
        console.error(err);
        throw err;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle results need untyped mapping
    let ledgerBalances: any[] = [];
    if (standardProductIds.length > 0) {
      ledgerBalances = await this.db
        .select({
          productId: inventoryLedger.productId,
          locationId: inventoryLedger.locationId,
          binId: inventoryLedger.binId,
          binNumber: bins.binNumber,
          quantityOnHand: sql<string>`SUM(${inventoryLedger.quantity})`,
        })
        .from(inventoryLedger)
        .innerJoin(bins, eq(inventoryLedger.binId, bins.binId))
        .where(inArray(inventoryLedger.productId, standardProductIds))
        .groupBy(
          inventoryLedger.productId,
          inventoryLedger.locationId,
          inventoryLedger.binId,
          bins.binNumber,
        )
        .having(sql`SUM(${inventoryLedger.quantity}) > 0`);
    }

    // Provide default backward-compatible fields
    const mappedRows = rows.map((r) => {
      const binBalances = ledgerBalances
        .filter(
          (b) => b.productId === r.productId && b.locationId === r.locationId,
        )
        .map((b) => ({
          binId: b.binId,
          binNumber: b.binNumber,
          quantityOnHand: Number(b.quantityOnHand ?? '0'),
        }));
      return {
        ...r,
        quantityAvailable: calculateAvailableQuantity(
          r.quantityOnHand,
          r.quantityCommitted,
          r.quantityReserved,
        ),
        binBalances,
        alternateProductNumber: null,
        defaultBinNumber: null,
      };
    });

    // Handle kit component availability for all kits (stock and non-stock)
    for (const kit of allKits) {
      const components = await this.db
        .select()
        .from(productComponents)
        .where(eq(productComponents.parentProductId, kit.productId));

      if (components.length === 0) continue;

      const compIds = components.map((c) => c.childProductId).filter(Boolean);
      if (compIds.length === 0) continue;

      const compsInventory = await this.findByProductIds(compIds, locationId);

      const inventoryByLocation: Record<
        string,
        {
          locationId: string;
          locationNo: string | null;
          locationName: string | null;
          compAvailable: Record<string, number>;
        }
      > = {};

      for (const inv of compsInventory.data) {
        if (!inv.locationId) continue;
        if (!inventoryByLocation[inv.locationId]) {
          inventoryByLocation[inv.locationId] = {
            locationId: inv.locationId,
            locationNo: inv.locationNo || null,
            locationName: inv.locationName || null,
            compAvailable: {},
          };
        }
        inventoryByLocation[inv.locationId].compAvailable[inv.productId] =
          (inventoryByLocation[inv.locationId].compAvailable[inv.productId] ||
            0) + (Number(inv.quantityAvailable) || 0);
      }

      for (const locId in inventoryByLocation) {
        const locInv = inventoryByLocation[locId];
        let totalBuildable = Number.MAX_SAFE_INTEGER;

        for (const c of components) {
          if (!c.childProductId) continue;
          const available = Math.max(
            0,
            locInv.compAvailable[c.childProductId] || 0,
          );
          const reqQty = Number(c.parentQuantity) || 1;
          const buildable = Math.floor(available / reqQty);
          if (buildable < totalBuildable) {
            totalBuildable = buildable;
          }
        }

        if (totalBuildable === Number.MAX_SAFE_INTEGER) totalBuildable = 0;

        const existingIndex = mappedRows.findIndex(
          (r) => r.productId === kit.productId && r.locationId === locId,
        );

        if (existingIndex >= 0) {
          const current = mappedRows[existingIndex];
          const currOnHand = Number(current.quantityOnHand) || 0;
          const currAvail = Number(current.quantityAvailable) || 0;
          mappedRows[existingIndex] = {
            ...current,
            quantityOnHand: String(currOnHand + totalBuildable),
            quantityAvailable: currAvail + totalBuildable,
          };
        } else {
          mappedRows.push({
            inventoryLevelId: 'synthetic-' + kit.productId + '-' + locId,
            productId: kit.productId,
            productNumber: kit.productNumber,
            productName: kit.name,
            locationId: locInv.locationId,
            locationNo: locInv.locationNo,
            locationName: locInv.locationName,
            quantityOnHand: String(totalBuildable),
            quantityCommitted: '0',
            quantityReserved: '0',
            quantityOnOrder: '0',
            quantityAvailable: totalBuildable,
            binBalances: [],
            alternateProductNumber: null,
            defaultBinNumber: null,
          });
        }
      }
    }

    return { data: mappedRows };
  }

  async findBins(
    query?: PaginationQuery & { locationNo?: string; binType?: string },
  ) {
    const { page, limit, cursor, direction, searchTerm } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${products.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.productNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${products.alternateProductNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${products.alternateProductNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${bins.binNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${bins.binNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    let qb = this.db
      .select({
        binContentId: binContents.binContentId,
        binId: binContents.binId,
        binNumber: bins.binNumber,
        locationNo: locations.code,
        locationName: locations.name,
        productId: binContents.productId,
        productNumber: products.productNumber,
        productName: products.name,
        actualQuantity: binContents.actualQuantity,
        baseUom: products.baseUom,
        zoneCode: zones.code,
        score: scoreSql,
      })
      .from(binContents)
      .innerJoin(bins, eq(binContents.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .innerJoin(locations, eq(zones.locationId, locations.locationId))
      .innerJoin(products, eq(binContents.productId, products.productId))
      .$dynamic();

    const filters = [];

    if (searchTerm) {
      const term = `%${rawSearchTerm}%`;
      filters.push(
        or(
          ilike(products.name, term),
          ilike(products.productNumber, term),
          ilike(products.alternateProductNumber, term),
          ilike(bins.binNumber, term),
        ),
      );
    }

    if (query?.locationNo) {
      filters.push(eq(locations.code, query.locationNo));
    }

    if (query?.binType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Casting any to bypass structural string literals
      filters.push(eq(bins.binType, query.binType as any));
    }

    filters.push(sql`${binContents.actualQuantity}::numeric > 0`);

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
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
        score: number;
        bin: string;
        name: string;
        id: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const strOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(eq(scoreSql, c.score), sql`${bins.binNumber} ${strOp} ${c.bin}`),
          and(
            eq(scoreSql, c.score),
            eq(bins.binNumber, c.bin),
            sql`${products.name} ${strOp} ${c.name}`,
          ),
          and(
            eq(scoreSql, c.score),
            eq(bins.binNumber, c.bin),
            eq(products.name, c.name),
            sql`${binContents.binContentId} ${strOp} ${c.id}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const scoreOp = dir === 'next' ? desc : asc;
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(bins.binNumber),
          orderFn(products.name),
          orderFn(binContents.binContentId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        bin: row.binNumber,
        name: row.productName,
        id: row.binContentId,
      }),
    });

    const productIds = Array.from(new Set(rows.map((r) => r.productId)));

    let allUoms: (typeof productUoms.$inferSelect)[] = [];
    if (productIds.length > 0) {
      allUoms = await this.db
        .select()
        .from(productUoms)
        .where(inArray(productUoms.productId, productIds));
    }

    const rowsWithUoms = rows.map((row) => ({
      ...row,
      productUoms: allUoms.filter((u) => u.productId === row.productId),
    }));

    return { data: rowsWithUoms, page, limit, nextCursor, prevCursor };
  }

  async getPutawayContext(productId: string, locationId: string) {
    // 1. Get all available bins in the location
    const locationBins = await this.db
      .select({
        binId: bins.binId,
        binNumber: bins.binNumber,
        binType: bins.binType,
        zoneCode: zones.code,
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(zones.locationId, locationId),
          or(isPickableBinCondition(bins), isQuarantineBinCondition(bins)),
        ),
      );

    // 2. Find primary bin
    const [defaultBin] = await this.db
      .select({
        binId: productDefaultBins.binId,
        binNumber: bins.binNumber,
      })
      .from(productDefaultBins)
      .innerJoin(bins, eq(productDefaultBins.binId, bins.binId))
      .where(
        and(
          eq(productDefaultBins.productId, productId),
          eq(productDefaultBins.locationId, locationId),
          eq(productDefaultBins.isPrimaryPerLocation, true),
        ),
      )
      .limit(1);

    const primaryBinId = defaultBin?.binId;

    // 3. Fetch current quantity in primary bin (if exists)
    let currentQuantity = 0;
    if (primaryBinId) {
      const [content] = await this.db
        .select({ actualQuantity: binContents.actualQuantity })
        .from(binContents)
        .where(
          and(
            eq(binContents.productId, productId),
            eq(binContents.binId, primaryBinId),
          ),
        )
        .limit(1);

      if (content) {
        currentQuantity = parseFloat(content.actualQuantity);
      }
    }

    return {
      primaryBinId: primaryBinId || null,
      primaryBinNumber: defaultBin?.binNumber || null,
      currentQuantity,
      availableBins: locationBins,
    };
  }

  /**
   * Return a flat list of locations.
   * Optionally enriched with per-product availability if productId is provided.
   */
  async findAllLocations(productId?: string) {
    const locRows = await this.db
      .select({
        locationId: locations.locationId,
        code: locations.code,
        name: locations.name,
        city: locations.city,
        country: locations.country,
        source: locations.source,
      })
      .from(locations)
      .orderBy(locations.code);

    const availabilityByLocation = new Map<string, number>();
    if (productId) {
      const invRows = await this.db
        .select({
          locationId: inventoryLevels.locationId,
          quantityOnHand: inventoryLevels.quantityOnHand,
          quantityCommitted: inventoryLevels.quantityCommitted,
          quantityReserved: inventoryLevels.quantityReserved,
        })
        .from(inventoryLevels)
        .where(eq(inventoryLevels.productId, productId));
      for (const r of invRows) {
        if (!r.locationId) continue;
        const available = calculateAvailableQuantity(
          r.quantityOnHand,
          r.quantityCommitted,
          r.quantityReserved,
        );
        availabilityByLocation.set(r.locationId, available);
      }
    }

    return locRows.map((loc) => ({
      ...loc,
      ...(productId
        ? { availableQty: availabilityByLocation.get(loc.locationId) ?? 0 }
        : {}),
    }));
  }

  /**
   * Return all bins for a specific location.
   */
  async findBinsByLocation(
    locationId: string,
    binType?: string,
    zoneCode?: string,
  ) {
    const conditions = [eq(zones.locationId, locationId)];
    if (binType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle enum type mismatch workaround
      conditions.push(eq(bins.binType, binType as any));
    }
    if (zoneCode) {
      conditions.push(eq(zones.code, zoneCode));
    }

    return this.db
      .select({
        binId: bins.binId,
        zoneId: bins.zoneId,
        zoneCode: zones.code,
        binNumber: bins.binNumber,
        binType: bins.binType,
        isConsignment: bins.isConsignment,
        isBonded: bins.isBonded,
        isUnavailable: bins.isUnavailable,
        source: bins.source,
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(and(...conditions))
      .orderBy(bins.binNumber);
  }

  /**
   * Return the full warehouse topography hierarchy:
   * Location → Zone[] → Bin[]
   * Used by the Ops-Portal Topography read-only view.
   */
  async getTopography() {
    const locRows = await this.db
      .select({
        locationId: locations.locationId,
        code: locations.code,
        name: locations.name,
        city: locations.city,
        country: locations.country,
        source: locations.source,
      })
      .from(locations)
      .orderBy(locations.code);

    const zoneRows = await this.db
      .select({
        zoneId: zones.zoneId,
        locationId: zones.locationId,
        code: zones.code,
        name: zones.name,
        source: zones.source,
      })
      .from(zones)
      .orderBy(zones.code);

    const binRows = await this.db
      .select({
        binId: bins.binId,
        zoneId: bins.zoneId,
        binNumber: bins.binNumber,
        binType: bins.binType,
        isConsignment: bins.isConsignment,
        isBonded: bins.isBonded,
        isUnavailable: bins.isUnavailable,
        source: bins.source,
      })
      .from(bins)
      .orderBy(bins.binNumber);

    // Assemble the tree in-memory
    const zonesByLocation = new Map<
      string,
      ({
        zoneId: string;
        bins: Record<string, unknown>[];
      } & (typeof zoneRows)[0])[]
    >();
    for (const z of zoneRows) {
      const arr = zonesByLocation.get(z.locationId) ?? [];
      arr.push({ ...z, bins: [] as Record<string, unknown>[] });
      zonesByLocation.set(z.locationId, arr);
    }

    for (const b of binRows) {
      for (const [, zArr] of zonesByLocation) {
        const zone = zArr.find((z) => z.zoneId === b.zoneId);
        if (zone) {
          zone.bins.push(b);
          break;
        }
      }
    }

    return locRows.map((loc) => ({
      ...loc,
      zones: zonesByLocation.get(loc.locationId) ?? [],
    }));
  }

  async getLedger(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    const query = sql`
      SELECT
        e.entry_id AS "entryId",
        e.entry_date AS "date",
        e.entry_number AS "document",
        e.source_type AS "sourceType",
        p.product_number AS "productNumber",
        p.name AS "productName",
        l.quantity::numeric AS "change",
        COALESCE(inv.qty, 0) AS "onHand",
        e.created_by AS "actor"
      FROM herobm_core.inventory_ledger l
      JOIN herobm_core.inventory_entries e ON e.entry_id = l.entry_id
      JOIN herobm_core.products p ON p.product_id = l.product_id
      LEFT JOIN (
        SELECT bc.product_id, SUM(bc.actual_quantity) as qty
        FROM herobm_core.bin_contents bc
        JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
        WHERE ${isPickableBinSqlCondition('b')}
        GROUP BY bc.product_id
      ) inv ON inv.product_id = p.product_id
      WHERE e.entry_date >= ${cutoffIso}
        AND e.source_type != 'INITIAL_IMPORT'
      ORDER BY e.entry_date DESC, l.ledger_id DESC
      LIMIT 10000
    `;

    const result = await this.db.execute(query);
    const rows = Array.isArray(result)
      ? result
      : (result as { rows: unknown[] }).rows;
    return { data: rows };
  }

  async getEntryDetails(entryId: string) {
    // 1. Fetch header
    const [entry] = await this.db
      .select()
      .from(inventoryEntries)
      .where(eq(inventoryEntries.entryId, entryId))
      .limit(1);

    if (!entry) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }

    let relatedDocument: { number: string; link?: string } | null = null;
    let relatedParty: { name: string; number: string; link?: string } | null =
      null;

    if (entry.sourceId) {
      if (entry.sourceType === 'SO_PICK') {
        const [o] = await this.db
          .select({
            salesOrderId: salesOrders.salesOrderId,
            orderNumber: salesOrders.orderNumber,
            customerId: customers.customerId,
            customerName: actors.name,
            customerNumber: customers.customerNumber,
          })
          .from(salesOrders)
          .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
          .leftJoin(actors, eq(customers.actorId, actors.actorId))
          .where(eq(salesOrders.salesOrderId, entry.sourceId))
          .limit(1);

        if (o) {
          relatedDocument = {
            number: o.orderNumber,
            link: `/sales-orders/${o.salesOrderId}#picking-section`,
          };
          relatedParty = o.customerName
            ? {
                name: o.customerName,
                number: o.customerNumber || '',
                link: `/customers/${o.customerId}`,
              }
            : null;
        }
      } else if (entry.sourceType === 'SO_SHIPMENT') {
        const [s] = await this.db
          .select({
            shipmentNumber: salesOrderShipments.shipmentNumber,
            salesOrderId: salesOrders.salesOrderId,
            orderNumber: salesOrders.orderNumber,
            customerId: customers.customerId,
            customerName: actors.name,
            customerNumber: customers.customerNumber,
          })
          .from(salesOrderShipments)
          .innerJoin(
            salesOrders,
            eq(salesOrders.salesOrderId, salesOrderShipments.salesOrderId),
          )
          .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
          .leftJoin(actors, eq(customers.actorId, actors.actorId))
          .where(eq(salesOrderShipments.shipmentId, entry.sourceId))
          .limit(1);

        if (s) {
          relatedDocument = {
            number: s.orderNumber,
            link: `/sales-orders/${s.salesOrderId}#shipments-section`,
          };
          relatedParty = s.customerName
            ? {
                name: s.customerName,
                number: s.customerNumber || '',
                link: `/customers/${s.customerId}`,
              }
            : null;
        }
      } else if (entry.sourceType === 'SO_RETURN') {
        const [ret] = await this.db
          .select({
            returnNumber: salesOrderReturns.returnNumber,
            salesOrderId: salesOrders.salesOrderId,
            orderNumber: salesOrders.orderNumber,
            customerId: customers.customerId,
            customerName: actors.name,
            customerNumber: customers.customerNumber,
          })
          .from(salesOrderReturns)
          .innerJoin(
            salesOrders,
            eq(salesOrders.salesOrderId, salesOrderReturns.salesOrderId),
          )
          .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
          .leftJoin(actors, eq(customers.actorId, actors.actorId))
          .where(eq(salesOrderReturns.returnId, entry.sourceId))
          .limit(1);

        if (ret) {
          relatedDocument = {
            number: ret.orderNumber,
            link: `/sales-orders/${ret.salesOrderId}#returns-section`,
          };
          relatedParty = ret.customerName
            ? {
                name: ret.customerName,
                number: ret.customerNumber || '',
                link: `/customers/${ret.customerId}`,
              }
            : null;
        }
      }
    }

    // 2. Fetch ledger lines
    const linesQuery = sql`
      SELECT
        l.ledger_id AS "ledgerId",
        l.product_id AS "productId",
        p.product_number AS "productNumber",
        p.name AS "productName",
        l.quantity::numeric AS "change",
        b.bin_number AS "binCode",
        loc.name AS "locationName"
      FROM herobm_core.inventory_ledger l
      JOIN herobm_core.products p ON p.product_id = l.product_id
      JOIN herobm_core.bins b ON b.bin_id = l.bin_id
      JOIN herobm_core.locations loc ON loc.location_id = l.location_id
      WHERE l.entry_id = ${entryId}
      ORDER BY p.name ASC
    `;
    const linesResult = await this.db.execute(linesQuery);
    const lines = Array.isArray(linesResult)
      ? linesResult
      : (linesResult as { rows: unknown[] }).rows;

    return {
      ...entry,
      relatedDocument,
      relatedParty,
      lines,
    };
  }

  // ── Ledger Mutations (Modern Approach) ───────────────────────────────
  // ── Putaway Queue (Polymorphic) ──────────────────────────────────────

  async getPendingPutaway(locationId?: string) {
    // 1. Goods Receipts
    const grConditions = [
      inArray(goodsReceivedLines.putawayStatus, [
        PUTAWAY_STATUS.PENDING_PUTAWAY,
        PUTAWAY_STATUS.QUARANTINED,
      ]),
    ];
    if (locationId) {
      grConditions.push(eq(goodsReceived.locationId, locationId));
    }

    const grQb = this.db
      .select({
        id: goodsReceivedLines.goodsReceivedLineId,
        sourceType: sql<'goods_receipt'>`'goods_receipt'`,
        referenceNumber: goodsReceived.receiptNumber,
        productId: goodsReceivedLines.productId,
        productName: products.name,
        productNumber: products.productNumber,
        quantity: goodsReceivedLines.quantityReceived,
        putawayStatus: goodsReceivedLines.putawayStatus,
        locationId: goodsReceived.locationId,
        createdOn: goodsReceived.createdOn,
        sourceBinCode: sql`CASE WHEN ${goodsReceivedLines.putawayStatus} = 'quarantined' THEN 'QUARANTINE' ELSE 'RECEIVING' END`,
      })
      .from(goodsReceivedLines)
      .innerJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .innerJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .where(and(...grConditions));

    // 2. Sales Returns
    const retConditions = [
      inArray(salesOrderReturnLines.putawayStatus, [
        PUTAWAY_STATUS.PENDING_PUTAWAY,
        PUTAWAY_STATUS.QUARANTINED,
      ]),
    ];
    if (locationId) {
      retConditions.push(eq(salesOrders.fulfillmentLocationId, locationId));
    }

    const retQb = this.db
      .select({
        id: salesOrderReturnLines.returnLineId,
        sourceType: sql<'sales_return'>`'sales_return'`,
        referenceNumber: salesOrderReturns.returnNumber,
        productId: salesOrderLineItems.productId,
        productName: products.name,
        productNumber: products.productNumber,
        quantity: salesOrderReturnLines.quantityReturned,
        putawayStatus: salesOrderReturnLines.putawayStatus,
        locationId: salesOrders.fulfillmentLocationId,
        createdOn: salesOrderReturns.createdOn,
        sourceBinCode: sql`CASE WHEN ${salesOrderReturnLines.putawayStatus} = 'quarantined' THEN 'QUARANTINE' ELSE 'CUSTOMER_RETURNS' END`,
      })
      .from(salesOrderReturnLines)
      .innerJoin(
        salesOrderReturns,
        eq(salesOrderReturnLines.returnId, salesOrderReturns.returnId),
      )
      .innerJoin(
        salesOrders,
        eq(salesOrderReturns.salesOrderId, salesOrders.salesOrderId),
      )
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesOrderReturnLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .innerJoin(
        products,
        eq(salesOrderLineItems.productId, products.productId),
      )
      .where(and(...retConditions));

    // 3. Transfer Receipts
    const toConditions = [
      inArray(transferOrderReceiptLines.putawayStatus, [
        PUTAWAY_STATUS.PENDING_PUTAWAY,
        PUTAWAY_STATUS.QUARANTINED,
      ]),
    ];
    if (locationId) {
      toConditions.push(eq(transferOrders.destinationLocationId, locationId));
    }

    const toQb = this.db
      .select({
        id: transferOrderReceiptLines.receiptLineId,
        sourceType: sql<'transfer_receipt'>`'transfer_receipt'`,
        referenceNumber: transferOrderReceipts.receiptNumber,
        productId: transferOrderReceiptLines.productId,
        productName: products.name,
        productNumber: products.productNumber,
        quantity: transferOrderReceiptLines.quantity,
        putawayStatus: transferOrderReceiptLines.putawayStatus,
        locationId: transferOrders.destinationLocationId,
        createdOn: transferOrderReceipts.createdOn,
        sourceBinCode: sql`CASE WHEN ${transferOrderReceiptLines.putawayStatus} = 'quarantined' THEN 'QUARANTINE' ELSE 'RECEIVING' END`,
      })
      .from(transferOrderReceiptLines)
      .innerJoin(
        transferOrderReceipts,
        eq(
          transferOrderReceiptLines.receiptId,
          transferOrderReceipts.receiptId,
        ),
      )
      .innerJoin(
        transferOrders,
        eq(
          transferOrderReceipts.transferOrderId,
          transferOrders.transferOrderId,
        ),
      )
      .innerJoin(
        products,
        eq(transferOrderReceiptLines.productId, products.productId),
      )
      .where(and(...toConditions));

    const [grLines, retLines, toLines] = await Promise.all([grQb, retQb, toQb]);

    const combined = [...grLines, ...retLines, ...toLines].sort((a, b) => {
      const dateA = a.createdOn ? new Date(a.createdOn).getTime() : 0;
      const dateB = b.createdOn ? new Date(b.createdOn).getTime() : 0;
      return dateB - dateA; // descending
    });

    return combined;
  }
}
