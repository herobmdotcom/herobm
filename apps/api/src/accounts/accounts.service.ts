import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql, and, asc, getTableColumns } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  accounts,
  accountEvents,
  accountGroups,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(query);

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(accounts.name, searchTerm),
          ilike(accounts.accountNumber, searchTerm),
          ilike(accounts.emailAddress1, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(sql`${accounts.stateCode} != 'archived'`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total matching rows
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(whereClause);

    // Fetch paginated, sorted results
    let q = this.db
      .select({
        ...getTableColumns(accounts),
        accountGroupName: accountGroups.name,
        accountGroupCode: accountGroups.groupCode,
        accountGroupDiscount: accountGroups.defaultDiscountPercentage,
        accountGroupTradingTermsId: accountGroups.tradingTermsId,
        accountGroupCreditLimit: accountGroups.creditLimit,
        accountGroupIsOnCreditHold: accountGroups.isOnCreditHold,
        gstCategoryName: taxCategories.code,
      })
      .from(accounts)
      .leftJoin(
        accountGroups,
        eq(accounts.accountGroupId, accountGroups.accountGroupId),
      )
      .leftJoin(
        taxCategories,
        eq(accounts.taxCategoryId, taxCategories.taxCategoryId),
      )
      .orderBy(asc(sql`lower(${accounts.name})`))
      .limit(limit)
      .offset(offset)
      .$dynamic();

    if (whereClause) {
      q = q.where(whereClause);
    }

    const data = await q;

    return { data, page, limit, total: Number(count) };
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    // Look up by UUID or by sourceId (legacy ABM slugs)
    const rows = await this.db
      .select({
        ...getTableColumns(accounts),
        accountGroupName: accountGroups.name,
        accountGroupCode: accountGroups.groupCode,
        accountGroupDiscount: accountGroups.defaultDiscountPercentage,
        accountGroupTradingTermsId: accountGroups.tradingTermsId,
        accountGroupCreditLimit: accountGroups.creditLimit,
        accountGroupIsOnCreditHold: accountGroups.isOnCreditHold,
        gstCategoryName: taxCategories.code,
      })
      .from(accounts)
      .leftJoin(
        accountGroups,
        eq(accounts.accountGroupId, accountGroups.accountGroupId),
      )
      .leftJoin(
        taxCategories,
        eq(accounts.taxCategoryId, taxCategories.taxCategoryId),
      )
      .where(isUuid ? eq(accounts.accountId, id) : eq(accounts.sourceId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Account '${id}' not found`);
    }

    const account = rows[0];

    // Load activity events
    const events = await this.db
      .select()
      .from(accountEvents)
      .where(eq(accountEvents.accountId, account.accountId))
      .orderBy(accountEvents.createdOn);

    return { ...account, events };
  }
}
