import { Injectable, Inject } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { eq, ilike, or, sql, inArray, and, asc, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrderLineItems,
  customers as coreAccounts,
  salesOrders,
  products,
  productGroups,
  actors,
} from '@herobm/db-schema';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import {
  getAggregationPeriod,
  getAggregationSql,
} from '../common/utils/date-range.util';
import { SALES_ORDER_STATE, DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';

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
  productQuantity?: number;
  productQuantityShipped?: number;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly dataSourcesRegistry: DataSourcesRegistry,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.SALES_PERFORMANCE_CUSTOMER,
      {
        fetchData: (filters: Record<string, unknown>) =>
          this.getSalesPerformanceByCustomer(filters),
      },
    );
    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.SALES_PERFORMANCE_PRODUCT,
      {
        fetchData: (filters: Record<string, unknown>) =>
          this.getSalesPerformanceByProduct(filters),
      },
    );
    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.SALES_PERFORMANCE_PRODUCT_GROUP,
      {
        fetchData: (filters: Record<string, unknown>) =>
          this.getSalesPerformanceByProductGroup(filters),
      },
    );
    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.SALES_PERFORMANCE_TREND,
      {
        fetchData: (filters: Record<string, unknown>) =>
          this.getSalesPerformanceTrend(filters),
      },
    );
    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.SALES_PERFORMANCE_SALESPERSON,
      {
        fetchData: (filters: Record<string, unknown>) =>
          this.getSalesPerformanceBySalesperson(filters),
      },
    );
  }

  private getSalesPerformanceConditions(filters: Record<string, unknown>) {
    const conditions = [];
    if (filters.fromDate) {
      conditions.push(
        sql`${salesOrders.createdOn} >= ${filters.fromDate}::timestamp`,
      );
    }
    if (filters.toDate) {
      conditions.push(
        sql`${salesOrders.createdOn} <= ${filters.toDate}::timestamp`,
      );
    }
    conditions.push(
      inArray(salesOrders.stateCode, [
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.INVOICED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bypass strict array type check for inArray operator
      ] as any[]),
    );
    return conditions;
  }

  async getSalesPerformanceByCustomer(filters: Record<string, unknown>) {
    const conditions = this.getSalesPerformanceConditions(filters);
    const drillDown = filters.drillDown as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle select configuration
    const selectCols: any = {
      customerId: coreAccounts.customerId,
      customerName: actors.name,
      orderCount: sql<number>`count(distinct ${salesOrders.salesOrderId})::integer`,
      totalSales: sql<number>`coalesce(sum(${salesOrderLineItems.totalAmount}::numeric), 0)::float`,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle group-by configuration
    const groupCols: any[] = [coreAccounts.customerId, actors.name];

    if (drillDown === 'product') {
      selectCols.productName = sql<string>`coalesce(${products.name}, 'Unknown')`;
      groupCols.push(products.productId, products.name);
    } else if (drillDown === 'product-group') {
      selectCols.productGroupName = sql<string>`coalesce(${productGroups.name}, 'Unknown')`;
      groupCols.push(productGroups.productGroupId, productGroups.name);
    } else if (drillDown === 'period') {
      const period = getAggregationPeriod(filters);
      selectCols.period = getAggregationSql(salesOrders.createdOn, period);
      groupCols.push(selectCols.period);
    }

    let qb = this.db
      .select(selectCols)
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .$dynamic();

    if (drillDown === 'product' || drillDown === 'product-group') {
      qb = qb.leftJoin(
        products,
        eq(products.productId, salesOrderLineItems.productId),
      );
      if (drillDown === 'product-group') {
        qb = qb.leftJoin(
          productGroups,
          eq(productGroups.productGroupId, products.productGroupId),
        );
      }
    }

    qb = qb.where(and(...conditions)).groupBy(...groupCols);

    return await qb;
  }

  async getSalesPerformanceByProduct(filters: Record<string, unknown>) {
    const conditions = this.getSalesPerformanceConditions(filters);
    const drillDown = filters.drillDown as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle select configuration
    const selectCols: any = {
      productId: products.productId,
      productNumber: products.productNumber,
      productName: products.name,
      quantitySold: sql<number>`coalesce(sum(${salesOrderLineItems.quantity}::numeric), 0)::float`,
      totalSales: sql<number>`coalesce(sum(${salesOrderLineItems.totalAmount}::numeric), 0)::float`,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle group-by configuration
    const groupCols: any[] = [
      products.productId,
      products.productNumber,
      products.name,
    ];

    if (drillDown === 'customer') {
      selectCols.customerName = sql<string>`coalesce(${actors.name}, 'Unknown')`;
      groupCols.push(coreAccounts.customerId, actors.name);
    } else if (drillDown === 'period') {
      const period = getAggregationPeriod(filters);
      selectCols.period = getAggregationSql(salesOrders.createdOn, period);
      groupCols.push(selectCols.period);
    } else if (drillDown === 'channel') {
      selectCols.source = salesOrders.source;
      groupCols.push(salesOrders.source);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle query builder typing
    let qb: any = this.db
      .select(selectCols)
      .from(salesOrderLineItems)
      .innerJoin(
        salesOrders,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .leftJoin(products, eq(products.productId, salesOrderLineItems.productId))
      .$dynamic();

    if (drillDown === 'customer') {
      qb = qb
        .leftJoin(
          coreAccounts,
          eq(salesOrders.customerId, coreAccounts.customerId),
        )
        .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId));
    }

    if (conditions.length > 0) qb = qb.where(and(...conditions));
    qb = qb.groupBy(...groupCols);

    return await qb;
  }

  async getSalesPerformanceByProductGroup(filters: Record<string, unknown>) {
    const conditions = this.getSalesPerformanceConditions(filters);
    const drillDown = filters.drillDown as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle select configuration
    const selectCols: any = {
      productGroupId: productGroups.productGroupId,
      productGroupName: productGroups.name,
      quantitySold: sql<number>`coalesce(sum(${salesOrderLineItems.quantity}::numeric), 0)::float`,
      totalSales: sql<number>`coalesce(sum(${salesOrderLineItems.totalAmount}::numeric), 0)::float`,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle group-by configuration
    const groupCols: any[] = [productGroups.productGroupId, productGroups.name];

    if (drillDown === 'product') {
      selectCols.productName = sql<string>`coalesce(${products.name}, 'Unknown')`;
      groupCols.push(products.productId, products.name);
    } else if (drillDown === 'customer') {
      selectCols.customerName = sql<string>`coalesce(${actors.name}, 'Unknown')`;
      groupCols.push(coreAccounts.customerId, actors.name);
    } else if (drillDown === 'period') {
      const period = getAggregationPeriod(filters);
      selectCols.period = getAggregationSql(salesOrders.createdOn, period);
      groupCols.push(selectCols.period);
    } else if (drillDown === 'channel') {
      selectCols.source = salesOrders.source;
      groupCols.push(salesOrders.source);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle query builder typing
    let qb: any = this.db
      .select(selectCols)
      .from(salesOrderLineItems)
      .innerJoin(
        salesOrders,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .leftJoin(products, eq(products.productId, salesOrderLineItems.productId))
      .leftJoin(
        productGroups,
        eq(productGroups.productGroupId, products.productGroupId),
      )
      .$dynamic();

    if (drillDown === 'customer') {
      qb = qb
        .leftJoin(
          coreAccounts,
          eq(salesOrders.customerId, coreAccounts.customerId),
        )
        .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId));
    }

    if (conditions.length > 0) qb = qb.where(and(...conditions));
    qb = qb.groupBy(...groupCols);

    return await qb;
  }

  async getSalesPerformanceTrend(filters: Record<string, unknown>) {
    const conditions = this.getSalesPerformanceConditions(filters);
    const drillDown = filters.drillDown as string | undefined;
    const period = getAggregationPeriod(filters);
    const periodSql = getAggregationSql(salesOrders.createdOn, period);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const selectCols: any = {
      period: periodSql,
      orderCount: sql<number>`count(distinct ${salesOrders.salesOrderId})::integer`,
      totalSales: sql<number>`coalesce(sum(${salesOrderLineItems.totalAmount}::numeric), 0)::float`,
    };

    const groupCols: (
      | import('drizzle-orm').SQL
      | import('drizzle-orm/pg-core').PgColumn
    )[] = [periodSql];

    if (drillDown === 'product') {
      selectCols.productName = sql<string>`coalesce(${products.name}, 'Unknown')`;
      groupCols.push(products.productId, products.name);
    } else if (drillDown === 'product-group') {
      selectCols.productGroupName = sql<string>`coalesce(${productGroups.name}, 'Unknown')`;
      groupCols.push(productGroups.productGroupId, productGroups.name);
    } else if (drillDown === 'customer') {
      selectCols.customerName = sql<string>`coalesce(${actors.name}, 'Unknown')`;
      groupCols.push(coreAccounts.customerId, actors.name);
    } else if (drillDown === 'channel') {
      selectCols.source = salesOrders.source;
      groupCols.push(salesOrders.source);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Drizzle query builder typing
    let qb: any = this.db
      .select(selectCols)
      .from(salesOrders)
      .leftJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .$dynamic();

    if (drillDown === 'customer') {
      qb = qb
        .leftJoin(
          coreAccounts,
          eq(salesOrders.customerId, coreAccounts.customerId),
        )
        .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId));
    }
    if (drillDown === 'product' || drillDown === 'product-group') {
      qb = qb.leftJoin(
        products,
        eq(products.productId, salesOrderLineItems.productId),
      );
      if (drillDown === 'product-group') {
        qb = qb.leftJoin(
          productGroups,
          eq(productGroups.productGroupId, products.productGroupId),
        );
      }
    }

    if (conditions.length > 0) qb = qb.where(and(...conditions));
    qb = qb.groupBy(...groupCols).orderBy(asc(periodSql));

    return await qb;
  }

  async getSalesPerformanceBySalesperson(filters: Record<string, unknown>) {
    const conditions = this.getSalesPerformanceConditions(filters);
    const drillDown = filters.drillDown as string | undefined;

    const selectCols: Record<
      string,
      import('drizzle-orm').SQL | import('drizzle-orm/pg-core').PgColumn
    > = {
      createdBy: sql<string>`COALESCE(${salesOrders.createdBy}, 'System')`,
      source: salesOrders.source,
      orderCount: sql<number>`count(distinct ${salesOrders.salesOrderId})::integer`,
      totalSales: sql<number>`coalesce(sum(${salesOrderLineItems.totalAmount}::numeric), 0)::float`,
    };

    const groupCols: (
      | import('drizzle-orm').SQL
      | import('drizzle-orm/pg-core').PgColumn
    )[] = [
      sql`COALESCE(${salesOrders.createdBy}, 'System')`,
      salesOrders.source,
    ];

    if (drillDown === 'product') {
      selectCols.productName = sql<string>`coalesce(${products.name}, 'Unknown')`;
      groupCols.push(products.productId, products.name);
    } else if (drillDown === 'customer') {
      selectCols.customerName = sql<string>`coalesce(${actors.name}, 'Unknown')`;
      groupCols.push(coreAccounts.customerId, actors.name);
    } else if (drillDown === 'period') {
      const period = getAggregationPeriod(filters);
      selectCols.period = getAggregationSql(salesOrders.createdOn, period);
      groupCols.push(selectCols.period);
    }

    let qb = this.db
      .select(selectCols)
      .from(salesOrders)
      .leftJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .$dynamic();

    if (drillDown === 'customer') {
      qb = qb
        .leftJoin(
          coreAccounts,
          eq(salesOrders.customerId, coreAccounts.customerId),
        )
        .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId));
    }
    if (drillDown === 'product') {
      qb = qb.leftJoin(
        products,
        eq(products.productId, salesOrderLineItems.productId),
      );
    }

    if (conditions.length > 0) qb = qb.where(and(...conditions));
    qb = qb.groupBy(...groupCols);

    return await qb;
  }

  async findAll(query?: PaginationQuery) {
    const {
      page,
      limit,
      cursor,
      direction,
      searchTerm,
      includeArchived,
      customerId,
      days,
      states,
      productId,
    } = parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${salesOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${salesOrders.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesOrders.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${salesOrders.customerOrderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesOrders.customerOrderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(salesOrders.orderNumber, `%${rawSearchTerm}%`),
          ilike(salesOrders.name, `%${rawSearchTerm}%`),
          ilike(salesOrders.customerOrderNumber, `%${rawSearchTerm}%`),
          ilike(actors.name, `%${rawSearchTerm}%`),
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
        conditions.push(
          eq(
            salesOrders.stateCode,
            states[0] as NonNullable<typeof salesOrders.$inferInsert.stateCode>,
          ),
        );
      } else {
        conditions.push(
          inArray(
            salesOrders.stateCode,
            states as NonNullable<typeof salesOrders.$inferInsert.stateCode>[],
          ),
        );
      }
    }

    if (productId) {
      conditions.push(
        inArray(
          salesOrders.salesOrderId,
          this.db
            .select({ id: salesOrderLineItems.salesOrderId })
            .from(salesOrderLineItems)
            .where(eq(salesOrderLineItems.productId, productId)),
        ),
      );
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
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .where(whereClause);

    // Fetch paginated rows with customer name and line totals
    let qb = this.db
      .select({
        id: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        name: salesOrders.name,
        customerName: actors.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        stateCode: salesOrders.stateCode,
        source: salesOrders.source,
        createdBy: salesOrders.createdBy,
        createdOn: salesOrders.createdOn,
        currencyCode: salesOrders.currencyCode,
        customFields: salesOrders.customFields,
        score: scoreSql,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const {
      data: rows,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        id: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const cDate = c.createdOn;
        if (dir === 'next') {
          const cursorCond = or(
            sql`${scoreSql} < ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${salesOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) < ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${salesOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) = ${cDate}::timestamp`,
              sql`${salesOrders.salesOrderId} < ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        } else {
          const cursorCond = or(
            sql`${scoreSql} > ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${salesOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) > ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              sql`COALESCE(${salesOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp) = ${cDate}::timestamp`,
              sql`${salesOrders.salesOrderId} > ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        }
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        return q.orderBy(
          orderFn(scoreSql),
          orderFn(
            sql`COALESCE(${salesOrders.createdOn}, '1970-01-01T00:00:00.000Z'::timestamp)`,
          ),
          orderFn(salesOrders.salesOrderId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn
          ? row.createdOn.toISOString()
          : '1970-01-01T00:00:00.000Z',
        id: row.id,
      }),
    });

    // Aggregate line totals for the returned orders
    const orderIds = rows.map((r) => r.id);
    const totalMap = new Map<string, string>();
    const productQuantityMap = new Map<string, number>();
    const productQuantityShippedMap = new Map<string, number>();

    if (orderIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic aggregation select
      const selectObject: any = {
        salesOrderId: salesOrderLineItems.salesOrderId,
        total: sql<string>`COALESCE(SUM(${salesOrderLineItems.totalAmount}::numeric), 0)::text`,
      };

      if (productId) {
        selectObject.prodQty =
          sql<number>`COALESCE(SUM(CASE WHEN ${salesOrderLineItems.productId} = ${productId} THEN ${salesOrderLineItems.quantity} ELSE 0 END), 0)`.mapWith(
            Number,
          );
        selectObject.prodQtyShipped = sql<number>`COALESCE((
          SELECT SUM(sl.quantity_shipped)
          FROM herobm_core.sales_order_shipment_lines sl
          JOIN herobm_core.sales_order_lines sol ON sol.sales_order_line_id = sl.sales_order_line_id
          WHERE sol.sales_order_id = "herobm_core"."sales_order_lines"."sales_order_id"
            AND sol.product_id = ${productId}
        ), 0)`.mapWith(Number);
      }

      const totals = await this.db
        .select(selectObject)
        .from(salesOrderLineItems)
        .where(inArray(salesOrderLineItems.salesOrderId, orderIds))
        .groupBy(salesOrderLineItems.salesOrderId);

      for (const row of totals) {
        totalMap.set(row.salesOrderId, row.total);
        if (productId) {
          productQuantityMap.set(row.salesOrderId, Number(row.prodQty || 0));
          productQuantityShippedMap.set(
            row.salesOrderId,
            Number(row.prodQtyShipped || 0),
          );
        }
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
      ...(productId
        ? {
            productQuantity: productQuantityMap.get(r.id) ?? 0,
            productQuantityShipped: productQuantityShippedMap.get(r.id) ?? 0,
          }
        : {}),
    }));

    return { data, page, limit, total: Number(count), nextCursor, prevCursor };
  }
}
