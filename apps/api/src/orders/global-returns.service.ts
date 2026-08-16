import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import { PaginationQuery } from '../common/pagination.dto';

@Injectable()
export class GlobalReturnsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findGlobalReturns(query: PaginationQuery) {
    const limit = query.limit || 50;
    const offset = query.page ? (query.page - 1) * limit : 0;
    // We ignore cursor for simplicity or handle it if necessary, but offset is easiest.
    const sortField = query.sort || 'createdOn';

    // Base UNION ALL query for open returns requiring credit/debit note
    const baseQuery = sql`
      WITH returns_data AS (
        SELECT 
          'customer_return' as "type",
          r.return_id as "returnId",
          r.return_number as "returnNumber",
          o.order_number as "orderNumber",
          c.customer_number as "partyNumber",
          a.name as "partyName",
          r.created_on as "createdOn",
          r.state_code as "stateCode",
          r.notes as "notes",
          (SELECT COUNT(*) FROM herobm_core.sales_order_return_lines l WHERE l.return_id = r.return_id) as "linesCount",
          (SELECT MAX(l.putaway_status) FROM herobm_core.sales_order_return_lines l WHERE l.return_id = r.return_id) as "putawayStatus"
        FROM herobm_core.sales_order_returns r
        JOIN herobm_core.sales_orders o ON r.sales_order_id = o.sales_order_id
        LEFT JOIN herobm_core.customers c ON o.customer_id = c.customer_id
        LEFT JOIN herobm_core.actors a ON c.actor_id = a.actor_id
        WHERE r.state_code = 'received'
          AND (r.created_by IS NULL OR r.created_by != 'abm-import')
          AND NOT EXISTS (SELECT 1 FROM herobm_core.sales_credit_notes scn WHERE scn.return_id = r.return_id)

        UNION ALL

        SELECT 
          'supplier_return' as "type",
          pr.return_id as "returnId",
          pr.return_number as "returnNumber",
          po.order_number as "orderNumber",
          s.vendor_number as "partyNumber",
          a2.name as "partyName",
          pr.created_on as "createdOn",
          pr.state_code as "stateCode",
          pr.notes as "notes",
          (SELECT COUNT(*) FROM herobm_core.purchase_order_return_lines pl WHERE pl.return_id = pr.return_id) as "linesCount",
          NULL as "putawayStatus"
        FROM herobm_core.purchase_order_returns pr
        JOIN herobm_core.purchase_orders po ON pr.purchase_order_id = po.purchase_order_id
        LEFT JOIN herobm_core.suppliers s ON po.vendor_id = s.vendor_id
        LEFT JOIN herobm_core.actors a2 ON s.actor_id = a2.actor_id
        WHERE pr.state_code = 'shipped'
          AND (pr.created_by IS NULL OR pr.created_by != 'abm-import')
          AND NOT EXISTS (SELECT 1 FROM herobm_core.purchase_debit_notes pdn WHERE pdn.return_id = pr.return_id)
      )
      SELECT * FROM returns_data
    `;

    // Add search and sorting
    let filterSql = sql``;
    if (query.q) {
      const search = `%${query.q}%`;
      filterSql = sql` WHERE "returnNumber" ILIKE ${search} OR "orderNumber" ILIKE ${search} OR "partyName" ILIKE ${search}`;
    }

    let orderSql = sql` ORDER BY "createdOn" DESC`;
    if (sortField === 'returnNumber') {
      orderSql =
        query.sortDirection === 'asc'
          ? sql` ORDER BY "returnNumber" ASC`
          : sql` ORDER BY "returnNumber" DESC`;
    } else if (sortField === 'orderNumber') {
      orderSql =
        query.sortDirection === 'asc'
          ? sql` ORDER BY "orderNumber" ASC`
          : sql` ORDER BY "orderNumber" DESC`;
    } else if (sortField === 'partyName') {
      orderSql =
        query.sortDirection === 'asc'
          ? sql` ORDER BY "partyName" ASC`
          : sql` ORDER BY "partyName" DESC`;
    }

    const finalQuery = sql`${baseQuery} ${filterSql} ${orderSql} LIMIT ${limit} OFFSET ${offset}`;
    const countQuery = sql`SELECT COUNT(*) as total FROM (${baseQuery} ${filterSql}) as c`;

    const [rows, [{ total }]] = await Promise.all([
      this.db.execute(finalQuery),
      this.db.execute(countQuery),
    ]);

    return {
      data: rows,
      meta: {
        total: Number(total),
        page: query.page || 1,
        limit,
      },
    };
  }
}
