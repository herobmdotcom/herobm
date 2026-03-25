import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  suppliers as coreSuppliers,
  supplierEvents,
} from '../drizzle/modbm-core-schema';
import { eq, ilike, or, sql, and } from 'drizzle-orm';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(params);

    let qb = this.db.select().from(coreSuppliers).$dynamic();

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
      .select()
      .from(coreSuppliers)
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
  async findSupplierProducts(vendorId: string) {
    const { productSuppliers } =
      await import('../drizzle/modbm-core-schema.js');
    return this.db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.vendorId, vendorId));
  }
}
