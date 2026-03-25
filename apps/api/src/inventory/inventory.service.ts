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
        locationNo: inventoryLevels.locationNo,
        locationName: sql<string>`${inventoryLevels.locationNo}`,
        quantityOnHand: inventoryLevels.quantityOnHand,
        quantityCommitted: inventoryLevels.quantityCommitted,
        quantityOnOrder: inventoryLevels.quantityOnOrder,
        quantityAvailable: sql<number>`(${inventoryLevels.quantityOnHand} - ${inventoryLevels.quantityCommitted})`,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.productId))
      .$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(products.name, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(inventoryLevels.locationNo, searchTerm),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(inventoryLevels.locationNo, query.locationNo));
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
        locationNo: inventoryLevels.locationNo,
        locationName: sql<string>`${inventoryLevels.locationNo}`,
        quantityOnHand: inventoryLevels.quantityOnHand,
        quantityCommitted: inventoryLevels.quantityCommitted,
        quantityOnOrder: inventoryLevels.quantityOnOrder,
        quantityAvailable: sql<number>`(${inventoryLevels.quantityOnHand} - ${inventoryLevels.quantityCommitted})`,
      })
      .from(inventoryLevels)
      .leftJoin(products, eq(inventoryLevels.productId, products.productId))
      .where(inArray(inventoryLevels.productId, productIds))
      .orderBy(products.name, inventoryLevels.locationNo);

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
        locationNo: bins.locationNo,
        productId: binContents.productId,
        productNumber: products.productNumber,
        productName: products.name,
        actualQuantity: binContents.actualQuantity,
      })
      .from(binContents)
      .innerJoin(bins, eq(binContents.binId, bins.binId))
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
      qb = qb.where(eq(bins.locationNo, query.locationNo));
    }

    const rows = await qb
      .orderBy(bins.binNumber, products.name)
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit };
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
        SUM(l.quantity::numeric) AS "netChange"
      FROM modbm_core.inventory_ledger l
      JOIN modbm_core.inventory_entries e ON e.entry_id = l.entry_id
      JOIN modbm_core.products p ON p.product_id = l.product_id
      WHERE e.entry_date >= ${cutoffIso}
        AND e.source_type != 'INITIAL_IMPORT'
      GROUP BY p.product_number, p.name
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
        locationNo: string;
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

    // 2. Create Ledger Lines
    const ledgerPayload = params.lines.map((l) => ({
      entryId: entry.entryId,
      productId: l.productId,
      binId: l.binId,
      locationNo: l.locationNo,
      quantity: l.quantity.toString(),
    }));
    await tx.insert(inventoryLedger).values(ledgerPayload);

    // 4. Emit Outbox Event for ERP sync
    await tx.insert(outbox).values({
      eventType: 'INVENTORY_ENTRY_CREATED',
      aggregateId: entry.entryId,
      aggregateType: 'inventory_entries',
      payload: { header: params, lines: ledgerPayload },
    });
  }
}
