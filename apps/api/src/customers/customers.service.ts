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

    const behavior = this.appConfig.creditLimitBehavior();

    const customersWithBalances = data.map((c) => {
      const b = balancesMap.get(c.customerId);
      const totalOutstanding = b ? b.totalOutstanding : 0;
      const current = b ? b.current : 0;
      const overdueInvoiceBalance = Math.max(0, totalOutstanding - current);
      const glBalance = b ? b.glBalance : 0;
      const uninvoicedOrdersTotal = b ? b.uninvoicedOrdersTotal : 0;

      const custProfile: CustomerProfile = {
        stateCode: c.stateCode as string,
        isOnCreditHold: Boolean(c.isOnCreditHold),
        creditLimit:
          c.creditLimit !== null && c.creditLimit !== undefined
            ? String(c.creditLimit)
            : null,
        tradingTermsId: c.tradingTermsId,
        overrideCreditHoldUntil: c.overrideCreditHoldUntil
          ? new Date(c.overrideCreditHoldUntil)
          : null,
        earlyPaymentDiscount:
          c.earlyPaymentDiscount !== null &&
          c.earlyPaymentDiscount !== undefined
            ? String(c.earlyPaymentDiscount)
            : null,
        earlyPaymentDiscountDays: c.earlyPaymentDiscountDays,
      };

      const groupProfile: CustomerGroupProfile | null = c.customerGroupId
        ? {
            stateCode: c.stateCode as string,
            isOnCreditHold: Boolean(c.customerGroupIsOnCreditHold),
            creditLimit:
              c.customerGroupCreditLimit !== null &&
              c.customerGroupCreditLimit !== undefined
                ? String(c.customerGroupCreditLimit)
                : null,
            tradingTermsId: c.customerGroupTradingTermsId,
          }
        : null;

      const risk = resolveCustomerRiskProfile(
        custProfile,
        groupProfile,
        {
          totalInvoiceBalance: totalOutstanding,
          overdueInvoiceBalance,
          glBalance,
          isOverdue: overdueInvoiceBalance > 0.01,
        },
        uninvoicedOrdersTotal,
        behavior,
        'confirm',
      );

      return {
        ...c,
        totalOutstanding,
        uninvoicedOrdersTotal,
        isSalesBlocked: risk.isSalesBlocked,
        salesBlockReasons: risk.salesBlockReasons,
        effectiveCreditLimit: risk.effectiveCreditLimit,
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

  async getAgedBalances(
    agingBasis: 'invoiceDate' | 'dueDate' = 'dueDate',
    query?: PaginationQuery,
    quickFilter?: string,
  ) {
    const basisCol = agingBasis === 'invoiceDate' ? 'invoice_date' : 'due_date';
    const { limit, page, searchTerm, sort, sortDirection } =
      parsePagination(query);
    const offset = (page - 1) * limit;

    let conditions = sql`1=1`;
    if (searchTerm) {
      conditions = sql`${conditions} AND (ci.customer_name ILIKE ${searchTerm} OR ci.customer_number ILIKE ${searchTerm})`;
    }

    if (quickFilter === 'discrepancy') {
      conditions = sql`${conditions} AND ABS(COALESCE(cgl.gl_balance, 0) - ci.total_outstanding) > 0.01`;
    } else if (quickFilter === 'overdue') {
      conditions = sql`${conditions} AND (ci.total_outstanding - ci.current) > 0.01`;
    } else if (quickFilter === 'overLimit') {
      conditions = sql`${conditions} AND COALESCE(ci.c_credit_limit, ci.g_credit_limit) IS NOT NULL AND ci.total_outstanding > COALESCE(ci.c_credit_limit, ci.g_credit_limit)`;
    }

    let orderBy = sql`"customerName" ASC`;
    if (sort) {
      const sortMap: Record<string, string> = {
        customerNumber: 'customerNumber',
        customerName: 'customerName',
        creditLimit: 'creditLimit',
        current: 'current',
        days1To30: 'days1To30',
        days31To60: 'days31To60',
        days61To90: 'days61To90',
        days90Plus: 'days90Plus',
        totalOutstanding: 'totalOutstanding',
        uninvoicedOrdersTotal: 'uninvoicedOrdersTotal',
        glBalance: 'glBalance',
        discrepancyAmount: 'discrepancyAmount',
      };
      const mappedCol = sortMap[sort] || 'customerName';
      const sortIdentifier = sql.identifier(mappedCol);
      orderBy =
        sortDirection === 'desc'
          ? sql`${sortIdentifier} DESC`
          : sql`${sortIdentifier} ASC`;
    }

    const cteQuery = sql`
      WITH customer_invoices AS (
        SELECT 
          c.customer_id,
          a.name as customer_name,
          c.customer_number,
          c.currency_code,
          c.state_code,
          c.is_on_credit_hold as c_is_on_credit_hold,
          c.credit_limit as c_credit_limit,
          c.override_credit_hold_until as c_override,
          c.customer_group_id,
          g.is_on_credit_hold as g_is_on_credit_hold,
          g.credit_limit as g_credit_limit,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) as current,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '30 days' THEN i.outstanding_amount ELSE 0 END), 0) as days1_to_30,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '30 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '60 days' THEN i.outstanding_amount ELSE 0 END), 0) as days31_to_60,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '60 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as days61_to_90,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '90 days' OR i.${sql.identifier(basisCol)} IS NULL THEN i.outstanding_amount ELSE 0 END), 0) as days90_plus,
          COALESCE(SUM(i.outstanding_amount), 0) as total_outstanding
        FROM herobm_core.sales_invoices i
        LEFT JOIN herobm_core.sales_orders so ON i.sales_order_id = so.sales_order_id
        JOIN herobm_core.customers c ON c.customer_id = COALESCE(i.customer_id, so.customer_id)
        LEFT JOIN herobm_core.actors a ON c.actor_id = a.actor_id
        LEFT JOIN herobm_core.customer_groups g ON c.customer_group_id = g.customer_group_id
        WHERE i.outstanding_amount > 0 AND i.state_code NOT IN ('draft', 'cancelled', 'paid')
        GROUP BY c.customer_id, a.name, c.customer_number, c.currency_code, c.state_code, c.is_on_credit_hold, c.credit_limit, c.override_credit_hold_until, c.customer_group_id, g.is_on_credit_hold, g.credit_limit
      ),
      customer_gl AS (
        SELECT 
          l.party_id,
          COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as gl_balance
        FROM herobm_core.gl_journal_lines l
        JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
        WHERE l.party_type = 'customer'
        GROUP BY l.party_id
      ),
      customer_uninvoiced AS (
        SELECT
          so.customer_id,
          SUM(
            COALESCE((SELECT SUM(sol.total_amount) FROM herobm_core.sales_order_lines sol WHERE sol.sales_order_id = so.sales_order_id), 0)
            -
            COALESCE((SELECT SUM(si.total_amount) FROM herobm_core.sales_invoices si WHERE si.sales_order_id = so.sales_order_id AND si.state_code NOT IN ('draft', 'cancelled')), 0)
          ) as uninvoiced_total
        FROM herobm_core.sales_orders so
        WHERE so.state_code IN ('confirmed', 'picking', 'shipped')
        GROUP BY so.customer_id
      ),
      combined AS (
        SELECT 
          ci.customer_id as "customerId",
          ci.customer_name as "customerName",
          ci.customer_number as "customerNumber",
          ci.currency_code as "currencyCode",
          ci.state_code as "stateCode",
          ci.c_is_on_credit_hold as "cIsOnCreditHold",
          ci.c_credit_limit as "cCreditLimit",
          ci.c_override as "cOverride",
          ci.customer_group_id as "customerGroupId",
          ci.g_is_on_credit_hold as "gIsOnCreditHold",
          ci.g_credit_limit as "gCreditLimit",
          ci.current as "current",
          ci.days1_to_30 as "days1To30",
          ci.days31_to_60 as "days31To60",
          ci.days61_to_90 as "days61To90",
          ci.days90_plus as "days90Plus",
          ci.total_outstanding as "totalOutstanding",
          COALESCE(cgl.gl_balance, 0) as "glBalance",
          ABS(COALESCE(cgl.gl_balance, 0) - ci.total_outstanding) as "discrepancyAmount",
          COALESCE(cu.uninvoiced_total, 0) as "uninvoicedOrdersTotal"
        FROM customer_invoices ci
        LEFT JOIN customer_gl cgl ON ci.customer_id::text = cgl.party_id
        LEFT JOIN customer_uninvoiced cu ON ci.customer_id = cu.customer_id
        WHERE ${conditions}
      )
    `;

    const dataQuery = sql`
      ${cteQuery}
      SELECT * FROM combined
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = sql`
      ${cteQuery}
      SELECT COUNT(*) as total FROM combined
    `;

    const [dataRes, countRes] = await Promise.all([
      this.db.execute(dataQuery),
      this.db.execute(countQuery),
    ]);

    const dataRows = ((dataRes as unknown as Record<string, unknown>).rows ??
      dataRes) as Record<string, unknown>[];
    const countRows = ((countRes as unknown as Record<string, unknown>).rows ??
      countRes) as Record<string, unknown>[];

    const total = Number(countRows[0]?.total || 0);

    const formattedData = dataRows.map((b) => {
      const custProfile = {
        stateCode: b.stateCode as string,
        isOnCreditHold: Boolean(b.cIsOnCreditHold),
        creditLimit:
          b.cCreditLimit !== null
            ? String(b.cCreditLimit as string | number)
            : null,
        tradingTermsId: null,
        overrideCreditHoldUntil: b.cOverride
          ? new Date(b.cOverride as string)
          : null,
      };

      const groupProfile = b.customerGroupId
        ? {
            stateCode: b.stateCode as string,
            isOnCreditHold: Boolean(b.gIsOnCreditHold),
            creditLimit:
              b.gCreditLimit !== null
                ? String(b.gCreditLimit as string | number)
                : null,
            tradingTermsId: null,
          }
        : null;

      const risk = resolveCustomerRiskProfile(
        custProfile as CustomerProfile,
        groupProfile as CustomerGroupProfile,
        {
          totalInvoiceBalance: Number(b.totalOutstanding),
          overdueInvoiceBalance: Number(b.totalOutstanding) - Number(b.current),
          glBalance: Number(b.glBalance),
          isOverdue: Number(b.totalOutstanding) - Number(b.current) > 0,
        },
        0,
        'hard',
        'confirm',
      );

      return {
        customerId: b.customerId as string,
        customerName: b.customerName as string,
        customerNumber: b.customerNumber as string,
        currencyCode: b.currencyCode as string,
        current: Number(b.current),
        days1To30: Number(b.days1To30),
        days31To60: Number(b.days31To60),
        days61To90: Number(b.days61To90),
        days90Plus: Number(b.days90Plus),
        totalOutstanding: Number(b.totalOutstanding),
        glBalance: Number(b.glBalance),
        discrepancyAmount: Number(b.discrepancyAmount),
        uninvoicedOrdersTotal: Number(b.uninvoicedOrdersTotal),
        isOnCreditHold: risk.isSalesBlocked,
        creditLimit: risk.effectiveCreditLimit,
        stateCode: b.stateCode as string,
      };
    });

    return {
      data: formattedData,
      total,
      limit,
      page,
    };
  }
}
