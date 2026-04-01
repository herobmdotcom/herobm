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
              ilike(corePurchaseOrders.invoiceNumber, term),
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

    const fragments = [];

    if (types.includes('so_created')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'so_created' as "eventType", o.sales_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.order_events e
            JOIN modbm_core.sales_orders o ON e.sales_order_id = o.sales_order_id
            WHERE e.event_type = 'created'`,
      );
    }
    if (types.includes('so_confirmed')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'so_confirmed' as "eventType", o.sales_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.order_events e
            JOIN modbm_core.sales_orders o ON e.sales_order_id = o.sales_order_id
            WHERE e.event_type = 'status_changed' AND e.payload->>'to' = 'confirmed'`,
      );
    }
    if (types.includes('so_shipped')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'so_shipped' as "eventType", o.sales_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.order_events e
            JOIN modbm_core.sales_orders o ON e.sales_order_id = o.sales_order_id
            WHERE e.event_type = 'status_changed' AND e.payload->>'to' = 'shipped'`,
      );
    }
    if (types.includes('so_invoiced')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'so_invoiced' as "eventType", o.sales_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.order_events e
            JOIN modbm_core.sales_orders o ON e.sales_order_id = o.sales_order_id
            WHERE e.event_type = 'status_changed' AND e.payload->>'to' = 'invoiced'`,
      );
    }

    if (types.includes('po_created')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'po_created' as "eventType", o.purchase_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.purchase_order_events e
            JOIN modbm_core.purchase_orders o ON e.purchase_order_id = o.purchase_order_id
            WHERE e.event_type = 'created'`,
      );
    }
    if (types.includes('po_ordered')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'po_ordered' as "eventType", o.purchase_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.purchase_order_events e
            JOIN modbm_core.purchase_orders o ON e.purchase_order_id = o.purchase_order_id
            WHERE e.event_type = 'status_changed' AND e.payload->>'to' = 'ordered'`,
      );
    }
    if (types.includes('po_received')) {
      fragments.push(
        sql`SELECT e.event_id as "eventId", 'po_received' as "eventType", o.purchase_order_id as "entityId", o.order_number as "entityDisplay", e.actor, e.created_on as "timestamp"
            FROM modbm_core.purchase_order_events e
            JOIN modbm_core.purchase_orders o ON e.purchase_order_id = o.purchase_order_id
            WHERE e.event_type = 'status_changed' AND e.payload->>'to' = 'fulfilled'`,
      );
    }

    if (types.includes('account_created')) {
      fragments.push(
        sql`SELECT a.account_id as "eventId", 'account_created' as "eventType", a.account_id as "entityId", a.name as "entityDisplay", a.created_by as "actor", a.created_on as "timestamp"
            FROM modbm_core.accounts a
            WHERE a.created_on IS NOT NULL`,
      );
    }

    if (types.includes('supplier_created')) {
      fragments.push(
        sql`SELECT s.vendor_id as "eventId", 'supplier_created' as "eventType", s.vendor_id as "entityId", s.name as "entityDisplay", s.created_by as "actor", s.created_on as "timestamp"
            FROM modbm_core.suppliers s
            WHERE s.created_on IS NOT NULL`,
      );
    }

    if (fragments.length === 0) {
      return { events: [] };
    }

    const unionQuery = fragments.reduce(
      (acc, frag, i) => (i === 0 ? frag : sql`${acc} UNION ALL ${frag}`),
      sql``,
    );

    const fullQuery = sql`
      SELECT * FROM (${unionQuery}) as combined
      ORDER BY "timestamp" DESC
      LIMIT ${limit}
    `;

    const result = await this.db.execute(fullQuery);
    return { events: result as unknown as TimelineEvent[] };
  }
}
