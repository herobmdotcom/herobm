import { Injectable, Inject } from '@nestjs/common';
import { ilike, or, eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { inventory, binContents } from '../drizzle/schema';

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  private get database(): DrizzleDB {
    return this.db as DrizzleDB;
  }

  async findAll(query?: { search?: string; page?: number; limit?: number; locationNo?: string }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    let qb = this.database.select().from(inventory).$dynamic();

    if (query?.search) {
      const term = `%${query.search}%`;
      qb = qb.where(
        or(
          ilike(inventory.productName, term),
          ilike(inventory.productNumber, term),
          ilike(inventory.locationName, term),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(inventory.locationNo, query.locationNo));
    }

    const rows = await qb
      .orderBy(inventory.productName)
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit };
  }

  async findBins(query?: { search?: string; page?: number; limit?: number; locationNo?: string }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    let qb = this.database.select().from(binContents).$dynamic();

    if (query?.search) {
      const term = `%${query.search}%`;
      qb = qb.where(
        or(
          ilike(binContents.productName, term),
          ilike(binContents.productNumber, term),
          ilike(binContents.binNumber, term),
        ),
      );
    }

    if (query?.locationNo) {
      qb = qb.where(eq(binContents.locationNo, query.locationNo));
    }

    const rows = await qb
      .orderBy(binContents.binNumber)
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit };
  }
}
