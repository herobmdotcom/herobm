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
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
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
} from '@modbm/shared';
import { UomService } from './uom.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from './valuation';
import { getAccountingStrategy } from './inventory-accounting';
import {
  filterPickableBins,
  calculatePickableOnHand,
} from './inventory-math.utils';

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

    let qb = this.db
      .select({
        inventoryLevelId: inventoryLevels.inventoryLevelId,
        productId: inventoryLevels.productId,
        productNumber: products.productNumber,
        productName: products.name,
        locationNo: locations.code,
        locationName: locations.name,
        quantityOnHand: inventoryLevels.quantityOnHand,
        quantityCommitted: inventoryLevels.quantityCommitted,
        quantityReserved: inventoryLevels.quantityReserved,
        quantityOnOrder: inventoryLevels.quantityOnOrder,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.productId))
      .leftJoin(locations, eq(inventoryLevels.locationId, locations.locationId))
      .$dynamic();

    const filters = [];

    if (searchTerm) {
      const term = `%${searchTerm}%`;
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
    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { name: string; id: string }, dir) => {
        const cursorCond =
          dir === 'next'
            ? or(
                sql`${products.name} > ${c.name}`,
                and(
                  eq(products.name, c.name),
                  sql`${inventoryLevels.inventoryLevelId} > ${c.id}`,
                ),
              )
            : or(
                sql`${products.name} < ${c.name}`,
                and(
                  eq(products.name, c.name),
                  sql`${inventoryLevels.inventoryLevelId} < ${c.id}`,
                ),
              );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(products.name),
          orderFn(inventoryLevels.inventoryLevelId),
        );
      },
      encodeRow: (row) => ({ name: row.productName, id: row.inventoryLevelId }),
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
    txClient?: any,
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

  async findBins(query?: PaginationQuery & { locationNo?: string }) {
    const { page, limit, cursor, direction, searchTerm } =
      parsePagination(query);

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
      })
      .from(binContents)
      .innerJoin(bins, eq(binContents.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .innerJoin(locations, eq(zones.locationId, locations.locationId))
      .innerJoin(products, eq(binContents.productId, products.productId))
      .$dynamic();

    const filters = [];

    if (searchTerm) {
      filters.push(
        or(
          ilike(products.name, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(products.alternateProductNumber, searchTerm),
          ilike(bins.binNumber, searchTerm),
        ),
      );
    }

    if (query?.locationNo) {
      filters.push(eq(locations.code, query.locationNo));
    }

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
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { bin: string; name: string; id: string }, dir) => {
        const cursorCond =
          dir === 'next'
            ? or(
                sql`${bins.binNumber} > ${c.bin}`,
                and(
                  eq(bins.binNumber, c.bin),
                  sql`${products.name} > ${c.name}`,
                ),
                and(
                  eq(bins.binNumber, c.bin),
                  eq(products.name, c.name),
                  sql`${binContents.binContentId} > ${c.id}`,
                ),
              )
            : or(
                sql`${bins.binNumber} < ${c.bin}`,
                and(
                  eq(bins.binNumber, c.bin),
                  sql`${products.name} < ${c.name}`,
                ),
                and(
                  eq(bins.binNumber, c.bin),
                  eq(products.name, c.name),
                  sql`${binContents.binContentId} < ${c.id}`,
                ),
              );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(bins.binNumber),
          orderFn(products.name),
          orderFn(binContents.binContentId),
        );
      },
      encodeRow: (row) => ({
        bin: row.binNumber,
        name: row.productName,
        id: row.binContentId,
      }),
    });

    const productIds = Array.from(new Set(rows.map((r) => r.productId)));

    let allUoms: any[] = [];
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
          sql`${bins.binType} IN ('storage', 'pick', 'bulk')`,
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
    const zonesByLocation = new Map<string, any[]>();
    for (const z of zoneRows) {
      const arr = zonesByLocation.get(z.locationId) ?? [];
      arr.push({ ...z, bins: [] as any[] });
      zonesByLocation.set(z.locationId, arr);
    }

    for (const b of binRows) {
      for (const [, zArr] of zonesByLocation) {
        const zone = zArr.find((z: any) => z.zoneId === b.zoneId);
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

  async getMovements(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    const query = sql`
      SELECT
        p.product_number AS "productNumber",
        p.name AS "productName",
        SUM(CASE WHEN l.quantity::numeric > 0 THEN l.quantity::numeric ELSE 0 END) AS "stockIn",
        SUM(CASE WHEN l.quantity::numeric < 0 THEN ABS(l.quantity::numeric) ELSE 0 END) AS "stockOut",
        SUM(l.quantity::numeric) AS "netChange",
        COALESCE(inv.qty, 0) AS "onHand"
      FROM modbm_core.inventory_ledger l
      JOIN modbm_core.inventory_entries e ON e.entry_id = l.entry_id
      JOIN modbm_core.products p ON p.product_id = l.product_id
      LEFT JOIN (
        SELECT bc.product_id, SUM(bc.actual_quantity) as qty
        FROM modbm_core.bin_contents bc
        JOIN modbm_core.bins b ON b.bin_id = bc.bin_id
        WHERE b.bin_type IN ('storage', 'pick', 'bulk')
          AND b.is_unavailable = false
          AND b.is_bonded = false
        GROUP BY bc.product_id
      ) inv ON inv.product_id = p.product_id
      WHERE e.entry_date >= ${cutoffIso}
        AND e.source_type != 'INITIAL_IMPORT'
      GROUP BY p.product_id, p.product_number, p.name, inv.qty
      HAVING SUM(ABS(l.quantity::numeric)) > 0
      ORDER BY p.name ASC
    `;

    const result = await this.db.execute(query);
    const rows = (result as any).rows ?? result;
    return { data: rows };
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
      FROM modbm_core.inventory_ledger l
      JOIN modbm_core.inventory_entries e ON e.entry_id = l.entry_id
      JOIN modbm_core.products p ON p.product_id = l.product_id
      LEFT JOIN (
        SELECT bc.product_id, SUM(bc.actual_quantity) as qty
        FROM modbm_core.bin_contents bc
        JOIN modbm_core.bins b ON b.bin_id = bc.bin_id
        WHERE b.bin_type IN ('storage', 'pick', 'bulk')
          AND b.is_unavailable = false
          AND b.is_bonded = false
        GROUP BY bc.product_id
      ) inv ON inv.product_id = p.product_id
      WHERE e.entry_date >= ${cutoffIso}
        AND e.source_type != 'INITIAL_IMPORT'
      ORDER BY e.entry_date DESC, l.ledger_id DESC
      LIMIT 10000
    `;

    const result = await this.db.execute(query);
    const rows = (result as any).rows ?? result;
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
      FROM modbm_core.inventory_ledger l
      JOIN modbm_core.products p ON p.product_id = l.product_id
      JOIN modbm_core.bins b ON b.bin_id = l.bin_id
      JOIN modbm_core.locations loc ON loc.location_id = l.location_id
      WHERE l.entry_id = ${entryId}
      ORDER BY p.name ASC
    `;
    const linesResult = await this.db.execute(linesQuery);
    const lines = (linesResult as any).rows ?? linesResult;

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
    tx: any,
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
        uomCode?: string;
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

    const binMap = new Map<string, any>(
      resolvedBins.map((row: any) => {
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
        locationId: b.locationId,
        zoneId: b.zoneId,
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
        >(productRows.map((p: any) => [p.productId, p]));
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
              adjustmentGl.lines as any,
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
      aggregateType: AggregateType.SYSTEM,
      aggregateId: entry.entryId,
      eventType: EventType.STOCK_ADJUSTED,
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

    const [grLines, retLines] = await Promise.all([grQb, retQb]);

    const combined = [...grLines, ...retLines].sort((a, b) => {
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

        if (lineDto.sourceType === 'goods_receipt') {
          const [grLine] = await tx
            .select({
              line: goodsReceivedLines,
              locationId: goodsReceived.locationId,
              receiptNumber: goodsReceived.receiptNumber,
            })
            .from(goodsReceivedLines)
            .innerJoin(
              goodsReceived,
              eq(
                goodsReceivedLines.goodsReceivedId,
                goodsReceived.goodsReceivedId,
              ),
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
        } else {
          // sales_return
          const [retLine] = await tx
            .select({
              line: salesOrderReturnLines,
              locationId: salesOrders.fulfillmentLocationId,
              returnNumber: salesOrderReturns.returnNumber,
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

        const movements: any[] = [
          { productId, binId: sourceBin.binId, quantity: -qty },
          { productId, binId: lineDto.destinationBinId, quantity: qty },
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
        } else {
          await tx
            .update(salesOrderReturnLines)
            .set({ putawayStatus: PUTAWAY_STATUS.COMPLETED })
            .where(eq(salesOrderReturnLines.returnLineId, lineDto.lineId));
        }
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

                await emitEvent(tx, {
                  aggregateType: AggregateType.SALES_ORDER,
                  aggregateId: ret.salesOrderId,
                  eventType: EventType.AUTO_STATUS_CHANGED,
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

  async toggleQuarantine(
    lineId: string,
    sourceType: 'goods_receipt' | 'sales_return',
    userId: string,
    reason?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      let locationId: string;
      let productId: string;
      let currentPutawayStatus: string;
      let referenceNumber: string;
      let recordSourceType: string;
      let recordSourceId: string;
      let linePrefix: string;
      let quantityToMove: number;
      let defaultBinCode: string;

      if (sourceType === 'goods_receipt') {
        const [grLine] = await tx
          .select({
            line: goodsReceivedLines,
            locationId: goodsReceived.locationId,
            receiptNumber: goodsReceived.receiptNumber,
          })
          .from(goodsReceivedLines)
          .innerJoin(
            goodsReceived,
            eq(
              goodsReceivedLines.goodsReceivedId,
              goodsReceived.goodsReceivedId,
            ),
          )
          .where(eq(goodsReceivedLines.goodsReceivedLineId, lineId))
          .limit(1);

        if (!grLine) throw new NotFoundException('Line not found');

        locationId = grLine.locationId;
        productId = grLine.line.productId;
        currentPutawayStatus = grLine.line.putawayStatus;
        referenceNumber = grLine.receiptNumber;
        recordSourceType = 'PO_RECEIPT';
        recordSourceId = grLine.line.goodsReceivedId;
        linePrefix = grLine.line.goodsReceivedLineId.substring(0, 4);
        quantityToMove = parseFloat(grLine.line.quantityReceived);
        defaultBinCode = 'RECEIVING';
      } else {
        // sales_return
        const [retLine] = await tx
          .select({
            line: salesOrderReturnLines,
            locationId: salesOrders.fulfillmentLocationId,
            returnNumber: salesOrderReturns.returnNumber,
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
          .where(eq(salesOrderReturnLines.returnLineId, lineId))
          .limit(1);

        if (!retLine) throw new NotFoundException('Line not found');

        locationId = retLine.locationId;
        productId = retLine.productId!;
        currentPutawayStatus = retLine.line.putawayStatus;
        referenceNumber = retLine.returnNumber;
        recordSourceType = 'SO_RETURN';
        recordSourceId = retLine.line.returnId;
        linePrefix = retLine.line.returnLineId.substring(0, 4);
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
      const newStatus = isCurrentlyQuarantined
        ? PUTAWAY_STATUS.PENDING_PUTAWAY
        : PUTAWAY_STATUS.QUARANTINED;

      const sourceBinCode = isCurrentlyQuarantined
        ? 'QUARANTINE'
        : defaultBinCode;
      const targetBinCode = isCurrentlyQuarantined
        ? defaultBinCode
        : 'QUARANTINE';

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

      const [targetBin] = await tx
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

      if (!sourceBin || !targetBin) {
        throw new BadRequestException(
          `Source or target bin for quarantine operation not found in this location (${sourceBinCode} -> ${targetBinCode}).`,
        );
      }

      await this.recordInventoryMovement(tx, {
        entryNumber: `${isCurrentlyQuarantined ? 'UN' : ''}QUAR-${referenceNumber}-${linePrefix}`,
        sourceType: recordSourceType,
        sourceId: recordSourceId,
        memo: `${isCurrentlyQuarantined ? 'Un-quarantine' : 'Quarantine'} item. Reason: ${reason || 'None'}`,
        userId,
        lines: [
          { productId, binId: sourceBin.binId, quantity: -quantityToMove },
          { productId, binId: targetBin.binId, quantity: quantityToMove },
        ],
      });

      if (sourceType === 'goods_receipt') {
        await tx
          .update(goodsReceivedLines)
          .set({ putawayStatus: newStatus })
          .where(eq(goodsReceivedLines.goodsReceivedLineId, lineId));
      } else {
        await tx
          .update(salesOrderReturnLines)
          .set({ putawayStatus: newStatus })
          .where(eq(salesOrderReturnLines.returnLineId, lineId));
      }

      return { success: true, putawayStatus: newStatus };
    });
  }

  private async changeReturnState(
    tx: DrizzleDB,
    returnId: string,
    stateCode: (typeof RETURN_STATE)[keyof typeof RETURN_STATE],
  ) {
    await tx
      .update(salesOrderReturns)
      .set({ stateCode })
      .where(eq(salesOrderReturns.returnId, returnId));
  }
}
