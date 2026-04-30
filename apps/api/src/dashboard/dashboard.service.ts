import { Injectable, Inject } from '@nestjs/common';
import { sql, ilike, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  accounts as coreAccounts,
  salesOrders as coreSalesOrders,
  suppliers as coreSuppliers,
  purchaseOrders as corePurchaseOrders,
  binContents as coreBinContents,
  salesOrderLineItems as coreSalesOrderLines,
} from '../drizzle/modbm-core-schema';

export interface SearchResult {
  id: string;
  type: 'product' | 'account' | 'sales_order' | 'supplier' | 'purchase_order';
  label: string;
  subtitle: string;
  href: string;
}

export interface TimelineEvent {
  eventId: string;
  eventType: string;
  entityId: string;
  entityDisplay: string;
  actor: string | null;
  timestamp: Date;
}

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getSummary() {
    const [accountCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(coreAccounts);

    const [productCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(coreProducts);

    const [orderLineCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(coreSalesOrderLines);

    return {
      accounts: accountCount.count,
      products: productCount.count,
      orderLines: orderLineCount.count,
    };
  }

  async universalSearch(q: string): Promise<{ results: SearchResult[] }> {
    if (!q || q.length < 2) return { results: [] };

    const term = `%${q}%`;

    const [productRows, accountRows, soRows, supplierRows, poRows] =
      await Promise.all([
        // Products
        this.db
          .select({
            id: coreProducts.productId,
            label: coreProducts.name,
            subtitle: coreProducts.productNumber,
          })
          .from(coreProducts)
          .where(
            or(
              ilike(coreProducts.name, term),
              ilike(coreProducts.productNumber, term),
              ilike(coreProducts.barcode, term),
            ),
          )
          .limit(5),

        // Accounts
        this.db
          .select({
            id: coreAccounts.accountId,
            label: coreAccounts.name,
            subtitle: coreAccounts.accountNumber,
          })
          .from(coreAccounts)
          .where(
            or(
              ilike(coreAccounts.name, term),
              ilike(coreAccounts.accountNumber, term),
              ilike(coreAccounts.emailAddress1, term),
            ),
          )
          .limit(5),

        // Sales Orders
        this.db
          .select({
            id: coreSalesOrders.salesOrderId,
            label: coreSalesOrders.orderNumber,
            subtitle: coreSalesOrders.name,
          })
          .from(coreSalesOrders)
          .where(
            or(
              ilike(coreSalesOrders.orderNumber, term),
              ilike(coreSalesOrders.name, term),
              ilike(coreSalesOrders.customerOrderNumber, term),
            ),
          )
          .limit(5),

        // Suppliers
        this.db
          .select({
            id: coreSuppliers.vendorId,
            label: coreSuppliers.name,
            subtitle: coreSuppliers.vendorNumber,
          })
          .from(coreSuppliers)
          .where(
            or(
              ilike(coreSuppliers.name, term),
              ilike(coreSuppliers.vendorNumber, term),
            ),
          )
          .limit(5),

        // Purchase Orders
        this.db
          .select({
            id: corePurchaseOrders.purchaseOrderId,
            label: corePurchaseOrders.orderNumber,
            subtitle: corePurchaseOrders.name,
          })
          .from(corePurchaseOrders)
          .where(
            or(
              ilike(corePurchaseOrders.orderNumber, term),
              ilike(corePurchaseOrders.name, term),
              ilike(corePurchaseOrders.referenceNumber, term),
            ),
          )
          .limit(5),
      ]);

    const results: SearchResult[] = [
      ...productRows.map((r) => ({
        id: r.id,
        type: 'product' as const,
        label: r.label,
        subtitle: r.subtitle,
        href: `/products/${r.id}`,
      })),
      ...accountRows.map((r) => ({
        id: r.id,
        type: 'account' as const,
        label: r.label,
        subtitle: r.subtitle,
        href: `/accounts/${r.id}`,
      })),
      ...soRows.map((r) => ({
        id: r.id,
        type: 'sales_order' as const,
        label: r.label,
        subtitle: r.subtitle ?? '',
        href: `/sales-orders/${r.id}`,
      })),
      ...supplierRows.map((r) => ({
        id: r.id,
        type: 'supplier' as const,
        label: r.label,
        subtitle: r.subtitle,
        href: `/suppliers/${r.id}`,
      })),
      ...poRows.map((r) => ({
        id: r.id,
        type: 'purchase_order' as const,
        label: r.label,
        subtitle: r.subtitle ?? '',
        href: `/purchase-orders/${r.id}`,
      })),
    ];

    return { results };
  }

  async getTimeline(
    types: string[],
    limit = 50,
  ): Promise<{ events: TimelineEvent[] }> {
    if (!types || types.length === 0) {
      return { events: [] };
    }

    const conditions = [];

    if (types.includes('so_created')) {
      conditions.push(
        sql`(e.aggregate_type = 'sales_order' AND e.event_type = 'created')`,
      );
    }
    if (types.includes('so_confirmed')) {
      conditions.push(
        sql`(e.aggregate_type = 'sales_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'confirmed')`,
      );
    }
    if (types.includes('so_shipped')) {
      conditions.push(
        sql`(e.aggregate_type = 'sales_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'shipped')`,
      );
    }
    if (types.includes('so_invoiced')) {
      conditions.push(
        sql`(e.aggregate_type = 'sales_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'invoiced')`,
      );
    }

    if (types.includes('po_created')) {
      conditions.push(
        sql`(e.aggregate_type = 'purchase_order' AND e.event_type = 'created')`,
      );
    }
    if (types.includes('po_ordered')) {
      conditions.push(
        sql`(e.aggregate_type = 'purchase_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'ordered')`,
      );
    }
    if (types.includes('po_received')) {
      conditions.push(
        sql`(e.aggregate_type = 'purchase_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'fulfilled')`,
      );
    }

    if (types.includes('account_created')) {
      conditions.push(
        sql`(e.aggregate_type = 'account' AND e.event_type = 'created')`,
      );
    }

    if (types.includes('supplier_created')) {
      conditions.push(
        sql`(e.aggregate_type = 'supplier' AND e.event_type = 'created')`,
      );
    }

    if (conditions.length === 0) {
      return { events: [] };
    }

    const whereClause = conditions.reduce(
      (acc, cond, i) => (i === 0 ? cond : sql`${acc} OR ${cond}`),
      sql``,
    );

    const fullQuery = sql`
      SELECT 
        e.event_id as "eventId", 
        CASE 
          WHEN e.aggregate_type = 'sales_order' AND e.event_type = 'created' THEN 'so_created'
          WHEN e.aggregate_type = 'sales_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'confirmed' THEN 'so_confirmed'
          WHEN e.aggregate_type = 'sales_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'shipped' THEN 'so_shipped'
          WHEN e.aggregate_type = 'sales_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'invoiced' THEN 'so_invoiced'
          WHEN e.aggregate_type = 'purchase_order' AND e.event_type = 'created' THEN 'po_created'
          WHEN e.aggregate_type = 'purchase_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'ordered' THEN 'po_ordered'
          WHEN e.aggregate_type = 'purchase_order' AND e.event_type = 'status_changed' AND e.payload->>'to' = 'fulfilled' THEN 'po_received'
          WHEN e.aggregate_type = 'account' AND e.event_type = 'created' THEN 'account_created'
          WHEN e.aggregate_type = 'supplier' AND e.event_type = 'created' THEN 'supplier_created'
        END as "eventType",
        e.aggregate_id as "entityId", 
        COALESCE(so.order_number, po.order_number, a.name, s.name, e.aggregate_id::text) as "entityDisplay", 
        e.actor, 
        e.created_on as "timestamp"
      FROM modbm_core.dashboard_timeline e
      LEFT JOIN modbm_core.sales_orders so ON e.aggregate_type = 'sales_order' AND e.aggregate_id = so.sales_order_id
      LEFT JOIN modbm_core.purchase_orders po ON e.aggregate_type = 'purchase_order' AND e.aggregate_id = po.purchase_order_id
      LEFT JOIN modbm_core.accounts a ON e.aggregate_type = 'account' AND e.aggregate_id = a.account_id
      LEFT JOIN modbm_core.suppliers s ON e.aggregate_type = 'supplier' AND e.aggregate_id = s.vendor_id
      WHERE ${whereClause}
      ORDER BY e.created_on DESC
      LIMIT ${limit}
    `;

    const result = await this.db.execute(fullQuery);
    return { events: result as unknown as TimelineEvent[] };
  }
}
