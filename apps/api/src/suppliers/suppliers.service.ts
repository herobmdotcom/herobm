import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  suppliers as coreSuppliers,
  masterDataEvents,
  supplierGroups,
  supplierExpiries,
} from '../drizzle/modbm-core-schema';
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
import { SUPPLIER_STATE } from '@modbm/shared';

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(params: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(params);

    let qb = this.db
      .select({
        ...getTableColumns(coreSuppliers),
        supplierGroupName: supplierGroups.name,
        supplierGroupCode: supplierGroups.groupCode,
        groupIsPurchasingBlocked: supplierGroups.isPurchasingBlocked,
        groupPurchasingBlockReason: supplierGroups.purchasingBlockReason,
        groupIsPaymentBlocked: supplierGroups.isPaymentBlocked,
        groupPaymentBlockReason: supplierGroups.paymentBlockReason,
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
          ilike(coreSuppliers.name, searchTerm),
          ilike(coreSuppliers.vendorNumber, searchTerm),
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
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { name: string; id: string }, dir) => {
        const cursorCond =
          dir === 'next'
            ? or(
                sql`${coreSuppliers.name} > ${c.name}`,
                and(
                  eq(coreSuppliers.name, c.name),
                  sql`${coreSuppliers.vendorId} > ${c.id}`,
                ),
              )
            : or(
                sql`${coreSuppliers.name} < ${c.name}`,
                and(
                  eq(coreSuppliers.name, c.name),
                  sql`${coreSuppliers.vendorId} < ${c.id}`,
                ),
              );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(coreSuppliers.name),
          orderFn(coreSuppliers.vendorId),
        );
      },
      encodeRow: (row) => ({ name: row.name, id: row.vendorId }),
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
        supplierGroupName: supplierGroups.name,
        supplierGroupCode: supplierGroups.groupCode,
        groupIsPurchasingBlocked: supplierGroups.isPurchasingBlocked,
        groupPurchasingBlockReason: supplierGroups.purchasingBlockReason,
        groupIsPaymentBlocked: supplierGroups.isPaymentBlocked,
        groupPaymentBlockReason: supplierGroups.paymentBlockReason,
      })
      .from(coreSuppliers)
      .leftJoin(
        supplierGroups,
        eq(coreSuppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
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
        .orderBy(masterDataEvents.createdOn);

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

      if (expiredDocs.length > 0 && !rows[0].isPurchasingBlocked) {
        await this.db
          .update(coreSuppliers)
          .set({
            isPurchasingBlocked: true,
            purchasingBlockReason: 'compliance_breach',
            blockNotes:
              'System automatically blocked due to expired compliance documentation.',
          })
          .where(eq(coreSuppliers.vendorId, id));

        rows[0].isPurchasingBlocked = true;
        rows[0].purchasingBlockReason = 'compliance_breach';
        rows[0].blockNotes =
          'System automatically blocked due to expired compliance documentation.';
      }

      return { ...rows[0], events };
    }

    throw new NotFoundException(`Supplier '${id}' not found`);
  }

  /** Expiries for a given vendor */
  async findSupplierExpiries(vendorId: string, params: PaginationQuery) {
    const { page, limit, cursor, direction } = parsePagination(params);

    const { supplierExpiries } =
      await import('../drizzle/modbm-core-schema.js');

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
      await import('../drizzle/modbm-core-schema.js');

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
      await import('../drizzle/modbm-core-schema.js');

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
}
