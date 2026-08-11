// security-ignore: sql-raw
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
  contacts,
  actorContactLinks,
  actors,
  customerDeliveryAddresses,
  actorActorLinks,
} from '@herobm/db-schema';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { alias } from 'drizzle-orm/pg-core';

import { CUSTOMER_STATE, SALES_INVOICE_STATE } from '@herobm/shared';
import { CreditAssessmentService } from './credit-assessment.service';
import { AppConfigService } from '../settings/app-config.service';
import {
  resolveCustomerRiskProfile,
  ResolvedCustomerRiskProfile,
  CustomerProfile,
  CustomerGroupProfile,
} from './customer-risk.domain';
import {
  AgedBalanceResult,
  calculateCustomerBalances,
} from './customer-balances.util';

@Injectable()
export class CustomersService {
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
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
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
          ilike(actors.name, `%${rawSearchTerm}%`),
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

    const parentLink = alias(actorActorLinks, 'parent_link');
    const parentActor = alias(actors, 'parent_actor');
    const parentCustomer = alias(customers, 'parent_customer');

    let qb = this.db
      .select({
        ...getTableColumns(customers),
        name: actors.name,
        customerGroupName: customerGroups.name,
        customerGroupCode: customerGroups.groupCode,
        customerGroupTradingTermsId: customerGroups.tradingTermsId,
        customerGroupCreditLimit: customerGroups.creditLimit,
        customerGroupIsOnCreditHold: customerGroups.isOnCreditHold,
        customerGroupTaxPositionId: customerGroups.taxPositionId,
        gstCategoryName: taxPositions.code,
        score: scoreSql,
        billingAddressLine1: actors.headquartersAddressLine1,
        billingAddressLine2: actors.headquartersAddressLine2,
        billingAddressCity: actors.headquartersCity,
        billingAddressStateOrProvince: actors.headquartersStateOrProvince,
        billingAddressPostalCode: actors.headquartersPostalCode,
        billingAddressCountry: actors.headquartersCountry,
        parentCustomerId: parentCustomer.customerId,
        parentCustomerName: parentActor.name,
        telephone: actors.telephone,
        email: actors.email,
        salesContactName: sql<string>`(
          SELECT c.first_name || ' ' || c.last_name
          FROM ${actorContactLinks} acl
          JOIN ${contacts} c ON acl.contact_id = c.contact_id
          WHERE acl.actor_id = ${customers.actorId} AND 'sales' = ANY(acl.primary_for)
          LIMIT 1
        )`,
        accountsContactName: sql<string>`(
          SELECT c.first_name || ' ' || c.last_name
          FROM ${actorContactLinks} acl
          JOIN ${contacts} c ON acl.contact_id = c.contact_id
          WHERE acl.actor_id = ${customers.actorId} AND 'accounts' = ANY(acl.primary_for)
          LIMIT 1
        )`,
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
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .leftJoin(
        parentLink,
        and(
          eq(parentLink.sourceActorId, customers.actorId),
          eq(parentLink.linkType, 'parent_company'),
        ),
      )
      .leftJoin(parentActor, eq(parentLink.targetActorId, parentActor.actorId))
      .leftJoin(parentCustomer, eq(parentActor.actorId, parentCustomer.actorId))
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
            sql`lower(${actors.name}) ${nameOp} lower(${c.name})`,
          ),
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${actors.name}) = lower(${c.name})`,
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
          orderFn(sql`lower(${actors.name})`),
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
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .where(whereClause);

    // Fetch balances and uninvoiced totals for the paginated customers
    const customerIds = data.map((c) => c.customerId);
    let balancesMap = new Map<string, AgedBalanceResult>();
    if (customerIds.length > 0) {
      const balancesList = await calculateCustomerBalances(
        this.db,
        'dueDate',
        customerIds,
      );
      balancesMap = new Map(balancesList.map((b) => [b.customerId, b]));
    }

    const customersWithBalances = data.map((c) => {
      const b = balancesMap.get(c.customerId);
      return {
        ...c,
        totalOutstanding: b ? b.totalOutstanding : 0,
        uninvoicedOrdersTotal: b ? b.uninvoicedOrdersTotal : 0,
      };
    });

    return {
      data: customersWithBalances,
      page,
      limit,
      total: Number(count),
      nextCursor,
      prevCursor,
    };
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
        name: actors.name,
        gstCategoryName: taxPositions.code,
        customerGroupTaxPositionId: customerGroups.taxPositionId,
        businessNumber: actors.businessNumber,
        isTaxRegistered: actors.isTaxRegistered,
        billingAddressLine1: actors.headquartersAddressLine1,
        billingAddressLine2: actors.headquartersAddressLine2,
        billingAddressCity: actors.headquartersCity,
        billingAddressStateOrProvince: actors.headquartersStateOrProvince,
        billingAddressPostalCode: actors.headquartersPostalCode,
        billingAddressCountry: actors.headquartersCountry,
        telephone1: actors.telephone,
        fax: actors.fax,
        emailAddress1: actors.email,
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
      .leftJoin(actors, eq(customers.actorId, actors.actorId))

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

    const [
      events,
      contactsResult,
      deliveryAddressesResult,
      creditAssessment,
      parentResult,
      childrenResult,
    ] = await Promise.all([
      eventsQuery,
      customer.actorId
        ? db
            .select({
              id: contacts.contactId,
              customerId: sql<string>`${customer.customerId}`, // map to old DTO
              firstName: contacts.firstName,
              lastName: contacts.lastName,
              fullName: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
              email: contacts.email,
              phone: contacts.phone,
              mobile: contacts.mobile,
              jobTitle: contacts.jobTitle,
              primaryFor: actorContactLinks.primaryFor,
              createdOn: contacts.createdOn,
              modifiedOn: contacts.modifiedOn,
            })
            .from(contacts)
            .innerJoin(
              actorContactLinks,
              eq(contacts.contactId, actorContactLinks.contactId),
            )
            .where(eq(actorContactLinks.actorId, customer.actorId))
            .catch(() => [])
        : Promise.resolve([]),
      db.query.customerDeliveryAddresses
        .findMany({
          where: eq(customerDeliveryAddresses.customerId, customer.customerId),
        })
        .catch(() => []),
      this.creditAssessmentService.assessCredit(customer.customerId, db),
      customer.actorId
        ? db
            .select({
              customerId: customers.customerId,
              name: actors.name,
            })
            .from(actorActorLinks)
            .innerJoin(
              actors,
              eq(actorActorLinks.targetActorId, actors.actorId),
            )
            .innerJoin(customers, eq(actors.actorId, customers.actorId))
            .where(
              and(
                eq(actorActorLinks.sourceActorId, customer.actorId),
                eq(actorActorLinks.linkType, 'parent_company'),
              ),
            )
            .limit(1)
            .catch(() => [])
        : Promise.resolve([]),
      customer.actorId
        ? db
            .select({
              customerId: customers.customerId,
              name: actors.name,
            })
            .from(actorActorLinks)
            .innerJoin(
              actors,
              eq(actorActorLinks.sourceActorId, actors.actorId),
            )
            .innerJoin(customers, eq(actors.actorId, customers.actorId))
            .where(
              and(
                eq(actorActorLinks.targetActorId, customer.actorId),
                eq(actorActorLinks.linkType, 'parent_company'),
              ),
            )
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // Fetch group if applicable
    let groupProfile: CustomerGroupProfile | null = null;
    if (customer.customerGroupId) {
      const groups = await db
        .select()
        .from(customerGroups)
        .where(eq(customerGroups.customerGroupId, customer.customerGroupId))
        .limit(1);
      if (groups.length) {
        groupProfile = {
          stateCode: customer.stateCode,
          isOnCreditHold: groups[0].isOnCreditHold,
          creditLimit: groups[0].creditLimit?.toString() || null,
          tradingTermsId: groups[0].tradingTermsId,
        };
      }
    }

    const custProfile: CustomerProfile = {
      stateCode: customer.stateCode,
      isOnCreditHold: Boolean(customer.isOnCreditHold),
      creditLimit: customer.creditLimit?.toString() || null,
      tradingTermsId: customer.tradingTermsId,
      overrideCreditHoldUntil: customer.overrideCreditHoldUntil,
      earlyPaymentDiscount: customer.earlyPaymentDiscount?.toString() || null,
      earlyPaymentDiscountDays: customer.earlyPaymentDiscountDays,
    };

    const risk = resolveCustomerRiskProfile(
      custProfile,
      groupProfile,
      creditAssessment,
      0,
      'hard',
      'confirm',
    );

    return {
      ...customer,
      events,
      contacts: contactsResult.map((c) => ({ ...c, contactId: c.id })),
      deliveryAddresses: deliveryAddressesResult.map((d) => ({
        ...d,
        deliveryAddressId: d.id,
      })),
      isSalesBlocked: risk.isSalesBlocked,
      salesBlockReasons: risk.salesBlockReasons,
      creditAssessment,
      effectiveCreditLimit: risk.effectiveCreditLimit,
      parentCustomerId:
        parentResult.length > 0 ? parentResult[0].customerId : null,
      parentCustomerName: parentResult.length > 0 ? parentResult[0].name : null,
      childAccounts: childrenResult.map((c) => ({
        customerId: c.customerId,
        name: c.name,
      })),
    };
  }

  async getAgedBalances(agingBasis: 'invoiceDate' | 'dueDate' = 'dueDate') {
    const balances = await calculateCustomerBalances(this.db, agingBasis);

    return balances.map((b) => {
      const custProfile = {
        stateCode: b.stateCode as string,
        isOnCreditHold: Boolean(b.isOnCreditHold),
        creditLimit: b.creditLimit ?? null,
        tradingTermsId: null,
        overrideCreditHoldUntil: b.overrideCreditHoldUntil ?? null,
      };

      const groupProfile = b.customerGroupId
        ? {
            stateCode: b.stateCode as string,
            isOnCreditHold: Boolean(b.groupIsOnCreditHold),
            creditLimit: b.groupCreditLimit ?? null,
            tradingTermsId: null,
          }
        : null;

      const risk = resolveCustomerRiskProfile(
        custProfile as CustomerProfile,
        groupProfile as CustomerGroupProfile,
        {
          totalInvoiceBalance: b.totalOutstanding,
          overdueInvoiceBalance: b.totalOutstanding - b.current,
          glBalance: b.glBalance,
          isOverdue: b.totalOutstanding - b.current > 0,
        },
        0,
        'hard',
        'confirm',
      );

      return {
        customerId: b.customerId,
        customerName: b.customerName as string,
        customerNumber: b.customerNumber as string,
        currencyCode: b.currencyCode,
        current: b.current,
        days1To30: b.days1To30,
        days31To60: b.days31To60,
        days61To90: b.days61To90,
        days90Plus: b.days90Plus,
        totalOutstanding: b.totalOutstanding,
        glBalance: b.glBalance,
        discrepancyAmount: b.discrepancyAmount,
        uninvoicedOrdersTotal: b.uninvoicedOrdersTotal,
        isOnCreditHold: risk.isSalesBlocked,
        creditLimit: risk.effectiveCreditLimit,
        stateCode: b.stateCode as string,
      };
    });
  }
}
