import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  suppliers as coreSuppliers,
  supplierEvents,
  supplierGroups,
} from '../drizzle/modbm-core-schema';
import { eq, ilike, or, sql, and, getTableColumns } from 'drizzle-orm';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(params);

    let qb = this.db
      .select({
        ...getTableColumns(coreSuppliers),
        supplierGroupName: supplierGroups.name,
        supplierGroupCode: supplierGroups.groupCode,
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
      conditions.push(sql`${coreSuppliers.stateCode} != 'archived'`);
    }

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const data = await qb
      .orderBy(coreSuppliers.name)
      .limit(limit)
      .offset(offset);

    // Count query for total (same filters, no limit/offset)
    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(coreSuppliers)
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count: total }] = await countQb;

    return { data, page, limit, total: Number(total) };
  }

  async findOne(id: string) {
    const rows = await this.db
      .select({
        ...getTableColumns(coreSuppliers),
        supplierGroupName: supplierGroups.name,
        supplierGroupCode: supplierGroups.groupCode,
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
        .from(supplierEvents)
        .where(eq(supplierEvents.vendorId, id))
        .orderBy(supplierEvents.createdOn);

      return { ...rows[0], events };
    }

    throw new NotFoundException(`Supplier '${id}' not found`);
  }

  /** Products supplied by a given vendor */
  async findSupplierProducts(vendorId: string, params: PaginationQuery) {
    const { page, limit, offset } = parsePagination(params);

    const { productSuppliers, products } =
      await import('../drizzle/modbm-core-schema.js');

    const baseQuery = this.db
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
      .where(eq(productSuppliers.vendorId, vendorId));

    const data = await baseQuery
      .orderBy(products.name)
      .limit(limit)
      .offset(offset);

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(productSuppliers)
      .where(eq(productSuppliers.vendorId, vendorId));

    const [{ count: total }] = await countQuery;

    return { data, page, limit, total: Number(total) };
  }

  /** Suppliers that provide a given product */
  async findProductSuppliers(productId: string, params: PaginationQuery) {
    const { page, limit, offset } = parsePagination(params);

    const { productSuppliers, suppliers } =
      await import('../drizzle/modbm-core-schema.js');

    const baseQuery = this.db
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
      .where(eq(productSuppliers.productId, productId));

    const data = await baseQuery
      .orderBy(suppliers.name)
      .limit(limit)
      .offset(offset);

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(productSuppliers)
      .where(eq(productSuppliers.productId, productId));

    const [{ count: total }] = await countQuery;

    return { data, page, limit, total: Number(total) };
  }
}
