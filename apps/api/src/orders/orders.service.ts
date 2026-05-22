import { Injectable, Inject } from '@nestjs/common';
import { eq, ilike, or, sql, inArray, and, asc, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrderLineItems,
  customers as coreAccounts,
  salesOrders,
} from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { SALES_ORDER_STATE } from '@modbm/shared';

export interface UnifiedOrderRow {
  id: string;
  orderNumber: string;
  name: string;
  customerName: string;
  customerOrderNumber: string;
  stateCode: string;
  source: string;
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
  currencyCode: string | null;
}

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const {
      page,
      limit,
      offset,
      searchTerm,
      includeArchived,
      customerId,
      days,
      states,
    } = parsePagination(query);

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(salesOrders.orderNumber, searchTerm),
          ilike(salesOrders.name, searchTerm),
          ilike(salesOrders.customerOrderNumber, searchTerm),
          ilike(coreAccounts.name, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(
        sql`${salesOrders.stateCode} != ${SALES_ORDER_STATE.ARCHIVED}`,
      );
    }

    if (customerId) {
      conditions.push(
        or(
          eq(salesOrders.customerId, customerId),
          eq(coreAccounts.sourceId, customerId),
        ),
      );
    }

    if (days && days > 0) {
      conditions.push(
        sql`${salesOrders.createdOn} >= NOW() - INTERVAL '1 day' * ${days}`,
      );
    }

    if (states && states.length > 0) {
      if (states.length === 1) {
        conditions.push(eq(salesOrders.stateCode, states[0] as any));
      } else {
        conditions.push(inArray(salesOrders.stateCode, states as any[]));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total matching rows
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .where(whereClause);

    // Fetch paginated rows with customer name and line totals
    const rows = await this.db
      .select({
        id: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        name: salesOrders.name,
        customerName: coreAccounts.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        stateCode: salesOrders.stateCode,
        source: salesOrders.source,
        createdBy: salesOrders.createdBy,
        createdOn: salesOrders.createdOn,
        currencyCode: salesOrders.currencyCode,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .where(whereClause)
      .orderBy(desc(salesOrders.createdOn))
      .limit(limit)
      .offset(offset);

    // Aggregate line totals for the returned orders
    const orderIds = rows.map((r) => r.id);
    const totalMap = new Map<string, string>();
    if (orderIds.length > 0) {
      const totals = await this.db
        .select({
          salesOrderId: salesOrderLineItems.salesOrderId,
          total: sql<string>`COALESCE(SUM(${salesOrderLineItems.totalAmount}::numeric), 0)::text`,
        })
        .from(salesOrderLineItems)
        .where(inArray(salesOrderLineItems.salesOrderId, orderIds))
        .groupBy(salesOrderLineItems.salesOrderId);

      for (const row of totals) {
        totalMap.set(row.salesOrderId, row.total);
      }
    }

    const data: UnifiedOrderRow[] = rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber ?? '',
      name: r.name ?? '',
      customerName: r.customerName ?? '',
      customerOrderNumber: r.customerOrderNumber ?? '',
      stateCode: r.stateCode ?? SALES_ORDER_STATE.DRAFT,
      source: r.source ?? 'app',
      createdBy: r.createdBy ?? '',
      createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
      totalPrice: totalMap.get(r.id) ?? null,
      currencyCode: r.currencyCode ?? 'EUR',
    }));

    return { data, page, limit, total: Number(count) };
  }
}
