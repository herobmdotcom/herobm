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
} from '../drizzle/herobm-core-schema';
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
  PICKABLE_BIN_TYPES,
  filterPickableBins,
  calculatePickableOnHand,
} from './inventory-math.utils';
import { BIN_TYPE } from '@herobm/shared';
import { UomService } from './uom.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from './valuation';
import { getAccountingStrategy } from './inventory-accounting';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

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

    const filters = [inArray(inventoryLevels.productId, productIds)];
    if (locationId) {
      filters.push(eq(inventoryLevels.locationId, locationId));
    }

    let rows;
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
      console.error('>>> INNER CAUSE <<<');
      console.error(err.cause);
      throw err;
    }

    const ledgerBalances = await this.db
      .select({
        productId: inventoryLedger.productId,
        locationId: inventoryLedger.locationId,
        binId: inventoryLedger.binId,
        binNumber: bins.binNumber,
        quantityOnHand: sql<string>`SUM(${inventoryLedger.quantity})`,
      })
      .from(inventoryLedger)
      .innerJoin(bins, eq(inventoryLedger.binId, bins.binId))
      .where(inArray(inventoryLedger.productId, productIds))
      .groupBy(
        inventoryLedger.productId,
        inventoryLedger.locationId,
        inventoryLedger.binId,
        bins.binNumber,
      )
      .having(sql`SUM(${inventoryLedger.quantity}) > 0`);

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
      filters.push(
        eq(
          bins.binType,
          query.binType as
            | 'storage'
            | 'pick'
            | 'bulk'
            | 'receiving'
            | 'staging'
            | 'quarantine'
            | 'in_transit',
        ),
      );
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
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(zones.locationId, locationId),
          inArray(bins.binType, [...PICKABLE_BIN_TYPES]),
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
   * Return the full warehouse topography hierarchy:
   * Location → Zone[] → Bin[]
   * Used by the Ops-Portal Topography read-only view.
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

    // -------------------------------------------------------------------
    // Optionally enrich each location with per-product available quantity.
    //
    // When a productId is supplied, we pull rows from the inventory_levels
    // view (indexed on product_id) and compute availability via the shared
    // `calculateAvailableQuantity` helper to keep the formula in exactly
    // one place per conventions §27.
    // -------------------------------------------------------------------
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

    const data = locRows.map((loc) => ({
      ...loc,
      zones: zonesByLocation.get(loc.locationId) ?? [],
      // When productId is supplied, surface per-location availability so
      // the UI can render "Warehouse X - N available". Property is absent
      // (undefined) when productId is not supplied — callers that need
      // availability should always pass productId.
      ...(productId
        ? { availableQty: availabilityByLocation.get(loc.locationId) ?? 0 }
        : {}),
    }));

    return data;
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
            customerName: customers.name,
            customerNumber: customers.customerNumber,
          })
          .from(salesOrders)
          .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
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
            customerName: customers.name,
            customerNumber: customers.customerNumber,
          })
          .from(salesOrderShipments)
          .innerJoin(
            salesOrders,
            eq(salesOrders.salesOrderId, salesOrderShipments.salesOrderId),
          )
          .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
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
            customerName: customers.name,
            customerNumber: customers.customerNumber,
          })
          .from(salesOrderReturns)
          .innerJoin(
            salesOrders,
            eq(salesOrders.salesOrderId, salesOrderReturns.salesOrderId),
          )
          .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
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

  /**
   * Record a strictly balanced inventory movement in the immutable ledger.
   * This creates a header (inventory_entries), the ledger lines (inventory_ledger),
   * updates the cache (bin_contents), and emits an outbox event.
   */
  async recordInventoryMovement(
    tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    params: {
      entryNumber: string;
      sourceType: string;
      sourceId?: string;
      memo?: string;
      userId?: string;
      lines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string; // <-- strictly required
      }[];
    },
  ) {
    if (params.lines.length === 0) return;

    // 1. Prepare absolute base quantities for all input lines
    const processedLines = [];
    for (const line of params.lines) {
      const absoluteQty = await this.uomService.calculateAbsoluteBaseQuantity(
        line.productId,
        [{ quantity: line.quantity, uomCode: line.uomCode }],
        tx,
      );
      processedLines.push({ ...line, absoluteQuantity: absoluteQty });
    }

    // 2. Create Header
    const [entry] = await tx
      .insert(inventoryEntries)
      .values({
        entryNumber: params.entryNumber,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        memo: params.memo,
        createdBy: params.userId,
      })
      .returning({ entryId: inventoryEntries.entryId });

    // 1b. Resolve Zone and Location for all bins
    const binIds = [...new Set(params.lines.map((l) => l.binId))];
    const resolvedBins = await tx
      .select()
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(inArray(bins.binId, binIds));

    const binMap = new Map<
      string,
      { binId: string; locationId: string | null; zoneId: string | null }
    >(
      resolvedBins.map((row) => {
        const b = row.bins;
        const z = row.zones;
        return [b.binId, { ...b, locationId: z.locationId }];
      }),
    );

    // 2. Create Ledger Lines
    const ledgerPayload = processedLines.map((l) => {
      const b = binMap.get(l.binId);
      if (!b) throw new Error(`Bin ${l.binId} not found in database`);
      return {
        entryId: entry.entryId,
        productId: l.productId,
        binId: l.binId,
        locationId: b.locationId as string,
        zoneId: b.zoneId as string,
        quantity: l.absoluteQuantity.toString(),
      };
    });
    await tx.insert(inventoryLedger).values(ledgerPayload);

    // 4. Update Cache (bin_contents)
    for (const line of processedLines) {
      await tx
        .insert(binContents)
        .values({
          binId: line.binId,
          productId: line.productId,
          actualQuantity: line.absoluteQuantity.toString(),
          modifiedOn: new Date(),
        })
        .onConflictDoUpdate({
          target: [binContents.binId, binContents.productId],
          set: {
            actualQuantity: sql`${binContents.actualQuantity} + ${line.absoluteQuantity.toString()}`,
            modifiedOn: new Date(),
          },
        });
    }

    // 5. Cleanup Zero Quantity Cache Entries
    for (const line of processedLines) {
      await tx
        .delete(binContents)
        .where(
          and(
            eq(binContents.binId, line.binId),
            eq(binContents.productId, line.productId),
            lte(sql`${binContents.actualQuantity}::numeric`, 0),
          ),
        );
    }

    // --- Financial Integration: Post Shrinkage Journal Entry via Accounting Strategy ---
    if (params.sourceType === 'MANUAL_ADJUST') {
      const productIds = [...new Set(processedLines.map((l) => l.productId))];
      if (productIds.length > 0) {
        const productRows = await tx
          .select({
            productId: products.productId,
            standardCost: products.standardCost,
            weightedAverageCost: products.weightedAverageCost,
          })
          .from(products)
          .where(inArray(products.productId, productIds));

        const productMap = new Map<
          string,
          {
            productId: string;
            standardCost: string | null;
            weightedAverageCost: string | null;
          }
        >(productRows.map((p) => [p.productId, p]));
        const valuationStrategy = getValuationStrategy(
          this.appConfig.valuationMethod(),
        );

        let totalShrinkageValue = 0; // Positive means we lost inventory (expense), Negative means we gained inventory (income)

        for (const line of processedLines) {
          const p = productMap.get(line.productId);
          if (p) {
            const cost = valuationStrategy.getCogs(
              {
                productId: p.productId,
                standardCost: p.standardCost || '0',
                weightedAverageCost: p.weightedAverageCost || '0',
              },
              Math.abs(line.absoluteQuantity),
            );

            if (line.absoluteQuantity > 0) {
              totalShrinkageValue -= parseFloat(cost); // Gained inventory
            } else if (line.absoluteQuantity < 0) {
              totalShrinkageValue += parseFloat(cost); // Lost inventory
            }
          }
        }

        if (Math.abs(totalShrinkageValue) > 0.001) {
          const accountingStrategy = getAccountingStrategy(
            this.appConfig.inventoryAccountingMode(),
            {
              inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
              grniAccountId: this.appConfig.defaultGrniAccountId(),
              cogsAccountId: this.appConfig.defaultCogsAccountId(),
              shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
              ppvAccountId: this.appConfig.defaultPpvAccountId(),
            },
          );

          const direction = totalShrinkageValue > 0 ? 'loss' : 'gain';
          const adjustmentGl = accountingStrategy.onManualAdjustment(
            {
              amount: Number(Math.abs(totalShrinkageValue).toFixed(2)),
              memo: `Manual Adjustment ${params.entryNumber}`,
            },
            direction,
          );

          if (adjustmentGl) {
            await this.glService.postJournalEntry(
              adjustmentGl.lines as Parameters<
                GlService['postJournalEntry']
              >[0],
              {
                actor: params.userId || 'system',
                entryDate: new Date().toISOString().slice(0, 10),
                sourceType: adjustmentGl.sourceType,
                sourceId: entry.entryId,
                memo:
                  params.memo || `Inventory Adjustment ${params.entryNumber}`,
              },
              tx,
            );
          }
        }
      }
    }

    // 4. Emit event for ERP sync (and system events audit)
    await emitEvent(tx, {
      entityType: EntityType.INVENTORY_LEDGER,
      entityId: entry.entryId,
      eventType: EventType.ENTRY_POSTED,
      entityDisplayName: params.entryNumber,
      payload: { header: params, lines: ledgerPayload },
    });
  }

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

  async putaway(dto: import('./dto').PutawayBulkDto, userId: string) {
    return await this.db.transaction(async (tx) => {
      for (const lineDto of dto.putaways) {
        let locationId: string;
        let productId: string;
        let putawayStatus: string;
        let sourceBinCode: string;
        let referenceNumber: string;
        let recordSourceType: string;
        let recordSourceId: string;
        let linePrefix: string;
        let uomCode: string;

        if (lineDto.sourceType === 'goods_receipt') {
          const [grLine] = await tx
            .select({
              line: goodsReceivedLines,
              locationId: goodsReceived.locationId,
              receiptNumber: goodsReceived.receiptNumber,
              uomCode: purchaseOrderLineItems.unitOfMeasure,
              baseUom: products.baseUom,
            })
            .from(goodsReceivedLines)
            .innerJoin(
              goodsReceived,
              eq(
                goodsReceivedLines.goodsReceivedId,
                goodsReceived.goodsReceivedId,
              ),
            )
            .leftJoin(
              purchaseOrderLineItems,
              eq(
                goodsReceivedLines.purchaseOrderLineId,
                purchaseOrderLineItems.purchaseOrderLineId,
              ),
            )
            .leftJoin(
              products,
              eq(goodsReceivedLines.productId, products.productId),
            )
            .where(eq(goodsReceivedLines.goodsReceivedLineId, lineDto.lineId))
            .limit(1);

          if (!grLine)
            throw new NotFoundException(`Line ${lineDto.lineId} not found`);
          if (grLine.line.matchStatus !== MATCH_STATUS.MATCHED) {
            throw new BadRequestException(
              `Cannot putaway unmatched line: ${lineDto.lineId}`,
            );
          }

          locationId = grLine.locationId;
          productId = grLine.line.productId;
          putawayStatus = grLine.line.putawayStatus;
          referenceNumber = grLine.receiptNumber;
          recordSourceType = 'PO_RECEIPT';
          recordSourceId = grLine.line.goodsReceivedId;
          linePrefix = grLine.line.goodsReceivedLineId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : 'RECEIVING';
          uomCode = grLine.uomCode || grLine.baseUom || 'EA';
        } else if (lineDto.sourceType === 'transfer_receipt') {
          const [toLine] = await tx
            .select({
              line: transferOrderReceiptLines,
              locationId: transferOrders.destinationLocationId,
              receiptNumber: transferOrderReceipts.receiptNumber,
              baseUom: products.baseUom,
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
            .leftJoin(
              products,
              eq(transferOrderReceiptLines.productId, products.productId),
            )
            .where(eq(transferOrderReceiptLines.receiptLineId, lineDto.lineId))
            .limit(1);

          if (!toLine)
            throw new NotFoundException(`Line ${lineDto.lineId} not found`);

          locationId = toLine.locationId;
          productId = toLine.line.productId;
          putawayStatus = toLine.line.putawayStatus;
          referenceNumber = toLine.receiptNumber;
          recordSourceType = 'TRANSFER_IN';
          recordSourceId = toLine.line.receiptId;
          linePrefix = toLine.line.receiptLineId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : 'RECEIVING';
          uomCode = toLine.baseUom || 'EA';
        } else {
          // sales_return
          const [retLine] = await tx
            .select({
              line: salesOrderReturnLines,
              locationId: salesOrders.fulfillmentLocationId,
              returnNumber: salesOrderReturns.returnNumber,
              productId: salesOrderLineItems.productId,
              uomCode: salesOrderLineItems.unitOfMeasure,
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
            .where(eq(salesOrderReturnLines.returnLineId, lineDto.lineId))
            .limit(1);

          if (!retLine)
            throw new NotFoundException(
              `Return line ${lineDto.lineId} not found`,
            );

          locationId = retLine.locationId;
          productId = retLine.productId!;
          putawayStatus = retLine.line.putawayStatus;
          referenceNumber = retLine.returnNumber;
          recordSourceType = 'SO_RETURN';
          recordSourceId = retLine.line.returnId;
          linePrefix = retLine.line.returnLineId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : 'CUSTOMER_RETURNS';
          uomCode = retLine.uomCode || 'EA';
        }

        if (putawayStatus === PUTAWAY_STATUS.COMPLETED) {
          throw new BadRequestException(
            `Line ${lineDto.lineId} is already putaway`,
          );
        }

        const [sourceBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(zones.locationId, locationId),
              eq(bins.binNumber, sourceBinCode),
            ),
          )
          .limit(1);

        if (!sourceBin) {
          throw new BadRequestException(
            `Source bin ${sourceBinCode} not found for line ${lineDto.lineId}`,
          );
        }

        const qty = parseFloat(lineDto.quantity);

        const movements: {
          productId: string;
          binId: string;
          quantity: number;
          uomCode: string;
        }[] = [
          { productId, binId: sourceBin.binId, quantity: -qty, uomCode },
          {
            productId,
            binId: lineDto.destinationBinId,
            quantity: qty,
            uomCode,
          },
        ];

        // Handle discrepancies
        if (lineDto.newTotalQuantity !== undefined) {
          const newTotal = parseFloat(lineDto.newTotalQuantity);
          const [destBinContent] = await tx
            .select({ actualQuantity: binContents.actualQuantity })
            .from(binContents)
            .where(
              and(
                eq(binContents.productId, productId),
                eq(binContents.binId, lineDto.destinationBinId),
              ),
            )
            .limit(1);

          const currentDbQty = destBinContent
            ? parseFloat(destBinContent.actualQuantity)
            : 0;
          const expectedTotal = currentDbQty + qty;
          const discrepancy = newTotal - expectedTotal;

          if (Math.abs(discrepancy) > 0.001) {
            movements.push({
              productId,
              binId: lineDto.destinationBinId,
              quantity: discrepancy,
              uomCode,
            });
            this.logger.warn(
              `Putaway discrepancy adjustment created. Expected: ${expectedTotal}, Counted: ${newTotal}, Adj: ${discrepancy}`,
            );
          }
        }

        await this.recordInventoryMovement(tx, {
          entryNumber: `PUT-${referenceNumber}-${linePrefix}`,
          sourceType: recordSourceType,
          sourceId: recordSourceId,
          memo: `Putaway to ${lineDto.destinationBinId}`,
          userId,
          lines: movements,
        });

        // Mark line as completed
        if (lineDto.sourceType === 'goods_receipt') {
          await tx
            .update(goodsReceivedLines)
            .set({ putawayStatus: PUTAWAY_STATUS.COMPLETED })
            .where(eq(goodsReceivedLines.goodsReceivedLineId, lineDto.lineId));
        } else if (lineDto.sourceType === 'transfer_receipt') {
          await tx
            .update(transferOrderReceiptLines)
            .set({ putawayStatus: PUTAWAY_STATUS.COMPLETED })
            .where(eq(transferOrderReceiptLines.receiptLineId, lineDto.lineId));
        } else {
          await tx
            .update(salesOrderReturnLines)
            .set({ putawayStatus: PUTAWAY_STATUS.COMPLETED })
            .where(eq(salesOrderReturnLines.returnLineId, lineDto.lineId));
        }

        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.WAREHOUSE,
          entityId: lineDto.lineId,
          eventType: EventType.PUTAWAY_COMPLETED,
          entityDisplayName: referenceNumber,
          payload: {
            lineId: lineDto.lineId,
            sourceType: lineDto.sourceType,
            productId,
            quantityPutaway: lineDto.quantity,
            destinationBinId: lineDto.destinationBinId,
          },
          actor: userId,
        });
      }

      // Check if any returns should be transitioned to RECEIVED automatically
      const affectedReturnIds = Array.from(
        new Set(
          dto.putaways
            .filter((p) => p.sourceType === 'sales_return')
            .map((p) => p.lineId),
        ),
      );

      if (affectedReturnIds.length > 0) {
        for (const lineId of affectedReturnIds) {
          const [rl] = await tx
            .select({ returnId: salesOrderReturnLines.returnId })
            .from(salesOrderReturnLines)
            .where(eq(salesOrderReturnLines.returnLineId, lineId));

          if (rl) {
            const lines = await tx
              .select({ putawayStatus: salesOrderReturnLines.putawayStatus })
              .from(salesOrderReturnLines)
              .where(eq(salesOrderReturnLines.returnId, rl.returnId));

            const allCompleted =
              lines.length > 0 &&
              lines.every((l) => l.putawayStatus === PUTAWAY_STATUS.COMPLETED);

            if (allCompleted) {
              const [ret] = await tx
                .select({
                  stateCode: salesOrderReturns.stateCode,
                  salesOrderId: salesOrderReturns.salesOrderId,
                  returnNumber: salesOrderReturns.returnNumber,
                })
                .from(salesOrderReturns)
                .where(eq(salesOrderReturns.returnId, rl.returnId));

              if (
                ret &&
                ret.stateCode !== RETURN_STATE.RECEIVED &&
                ret.stateCode !== RETURN_STATE.PROCESSED
              ) {
                await this.changeReturnState(
                  tx,
                  rl.returnId,
                  RETURN_STATE.RECEIVED,
                );

                const [order] = await tx
                  .select({ orderNumber: salesOrders.orderNumber })
                  .from(salesOrders)
                  .where(eq(salesOrders.salesOrderId, ret.salesOrderId));
                await emitEvent(tx, {
                  entityType: EntityType.SALES_ORDER,
                  entityId: ret.salesOrderId,
                  eventType: EventType.STATUS_CHANGED,
                  entityDisplayName: order.orderNumber,
                  payload: {
                    entity: 'return',
                    entityId: rl.returnId,
                    from: ret.stateCode,
                    to: RETURN_STATE.RECEIVED,
                    returnNumber: ret.returnNumber,
                    reason: 'Auto-transition from complete putaway',
                  },
                  actor: userId,
                });
              }
            }
          }
        }
      }

      return { success: true };
    });
  }

  async quarantineStock(
    dto: import('./dto').QuarantineMoveDto,
    userId: string,
  ) {
    return await this.db.transaction(async (tx) => {
      let locationId: string;
      let productId = dto.productId;
      let quantityToMove = parseFloat(dto.quantity || '0');
      let currentPutawayStatus: string | undefined;

      // Auto-resolve for line-based actions
      if (dto.lineId && dto.sourceType) {
        let defaultBinCode: string;

        if (dto.sourceType === 'goods_receipt') {
          const [grLine] = await tx
            .select({
              line: goodsReceivedLines,
              locationId: goodsReceived.locationId,
            })
            .from(goodsReceivedLines)
            .innerJoin(
              goodsReceived,
              eq(
                goodsReceivedLines.goodsReceivedId,
                goodsReceived.goodsReceivedId,
              ),
            )
            .where(eq(goodsReceivedLines.goodsReceivedLineId, dto.lineId))
            .limit(1);

          if (!grLine) throw new NotFoundException('Line not found');

          locationId = grLine.locationId;
          productId = productId || grLine.line.productId;
          currentPutawayStatus = grLine.line.putawayStatus;
          if (!dto.quantity)
            quantityToMove = parseFloat(grLine.line.quantityReceived);
          defaultBinCode = 'RECEIVING';
        } else {
          const [retLine] = await tx
            .select({
              line: salesOrderReturnLines,
              locationId: salesOrders.fulfillmentLocationId,
              productId: salesOrderLineItems.productId,
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
            .where(eq(salesOrderReturnLines.returnLineId, dto.lineId))
            .limit(1);

          if (!retLine) throw new NotFoundException('Line not found');

          locationId = retLine.locationId;
          productId = productId || retLine.productId!;
          currentPutawayStatus = retLine.line.putawayStatus;
          if (!dto.quantity)
            quantityToMove = parseFloat(retLine.line.quantityReturned);
          defaultBinCode = 'CUSTOMER_RETURNS';
        }

        if (currentPutawayStatus === PUTAWAY_STATUS.COMPLETED) {
          throw new BadRequestException(
            'Cannot quarantine an already putaway line',
          );
        }

        const isCurrentlyQuarantined =
          currentPutawayStatus === PUTAWAY_STATUS.QUARANTINED;

        if (!dto.sourceBinId) {
          const sourceBinCode = isCurrentlyQuarantined
            ? 'QUARANTINE'
            : defaultBinCode;
          const [sBin] = await tx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, locationId),
                eq(bins.binNumber, sourceBinCode),
              ),
            )
            .limit(1);
          if (!sBin)
            throw new BadRequestException(
              `Source bin ${sourceBinCode} not found`,
            );
          dto.sourceBinId = sBin.binId;
        }

        if (!dto.targetBinId) {
          const targetBinCode = isCurrentlyQuarantined
            ? defaultBinCode
            : 'QUARANTINE';
          const [tBin] = await tx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, locationId),
                eq(bins.binNumber, targetBinCode),
              ),
            )
            .limit(1);
          if (!tBin)
            throw new BadRequestException(
              `Target bin ${targetBinCode} not found`,
            );
          dto.targetBinId = tBin.binId;
        }
      }

      if (!dto.sourceBinId)
        throw new BadRequestException('sourceBinId is required');
      if (!productId) throw new BadRequestException('productId is required');
      if (!quantityToMove || quantityToMove <= 0)
        throw new BadRequestException('quantity is required');

      // Fetch source bin
      const [sourceBin] = await tx
        .select({
          binId: bins.binId,
          binType: bins.binType,
          zoneId: bins.zoneId,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.sourceBinId))
        .limit(1);

      if (!sourceBin) throw new BadRequestException('Source bin not found');

      const isUnquarantining =
        sourceBin.binType === (BIN_TYPE.QUARANTINE as string);

      let targetBinId = dto.targetBinId;

      if (isUnquarantining) {
        if (!targetBinId) {
          throw new BadRequestException(
            'targetBinId is required when moving stock out of quarantine',
          );
        }
        const [targetBin] = await tx
          .select({
            binId: bins.binId,
            binType: bins.binType,
            locationId: zones.locationId,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, targetBinId))
          .limit(1);

        if (!targetBin) throw new BadRequestException('Target bin not found');
        if (targetBin.locationId !== sourceBin.locationId)
          throw new BadRequestException(
            'Target bin must be in the same location',
          );
        if (targetBin.binType === (BIN_TYPE.QUARANTINE as string))
          throw new BadRequestException(
            'Target bin cannot be a quarantine bin when unquarantining',
          );
      } else {
        if (targetBinId) {
          const [targetBin] = await tx
            .select({
              binId: bins.binId,
              binType: bins.binType,
              locationId: zones.locationId,
            })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(eq(bins.binId, targetBinId))
            .limit(1);

          if (!targetBin) throw new BadRequestException('Target bin not found');
          if (targetBin.locationId !== sourceBin.locationId)
            throw new BadRequestException(
              'Target bin must be in the same location',
            );
          if (targetBin.binType !== (BIN_TYPE.QUARANTINE as string))
            throw new BadRequestException(
              'Target bin must be a quarantine type bin',
            );
        } else {
          // Auto-resolve first quarantine bin in location
          const [targetBin] = await tx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, sourceBin.locationId),
                eq(bins.binType, 'quarantine'),
              ),
            )
            .limit(1);
          if (!targetBin)
            throw new BadRequestException(
              'No quarantine bin found in this location',
            );
          targetBinId = targetBin.binId;
        }
      }

      // Check available quantity in source bin
      const [binContent] = await tx
        .select({ quantity: binContents.actualQuantity })
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, sourceBin.binId),
            eq(binContents.productId, productId),
          ),
        )
        .limit(1);

      const availableQty = parseFloat(binContent?.quantity || '0');

      if (availableQty < quantityToMove) {
        throw new BadRequestException(
          `Insufficient stock in source bin. Available: ${availableQty}`,
        );
      }

      const reference = dto.lineId
        ? `LINE-${dto.lineId.substring(0, 4)}`
        : `BIN-${sourceBin.binId.substring(0, 4)}`;
      const prefix = isUnquarantining ? 'UNQUAR' : 'QUAR';
      const recordSourceType =
        dto.sourceType === 'goods_receipt'
          ? 'PO_RECEIPT'
          : dto.sourceType === 'sales_return'
            ? 'SO_RETURN'
            : 'MANUAL';
      const recordSourceId = dto.lineId || dto.sourceBinId;

      const [product] = await tx
        .select({ baseUom: products.baseUom })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);

      await this.recordInventoryMovement(tx, {
        entryNumber: `${prefix}-${reference}`,
        sourceType: recordSourceType,
        sourceId: recordSourceId,
        memo: `${isUnquarantining ? 'Un-quarantine' : 'Quarantine'} item. Reason: ${dto.reason || 'None'}`,
        userId,
        lines: [
          {
            productId: productId,
            binId: sourceBin.binId,
            quantity: -quantityToMove,
            uomCode: product.baseUom,
          },
          {
            productId: productId,
            binId: targetBinId,
            quantity: quantityToMove,
            uomCode: product.baseUom,
          },
        ],
      });

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.WAREHOUSE,
        entityId: dto.sourceBinId,
        eventType: EventType.STOCK_MOVED,
        entityDisplayName: reference,
        payload: {
          productId,
          sourceBinId: sourceBin.binId,
          targetBinId,
          quantity: quantityToMove,
          reason: dto.reason,
          isUnquarantining,
        },
        actor: userId,
      });

      let newStatus = undefined;
      // Optional line update
      if (dto.lineId && dto.sourceType) {
        newStatus = isUnquarantining
          ? PUTAWAY_STATUS.PENDING_PUTAWAY
          : PUTAWAY_STATUS.QUARANTINED;
        if (dto.sourceType === 'goods_receipt') {
          await tx
            .update(goodsReceivedLines)
            .set({ putawayStatus: newStatus })
            .where(eq(goodsReceivedLines.goodsReceivedLineId, dto.lineId));
        } else if (dto.sourceType === 'sales_return') {
          await tx
            .update(salesOrderReturnLines)
            .set({ putawayStatus: newStatus })
            .where(eq(salesOrderReturnLines.returnLineId, dto.lineId));
        }
      }

      return { success: true, putawayStatus: newStatus };
    });
  }

  async moveStock(dto: import('./dto').MoveStockDto, userId: string) {
    return await this.db.transaction(async (tx) => {
      const movementLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];
      const reasonStr = dto.reason || 'Manual stock move';

      for (const line of dto.lines) {
        const [product] = await tx
          .select({ baseUom: products.baseUom })
          .from(products)
          .where(eq(products.productId, line.productId))
          .limit(1);

        // Fetch source and target bin details
        const [sourceBinInfo] = await tx
          .select({
            binId: bins.binId,
            binNumber: bins.binNumber,
            locationId: zones.locationId,
            zoneCode: zones.code,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, line.sourceBinId))
          .limit(1);

        const [targetBinInfo] = await tx
          .select({
            binId: bins.binId,
            locationId: zones.locationId,
            zoneCode: zones.code,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, line.targetBinId))
          .limit(1);

        if (!sourceBinInfo) {
          throw new BadRequestException(
            `Source bin ${line.sourceBinId} not found`,
          );
        }
        if (!targetBinInfo) {
          throw new BadRequestException(
            `Target bin ${line.targetBinId} not found`,
          );
        }
        if (sourceBinInfo.locationId !== targetBinInfo.locationId) {
          throw new BadRequestException(
            'Cannot move stock between different locations. Please use Transfer Orders instead.',
          );
        }
        if (targetBinInfo.zoneCode === 'HANDLING') {
          throw new BadRequestException(
            'Cannot manually move stock into system HANDLING bins.',
          );
        }
        if (
          sourceBinInfo.binNumber === 'RECEIVING' &&
          targetBinInfo.zoneCode !== 'HANDLING'
        ) {
          throw new BadRequestException(
            'Cannot manually move stock out of RECEIVING bins. Please use the Putaway process.',
          );
        }

        const qtyToMove = parseFloat(line.quantity);
        if (qtyToMove <= 0) {
          throw new BadRequestException(
            'Quantity to move must be greater than zero',
          );
        }

        // Verify available quantity in source bin
        const [binContent] = await tx
          .select({ quantity: binContents.actualQuantity })
          .from(binContents)
          .where(
            and(
              eq(binContents.binId, line.sourceBinId),
              eq(binContents.productId, line.productId),
            ),
          )
          .limit(1);

        const availableQty = parseFloat(binContent?.quantity || '0');
        if (availableQty < qtyToMove) {
          throw new BadRequestException(
            `Insufficient stock in source bin. Available: ${availableQty}`,
          );
        }

        movementLines.push(
          {
            productId: line.productId,
            binId: line.sourceBinId,
            quantity: -qtyToMove,
            uomCode: product?.baseUom || 'EA',
          },
          {
            productId: line.productId,
            binId: line.targetBinId,
            quantity: qtyToMove,
            uomCode: product?.baseUom || 'EA',
          },
        );
      }

      if (movementLines.length > 0) {
        const entryNumber = `MOVE-${randomUUID().substring(0, 8).toUpperCase()}`;
        await this.recordInventoryMovement(tx, {
          entryNumber,
          sourceType: 'MANUAL',
          memo: dto.reason || 'N/A',
          userId,
          lines: movementLines,
        });

        // Emit general inventory moved event
        // Note: For advanced integration, we could emit individual events per line, but for this workflow one bulk event is often simpler.
        // @herobm-skip-audit - DB write is performed by recordInventoryMovement
        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.WAREHOUSE,
          entityId: dto.lines[0].sourceBinId, // Using first source bin as reference
          eventType: EventType.STOCK_MOVED,
          entityDisplayName: entryNumber,
          payload: {
            reason: reasonStr,
            lines: dto.lines,
          },
          actor: userId,
        });
      }

      return { success: true };
    });
  }

  private async changeReturnState(
    tx: DrizzleDB,
    returnId: string,
    stateCode: (typeof RETURN_STATE)[keyof typeof RETURN_STATE],
  ) {
    const [updated] = await tx
      .update(salesOrderReturns)
      .set({ stateCode })
      .where(eq(salesOrderReturns.returnId, returnId))
      .returning();

    if (updated) {
      await emitEvent(tx, {
        entityType: EntityType.SALES_RETURN,
        entityId: returnId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: updated.returnNumber,
        payload: {
          stateCode,
        },
        actor: 'system', // mostly system-driven
      });
    }
  }

  async adjustStock(dto: import('./dto').AdjustStockDto, userId: string) {
    if (!dto.lines || dto.lines.length === 0) return { success: true };

    return await this.db.transaction(async (tx) => {
      const movementLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];
      const reasonStr = dto.reason || 'N/A';

      for (const line of dto.lines) {
        const [product] = await tx
          .select({ baseUom: products.baseUom })
          .from(products)
          .where(eq(products.productId, line.productId))
          .limit(1);

        const currentContent = await tx
          .select({ actualQuantity: binContents.actualQuantity })
          .from(binContents)
          .where(
            and(
              eq(binContents.binId, line.binId),
              eq(binContents.productId, line.productId),
            ),
          )
          .limit(1);

        const currentQty =
          currentContent.length > 0
            ? Number(currentContent[0].actualQuantity)
            : 0;
        const newQty = Number(line.newQuantity);
        const diff = newQty - currentQty;

        if (Math.abs(diff) > 0.001) {
          movementLines.push({
            productId: line.productId,
            binId: line.binId,
            quantity: diff,
            uomCode: product?.baseUom || 'EA',
          });
        }
      }

      if (movementLines.length > 0) {
        const entryNumber = `ADJ-${randomUUID().substring(0, 8).toUpperCase()}`;
        await this.recordInventoryMovement(tx, {
          entryNumber,
          sourceType: 'MANUAL_ADJUST',
          memo: reasonStr,
          userId,
          lines: movementLines,
        });
        // @herobm-skip-audit - DB write is performed by recordInventoryMovement
        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.WAREHOUSE,
          entityId: dto.lines[0].binId,
          eventType: EventType.STOCK_MOVED,
          entityDisplayName: entryNumber,
          payload: {
            reason: reasonStr,
            lines: movementLines,
          },
          actor: userId,
        });
      }

      return { success: true };
    });
  }
}
