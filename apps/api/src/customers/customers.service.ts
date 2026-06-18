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
  taxPositions,
  customerContacts,
  customerDeliveryAddresses,
} from '../drizzle/herobm-core-schema';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { alias } from 'drizzle-orm/pg-core';

import { CUSTOMER_STATE } from '@herobm/shared';
import { CreditAssessmentService } from './credit-assessment.service';
import { AppConfigService } from '../settings/app-config.service';
import {
  resolveCustomerRiskProfile,
  ResolvedCustomerRiskProfile,
  CustomerProfile,
  CustomerGroupProfile,
} from './customer-risk.domain';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly creditAssessmentService: CreditAssessmentService,
    private readonly appConfig: AppConfigService,
  ) {}

  async assessRisk(
    customerId: string,
    additionalExposure: number = 0,
    operation: 'create' | 'update' | 'confirm' | 'quote' = 'confirm',
    tx?: DrizzleDB,
  ): Promise<ResolvedCustomerRiskProfile> {
    const db = tx || this.db;

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.customerId, customerId));

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    let group = null;
    if (customer.customerGroupId) {
      const [g] = await db
        .select()
        .from(customerGroups)
        .where(eq(customerGroups.customerGroupId, customer.customerGroupId));
      group = g;
    }

    const assessment = await this.creditAssessmentService.assessCredit(
      customerId,
      tx,
    );

    const behavior = this.appConfig.creditLimitBehavior();

    return resolveCustomerRiskProfile(
      customer as unknown as CustomerProfile,
      group as unknown as CustomerGroupProfile,
      assessment,
      additionalExposure,
      behavior,
      operation,
    );
  }

  async findAll(query?: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${customers.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${customers.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${customers.customerNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${customers.customerNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(customers.name, `%${rawSearchTerm}%`),
          ilike(customers.customerNumber, `%${rawSearchTerm}%`),
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
        customerGroupTaxPositionId: customerGroups.taxPositionId,
        gstCategoryName: taxPositions.code,
        score: scoreSql,
      })
      .from(customers)
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        taxPositions,
        eq(customers.taxPositionId, taxPositions.taxPositionId),
      )
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { score: number; name: string; id: string } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const nameOp = dir === 'next' ? sql`>` : sql`<`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;

        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${customers.name}) ${nameOp} lower(${c.name})`,
          ),
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${customers.name}) = lower(${c.name})`,
            sql`${customers.customerId} ${idOp} ${c.id}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        const scoreOp = dir === 'next' ? desc : asc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(sql`lower(${customers.name})`),
          orderFn(customers.customerId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        name: row.name,
        id: row.customerId,
      }),
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
        customerGroupTaxPositionId: customerGroups.taxPositionId,
        gstCategoryName: taxPositions.code,
      })
      .from(customers)
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        taxPositions,
        eq(customers.taxPositionId, taxPositions.taxPositionId),
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
