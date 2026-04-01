import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql, and, getTableColumns } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  productEvents,
  productGroups,
  productUoms,
} from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(query);

    let qb = this.db
      .select({
        ...getTableColumns(coreProducts),
        productGroupName: productGroups.name,
        productGroupCode: productGroups.groupCode,
      })
      .from(coreProducts)
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .$dynamic();

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(coreProducts.name, searchTerm),
          ilike(coreProducts.productNumber, searchTerm),
          ilike(coreProducts.barcode, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(sql`${coreProducts.stateCode} != 'archived'`);
    }

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const data = await qb
      .orderBy(coreProducts.name)
      .limit(limit)
      .offset(offset);

    // Count query for total (same filters, no limit/offset)
    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(coreProducts)
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count: total }] = await countQb;

    return { data, page, limit, total: Number(total) };
  }

  async findOne(id: string) {
    // Reject non-UUID strings early — product_id is a uuid column
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Product '${id}' not found`);
    }

    const rows = await this.db
      .select({
        ...getTableColumns(coreProducts),
        productGroupName: productGroups.name,
        productGroupCode: productGroups.groupCode,
      })
      .from(coreProducts)
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .where(eq(coreProducts.productId, id))
      .limit(1);

    if (rows.length > 0) {
      const events = await this.db
        .select()
        .from(productEvents)
        .where(eq(productEvents.productId, id))
        .orderBy(productEvents.createdOn);

      const uoms = await this.db
        .select()
        .from(productUoms)
        .where(eq(productUoms.productId, id));

      return { ...rows[0], events, productUoms: uoms };
    }

    throw new NotFoundException(`Product '${id}' not found`);
  }
}
