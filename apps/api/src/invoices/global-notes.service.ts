import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  paginatedResult,
} from '../common/pagination';

@Injectable()
export class GlobalNotesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { limit, offset, page, searchTerm } = parsePagination(query || {});

    // Create dynamic condition for search
    let searchCondition = sql`TRUE`;
    if (searchTerm) {
      searchCondition = sql`(
        u.note_number ILIKE ${searchTerm}
        OR u.reference_number ILIKE ${searchTerm}
        OR u.order_number ILIKE ${searchTerm}
        OR u.party_number ILIKE ${searchTerm}
        OR u.party_name ILIKE ${searchTerm}
        OR u.notes ILIKE ${searchTerm}
      )`;
    }

    const unionQuery = sql`
      WITH unified_notes AS (
        SELECT 
          'credit_note' AS type,
          cn.credit_note_id AS note_id,
          cn.credit_note_number AS note_number,
          COALESCE(rt.return_number, '') AS reference_number,
          COALESCE(so.order_number, '') AS order_number,
          COALESCE(ca.customer_number, '') AS party_number,
          COALESCE(act.name, '') AS party_name,
          cn.created_on,
          COALESCE(cn.notes, '') AS notes,
          (CAST(cn.total_amount AS numeric) + COALESCE(CAST(cn.tax_amount AS numeric), 0) - COALESCE(CAST(cn.fee_amount AS numeric), 0)) AS total_amount,
          cn.currency_code,
          cn.state_code
        FROM herobm_core.sales_credit_notes cn
        LEFT JOIN herobm_core.sales_orders so ON cn.sales_order_id = so.sales_order_id
        LEFT JOIN herobm_core.sales_order_returns rt ON cn.return_id = rt.return_id
        LEFT JOIN herobm_core.customers ca ON cn.customer_id = ca.customer_id
        LEFT JOIN herobm_core.actors act ON ca.actor_id = act.actor_id
        
        UNION ALL
        
        SELECT 
          'debit_note' AS type,
          dn.debit_note_id AS note_id,
          dn.debit_note_number AS note_number,
          COALESCE(dn.supplier_reference_number, '') AS reference_number,
          COALESCE(po.order_number, '') AS order_number,
          COALESCE(su.vendor_number, '') AS party_number,
          COALESCE(act.name, '') AS party_name,
          dn.created_on,
          COALESCE(dn.notes, '') AS notes,
          (CAST(dn.total_amount AS numeric) + COALESCE(CAST(dn.tax_amount AS numeric), 0) - COALESCE(CAST(dn.fee_amount AS numeric), 0)) AS total_amount,
          dn.currency_code,
          dn.state_code
        FROM herobm_core.purchase_debit_notes dn
        LEFT JOIN herobm_core.purchase_orders po ON dn.purchase_order_id = po.purchase_order_id
        LEFT JOIN herobm_core.suppliers su ON dn.vendor_id = su.vendor_id
        LEFT JOIN herobm_core.actors act ON su.actor_id = act.actor_id
      )
      SELECT *
      FROM unified_notes u
      WHERE ${searchCondition}
      ORDER BY u.created_on DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = sql`
      WITH unified_notes AS (
        SELECT 
          'credit_note' AS type,
          cn.credit_note_number AS note_number,
          COALESCE(rt.return_number, '') AS reference_number,
          COALESCE(so.order_number, '') AS order_number,
          COALESCE(ca.customer_number, '') AS party_number,
          COALESCE(act.name, '') AS party_name,
          COALESCE(cn.notes, '') AS notes
        FROM herobm_core.sales_credit_notes cn
        LEFT JOIN herobm_core.sales_orders so ON cn.sales_order_id = so.sales_order_id
        LEFT JOIN herobm_core.sales_order_returns rt ON cn.return_id = rt.return_id
        LEFT JOIN herobm_core.customers ca ON cn.customer_id = ca.customer_id
        LEFT JOIN herobm_core.actors act ON ca.actor_id = act.actor_id
        
        UNION ALL
        
        SELECT 
          'debit_note' AS type,
          dn.debit_note_number AS note_number,
          COALESCE(dn.supplier_reference_number, '') AS reference_number,
          COALESCE(po.order_number, '') AS order_number,
          COALESCE(su.vendor_number, '') AS party_number,
          COALESCE(act.name, '') AS party_name,
          COALESCE(dn.notes, '') AS notes
        FROM herobm_core.purchase_debit_notes dn
        LEFT JOIN herobm_core.purchase_orders po ON dn.purchase_order_id = po.purchase_order_id
        LEFT JOIN herobm_core.suppliers su ON dn.vendor_id = su.vendor_id
        LEFT JOIN herobm_core.actors act ON su.actor_id = act.actor_id
      )
      SELECT COUNT(*)::int AS total
      FROM unified_notes u
      WHERE ${searchCondition}
    `;

    interface RawUnifiedNoteRow {
      type: string;
      note_id: string;
      note_number: string;
      reference_number?: string | null;
      order_number?: string | null;
      party_number?: string | null;
      party_name?: string | null;
      created_on: string;
      notes?: string | null;
      total_amount?: string | number | null;
      currency_code: string;
      state_code: string;
    }

    interface CountResult {
      total: number;
    }

    const [rows, [countRes]] = await Promise.all([
      this.db.execute(unionQuery),
      this.db.execute(countQuery),
    ]);

    const mappedRows = (rows as unknown as RawUnifiedNoteRow[]).map((r) => ({
      id: `${r.type}-${r.note_id}`,
      type: r.type,
      noteId: r.note_id,
      noteNumber: r.note_number,
      referenceNumber: r.reference_number || '—',
      orderNumber: r.order_number || '—',
      partyNumber: r.party_number || '—',
      partyName: r.party_name || '—',
      createdOn: r.created_on,
      notes: r.notes || '',
      totalAmount: parseFloat(String(r.total_amount || 0)),
      currencyCode: r.currency_code,
      stateCode: r.state_code,
    }));

    const total = (countRes as unknown as CountResult)?.total ?? 0;
    return paginatedResult(mappedRows, total, page, limit);
  }
}
