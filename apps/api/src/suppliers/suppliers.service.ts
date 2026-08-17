// security-ignore: sql-raw
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  suppliers as coreSuppliers,
  masterDataEvents,
  supplierGroups,
  supplierExpiries,
  actors,
  contacts,
  actorContactLinks,
} from '@herobm/db-schema';
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
import { SUPPLIER_STATE, PURCHASE_INVOICE_STATE } from '@herobm/shared';
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
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${coreSuppliers.vendorNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${coreSuppliers.vendorNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    let qb = this.db
      .select({
        ...getTableColumns(coreSuppliers),
        name: actors.name,
        supplierGroupName: supplierGroups.name,
        supplierGroupCode: supplierGroups.groupCode,
        groupIsPurchasingBlocked: supplierGroups.isPurchasingBlocked,
        groupPurchasingBlockReason: supplierGroups.purchasingBlockReason,
        groupIsPaymentBlocked: supplierGroups.isPaymentBlocked,
        groupPaymentBlockReason: supplierGroups.paymentBlockReason,
        supplierGroupTaxPositionId: supplierGroups.taxPositionId,
        supplierGroupTradingTermsId: supplierGroups.tradingTermsId,
        score: scoreSql,
        address1Line1: actors.headquartersAddressLine1,
        address1Line2: actors.headquartersAddressLine2,
        address1City: actors.headquartersCity,
        address1StateOrProvince: actors.headquartersStateOrProvince,
        address1PostalCode: actors.headquartersPostalCode,
        address1Country: actors.headquartersCountry,
        telephone1: sql<string>`TRIM(${actors.telephone})`,
        fax: sql<string>`TRIM(${actors.fax})`,
        emailAddress1: sql<string>`TRIM(${actors.email})`,
      })
      .from(coreSuppliers)
      .leftJoin(
        supplierGroups,
        eq(coreSuppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .$dynamic();

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(actors.name, `%${rawSearchTerm}%`),
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
      cursorObj: cursor as {
        score: number;
        name: string;
        supplierId: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const strOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(eq(scoreSql, c.score), sql`${actors.name} ${strOp} ${c.name}`),
          and(
            eq(scoreSql, c.score),
            eq(actors.name, c.name),
            sql`${coreSuppliers.vendorId} ${strOp} ${c.supplierId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const scoreOp = dir === 'next' ? desc : asc;
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(actors.name),
          orderFn(coreSuppliers.vendorId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        name: row.name,
        supplierId: row.vendorId,
      }),
    });

    // Count query for total (same filters, no limit/offset)
    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(coreSuppliers)
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count: total }] = await countQb;

    return { data, page, limit, total: Number(total), nextCursor, prevCursor };
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select({
        ...getTableColumns(coreSuppliers),
        name: actors.name,
        supplierGroupTaxPositionId: supplierGroups.taxPositionId,
        address1Line1: actors.headquartersAddressLine1,
        address1Line2: actors.headquartersAddressLine2,
        address1City: actors.headquartersCity,
        address1StateOrProvince: actors.headquartersStateOrProvince,
        address1PostalCode: actors.headquartersPostalCode,
        address1Country: actors.headquartersCountry,
        businessNumber: actors.businessNumber,
        isTaxRegistered: actors.isTaxRegistered,
        telephone1: sql<string>`TRIM(${actors.telephone})`,
        fax: sql<string>`TRIM(${actors.fax})`,
        emailAddress1: sql<string>`TRIM(${actors.email})`,
      })
      .from(coreSuppliers)
      .leftJoin(
        supplierGroups,
        eq(coreSuppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
      .where(eq(coreSuppliers.vendorId, id))
      .limit(1);

    if (rows.length > 0) {
      const events = await db
        .select()
        .from(masterDataEvents)
        .where(
          and(
            eq(masterDataEvents.entityId, id),
            eq(masterDataEvents.entityType, EntityType.SUPPLIER),
          ),
        )
        .orderBy(sql`${masterDataEvents.createdOn} DESC`);

      const expiredDocs = await db
        .select({ id: supplierExpiries.expiryId })
        .from(supplierExpiries)
        .where(
          and(
            eq(supplierExpiries.vendorId, id),
            sql`${supplierExpiries.expiryDate} < CURRENT_DATE`,
          ),
        )
        .limit(1);

      const contactsResult = rows[0].actorId
        ? await db
            .select({
              id: contacts.contactId,
              contactId: contacts.contactId,
              supplierId: sql<string>`${rows[0].vendorId}`,
              firstName: contacts.firstName,
              lastName: contacts.lastName,
              fullName: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
              email: contacts.email,
              phone: contacts.phone,
              mobile: contacts.mobile,
              jobTitle: contacts.jobTitle,
              primaryFor: actorContactLinks.primaryFor,
              createdOn: contacts.createdOn,
              modifiedOn: contacts.modifiedOn,
            })
            .from(contacts)
            .innerJoin(
              actorContactLinks,
              eq(contacts.contactId, actorContactLinks.contactId),
            )
            .where(eq(actorContactLinks.actorId, rows[0].actorId))
            .catch(() => [])
        : [];

      // Note: Supplier compliance is now verified asynchronously by a daily worker (BullMQ)
      // and just-in-time when critical actions are taken (like PO creation).
      // We no longer mutate the supplier's state silently during a read operation.

      return { ...rows[0], events, contacts: contactsResult };
    }

    throw new NotFoundException(`Supplier '${id}' not found`);
  }

  /** Expiries for a given vendor */
  async findSupplierExpiries(vendorId: string, params: PaginationQuery) {
    const { page, limit, cursor, direction } = parsePagination(params);

    const { supplierExpiries } = await import('@herobm/db-schema');

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

    const { productSuppliers, products } = await import('@herobm/db-schema');

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

    const { productSuppliers, suppliers, actors } =
      await import('@herobm/db-schema');

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
        vendorName: actors.name,
        vendorNumber: suppliers.vendorNumber,
      })
      .from(productSuppliers)
      .innerJoin(suppliers, eq(productSuppliers.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
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
                sql`${actors.name} > ${c.name}`,
                and(
                  eq(actors.name, c.name),
                  sql`${productSuppliers.productSupplierId} > ${c.id}`,
                ),
              )
            : or(
                sql`${actors.name} < ${c.name}`,
                and(
                  eq(actors.name, c.name),
                  sql`${productSuppliers.productSupplierId} < ${c.id}`,
                ),
              );
        return q.where(and(whereClause, cursorCond));
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(actors.name),
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

  async getAgedBalances(
    agingBasis: 'invoiceDate' | 'dueDate' = 'dueDate',
    query?: PaginationQuery,
    quickFilter?: string,
  ) {
    const basisCol = agingBasis === 'invoiceDate' ? 'invoice_date' : 'due_date';
    const { limit, page, searchTerm, sort, sortDirection } =
      parsePagination(query);
    const offset = (page - 1) * limit;

    let conditions = sql`1=1`;
    if (searchTerm) {
      conditions = sql`${conditions} AND (si.supplier_name ILIKE ${searchTerm} OR si.vendor_number ILIKE ${searchTerm})`;
    }

    if (quickFilter === 'discrepancy') {
      conditions = sql`${conditions} AND ABS(COALESCE(sgl.gl_balance, 0) - si.total_outstanding) > 0.01`;
    } else if (quickFilter === 'overdue') {
      conditions = sql`${conditions} AND (si.total_outstanding - si.current) > 0.01`;
    } else if (quickFilter === 'blocked') {
      conditions = sql`${conditions} AND si.is_payment_blocked = true`;
    }

    let orderBy = sql`"supplierName" ASC`;
    if (sort) {
      const sortMap: Record<string, string> = {
        supplierName: 'supplierName',
        supplierNumber: 'supplierNumber',
        glBalance: 'glBalance',
        totalOutstanding: 'totalOutstanding',
        discrepancyAmount: 'discrepancyAmount',
        current: 'current',
        creditLimit: 'creditLimit',
      };
      const mappedCol = sortMap[sort] || 'supplierName';
      const sortIdentifier = sql.identifier(mappedCol);
      orderBy =
        sortDirection === 'desc'
          ? sql`${sortIdentifier} DESC`
          : sql`${sortIdentifier} ASC`;
    }

    const cteQuery = sql`
      WITH supplier_invoices AS (
        SELECT 
          s.vendor_id,
          a.name as supplier_name,
          s.vendor_number,
          s.currency_code,
          s.is_payment_blocked,
          s.credit_limit,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) as current,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '30 days' THEN i.outstanding_amount ELSE 0 END), 0) as days1_to_30,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '30 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '60 days' THEN i.outstanding_amount ELSE 0 END), 0) as days31_to_60,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '60 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as days61_to_90,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '90 days' OR i.${sql.identifier(basisCol)} IS NULL THEN i.outstanding_amount ELSE 0 END), 0) as days90_plus,
          COALESCE(SUM(i.outstanding_amount), 0) as total_outstanding
        FROM herobm_core.suppliers s
        LEFT JOIN herobm_core.actors a ON s.actor_id = a.actor_id
        JOIN herobm_core.purchase_invoices i ON i.vendor_id = s.vendor_id
        WHERE i.outstanding_amount > 0 AND i.state_code NOT IN (${PURCHASE_INVOICE_STATE.DRAFT}, ${PURCHASE_INVOICE_STATE.CANCELLED}, ${PURCHASE_INVOICE_STATE.PAID})
        GROUP BY s.vendor_id, a.name, s.vendor_number, s.currency_code, s.is_payment_blocked, s.credit_limit
      ),
      supplier_gl AS (
        SELECT 
          l.party_id,
          COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) as gl_balance
        FROM herobm_core.gl_journal_lines l
        JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
        WHERE l.party_type = 'supplier'
        GROUP BY l.party_id
      ),
      combined AS (
        SELECT 
          si.vendor_id as "supplierId",
          si.supplier_name as "supplierName",
          si.vendor_number as "supplierNumber",
          si.currency_code as "currencyCode",
          si.is_payment_blocked as "isPaymentBlocked",
          si.credit_limit as "creditLimit",
          COALESCE(sgl.gl_balance, 0) as "glBalance",
          si.total_outstanding as "totalOutstanding",
          ABS(COALESCE(sgl.gl_balance, 0) - si.total_outstanding) as "discrepancyAmount",
          si.current as "current",
          si.days1_to_30 as "days1To30",
          si.days31_to_60 as "days31To60",
          si.days61_to_90 as "days61To90",
          si.days90_plus as "days90Plus"
        FROM supplier_invoices si
        LEFT JOIN supplier_gl sgl ON si.vendor_id::text = sgl.party_id
        WHERE ${conditions}
      )
    `;

    const dataQuery = sql`
      ${cteQuery}
      SELECT * FROM combined
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = sql`
      ${cteQuery}
      SELECT COUNT(*) as total FROM combined
    `;

    const [dataRes, countRes] = await Promise.all([
      this.db.execute(dataQuery),
      this.db.execute(countQuery),
    ]);

    const dataRows = ((dataRes as unknown as Record<string, unknown>).rows ??
      dataRes) as Record<string, unknown>[];
    const countRows = ((countRes as unknown as Record<string, unknown>).rows ??
      countRes) as Record<string, unknown>[];

    const total = Number(countRows[0]?.total || 0);

    const formattedData = dataRows.map((row) => ({
      supplierId: row.supplierId as string,
      supplierName: row.supplierName as string,
      supplierNumber: row.supplierNumber as string,
      currencyCode: row.currencyCode as string,
      isPaymentBlocked: Boolean(row.isPaymentBlocked),
      creditLimit: row.creditLimit as string | null,
      glBalance: Number(row.glBalance),
      totalOutstanding: Number(row.totalOutstanding),
      discrepancyAmount: Number(row.discrepancyAmount),
      current: Number(row.current),
      days1To30: Number(row.days1To30),
      days31To60: Number(row.days31To60),
      days61To90: Number(row.days61To90),
      days90Plus: Number(row.days90Plus),
    }));

    return {
      data: formattedData,
      total,
      limit,
      page,
    };
  }
}
