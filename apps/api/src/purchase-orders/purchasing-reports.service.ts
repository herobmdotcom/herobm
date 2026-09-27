import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  suppliers,
  organizations,
  products,
  productGroups,
} from '@herobm/db-schema';
import { sql, eq, and, gte, lte, asc, SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import {
  getAggregationPeriod,
  getAggregationSql,
} from '../common/utils/date-range.util';

@Injectable()
export class PurchasingReportsService implements OnModuleInit {
  private readonly logger = new Logger(PurchasingReportsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly registry: DataSourcesRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(DATA_SOURCE_CONTEXT.PURCHASING_SUPPLIER, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getPurchasesBySupplier(filters),
    });
    this.registry.register(DATA_SOURCE_CONTEXT.PURCHASING_PRODUCT, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getPurchasesByProduct(filters),
    });
    this.registry.register(DATA_SOURCE_CONTEXT.PURCHASING_TREND, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getPurchaseTrend(filters),
    });
    this.registry.register(DATA_SOURCE_CONTEXT.PURCHASING_OUTSTANDING, {
      fetchData: (filters: Record<string, unknown>) =>
        this.getOutstandingPOs(filters),
    });
  }

  private applyDateFilters(
    fromDate?: string,
    toDate?: string,
    dateField: PgColumn | SQL = purchaseOrders.createdOn,
  ) {
    const conditions = [];
    if (fromDate) conditions.push(sql`${dateField} >= ${fromDate}::timestamp`);
    if (toDate)
      conditions.push(sql`${dateField} < (${toDate}::date + interval '1 day')`);
    return conditions;
  }

  async getPurchasesBySupplier(filters: Record<string, unknown>) {
    const conditions = [
      ...this.applyDateFilters(
        filters.fromDate as string,
        filters.toDate as string,
      ),
    ];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const drillDown = filters.drillDown as string | undefined;

    const selectCols: Record<string, SQL | PgColumn> = {
      supplierName: sql<string>`coalesce(${organizations.name}, ${suppliers.vendorNumber}, 'Unknown')`,
      orderCount: sql<number>`count(distinct ${purchaseOrders.purchaseOrderId})::int`,
      totalSpend: sql<number>`sum(${purchaseOrderLineItems.totalAmount})::numeric`,
    };
    const groupCols: (SQL | PgColumn)[] = [
      suppliers.vendorId,
      organizations.name,
      suppliers.vendorNumber,
    ];

    if (drillDown === 'product') {
      selectCols.productName = sql<string>`coalesce(${products.name}, 'Unknown')`;
      groupCols.push(products.name);
    } else if (drillDown === 'period') {
      const period = getAggregationPeriod(filters);
      selectCols.period = getAggregationSql(purchaseOrders.createdOn, period);
      groupCols.push(selectCols.period);
    }

    let qb = this.db
      .select(selectCols)
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .innerJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
      .leftJoin(
        organizations,
        eq(suppliers.organizationId, organizations.organizationId),
      )
      .$dynamic();

    if (drillDown === 'product') {
      qb = qb.innerJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      );
    }

    if (whereClause) qb = qb.where(whereClause);
    qb = qb.groupBy(...groupCols);

    return await qb;
  }

  async getPurchasesByProduct(filters: Record<string, unknown>) {
    const conditions = [
      ...this.applyDateFilters(
        filters.fromDate as string,
        filters.toDate as string,
      ),
    ];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const drillDown = filters.drillDown as string | undefined;

    const selectCols: Record<string, SQL | PgColumn> = {
      productNumber: products.productNumber,
      productName: products.name,
      qtyPurchased: sql<number>`sum(${purchaseOrderLineItems.quantity})::numeric`,
      totalSpend: sql<number>`sum(${purchaseOrderLineItems.totalAmount})::numeric`,
    };
    const groupCols: (SQL | PgColumn)[] = [
      products.productNumber,
      products.name,
    ];

    if (drillDown === 'product-group') {
      selectCols.productGroupName = sql<string>`coalesce(${productGroups.name}, 'Unknown')`;
      groupCols.push(productGroups.name);
    } else if (drillDown === 'supplier') {
      selectCols.supplierName = sql<string>`coalesce(${organizations.name}, ${suppliers.vendorNumber}, 'Unknown')`;
      groupCols.push(
        suppliers.vendorId,
        organizations.name,
        suppliers.vendorNumber,
      );
    }

    let qb = this.db
      .select(selectCols)
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .innerJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .$dynamic();

    if (drillDown === 'product-group') {
      qb = qb.leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      );
    }
    if (drillDown === 'supplier') {
      qb = qb
        .innerJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
        .leftJoin(
          organizations,
          eq(suppliers.organizationId, organizations.organizationId),
        );
    }

    if (whereClause) qb = qb.where(whereClause);
    qb = qb.groupBy(...groupCols);

    return await qb;
  }

  async getPurchaseTrend(filters: Record<string, unknown>) {
    const conditions = [
      ...this.applyDateFilters(
        filters.fromDate as string,
        filters.toDate as string,
      ),
    ];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const drillDown = filters.drillDown as string | undefined;
    const period = getAggregationPeriod(filters);
    const periodSql = getAggregationSql(purchaseOrders.createdOn, period);

    const selectCols: Record<string, SQL | PgColumn> = {
      period: periodSql,
      orderCount: sql<number>`count(distinct ${purchaseOrders.purchaseOrderId})::int`,
      totalSpend: sql<number>`sum(${purchaseOrderLineItems.totalAmount})::numeric`,
    };
    const groupCols: (SQL | PgColumn)[] = [periodSql];

    if (drillDown === 'product-group') {
      selectCols.productGroupName = sql<string>`coalesce(${productGroups.name}, 'Unknown')`;
      groupCols.push(productGroups.name);
    } else if (drillDown === 'supplier') {
      selectCols.supplierName = sql<string>`coalesce(${organizations.name}, ${suppliers.vendorNumber}, 'Unknown')`;
      groupCols.push(
        suppliers.vendorId,
        organizations.name,
        suppliers.vendorNumber,
      );
    }

    let qb = this.db
      .select(selectCols)
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .$dynamic();

    if (drillDown === 'product-group') {
      qb = qb.innerJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      );
      qb = qb.leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      );
    } else if (drillDown === 'supplier') {
      qb = qb
        .innerJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
        .leftJoin(
          organizations,
          eq(suppliers.organizationId, organizations.organizationId),
        );
    }

    if (whereClause) qb = qb.where(whereClause);
    qb = qb.groupBy(...groupCols).orderBy(asc(periodSql));

    return await qb;
  }

  async getOutstandingPOs(filters: Record<string, unknown>) {
    const conditions = [
      sql`${purchaseOrders.stateCode} NOT IN ('completed', 'cancelled')`,
    ];

    const expectedDateField = purchaseOrders.expectedDate;
    if (filters.toDate) {
      conditions.push(
        sql`${expectedDateField} < (${filters.toDate}::date + interval '1 day')`,
      );
    }

    const whereClause = and(...conditions);
    const drillDown = filters.drillDown as string | undefined;

    const selectCols: Record<string, SQL | PgColumn> = {
      poNumber: purchaseOrders.orderNumber,
      supplierName: sql<string>`coalesce(${organizations.name}, ${suppliers.vendorNumber}, 'Unknown')`,
      expectedDate: sql<string>`to_char(${expectedDateField}, 'YYYY-MM-DD')`,
      pendingValue: sql<number>`sum((${purchaseOrderLineItems.quantity} - COALESCE(${purchaseOrderLineItems.quantityReceived}, 0)) * ${purchaseOrderLineItems.pricePerUnit})::numeric`,
    };
    const groupCols: (SQL | PgColumn)[] = [
      purchaseOrders.orderNumber,
      suppliers.vendorId,
      organizations.name,
      suppliers.vendorNumber,
      expectedDateField,
    ];

    if (drillDown === 'product') {
      selectCols.productName = sql<string>`coalesce(${products.name}, 'Unknown')`;
      groupCols.push(products.name);
    }

    let qb = this.db
      .select(selectCols)
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .innerJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
      .leftJoin(
        organizations,
        eq(suppliers.organizationId, organizations.organizationId),
      )
      .$dynamic();

    if (drillDown === 'product') {
      qb = qb.innerJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      );
    }

    qb = qb.where(whereClause).groupBy(...groupCols);

    return await qb;
  }
}
