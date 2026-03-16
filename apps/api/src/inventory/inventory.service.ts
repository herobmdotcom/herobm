import { Injectable, Inject } from '@nestjs/common';
import { ilike, or, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { inventory, binContents } from '../drizzle/schema';
import { inventoryLevels } from '../drizzle/modbm-core-schema';

/** A line with productId + quantity for stock mutations. */
export interface StockLine {
  productId: string | null;
  quantity: string;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  private get database(): DrizzleDB {
    return this.db as DrizzleDB;
  }

  // =========================================================================
  // Read-only queries (existing — from mart_inventory)
  // =========================================================================

  async findAll(query?: { search?: string; page?: number; limit?: number; locationNo?: string }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    let qb = this.database.select().from(inventory).$dynamic();

    if (query?.search) {
      const term = `%${query.search}%`;
      qb = qb.where(
        or(
          ilike(inventory.productName, term),
          ilike(inventory.productNumber, term),
          ilike(inventory.locationName, term),
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

    const rows = await this.database
      .select()
      .from(inventory)
      .where(inArray(inventory.productId, productIds))
      .orderBy(inventory.productName, inventory.locationName);

    return { data: rows };
  }

  async findBins(query?: { search?: string; page?: number; limit?: number; locationNo?: string }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    let qb = this.database.select().from(binContents).$dynamic();

    if (query?.search) {
      const term = `%${query.search}%`;
      qb = qb.where(
        or(
          ilike(binContents.productName, term),
          ilike(binContents.productNumber, term),
          ilike(binContents.binNumber, term),
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
      SET ${sql.raw(column)} = (modbm_core.inventory_levels.${sql.raw(column)}::numeric + ${delta.toString()}::numeric)::text,
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

