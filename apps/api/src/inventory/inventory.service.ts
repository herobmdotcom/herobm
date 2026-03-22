import { Injectable, Inject } from '@nestjs/common';
import { ilike, or, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { inventory, binContents } from '../drizzle/schema';
import { inventoryLevels } from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

/** A line with productId + quantity for stock mutations. */
export interface StockLine {
  productId: string | null;
  quantity: string;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // =========================================================================
  // Read-only queries (existing — from mart_inventory)
  // =========================================================================

  async findAll(query?: PaginationQuery & { locationNo?: string }) {
    const { page, limit, offset, searchTerm } = parsePagination(query);

    let qb = this.db.select().from(inventory).$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(inventory.productName, searchTerm),
          ilike(inventory.productNumber, searchTerm),
          ilike(inventory.locationName, searchTerm),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(inventory.locationNo, query.locationNo));
    }

    const rows = await qb
      .orderBy(inventory.productName)
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit };
  }

  /**
   * Batch lookup: return all inventory rows for the given product IDs.
   * Used by the Sales Portal availability tab to show per-line stock info.
   */
  async findByProductIds(productIds: string[]) {
    if (productIds.length === 0) return { data: [] };

    const rows = await this.db
      .select()
      .from(inventory)
      .where(inArray(inventory.productId, productIds))
      .orderBy(inventory.productName, inventory.locationName);

    return { data: rows };
  }

  async findBins(query?: PaginationQuery & { locationNo?: string }) {
    const { page, limit, offset, searchTerm } = parsePagination(query);

    let qb = this.db.select().from(binContents).$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(binContents.productName, searchTerm),
          ilike(binContents.productNumber, searchTerm),
          ilike(binContents.binNumber, searchTerm),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(binContents.locationNo, query.locationNo));
    }

    const rows = await qb
      .orderBy(binContents.binNumber)
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
        SUM(CASE WHEN m.type = 'IN' THEN m.quantity::numeric ELSE 0 END) AS "stockIn",
        SUM(CASE WHEN m.type = 'OUT' THEN m.quantity::numeric ELSE 0 END) AS "stockOut",
        SUM(CASE WHEN m.type = 'IN' THEN m.quantity::numeric ELSE -(m.quantity::numeric) END) AS "netChange"
      FROM (
        SELECT
          sh.created_on as date,
          'OUT' as type,
          sh.shipment_number as reference,
          sol.product_id,
          shl.quantity_shipped as quantity
        FROM modbm_core.sales_order_shipments sh
        JOIN modbm_core.sales_order_shipment_lines shl ON sh.shipment_id = shl.shipment_id
        JOIN modbm_core.sales_order_lines sol ON sol.sales_order_line_id = shl.sales_order_line_id
        WHERE sh.state_code != 'cancelled' AND sh.created_on >= ${cutoffIso}
        
        UNION ALL
        
        SELECT
          re.created_on as date,
          'IN' as type,
          re.reception_number as reference,
          pol.product_id,
          rel.quantity_received as quantity
        FROM modbm_core.purchase_order_receptions re
        JOIN modbm_core.purchase_order_reception_lines rel ON re.reception_id = rel.reception_id
        JOIN modbm_core.purchase_order_lines pol ON pol.purchase_order_line_id = rel.purchase_order_line_id
        WHERE re.state_code != 'cancelled' AND re.created_on >= ${cutoffIso}

        UNION ALL

        SELECT
          ret.created_on as date,
          'IN' as type,
          ret.return_number as reference,
          sol.product_id,
          retl.quantity_returned as quantity
        FROM modbm_core.sales_order_returns ret
        JOIN modbm_core.sales_order_return_lines retl ON ret.return_id = retl.return_id
        JOIN modbm_core.sales_order_lines sol ON sol.sales_order_line_id = retl.sales_order_line_id
        WHERE ret.state_code != 'cancelled' AND ret.created_on >= ${cutoffIso}
      ) m
      JOIN public_marts.mart_products p ON p.product_id = m.product_id
      WHERE m.quantity::numeric > 0
      GROUP BY p.product_number, p.name
      ORDER BY p.name ASC
    `;

    const result = await this.db.execute(query);
    const rows = (result as any).rows ?? result;
    return { data: rows };
  }

  // =========================================================================
  // Stock mutations (write to modbm_core.inventory_levels)
  //
  // All methods accept a `tx` so they run inside the caller's transaction.
  // They use upsert: if the row doesn't exist yet, it's created with the delta.
  // =========================================================================

  /**
   * Apply a delta to an inventory column using INSERT … ON CONFLICT UPDATE.
   * `column` must be one of 'quantity_on_hand', 'quantity_committed', 'quantity_on_order'.
   */
  private async applyDelta(
    tx: any,
    productId: string,
    locationNo: string,
    column: 'quantity_on_hand' | 'quantity_committed' | 'quantity_on_order',
    delta: number,
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO modbm_core.inventory_levels (product_id, location_no, ${sql.raw(column)}, modified_on)
      VALUES (${productId}, ${locationNo}, ${delta.toString()}, NOW())
      ON CONFLICT (product_id, location_no) DO UPDATE
      SET ${sql.raw(column)} = (modbm_core.inventory_levels.${sql.raw(column)}::numeric + ${delta.toString()}::numeric),
          modified_on = NOW()
    `);
  }

  /**
   * Apply multiple deltas at once for a list of lines.
   */
  private async applyLineDelta(
    tx: any,
    lines: StockLine[],
    locationNo: string,
    column: 'quantity_on_hand' | 'quantity_committed' | 'quantity_on_order',
    sign: 1 | -1,
  ): Promise<void> {
    for (const line of lines) {
      if (!line.productId) continue;
      const qty = parseFloat(line.quantity || '0');
      if (qty <= 0) continue;
      await this.applyDelta(tx, line.productId, locationNo, column, sign * qty);
    }
  }

  // ── Sales Order lifecycle ──────────────────────────────────────────────

  /** Order confirmed → commit stock (reserve for this order) */
  async commitStock(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_committed', 1);
  }

  /** Order cancelled (from confirmed+) → release committed stock */
  async releaseStock(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_committed', -1);
  }

  /** Shipment dispatched → deduct on-hand and release committed */
  async deductStock(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_hand', -1);
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_committed', -1);
  }

  /** Shipment reversed (dispatched → draft) → restore on-hand and re-commit */
  async restoreStock(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_hand', 1);
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_committed', 1);
  }

  /** Return processed → restore on-hand */
  async returnStock(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_hand', 1);
  }

  // ── Purchase Order lifecycle ───────────────────────────────────────────

  /** PO ordered → increase on-order */
  async placeOnOrder(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_order', 1);
  }

  /** PO cancelled → decrease on-order */
  async cancelOnOrder(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_order', -1);
  }

  /** PO reception completed → increase on-hand, decrease on-order */
  async receiveStock(tx: any, lines: StockLine[], locationNo = 'MAIN') {
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_hand', 1);
    await this.applyLineDelta(tx, lines, locationNo, 'quantity_on_order', -1);
  }
}
