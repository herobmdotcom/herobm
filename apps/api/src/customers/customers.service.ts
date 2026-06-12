import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  eq,
  ilike,
  or,
  sql,
  and,
  asc,
  desc,
  getTableColumns,
} from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  customers,
  masterDataEvents,
  customerGroups,
  taxCategories,
  customerContacts,
  customerDeliveryAddresses,
} from '../drizzle/modbm-core-schema';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { alias } from 'drizzle-orm/pg-core';

import { CUSTOMER_STATE } from '@modbm/shared';

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(customers.name, searchTerm),
          ilike(customers.customerNumber, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(
        sql`${customers.stateCode} != ${CUSTOMER_STATE.ARCHIVED}`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let qb = this.db
      .select({
        ...getTableColumns(customers),
        customerGroupName: customerGroups.name,
        customerGroupCode: customerGroups.groupCode,
        customerGroupTradingTermsId: customerGroups.tradingTermsId,
        customerGroupCreditLimit: customerGroups.creditLimit,
        customerGroupIsOnCreditHold: customerGroups.isOnCreditHold,
        gstCategoryName: taxCategories.code,
      })
      .from(customers)
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        taxCategories,
        eq(customers.taxCategoryId, taxCategories.taxCategoryId),
      )
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor,
      direction: direction,
      applyWhere: (q, c: { name: string; id: string }, dir) => {
        const cursorCond =
          dir === 'next'
            ? or(
                sql`lower(${customers.name}) > lower(${c.name})`,
                and(
                  sql`lower(${customers.name}) = lower(${c.name})`,
                  sql`${customers.customerId} > ${c.id}`,
                ),
              )
            : or(
                sql`lower(${customers.name}) < lower(${c.name})`,
                and(
                  sql`lower(${customers.name}) = lower(${c.name})`,
                  sql`${customers.customerId} < ${c.id}`,
                ),
              );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(sql`lower(${customers.name})`),
          orderFn(customers.customerId),
        );
      },
      encodeRow: (row) => ({ name: row.name, id: row.customerId }),
    });

    // Count total matching rows
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(whereClause);

    return { data, page, limit, total: Number(count), nextCursor, prevCursor };
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    // Look up by UUID or by sourceId (legacy ABM slugs)
    const rows = await db
      .select({
        ...getTableColumns(customers),
        customerGroupName: customerGroups.name,
        customerGroupCode: customerGroups.groupCode,
        customerGroupTradingTermsId: customerGroups.tradingTermsId,
        customerGroupCreditLimit: customerGroups.creditLimit,
        customerGroupIsOnCreditHold: customerGroups.isOnCreditHold,
        gstCategoryName: taxCategories.code,
      })
      .from(customers)
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        taxCategories,
        eq(customers.taxCategoryId, taxCategories.taxCategoryId),
      )

      .where(isUuid ? eq(customers.customerId, id) : eq(customers.sourceId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Customer '${id}' not found`);
    }

    const customer = rows[0];

    const eventsQuery = db
      .select()
      .from(masterDataEvents)
      .where(eq(masterDataEvents.entityId, customer.customerId))
      .orderBy(sql`${masterDataEvents.createdOn} DESC`);

    const [events, contactsResult, deliveryAddressesResult] = await Promise.all(
      [
        eventsQuery,
        db.query.customerContacts
          .findMany({
            where: eq(customerContacts.customerId, customer.customerId),
          })
          .catch(() => []), // fallback if not available
        db.query.customerDeliveryAddresses
          .findMany({
            where: eq(
              customerDeliveryAddresses.customerId,
              customer.customerId,
            ),
          })
          .catch(() => []),
      ],
    );

    // Use dynamic import workaround to avoid cyclic dependency if any, or just import them
    // Actually, I should import customerContacts and customerDeliveryAddresses at the top.

    return {
      ...customer,
      events,
      contacts: contactsResult,
      deliveryAddresses: deliveryAddressesResult,
    };
  }
}
