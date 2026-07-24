import { Injectable, Inject } from '@nestjs/common';
import { sql, ilike, or, eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  customers as coreAccounts,
  salesOrders as coreSalesOrders,
  suppliers as coreSuppliers,
  purchaseOrders as corePurchaseOrders,
  binContents as coreBinContents,
  salesOrderLineItems as coreSalesOrderLines,
  actors as coreActors,
} from '../drizzle/herobm-core-schema';
import { SALES_ORDER_STATE, PURCHASE_ORDER_STATE } from '@herobm/shared';
import { EventType } from '../common/event-types';
export interface SearchResult {
  id: string;
  type: 'product' | 'customer' | 'sales_order' | 'supplier' | 'purchase_order';
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
      customers: accountCount.count,
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

        // Customers
        this.db
          .select({
            id: coreAccounts.customerId,
            label: sql<string>`COALESCE(${coreActors.name}, '')`,
            subtitle: coreAccounts.customerNumber,
          })
          .from(coreAccounts)
          .leftJoin(coreActors, eq(coreAccounts.actorId, coreActors.actorId))
          .where(
            or(
              ilike(coreActors.name, term),
              ilike(coreAccounts.customerNumber, term),
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
            label: sql<string>`COALESCE(${coreActors.name}, '')`,
            subtitle: coreSuppliers.vendorNumber,
          })
          .from(coreSuppliers)
          .leftJoin(coreActors, eq(coreSuppliers.actorId, coreActors.actorId))
          .where(
            or(
              ilike(coreActors.name, term),
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
        type: 'customer' as const,
        label: r.label,
        subtitle: r.subtitle,
        href: `/customers/${r.id}`,
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

    for (const t of types) {
      if (t === 'general_ledger.entry_posted') {
        conditions.push(
          sql`(e.entity_type = 'system' AND e.event_type = 'gl_posted')`,
        );
      } else if (t === 'inventory_ledger.entry_posted') {
        conditions.push(
          sql`(e.entity_type = 'inventory_ledger' AND e.event_type = 'entry_posted')`,
        );
      } else if (t === 'warehouse.receipt_created') {
        conditions.push(
          sql`(e.entity_type = 'goods_receipt' AND e.event_type = 'created')`,
        );
      } else if (t === 'warehouse.receipt_status_changed') {
        conditions.push(
          sql`(e.entity_type = 'goods_receipt' AND e.event_type = 'status_changed')`,
        );
      } else if (t === 'warehouse.shipment_dispatched') {
        conditions.push(
          sql`(e.entity_type = 'shipment' AND e.event_type = 'stock_dispatched')`,
        );
      } else if (t === 'warehouse.shipment_created') {
        conditions.push(
          sql`(e.entity_type = 'shipment' AND e.event_type = 'created')`,
        );
      } else if (t === 'warehouse.shipment_status_changed') {
        conditions.push(
          sql`(e.entity_type = 'shipment' AND e.event_type = 'status_changed')`,
        );
      } else if (t === 'stock_adjusted') {
        conditions.push(
          sql`(e.entity_type = 'system' AND e.event_type = 'stock_adjusted')`,
        );
      } else if (t.startsWith('warehouse.')) {
        conditions.push(
          sql`(e.entity_type = 'warehouse' AND e.event_type = ${t.replace('warehouse.', '')})`,
        );
      } else {
        const parts = t.split('.');
        if (parts.length === 2) {
          conditions.push(
            sql`(e.entity_type = ${parts[0]} AND e.event_type = ${parts[1]})`,
          );
        }
      }
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
          WHEN e.entity_type = 'system' AND e.event_type = 'gl_posted' THEN 'general_ledger.entry_posted'
          WHEN e.entity_type = 'inventory_ledger' AND e.event_type = 'entry_posted' THEN 'inventory_ledger.entry_posted'
          WHEN e.entity_type = 'goods_receipt' AND e.event_type = 'created' THEN 'warehouse.receipt_created'
          WHEN e.entity_type = 'goods_receipt' AND e.event_type = 'status_changed' THEN 'warehouse.receipt_status_changed'
          WHEN e.entity_type = 'shipment' AND e.event_type = 'stock_dispatched' THEN 'warehouse.shipment_dispatched'
          WHEN e.entity_type = 'shipment' AND e.event_type = 'created' THEN 'warehouse.shipment_created'
          WHEN e.entity_type = 'shipment' AND e.event_type = 'status_changed' THEN 'warehouse.shipment_status_changed'
          WHEN e.entity_type = 'warehouse' THEN 'warehouse.' || e.event_type
          ELSE e.entity_type || '.' || e.event_type
        END as "eventType",
        e.entity_id as "entityId", 
        e.entity_display_name as "entityDisplay", 
        e.actor, 
        e.created_on as "timestamp"
      FROM herobm_core.dashboard_timeline e
      WHERE ${whereClause}
      ORDER BY e.created_on DESC
      LIMIT ${limit}
    `;

    const result = await this.db.execute(fullQuery);
    const rows = (result as { rows?: unknown[] }).rows ?? result;
    return { events: rows as unknown as TimelineEvent[] };
  }
}
