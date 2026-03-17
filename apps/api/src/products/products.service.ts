import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { products } from '../drizzle/schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm } = parsePagination(query);

    let qb = this.db.select().from(products).$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(products.name, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(products.barcode, searchTerm),
        ),
      );
    }

    const rows = await qb.orderBy(products.name).limit(limit).offset(offset);

    return { data: rows, page, limit };
  }

  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.productId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Product '${id}' not found`);
    }
    return rows[0];
  }
}
