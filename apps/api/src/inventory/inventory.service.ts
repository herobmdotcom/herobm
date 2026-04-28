import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ilike, or, eq, inArray, sql, and, isNull, desc } from 'drizzle-orm';
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
  accounts,
  purchaseOrders,
  suppliers,
  productUoms,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { calculateAvailableQuantity } from '@modbm/shared';
import { UomService } from './uom.service';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private appConfig: AppConfigService,
    private uomService: UomService,
  ) {}

  // =========================================================================
  // Read-only queries (from inventory_levels view / bin_contents cache)
  // =========================================================================

  async findAll(query?: PaginationQuery & { locationNo?: string }) {
    const { page, limit, offset, searchTerm } = parsePagination(query);

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

    if (searchTerm) {
      const term = `%${searchTerm}%`;
      qb = qb.where(
        or(
          ilike(products.name, term),
          ilike(products.productNumber, term),
          ilike(locations.code, term),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(locations.code, query.locationNo));
    }

    const rows = await qb.orderBy(products.name).limit(limit).offset(offset);

    // Provide default backward-compatible fields
    const mappedRows = rows.map((r) => ({
      ...r,
      quantityAvailable: calculateAvailableQuantity(
        r.quantityOnHand,
        r.quantityCommitted,
        r.quantityReserved,
      ),
      scNumber: null,
      defaultBinNumber: null,
    }));

    return { data: mappedRows, page, limit };
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
        scNumber: null,
        defaultBinNumber: null,
      };
    });

    return { data: mappedRows };
  }

  async findBins(query?: PaginationQuery & { locationNo?: string }) {
    const { page, limit, offset, searchTerm } = parsePagination(query);

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
      })
      .from(binContents)
      .innerJoin(bins, eq(binContents.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .innerJoin(locations, eq(zones.locationId, locations.locationId))
      .innerJoin(products, eq(binContents.productId, products.productId))
      .$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(products.name, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(bins.binNumber, searchTerm),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(locations.code, query.locationNo));
    }

    const rows = await qb
      .orderBy(bins.binNumber, products.name)
      .limit(limit)
      .offset(offset);

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

    return { data: rowsWithUoms, page, limit };
  }

  /**
   * Return the full warehouse topography hierarchy:
   * Location → Zone[] → Bin[]
   * Used by the Ops-Portal Topography read-only view.
   */
  async findAllLocations() {
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
    }));

    const defaultLocationId = this.appConfig.defaultFulfillmentLocationId();

    return {
      data,
      defaultFulfillmentLocationId: defaultLocationId ?? undefined,
    };
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
        MAX(p.quantity_on_hand::numeric) AS "onHand"
      FROM modbm_core.inventory_ledger l
      JOIN modbm_core.inventory_entries e ON e.entry_id = l.entry_id
      JOIN modbm_core.products p ON p.product_id = l.product_id
      WHERE e.entry_date >= ${cutoffIso}
        AND e.source_type != 'INITIAL_IMPORT'
      GROUP BY p.product_id, p.product_number, p.name
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
        p.quantity_on_hand::numeric AS "onHand",
        e.created_by AS "actor"
      FROM modbm_core.inventory_ledger l
      JOIN modbm_core.inventory_entries e ON e.entry_id = l.entry_id
      JOIN modbm_core.products p ON p.product_id = l.product_id
      WHERE e.entry_date >= ${cutoffIso}
        AND e.source_type != 'INITIAL_IMPORT'
      ORDER BY e.entry_date DESC, l.ledger_id DESC
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
            accountId: accounts.accountId,
            customerName: accounts.name,
            customerNumber: accounts.accountNumber,
          })
          .from(salesOrders)
          .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
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
                link: `/accounts/${o.accountId}`,
              }
            : null;
        }
      } else if (entry.sourceType === 'SO_SHIPMENT') {
        const [s] = await this.db
          .select({
            shipmentNumber: salesOrderShipments.shipmentNumber,
            salesOrderId: salesOrders.salesOrderId,
            orderNumber: salesOrders.orderNumber,
            accountId: accounts.accountId,
            customerName: accounts.name,
            customerNumber: accounts.accountNumber,
          })
          .from(salesOrderShipments)
          .innerJoin(
            salesOrders,
            eq(salesOrders.salesOrderId, salesOrderShipments.salesOrderId),
          )
          .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
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
                link: `/accounts/${s.accountId}`,
              }
            : null;
        }
      } else if (entry.sourceType === 'SO_RETURN') {
        const [ret] = await this.db
          .select({
            returnNumber: salesOrderReturns.returnNumber,
            salesOrderId: salesOrders.salesOrderId,
            orderNumber: salesOrders.orderNumber,
            accountId: accounts.accountId,
            customerName: accounts.name,
            customerNumber: accounts.accountNumber,
          })
          .from(salesOrderReturns)
          .innerJoin(
            salesOrders,
            eq(salesOrders.salesOrderId, salesOrderReturns.salesOrderId),
          )
          .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
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
                link: `/accounts/${ret.accountId}`,
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

    // 4. Emit event for ERP sync (and system events audit)
    await emitEvent(tx, {
      aggregateType: AggregateType.SYSTEM,
      aggregateId: entry.entryId,
      eventType: EventType.INVENTORY_ENTRY_CREATED,
      payload: { header: params, lines: ledgerPayload },
    });
  }
}
