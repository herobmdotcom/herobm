import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { accounts } from '../drizzle/schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm } = parsePagination(query);

    let qb = this.db.select().from(accounts).$dynamic();

    if (searchTerm) {
      qb = qb.where(
        or(
          ilike(accounts.name, searchTerm),
          ilike(accounts.accountNumber, searchTerm),
          ilike(accounts.emailAddress1, searchTerm),
        ),
      );
    }

    const rows = await qb.orderBy(accounts.name).limit(limit).offset(offset);

    return { data: rows, page, limit };
  }

  async findOne(id: string) {
    const rows = await this.db
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
