// security-ignore: sql-raw
import {
  contacts,
  customerDeliveryAddresses,
  customerGroups,
  customers,
  masterDataEvents,
  organizationContactLinks,
  organizationOrganizationLinks,
  organizations,
  taxPositions,
} from '@herobm/db-schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DRIZZLE } from '../drizzle/drizzle.module';

import { CUSTOMER_STATE } from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { CreditAssessmentService } from './credit-assessment.service';
import {
  AgedBalanceResult,
  calculateCustomerBalances,
} from './customer-balances.util';
import {
  CustomerGroupProfile,
  CustomerProfile,
  resolveCustomerRiskProfile,
  ResolvedCustomerRiskProfile,
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
            WHEN ${organizations.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${organizations.name} ILIKE ${rawSearchTerm + '%'} THEN 2
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
          ilike(organizations.name, `%${rawSearchTerm}%`),
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

    const parentLink = alias(organizationOrganizationLinks, 'parent_link');
    const parentOrg = alias(organizations, 'parent_org');
    const parentCustomer = alias(customers, 'parent_customer');

    let qb = this.db
      .select({
        ...getTableColumns(customers),
        name: organizations.name,
        customerGroupName: customerGroups.name,
        customerGroupCode: customerGroups.groupCode,
        customerGroupTradingTermsId: customerGroups.tradingTermsId,
        customerGroupCreditLimit: customerGroups.creditLimit,
        customerGroupIsOnCreditHold: customerGroups.isOnCreditHold,
        customerGroupTaxPositionId: customerGroups.taxPositionId,
        customerGroupStateCode: customerGroups.stateCode,
        customerGroupEarlyPaymentDiscount: customerGroups.earlyPaymentDiscount,
        customerGroupEarlyPaymentDiscountDays:
          customerGroups.earlyPaymentDiscountDays,
        gstCategoryName: taxPositions.code,
        score: scoreSql,
        billingAddressLine1: organizations.headquartersAddressLine1,
        billingAddressLine2: organizations.headquartersAddressLine2,
        billingAddressCity: organizations.headquartersCity,
        billingAddressStateOrProvince:
          organizations.headquartersStateOrProvince,
        billingAddressPostalCode: organizations.headquartersPostalCode,
        billingAddressCountry: organizations.headquartersCountry,
        parentCustomerId: parentCustomer.customerId,
        parentCustomerName: parentOrg.name,
        telephone: organizations.telephone,
        email: organizations.email,
        salesContactName: sql<string>`(
          SELECT c.first_name || ' ' || c.last_name
          FROM ${organizationContactLinks} acl
          JOIN ${contacts} c ON acl.contact_id = c.contact_id
          WHERE acl.organization_id = ${customers.organizationId} AND 'sales' = ANY(acl.primary_for)
          LIMIT 1
        )`,
        accountsContactName: sql<string>`(
          SELECT c.first_name || ' ' || c.last_name
          FROM ${organizationContactLinks} acl
          JOIN ${contacts} c ON acl.contact_id = c.contact_id
          WHERE acl.organization_id = ${customers.organizationId} AND 'accounts' = ANY(acl.primary_for)
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
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
      )
      .leftJoin(
        parentLink,
        and(
          eq(parentLink.sourceOrganizationId, customers.organizationId),
          eq(parentLink.linkType, 'parent_company'),
        ),
      )
      .leftJoin(
        parentOrg,
        eq(parentLink.targetOrganizationId, parentOrg.organizationId),
      )
      .leftJoin(
        parentCustomer,
        eq(parentOrg.organizationId, parentCustomer.organizationId),
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
            sql`lower(${organizations.name}) ${nameOp} lower(${c.name})`,
          ),
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${organizations.name}) = lower(${c.name})`,
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
          orderFn(sql`lower(${organizations.name})`),
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
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
      )
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
            stateCode: (c.customerGroupStateCode || c.stateCode) as string,
            isOnCreditHold: Boolean(c.customerGroupIsOnCreditHold),
            creditLimit:
              c.customerGroupCreditLimit !== null &&
              c.customerGroupCreditLimit !== undefined
                ? String(c.customerGroupCreditLimit)
                : null,
            tradingTermsId: c.customerGroupTradingTermsId,
            earlyPaymentDiscount:
              c.customerGroupEarlyPaymentDiscount !== null &&
              c.customerGroupEarlyPaymentDiscount !== undefined
                ? String(c.customerGroupEarlyPaymentDiscount)
                : null,
            earlyPaymentDiscountDays: c.customerGroupEarlyPaymentDiscountDays,
          }
        : null;

      const risk = resolveCustomerRiskProfile(
        custProfile,
        groupProfile,
        {
          totalInvoiceBalance: b?.totalInvoiceOutstanding ?? totalOutstanding,
          totalCreditNoteBalance: b?.totalCreditNoteOutstanding ?? 0,
          unallocatedPaymentBalance: b?.unallocatedPaymentsTotal ?? 0,
          netOutstandingBalance: totalOutstanding,
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
        effectiveTradingTermsId: risk.effectiveTradingTermsId,
        effectiveEarlyPaymentDiscount: risk.earlyPaymentDiscount,
        effectiveEarlyPaymentDiscountDays: risk.earlyPaymentDiscountDays,
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
        name: organizations.name,
        gstCategoryName: taxPositions.code,
        customerGroupTaxPositionId: customerGroups.taxPositionId,
        customerGroupTradingTermsId: customerGroups.tradingTermsId,
        customerGroupCreditLimit: customerGroups.creditLimit,
        customerGroupIsOnCreditHold: customerGroups.isOnCreditHold,
        customerGroupEarlyPaymentDiscount: customerGroups.earlyPaymentDiscount,
        customerGroupEarlyPaymentDiscountDays:
          customerGroups.earlyPaymentDiscountDays,
        customerGroupStateCode: customerGroups.stateCode,
        businessNumber: organizations.businessNumber,
        isTaxRegistered: organizations.isTaxRegistered,
        billingAddressLine1: organizations.headquartersAddressLine1,
        billingAddressLine2: organizations.headquartersAddressLine2,
        billingAddressCity: organizations.headquartersCity,
        billingAddressStateOrProvince:
          organizations.headquartersStateOrProvince,
        billingAddressPostalCode: organizations.headquartersPostalCode,
        billingAddressCountry: organizations.headquartersCountry,
        telephone1: organizations.telephone,
        fax: organizations.fax,
        emailAddress1: organizations.email,
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
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
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

    const [
      events,
      contactsResult,
      deliveryAddressesResult,
      creditAssessment,
      parentResult,
      childrenResult,
    ] = await Promise.all([
      eventsQuery,
      customer.organizationId
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
              primaryFor: organizationContactLinks.primaryFor,
              createdOn: contacts.createdOn,
              modifiedOn: contacts.modifiedOn,
            })
            .from(contacts)
            .innerJoin(
              organizationContactLinks,
              eq(contacts.contactId, organizationContactLinks.contactId),
            )
            .where(
              eq(
                organizationContactLinks.organizationId,
                customer.organizationId,
              ),
            )
            .catch(() => [])
        : Promise.resolve([]),
      db.query.customerDeliveryAddresses
        .findMany({
          where: eq(customerDeliveryAddresses.customerId, customer.customerId),
        })
        .catch(() => []),
      this.creditAssessmentService.assessCredit(customer.customerId, db),
      customer.organizationId
        ? db
            .select({
              customerId: customers.customerId,
              name: organizations.name,
            })
            .from(organizationOrganizationLinks)
            .innerJoin(
              organizations,
              eq(
                organizationOrganizationLinks.targetOrganizationId,
                organizations.organizationId,
              ),
            )
            .innerJoin(
              customers,
              eq(organizations.organizationId, customers.organizationId),
            )
            .where(
              and(
                eq(
                  organizationOrganizationLinks.sourceOrganizationId,
                  customer.organizationId,
                ),
                eq(organizationOrganizationLinks.linkType, 'parent_company'),
              ),
            )
            .limit(1)
            .catch(() => [])
        : Promise.resolve([]),
      customer.organizationId
        ? db
            .select({
              customerId: customers.customerId,
              name: organizations.name,
            })
            .from(organizationOrganizationLinks)
            .innerJoin(
              organizations,
              eq(
                organizationOrganizationLinks.sourceOrganizationId,
                organizations.organizationId,
              ),
            )
            .innerJoin(
              customers,
              eq(organizations.organizationId, customers.organizationId),
            )
            .where(
              and(
                eq(
                  organizationOrganizationLinks.targetOrganizationId,
                  customer.organizationId,
                ),
                eq(organizationOrganizationLinks.linkType, 'parent_company'),
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
          earlyPaymentDiscount:
            groups[0].earlyPaymentDiscount !== null &&
            groups[0].earlyPaymentDiscount !== undefined
              ? String(groups[0].earlyPaymentDiscount)
              : null,
          earlyPaymentDiscountDays: groups[0].earlyPaymentDiscountDays,
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
      effectiveTradingTermsId: risk.effectiveTradingTermsId,
      customerGroupTradingTermsId:
        customer.customerGroupTradingTermsId ??
        groupProfile?.tradingTermsId ??
        null,
      customerGroupCreditLimit:
        customer.customerGroupCreditLimit !== null &&
        customer.customerGroupCreditLimit !== undefined
          ? String(customer.customerGroupCreditLimit)
          : (groupProfile?.creditLimit ?? null),
      customerGroupIsOnCreditHold:
        customer.customerGroupIsOnCreditHold ??
        groupProfile?.isOnCreditHold ??
        false,
      effectiveEarlyPaymentDiscount: risk.earlyPaymentDiscount,
      effectiveEarlyPaymentDiscountDays: risk.earlyPaymentDiscountDays,
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
      conditions = sql`${conditions} AND (b.customer_name ILIKE ${searchTerm} OR b.customer_number ILIKE ${searchTerm})`;
    }

    if (quickFilter === 'discrepancy') {
      conditions = sql`${conditions} AND ABS(b.gl_balance - ((b.inv_current - b.rem4) + b.days1_to_30 + b.days31_to_60 + b.days61_to_90 + b.days90_plus)) > 0.01`;
    } else if (quickFilter === 'overdue') {
      conditions = sql`${conditions} AND (b.days1_to_30 + b.days31_to_60 + b.days61_to_90 + b.days90_plus) > 0.01`;
    } else if (quickFilter === 'overLimit') {
      conditions = sql`${conditions} AND COALESCE(b.c_credit_limit, b.g_credit_limit) IS NOT NULL AND ((b.inv_current - b.rem4) + b.days1_to_30 + b.days31_to_60 + b.days61_to_90 + b.days90_plus) > COALESCE(b.c_credit_limit, b.g_credit_limit)`;
    }

    let orderBy = sql`"customerName" ASC`;
    if (sort) {
      const sortMap: Record<string, string> = {
        customerNumber: 'customerNumber',
        customerName: 'customerName',
        creditLimit: 'cCreditLimit',
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
      WITH 
      cust_inv AS (
        SELECT 
          COALESCE(i.customer_id, so.customer_id) as customer_id,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) as inv_current,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '30 days' THEN i.outstanding_amount ELSE 0 END), 0) as inv_days1_to_30,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '30 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '60 days' THEN i.outstanding_amount ELSE 0 END), 0) as inv_days31_to_60,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '60 days' AND i.${sql.identifier(basisCol)} >= CURRENT_DATE - INTERVAL '90 days' THEN i.outstanding_amount ELSE 0 END), 0) as inv_days61_to_90,
          COALESCE(SUM(CASE WHEN i.${sql.identifier(basisCol)} < CURRENT_DATE - INTERVAL '90 days' OR i.${sql.identifier(basisCol)} IS NULL THEN i.outstanding_amount ELSE 0 END), 0) as inv_days90_plus,
          COALESCE(SUM(i.outstanding_amount), 0) as inv_total
        FROM herobm_core.sales_invoices i
        LEFT JOIN herobm_core.sales_orders so ON i.sales_order_id = so.sales_order_id
        WHERE i.outstanding_amount > 0 AND i.state_code NOT IN ('draft', 'cancelled', 'paid')
        GROUP BY COALESCE(i.customer_id, so.customer_id)
      ),
      cust_cn AS (
        SELECT 
          cn.customer_id,
          COALESCE(SUM(cn.outstanding_amount), 0) as cn_total
        FROM herobm_core.sales_credit_notes cn
        WHERE cn.outstanding_amount > 0 AND cn.state_code NOT IN ('draft', 'cancelled', 'paid', 'void')
        GROUP BY cn.customer_id
      ),
      cust_pe AS (
        SELECT 
          pe.party_id as customer_id,
          COALESCE(SUM(CASE WHEN pe.payment_type = 'customer_receipt' THEN pe.unallocated_amount ELSE -pe.unallocated_amount END), 0) as pe_unallocated_total
        FROM herobm_core.payment_entries pe
        WHERE pe.state_code = 'posted' AND pe.unallocated_amount > 0 AND pe.payment_type IN ('customer_receipt', 'customer_refund')
        GROUP BY pe.party_id
      ),
      cust_gl AS (
        SELECT 
          l.party_id::uuid as customer_id,
          COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as gl_balance
        FROM herobm_core.gl_journal_lines l
        JOIN herobm_core.gl_journal_entries e ON l.journal_entry_id = e.journal_entry_id
        WHERE l.party_type = 'customer' AND l.party_id IS NOT NULL
        GROUP BY l.party_id
        HAVING COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) != 0
      ),
      cust_uninvoiced AS (
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
      all_customers AS (
        SELECT customer_id FROM cust_inv
        UNION
        SELECT customer_id FROM cust_cn
        UNION
        SELECT customer_id FROM cust_pe
        UNION
        SELECT customer_id FROM cust_gl
      ),
      customer_raw_balances AS (
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
          COALESCE(ci.inv_current, 0) as inv_current,
          COALESCE(ci.inv_days1_to_30, 0) as inv_days1_to_30,
          COALESCE(ci.inv_days31_to_60, 0) as inv_days31_to_60,
          COALESCE(ci.inv_days61_to_90, 0) as inv_days61_to_90,
          COALESCE(ci.inv_days90_plus, 0) as inv_days90_plus,
          COALESCE(ci.inv_total, 0) as inv_total,
          COALESCE(cn.cn_total, 0) + COALESCE(pe.pe_unallocated_total, 0) as credits_total,
          COALESCE(cg.gl_balance, 0) as gl_balance,
          COALESCE(cu.uninvoiced_total, 0) as uninvoiced_total
        FROM all_customers ac
        JOIN herobm_core.customers c ON ac.customer_id = c.customer_id
        LEFT JOIN herobm_core.organizations a ON c.organization_id = a.organization_id
        LEFT JOIN herobm_core.customer_groups g ON c.customer_group_id = g.customer_group_id
        LEFT JOIN cust_inv ci ON ac.customer_id = ci.customer_id
        LEFT JOIN cust_cn cn ON ac.customer_id = cn.customer_id
        LEFT JOIN cust_pe pe ON ac.customer_id = pe.customer_id
        LEFT JOIN cust_gl cg ON ac.customer_id = cg.customer_id
        LEFT JOIN cust_uninvoiced cu ON ac.customer_id = cu.customer_id
      ),
      customer_aged AS (
        SELECT 
          b.*,
          CASE WHEN b.inv_days90_plus >= b.credits_total THEN b.inv_days90_plus - b.credits_total ELSE 0 END as days90_plus,
          GREATEST(0, b.credits_total - b.inv_days90_plus) as rem1
        FROM customer_raw_balances b
      ),
      customer_aged_2 AS (
        SELECT 
          b.*,
          CASE WHEN b.inv_days61_to_90 >= b.rem1 THEN b.inv_days61_to_90 - b.rem1 ELSE 0 END as days61_to_90,
          GREATEST(0, b.rem1 - b.inv_days61_to_90) as rem2
        FROM customer_aged b
      ),
      customer_aged_3 AS (
        SELECT 
          b.*,
          CASE WHEN b.inv_days31_to_60 >= b.rem2 THEN b.inv_days31_to_60 - b.rem2 ELSE 0 END as days31_to_60,
          GREATEST(0, b.rem2 - b.inv_days31_to_60) as rem3
        FROM customer_aged_2 b
      ),
      customer_aged_4 AS (
        SELECT 
          b.*,
          CASE WHEN b.inv_days1_to_30 >= b.rem3 THEN b.inv_days1_to_30 - b.rem3 ELSE 0 END as days1_to_30,
          GREATEST(0, b.rem3 - b.inv_days1_to_30) as rem4
        FROM customer_aged_3 b
      ),
      combined AS (
        SELECT 
          b.customer_id as "customerId",
          b.customer_name as "customerName",
          b.customer_number as "customerNumber",
          b.currency_code as "currencyCode",
          b.state_code as "stateCode",
          b.c_is_on_credit_hold as "cIsOnCreditHold",
          b.c_credit_limit as "cCreditLimit",
          b.c_override as "cOverride",
          b.customer_group_id as "customerGroupId",
          b.g_is_on_credit_hold as "gIsOnCreditHold",
          b.g_credit_limit as "gCreditLimit",
          (b.inv_current - b.rem4) as "current",
          b.days1_to_30 as "days1To30",
          b.days31_to_60 as "days31To60",
          b.days61_to_90 as "days61To90",
          b.days90_plus as "days90Plus",
          ((b.inv_current - b.rem4) + b.days1_to_30 + b.days31_to_60 + b.days61_to_90 + b.days90_plus) as "totalOutstanding",
          b.gl_balance as "glBalance",
          ABS(b.gl_balance - ((b.inv_current - b.rem4) + b.days1_to_30 + b.days31_to_60 + b.days61_to_90 + b.days90_plus)) as "discrepancyAmount",
          b.uninvoiced_total as "uninvoicedOrdersTotal"
        FROM customer_aged_4 b
        WHERE ${conditions}
      )
    `;

    const dataQuery = sql`
      ${cteQuery}
      SELECT * FROM combined
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalsQuery = sql`
      ${cteQuery}
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM("current"), 0) as "current",
        COALESCE(SUM("days1To30"), 0) as "days1To30",
        COALESCE(SUM("days31To60"), 0) as "days31To60",
        COALESCE(SUM("days61To90"), 0) as "days61To90",
        COALESCE(SUM("days90Plus"), 0) as "days90Plus",
        COALESCE(SUM("totalOutstanding"), 0) as "totalOutstanding"
      FROM combined
    `;

    const [dataRes, totalsRes] = await Promise.all([
      this.db.execute(dataQuery),
      this.db.execute(totalsQuery),
    ]);

    const dataRows = ((dataRes as unknown as Record<string, unknown>).rows ??
      dataRes) as Record<string, unknown>[];
    const totalsRows = ((totalsRes as unknown as Record<string, unknown>)
      .rows ?? totalsRes) as Record<string, unknown>[];

    const total = Number(totalsRows[0]?.total || 0);
    const totals = {
      current: Number(totalsRows[0]?.current || 0),
      days1To30: Number(totalsRows[0]?.days1To30 || 0),
      days31To60: Number(totalsRows[0]?.days31To60 || 0),
      days61To90: Number(totalsRows[0]?.days61To90 || 0),
      days90Plus: Number(totalsRows[0]?.days90Plus || 0),
      totalOutstanding: Number(totalsRows[0]?.totalOutstanding || 0),
    };

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
          totalCreditNoteBalance: 0,
          unallocatedPaymentBalance: 0,
          netOutstandingBalance: Number(b.totalOutstanding),
          overdueInvoiceBalance: Math.max(
            0,
            Number(b.totalOutstanding) - Number(b.current),
          ),
          glBalance: Number(b.glBalance),
          isOverdue: Number(b.totalOutstanding) - Number(b.current) > 0.01,
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
      totals,
    };
  }
}
