    // security-ignore: sql-raw\nimport { Injectable, Inject, NotFoundException } from '@nestjs/common';
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

    const customerIds = data.map((c) => c.customerId);
    const assessments =
      await this.creditAssessmentService.assessCreditBatch(customerIds);

    const enrichedData = data.map((row) => {
      const custProfile: CustomerProfile = {
        stateCode: row.stateCode,
        isOnCreditHold: Boolean(row.isOnCreditHold),
        creditLimit: row.creditLimit?.toString() || null,
        tradingTermsId: row.tradingTermsId,
        overrideCreditHoldUntil: row.overrideCreditHoldUntil,
        earlyPaymentDiscount: row.earlyPaymentDiscount?.toString() || null,
        earlyPaymentDiscountDays: row.earlyPaymentDiscountDays,
      };

      let groupProfile: CustomerGroupProfile | null = null;
      if (row.customerGroupId) {
        groupProfile = {
          stateCode: row.stateCode, // Groups don't have an independent stateCode
          isOnCreditHold: Boolean(row.customerGroupIsOnCreditHold),
          creditLimit: row.customerGroupCreditLimit?.toString() || null,
          tradingTermsId: row.customerGroupTradingTermsId,
        };
      }

      const risk = resolveCustomerRiskProfile(
        custProfile,
        groupProfile,
        assessments[row.customerId] || {
          glBalance: 0,
          totalInvoiceBalance: 0,
          overdueInvoiceBalance: 0,
          isOverdue: false,
        },
        0,
        'hard',
        'confirm',
      );

      return {
        ...row,
        isSalesBlocked: risk.isSalesBlocked,
        salesBlockReasons: risk.salesBlockReasons,
      };
    });

    return {
      data: enrichedData,
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
        businessNumber: actors.businessNumber,
        isTaxRegistered: actors.isTaxRegistered,
        billingAddressLine1: actors.headquartersAddressLine1,
        billingAddressLine2: actors.headquartersAddressLine2,
        billingAddressCity: actors.headquartersCity,
        billingAddressStateOrProvince: actors.headquartersStateOrProvince,
        billingAddressPostalCode: actors.headquartersPostalCode,
        billingAddressCountry: actors.headquartersCountry,
        telephone1: sql<string>`''`, // legacy mock
        fax: sql<string>`''`, // legacy mock
        emailAddress1: sql<string>`''`, // legacy mock
      })
      .from(customers)
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
              mobile: sql<string>`''`, // legacy mock
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
    const basisCol = agingBasis === 'invoiceDate' ? 'invoice_date' : 'due_date';

    const invoicesQuery = sql`
      SELECT 
        c.customer_id as "customerId",
        a.name as "customerName",
        c.customer_number as "customerNumber",
        c.currency_code as "currencyCode",
        c.state_code as "stateCode",
        c.is_on_credit_hold as "cIsOnCreditHold",
        c.credit_limit as "cCreditLimit",
        c.override_credit_hold_until as "cOverride",
        c.customer_group_id as "customerGroupId",
        g.is_on_credit_hold as "gIsOnCreditHold",
        g.credit_limit as "gCreditLimit",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) as "current",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE AND i.${sql.raw(basisCol)} >= CURRENT_DATE - INTERVAL '30 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days1To30",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE - INTERVAL '30 days' AND i.${sql.raw(basisCol)} >= CURRENT_DATE - INTERVAL '60 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days31To60",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE - INTERVAL '60 days' AND i.${sql.raw(basisCol)} >= CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as "days61To90",
        COALESCE(SUM(CASE WHEN i.${sql.raw(basisCol)} < CURRENT_DATE - INTERVAL '90 days' OR i.${sql.raw(basisCol)} IS NULL THEN i.outstanding_amount ELSE 0 END), 0) as "days90Plus",
        COALESCE(SUM(i.outstanding_amount), 0) as "totalOutstanding"
      FROM herobm_core.customers c
      LEFT JOIN herobm_core.actors a ON c.actor_id = a.actor_id
      LEFT JOIN herobm_core.customer_groups g ON c.customer_group_id = g.customer_group_id
      JOIN herobm_core.sales_orders so ON so.customer_id = c.customer_id
      JOIN herobm_core.sales_invoices i ON i.sales_order_id = so.sales_order_id
      WHERE i.outstanding_amount > 0 AND i.state_code NOT IN (${SALES_INVOICE_STATE.DRAFT}, ${SALES_INVOICE_STATE.CANCELLED}, ${SALES_INVOICE_STATE.PAID})
      GROUP BY c.customer_id, a.name, c.customer_number, c.currency_code, c.state_code, c.is_on_credit_hold, c.credit_limit, c.override_credit_hold_until, c.customer_group_id, g.is_on_credit_hold, g.credit_limit
    `;

    const glQuery = sql`
      SELECT 
        l.party_id as "customerId",
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as "glBalance"
      FROM herobm_core.gl_journal_lines l
      JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
      WHERE l.party_type = 'customer'
      GROUP BY l.party_id
    `;

    const [invoicesRes, glRes] = await Promise.all([
      this.db.execute(invoicesQuery),
      this.db.execute(glQuery),
    ]);

    const invoicesRows = ((invoicesRes as unknown as Record<string, unknown>)
      .rows ?? invoicesRes) as Record<string, unknown>[];
    const glRows = ((glRes as unknown as Record<string, unknown>).rows ??
      glRes) as Record<string, unknown>[];

    const glMap = new Map<string, number>();
    for (const row of glRows) {
      if (row.customerId) {
        glMap.set(row.customerId as string, Number(row.glBalance));
      }
    }

    return invoicesRows.map((row) => {
      const glBalance = glMap.get(row.customerId as string) || 0;
      const totalOutstanding = Number(row.totalOutstanding);
      const current = Number(row.current);
      const overdueInvoiceBalance = totalOutstanding - current;

      const custProfile = {
        stateCode: row.stateCode as string,
        isOnCreditHold: Boolean(row.cIsOnCreditHold),
        creditLimit:
          row.cCreditLimit !== null
            ? String(row.cCreditLimit as string | number)
            : null,
        tradingTermsId: null,
        overrideCreditHoldUntil: row.cOverride
          ? new Date(row.cOverride as string)
          : null,
      };

      const groupProfile = row.customerGroupId
        ? {
            stateCode: row.stateCode as string,
            isOnCreditHold: Boolean(row.gIsOnCreditHold),
            creditLimit:
              row.gCreditLimit !== null
                ? String(row.gCreditLimit as string | number)
                : null,
            tradingTermsId: null,
          }
        : null;

      const risk = resolveCustomerRiskProfile(
        custProfile,
        groupProfile,
        {
          totalInvoiceBalance: totalOutstanding,
          overdueInvoiceBalance,
          glBalance,
          isOverdue: overdueInvoiceBalance > 0,
        },
        0,
        'hard',
        'confirm',
      );

      return {
        customerId: row.customerId as string,
        customerName: row.customerName as string,
        customerNumber: row.customerNumber as string,
        currencyCode: row.currencyCode,
        current,
        days1To30: Number(row.days1To30),
        days31To60: Number(row.days31To60),
        days61To90: Number(row.days61To90),
        days90Plus: Number(row.days90Plus),
        totalOutstanding,
        glBalance,
        discrepancyAmount: Math.abs(totalOutstanding - glBalance),
        isOnCreditHold: risk.isSalesBlocked,
        creditLimit: risk.effectiveCreditLimit,
        stateCode: row.stateCode as string,
      };
    });
  }
}
