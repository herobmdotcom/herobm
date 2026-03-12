import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { accounts } from '../drizzle/schema';

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  private get database(): DrizzleDB {
    return this.db as DrizzleDB;
  }

  async findAll(query?: { search?: string; page?: number; limit?: number }) {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    let qb = this.database.select().from(accounts).$dynamic();

    if (query?.search) {
      const term = `%${query.search}%`;
      qb = qb.where(
        or(
          ilike(accounts.name, term),
          ilike(accounts.accountNumber, term),
          ilike(accounts.emailAddress1, term),
        ),
      );
    }

    const rows = await qb
      .orderBy(accounts.name)
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit };
  }

  async findOne(id: string) {
    const rows = await this.database
      .select()
      .from(accounts)
      .where(eq(accounts.accountId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Account '${id}' not found`);
    }
    return rows[0];
  }
}
