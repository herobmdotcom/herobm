import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { suppliers, productSuppliers } from '../drizzle/schema';
import { eq, ilike, or, and } from 'drizzle-orm';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm } = parsePagination(params);

    let conditions = undefined;
    if (searchTerm) {
      conditions = or(
        ilike(suppliers.name, searchTerm),
        ilike(suppliers.vendorNumber, searchTerm),
      );
    }

    const data = await this.db
      .select()
      .from(suppliers)
      .where(conditions)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: this.db.$count(suppliers, conditions) })
      .from(suppliers);

    return {
      data,
      page,
      limit,
      total: Number(count),
    };
  }

  async findOne(id: string) {
    const supplier = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.vendorId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  /** Products supplied by a given vendor */
  async findSupplierProducts(vendorId: string) {
    return this.db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.vendorId, vendorId));
  }

  /** All suppliers for a given product */
  async findProductSuppliers(productId: string) {
    return this.db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.productId, productId));
  }
}
