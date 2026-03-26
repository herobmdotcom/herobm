import { Injectable, Inject } from '@nestjs/common';
import { ilike, or, eq, inArray, sql } from 'drizzle-orm';
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
} from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

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
        quantityOnOrder: inventoryLevels.quantityOnOrder,
        quantityAvailable: sql<number>`(${inventoryLevels.quantityOnHand} - ${inventoryLevels.quantityCommitted})`,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.productId))
      .leftJoin(locations, eq(inventoryLevels.locationId, locations.locationId))
      .$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(products.name, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(locations.code, searchTerm),
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
      scNumber: null,
      defaultBinNumber: null,
    }));

    return { data: mappedRows, page, limit };
  }

  /**
   * Batch lookup: return all inventory rows for the given product IDs.
   * Used by the Sales Portal availability tab to show per-line stock info.
   */
  async findByProductIds(productIds: string[]) {
    if (productIds.length === 0) return { data: [] };

    const rows = await this.db
      .select({
        inventoryLevelId: inventoryLevels.inventoryLevelId,
        productId: inventoryLevels.productId,
        productNumber: products.productNumber,
        productName: products.name,
        locationNo: locations.code,
        locationName: locations.name,
        quantityOnHand: inventoryLevels.quantityOnHand,
        quantityCommitted: inventoryLevels.quantityCommitted,
        quantityOnOrder: inventoryLevels.quantityOnOrder,
        quantityAvailable: sql<number>`(${inventoryLevels.quantityOnHand} - ${inventoryLevels.quantityCommitted})`,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.productId))
      .leftJoin(locations, eq(inventoryLevels.locationId, locations.locationId))
      .where(inArray(inventoryLevels.productId, productIds))
      .orderBy(products.name, locations.code);

    // Provide default backward-compatible fields
    const mappedRows = rows.map((r) => ({
      ...r,
      scNumber: null,
      defaultBinNumber: null,
    }));

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
        productId: binContents.productId,
        productNumber: products.productNumber,
        productName: products.name,
        actualQuantity: binContents.actualQuantity,
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

    return { data: rows, page, limit };
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

    return { data };
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
      }[];
    },
  ) {
    if (params.lines.length === 0) return;

    // 1. Create Header
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
      .select({
        binId: bins.binId,
        zoneId: bins.zoneId,
        locationId: zones.locationId,
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(inArray(bins.binId, binIds));

    const binMap = new Map<string, any>(
      resolvedBins.map((b: any) => [b.binId, b]),
    );

    // 2. Create Ledger Lines
    const ledgerPayload = params.lines.map((l) => {
      const b = binMap.get(l.binId);
      if (!b) throw new Error(`Bin ${l.binId} not found in database`);
      return {
        entryId: entry.entryId,
        productId: l.productId,
        binId: l.binId,
        locationId: b.locationId,
        zoneId: b.zoneId,
        quantity: l.quantity.toString(),
      };
    });
    await tx.insert(inventoryLedger).values(ledgerPayload);

    // 3. Update Cache (bin_contents)
    for (const line of params.lines) {
      await tx
        .insert(binContents)
        .values({
          binId: line.binId,
          productId: line.productId,
          actualQuantity: line.quantity.toString(),
          modifiedOn: new Date(),
        })
        .onConflictDoUpdate({
          target: [binContents.binId, binContents.productId],
          set: {
            actualQuantity: sql`${binContents.actualQuantity} + ${line.quantity.toString()}`,
            modifiedOn: new Date(),
          },
        });
    }

    // 4. Emit Outbox Event for ERP sync
    await tx.insert(outbox).values({
      eventType: 'INVENTORY_ENTRY_CREATED',
      aggregateId: entry.entryId,
      aggregateType: 'inventory_entries',
      payload: { header: params, lines: ledgerPayload },
    });
  }
}
