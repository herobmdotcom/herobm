import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  suppliers as coreSuppliers,
  masterDataEvents,
  supplierGroups,
  supplierExpiries,
} from '../drizzle/herobm-core-schema';
import { EntityType } from '../common/event-types';
import {
  eq,
  ilike,
  or,
  sql,
  and,
  asc,
  desc,
  getTableColumns,
} from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { SUPPLIER_STATE } from '@herobm/shared';
import {
  resolveSupplierRiskProfile,
  ResolvedRiskProfile,
} from './supplier-risk.domain';

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async assessRisk(
    vendorId: string,
    tx?: DrizzleDB,
  ): Promise<ResolvedRiskProfile> {
    const db = tx || this.db;
    const [supplier] = await db
      .select()
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, vendorId));
    if (!supplier) throw new NotFoundException('Supplier not found');

    let group = null;
    if (supplier.supplierGroupId) {
      const [g] = await db
        .select()
        .from(supplierGroups)
        .where(eq(supplierGroups.supplierGroupId, supplier.supplierGroupId));
      group = g;
    }

    const expiries = await db
      .select()
      .from(supplierExpiries)
      .where(eq(supplierExpiries.vendorId, vendorId));

    return resolveSupplierRiskProfile(supplier, group, expiries);
  }

  async findAll(params: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(params);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${coreSuppliers.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${coreSuppliers.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${coreSuppliers.vendorNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${coreSuppliers.vendorNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    let qb = this.db
      .select({
        ...getTableColumns(coreSuppliers),
        supplierGroupName: supplierGroups.name,
        supplierGroupCode: supplierGroups.groupCode,
        groupIsPurchasingBlocked: supplierGroups.isPurchasingBlocked,
        groupPurchasingBlockReason: supplierGroups.purchasingBlockReason,
        groupIsPaymentBlocked: supplierGroups.isPaymentBlocked,
        groupPaymentBlockReason: supplierGroups.paymentBlockReason,
        supplierGroupTaxPositionId: supplierGroups.taxPositionId,
        supplierGroupTradingTermsId: supplierGroups.tradingTermsId,
        score: scoreSql,
      })
      .from(coreSuppliers)
      .leftJoin(
        supplierGroups,
        eq(coreSuppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .$dynamic();

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(coreSuppliers.name, `%${rawSearchTerm}%`),
          ilike(coreSuppliers.vendorNumber, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(
        sql`${coreSuppliers.stateCode} != ${SUPPLIER_STATE.ARCHIVED}`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
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
          and(
            eq(scoreSql, c.score),
            sql`${coreSuppliers.name} ${strOp} ${c.name}`,
          ),
          and(
            eq(scoreSql, c.score),
            eq(coreSuppliers.name, c.name),
            sql`${coreSuppliers.vendorId} ${strOp} ${c.id}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const scoreOp = dir === 'next' ? desc : asc;
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(coreSuppliers.name),
          orderFn(coreSuppliers.vendorId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        name: row.name,
        id: row.vendorId,
      }),
    });

    // Count query for total (same filters, no limit/offset)
    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(coreSuppliers)
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count: total }] = await countQb;

    return { data, page, limit, total: Number(total), nextCursor, prevCursor };
  }

  async findOne(id: string) {
    const rows = await this.db
      .select({
        ...getTableColumns(coreSuppliers),
      })
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, id))
      .limit(1);

    if (rows.length > 0) {
      const events = await this.db
        .select()
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, id),
            eq(masterDataEvents.entityType, EntityType.SUPPLIER),
          ),
        )
        .orderBy(sql`${masterDataEvents.createdOn} DESC`);

      const expiredDocs = await this.db
        .select({ id: supplierExpiries.expiryId })
        .from(supplierExpiries)
        .where(
          and(
            eq(supplierExpiries.vendorId, id),
            sql`${supplierExpiries.expiryDate} < CURRENT_DATE`,
          ),
        )
        .limit(1);

      // Note: Supplier compliance is now verified asynchronously by a daily worker (BullMQ)
      // and just-in-time when critical actions are taken (like PO creation).
      // We no longer mutate the supplier's state silently during a read operation.

      return { ...rows[0], events };
    }

    throw new NotFoundException(`Supplier '${id}' not found`);
  }

  /** Expiries for a given vendor */
  async findSupplierExpiries(vendorId: string, params: PaginationQuery) {
    const { page, limit, cursor, direction } = parsePagination(params);

    const { supplierExpiries } =
      await import('../drizzle/herobm-core-schema.js');

    const whereClause = eq(supplierExpiries.vendorId, vendorId);
    const qb = this.db
      .select({
        expiryId: supplierExpiries.expiryId,
        vendorId: supplierExpiries.vendorId,
        expiryType: supplierExpiries.expiryType,
        expiryDate: supplierExpiries.expiryDate,
        notes: supplierExpiries.notes,
        createdOn: supplierExpiries.createdOn,
      })
      .from(supplierExpiries)
      .where(whereClause)
      .$dynamic();

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { date: string; id: string }, dir) => {
        const cDate = c.date;
        const cursorCond =
          dir === 'next'
            ? or(
                sql`${supplierExpiries.expiryDate} > ${cDate}::timestamp`,
                and(
                  eq(supplierExpiries.expiryDate, sql`${cDate}::timestamp`),
                  sql`${supplierExpiries.expiryId} > ${c.id}`,
                ),
              )
            : or(
                sql`${supplierExpiries.expiryDate} < ${cDate}::timestamp`,
                and(
                  eq(supplierExpiries.expiryDate, sql`${cDate}::timestamp`),
                  sql`${supplierExpiries.expiryId} < ${c.id}`,
                ),
              );
        return q.where(and(whereClause, cursorCond));
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(supplierExpiries.expiryDate),
          orderFn(supplierExpiries.expiryId),
        );
      },
      encodeRow: (row) => ({ date: row.expiryDate, id: row.expiryId }),
    });

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierExpiries)
      .where(eq(supplierExpiries.vendorId, vendorId));

    const [{ count: total }] = await countQuery;

    return { data, page, limit, total: Number(total), nextCursor, prevCursor };
  }

  /** Products supplied by a given vendor */
  async findSupplierProducts(vendorId: string, params: PaginationQuery) {
    const { page, limit, cursor, direction } = parsePagination(params);

    const { productSuppliers, products } =
      await import('../drizzle/herobm-core-schema.js');

    const whereClause = eq(productSuppliers.vendorId, vendorId);
    const qb = this.db
      .select({
        productSupplierId: productSuppliers.productSupplierId,
        productId: productSuppliers.productId,
        vendorId: productSuppliers.vendorId,
        supplierPartNumber: productSuppliers.supplierPartNumber,
        costPrice: productSuppliers.costPrice,
        discountPercent: productSuppliers.discountPercent,
        priceBreakQuantity: productSuppliers.priceBreakQuantity,
        isPreferred: productSuppliers.isPreferred,
        stateCode: productSuppliers.stateCode,
        productName: products.name,
        productNumber: products.productNumber,
        productStateCode: products.stateCode,
      })
      .from(productSuppliers)
      .innerJoin(products, eq(productSuppliers.productId, products.productId))
      .where(whereClause)
      .$dynamic();

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
                  sql`${productSuppliers.productSupplierId} > ${c.id}`,
                ),
              )
            : or(
                sql`${products.name} < ${c.name}`,
                and(
                  eq(products.name, c.name),
                  sql`${productSuppliers.productSupplierId} < ${c.id}`,
                ),
              );
        return q.where(and(whereClause, cursorCond));
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(products.name),
          orderFn(productSuppliers.productSupplierId),
        );
      },
      encodeRow: (row) => ({
        name: row.productName,
        id: row.productSupplierId,
      }),
    });

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(productSuppliers)
      .where(eq(productSuppliers.vendorId, vendorId));

    const [{ count: total }] = await countQuery;

    return { data, page, limit, total: Number(total), nextCursor, prevCursor };
  }

  /** Suppliers that provide a given product */
  async findProductSuppliers(productId: string, params: PaginationQuery) {
    const { page, limit, cursor, direction } = parsePagination(params);

    const { productSuppliers, suppliers } =
      await import('../drizzle/herobm-core-schema.js');

    const whereClause = eq(productSuppliers.productId, productId);
    const qb = this.db
      .select({
        productSupplierId: productSuppliers.productSupplierId,
        productId: productSuppliers.productId,
        vendorId: productSuppliers.vendorId,
        supplierPartNumber: productSuppliers.supplierPartNumber,
        costPrice: productSuppliers.costPrice,
        discountPercent: productSuppliers.discountPercent,
        priceBreakQuantity: productSuppliers.priceBreakQuantity,
        isPreferred: productSuppliers.isPreferred,
        stateCode: productSuppliers.stateCode,
        vendorName: suppliers.name,
        vendorNumber: suppliers.vendorNumber,
      })
      .from(productSuppliers)
      .innerJoin(suppliers, eq(productSuppliers.vendorId, suppliers.vendorId))
      .where(whereClause)
      .$dynamic();

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { name: string; id: string }, dir) => {
        const cursorCond =
          dir === 'next'
            ? or(
                sql`${suppliers.name} > ${c.name}`,
                and(
                  eq(suppliers.name, c.name),
                  sql`${productSuppliers.productSupplierId} > ${c.id}`,
                ),
              )
            : or(
                sql`${suppliers.name} < ${c.name}`,
                and(
                  eq(suppliers.name, c.name),
                  sql`${productSuppliers.productSupplierId} < ${c.id}`,
                ),
              );
        return q.where(and(whereClause, cursorCond));
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(suppliers.name),
          orderFn(productSuppliers.productSupplierId),
        );
      },
      encodeRow: (row) => ({ name: row.vendorName, id: row.productSupplierId }),
    });

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(productSuppliers)
      .where(eq(productSuppliers.productId, productId));

    const [{ count: total }] = await countQuery;

    return { data, page, limit, total: Number(total), nextCursor, prevCursor };
  }

  async getAgedBalances(agingBasis: 'invoiceDate' | 'dueDate' = 'dueDate') {
    const basisCol = agingBasis === 'invoiceDate' ? 'invoice_date' : 'due_date';

    const invoicesQuery = sql`
      SELECT 
        s.vendor_id as "supplierId",
        s.name as "supplierName",
        s.vendor_number as "supplierNumber",
        s.currency_code as "currencyCode",
        s.is_payment_blocked as "isPaymentBlocked",
        s.credit_limit as "creditLimit",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) as "current",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE AND i.${sql.raw(basisCol)} >= CURRENT_DATE - INTERVAL '30 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days1To30",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE - INTERVAL '30 days' AND i.${sql.raw(basisCol)} >= CURRENT_DATE - INTERVAL '60 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days31To60",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE - INTERVAL '60 days' AND i.${sql.raw(basisCol)} >= CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days61To90",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days90Plus",
        COALESCE(SUM(i.outstanding_amount), 0) as "totalOutstanding"
      FROM herobm_core.suppliers s
      JOIN herobm_core.purchase_invoices i ON i.vendor_id = s.vendor_id
      WHERE i.outstanding_amount > 0 AND i.state_code NOT IN ('DRAFT', 'CANCELLED', 'draft', 'cancelled')
      GROUP BY s.vendor_id, s.name, s.vendor_number, s.currency_code, s.is_payment_blocked, s.credit_limit
    `;

    const glQuery = sql`
      SELECT 
        l.party_id as "supplierId",
        COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) as "glBalance"
      FROM herobm_core.gl_journal_lines l
      JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
      WHERE l.party_type = 'supplier'
      GROUP BY l.party_id
    `;

    const [invoicesRes, glRes] = await Promise.all([
      this.db.execute(invoicesQuery),
      this.db.execute(glQuery),
    ]);

    const invoicesRows = ((invoicesRes as unknown as Record<string, unknown>)
      .rows ?? invoicesRes) as Record<string, unknown>[];
    const glRows = ((glRes as unknown as Record<string, unknown>).rows ??
      glRes) as Record<string, unknown>[];

    const glMap = new Map<string, number>();
    for (const row of glRows) {
      if (row.supplierId) {
        glMap.set(row.supplierId as string, Number(row.glBalance));
      }
    }

    return invoicesRows.map((row) => {
      const glBalance = glMap.get(row.supplierId as string) || 0;
      const totalOutstanding = Number(row.totalOutstanding);
      return {
        supplierId: row.supplierId as string,
        supplierName: row.supplierName as string,
        supplierNumber: row.supplierNumber as string,
        currencyCode: row.currencyCode as string,
        isPaymentBlocked: Boolean(row.isPaymentBlocked),
        creditLimit: row.creditLimit as string | null,
        glBalance,
        totalOutstanding,
        discrepancyAmount: Math.abs(glBalance - totalOutstanding),
        current: Number(row.current),
        days1To30: Number(row.days1To30),
        days31To60: Number(row.days31To60),
        days61To90: Number(row.days61To90),
        days90Plus: Number(row.days90Plus),
      };
    });
  }
}
