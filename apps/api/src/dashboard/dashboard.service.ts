import { Injectable, Inject } from '@nestjs/common';
import { sql, ilike, or } from 'drizzle-orm';
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
} from '../drizzle/modbm-core-schema';
import { SALES_ORDER_STATE, PURCHASE_ORDER_STATE } from '@modbm/shared';
import { AggregateType, EventType } from '../common/event-types';
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
            label: coreAccounts.name,
            subtitle: coreAccounts.customerNumber,
          })
          .from(coreAccounts)
          .where(
            or(
              ilike(coreAccounts.name, term),
              ilike(coreAccounts.customerNumber, term),
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

    // --- Sales Events ---
    if (types.includes('so_created')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.CREATED})`,
      );
    }
    if (types.includes('so_confirmed')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${SALES_ORDER_STATE.CONFIRMED})`,
      );
    }
    if (types.includes('so_shipped')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${SALES_ORDER_STATE.SHIPPED})`,
      );
    }
    if (types.includes('so_invoiced')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${SALES_ORDER_STATE.INVOICED})`,
      );
    }
    if (types.includes('so_dispatched')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STOCK_DISPATCHED})`,
      );
    }
    if (types.includes('so_credit_note')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.CREDIT_NOTE_POSTED})`,
      );
    }
    if (types.includes('so_backorders')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.BACKORDERS_ALLOCATED})`,
      );
    }

    // --- Purchasing Events ---
    if (types.includes('po_created')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.CREATED})`,
      );
    }
    if (types.includes('po_ordered')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${PURCHASE_ORDER_STATE.ORDERED})`,
      );
    }
    if (types.includes('po_received')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${PURCHASE_ORDER_STATE.RECEIVED})`,
      );
    }
    if (types.includes('po_invoiced')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.PURCHASE_INVOICED})`,
      );
    }
    if (types.includes('po_over_received')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.OVER_RECEIVED_WARNING})`,
      );
    }
    if (types.includes('po_price_discrepancy')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.PRICE_DISCREPANCY_WARNING})`,
      );
    }

    // --- Inventory & Warehouse Events ---
    if (types.includes('stock_received')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.GOODS_RECEIPT} AND e.event_type = ${EventType.STOCK_RECEIVED})`,
      );
    }
    if (types.includes('stock_adjusted')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SYSTEM} AND e.event_type = ${EventType.STOCK_ADJUSTED})`,
      );
    }
    if (types.includes('transfer_created')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.TRANSFER_ORDER} AND e.event_type = ${EventType.CREATED})`,
      );
    }

    // --- Finance Events ---
    if (types.includes('payment_submitted')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PAYMENT} AND e.event_type = ${EventType.PAYMENT_SUBMITTED})`,
      );
    }
    if (types.includes('payment_allocated')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PAYMENT} AND e.event_type = ${EventType.PAYMENT_ALLOCATED})`,
      );
    }
    if (types.includes('payment_cancelled')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.PAYMENT} AND e.event_type = ${EventType.PAYMENT_CANCELLED})`,
      );
    }

    // --- Cross-Domain Entities ---
    if (types.includes('customer_created')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.CUSTOMER} AND e.event_type = ${EventType.CREATED})`,
      );
    }
    if (types.includes('supplier_created')) {
      conditions.push(
        sql`(e.aggregate_type = ${AggregateType.SUPPLIER} AND e.event_type = ${EventType.CREATED})`,
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
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.CREATED} THEN 'so_created'
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${SALES_ORDER_STATE.CONFIRMED} THEN 'so_confirmed'
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${SALES_ORDER_STATE.SHIPPED} THEN 'so_shipped'
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${SALES_ORDER_STATE.INVOICED} THEN 'so_invoiced'
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.STOCK_DISPATCHED} THEN 'so_dispatched'
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.CREDIT_NOTE_POSTED} THEN 'so_credit_note'
          WHEN e.aggregate_type = ${AggregateType.SALES_ORDER} AND e.event_type = ${EventType.BACKORDERS_ALLOCATED} THEN 'so_backorders'
          
          WHEN e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.CREATED} THEN 'po_created'
          WHEN e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${PURCHASE_ORDER_STATE.ORDERED} THEN 'po_ordered'
          WHEN e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.STATUS_CHANGED} AND e.payload->>'to' = ${PURCHASE_ORDER_STATE.RECEIVED} THEN 'po_received'
          WHEN e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.PURCHASE_INVOICED} THEN 'po_invoiced'
          WHEN e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.OVER_RECEIVED_WARNING} THEN 'po_over_received'
          WHEN e.aggregate_type = ${AggregateType.PURCHASE_ORDER} AND e.event_type = ${EventType.PRICE_DISCREPANCY_WARNING} THEN 'po_price_discrepancy'
          
          WHEN e.aggregate_type = ${AggregateType.GOODS_RECEIPT} AND e.event_type = ${EventType.STOCK_RECEIVED} THEN 'stock_received'
          WHEN e.aggregate_type = ${AggregateType.SYSTEM} AND e.event_type = ${EventType.STOCK_ADJUSTED} THEN 'stock_adjusted'
          WHEN e.aggregate_type = ${AggregateType.TRANSFER_ORDER} AND e.event_type = ${EventType.CREATED} THEN 'transfer_created'
          
          WHEN e.aggregate_type = ${AggregateType.PAYMENT} AND e.event_type = ${EventType.PAYMENT_SUBMITTED} THEN 'payment_submitted'
          WHEN e.aggregate_type = ${AggregateType.PAYMENT} AND e.event_type = ${EventType.PAYMENT_ALLOCATED} THEN 'payment_allocated'
          WHEN e.aggregate_type = ${AggregateType.PAYMENT} AND e.event_type = ${EventType.PAYMENT_CANCELLED} THEN 'payment_cancelled'
          
          WHEN e.aggregate_type = ${AggregateType.CUSTOMER} AND e.event_type = ${EventType.CREATED} THEN 'customer_created'
          WHEN e.aggregate_type = ${AggregateType.SUPPLIER} AND e.event_type = ${EventType.CREATED} THEN 'supplier_created'
        END as "eventType",
        e.aggregate_id as "entityId", 
        COALESCE(so.order_number, po.order_number, a.name, s.name, gr.receipt_number, to_tbl.order_number, pe.payment_number, e.aggregate_id::text) as "entityDisplay", 
        e.actor, 
        e.created_on as "timestamp"
      FROM modbm_core.dashboard_timeline e
      LEFT JOIN modbm_core.sales_orders so ON e.aggregate_type = 'sales_order' AND e.aggregate_id = so.sales_order_id
      LEFT JOIN modbm_core.purchase_orders po ON e.aggregate_type = 'purchase_order' AND e.aggregate_id = po.purchase_order_id
      LEFT JOIN modbm_core.customers a ON e.aggregate_type = 'customer' AND e.aggregate_id = a.customer_id
      LEFT JOIN modbm_core.suppliers s ON e.aggregate_type = 'supplier' AND e.aggregate_id = s.vendor_id
      LEFT JOIN modbm_core.goods_received gr ON e.aggregate_type = 'goods_receipt' AND e.aggregate_id = gr.goods_received_id
      LEFT JOIN modbm_core.transfer_orders to_tbl ON e.aggregate_type = 'transfer_order' AND e.aggregate_id = to_tbl.transfer_order_id
      LEFT JOIN modbm_core.payment_entries pe ON e.aggregate_type = 'payment' AND e.aggregate_id = pe.payment_id
      WHERE ${whereClause}
      ORDER BY e.created_on DESC
      LIMIT ${limit}
    `;

    const result = await this.db.execute(fullQuery);
    const rows = (result as any).rows ?? result;
    return { events: rows as unknown as TimelineEvent[] };
  }
}
