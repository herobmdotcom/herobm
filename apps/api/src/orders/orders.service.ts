import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesOrderLines } from '../drizzle/schema';

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  private get database(): DrizzleDB {
    return this.db as DrizzleDB;
  }

  async findAll(query?: { search?: string; page?: number; limit?: number }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    let qb = this.database.select().from(salesOrderLines).$dynamic();

    if (query?.search) {
      const term = `%${query.search}%`;
      qb = qb.where(
        or(
          ilike(salesOrderLines.orderNumber, term),
          ilike(salesOrderLines.accountName, term),
          ilike(salesOrderLines.productDescription, term),
          ilike(salesOrderLines.customerOrderNumber, term),
        ),
      );
    }

    const rows = await qb
      .orderBy(salesOrderLines.orderNumber)
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit };
  }

  async findOne(id: string) {
    const rows = await this.database
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderLineId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Order line '${id}' not found`);
    }
    return rows[0];
  }
}
