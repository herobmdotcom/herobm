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
  salesOrderShipments as coreShipments,
  goodsReceived as coreGoodsReceived,
  salesInvoices as coreSalesInvoices,
  purchaseInvoices as corePurchaseInvoices,
  salesOrderReturns as coreSalesReturns,
  purchaseOrderReturns as corePurchaseReturns,
  salesCreditNotes as coreSalesCreditNotes,
  purchaseDebitNotes as corePurchaseDebitNotes,
  transferOrders as coreTransferOrders,
  workOrders as coreWorkOrders,
  contacts as coreContacts,
  projects as coreProjects,
  paymentEntries as corePayments,
  salesOrderLineItems as coreSalesOrderLines,
  actors as coreActors,
} from '@herobm/db-schema';

export type SearchEntityType =
  | 'product'
  | 'customer'
  | 'sales_order'
  | 'supplier'
  | 'purchase_order'
  | 'shipment'
  | 'goods_receipt'
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'sales_return'
  | 'purchase_return'
  | 'sales_credit_note'
  | 'purchase_debit_note'
  | 'transfer_order'
  | 'work_order'
  | 'contact'
  | 'project'
  | 'payment';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  label: string;
  subtitle: string;
  href: string;
}

export interface TimelineEvent {
  eventId: string;
  eventType: string;
  entityId: string;
  entityDisplay: string;
  payload?: Record<string, unknown> | null;
  actor: string | null;
  timestamp: Date;
}

export const DEFAULT_SEARCH_ENTITIES: SearchEntityType[] = [
  'product',
  'customer',
  'sales_order',
  'supplier',
  'purchase_order',
  'sales_invoice',
  'purchase_invoice',
  'work_order',
];

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

  async universalSearch(
    q: string,
    types?: string[],
  ): Promise<{ results: SearchResult[] }> {
    if (!q || q.length < 2) return { results: [] };

    const term = `%${q}%`;
    const selectedTypes = new Set<string>(
      types && types.length > 0 ? types : DEFAULT_SEARCH_ENTITIES,
    );

    const searchQueries: Promise<SearchResult[]>[] = [];

    // 1. Products
    if (selectedTypes.has('product')) {
      searchQueries.push(
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
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'product' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/products/${r.id}`,
            })),
          ),
      );
    }

    // 2. Customers
    if (selectedTypes.has('customer')) {
      searchQueries.push(
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
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'customer' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/customers/${r.id}`,
            })),
          ),
      );
    }

    // 3. Sales Orders
    if (selectedTypes.has('sales_order')) {
      searchQueries.push(
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
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'sales_order' as const,
              label: r.label,
              subtitle: r.subtitle ?? '',
              href: `/sales-orders/${r.id}`,
            })),
          ),
      );
    }

    // 4. Suppliers
    if (selectedTypes.has('supplier')) {
      searchQueries.push(
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
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'supplier' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/suppliers/${r.id}`,
            })),
          ),
      );
    }

    // 5. Purchase Orders
    if (selectedTypes.has('purchase_order')) {
      searchQueries.push(
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
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'purchase_order' as const,
              label: r.label,
              subtitle: r.subtitle ?? '',
              href: `/purchase-orders/${r.id}`,
            })),
          ),
      );
    }

    // 6. Shipments
    if (selectedTypes.has('shipment')) {
      searchQueries.push(
        this.db
          .select({
            id: coreShipments.shipmentId,
            label: coreShipments.shipmentNumber,
            subtitle: sql<string>`COALESCE(${coreShipments.trackingNumber}, ${coreShipments.deliveryCompanyName}, '')`,
          })
          .from(coreShipments)
          .where(
            or(
              ilike(coreShipments.shipmentNumber, term),
              ilike(coreShipments.trackingNumber, term),
            ),
          )
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'shipment' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/shipments/${r.id}`,
            })),
          ),
      );
    }

    // 7. Goods Receipts
    if (selectedTypes.has('goods_receipt')) {
      searchQueries.push(
        this.db
          .select({
            id: coreGoodsReceived.goodsReceivedId,
            label: coreGoodsReceived.receiptNumber,
            subtitle: sql<string>`COALESCE(${coreGoodsReceived.packingSlipNumber}, '')`,
          })
          .from(coreGoodsReceived)
          .where(
            or(
              ilike(coreGoodsReceived.receiptNumber, term),
              ilike(coreGoodsReceived.packingSlipNumber, term),
            ),
          )
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'goods_receipt' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/receiving/${r.id}`,
            })),
          ),
      );
    }

    // 8. Sales Invoices
    if (selectedTypes.has('sales_invoice')) {
      searchQueries.push(
        this.db
          .select({
            id: coreSalesInvoices.invoiceId,
            label: coreSalesInvoices.invoiceNumber,
            subtitle: sql<string>`COALESCE(${coreSalesInvoices.customerNameDisplay}, ${coreSalesInvoices.customerOrderNumber}, '')`,
          })
          .from(coreSalesInvoices)
          .where(
            or(
              ilike(coreSalesInvoices.invoiceNumber, term),
              ilike(coreSalesInvoices.customerOrderNumber, term),
              ilike(coreSalesInvoices.customerNameDisplay, term),
            ),
          )
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'sales_invoice' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/sales-invoices/${r.id}`,
            })),
          ),
      );
    }

    // 9. Purchase Invoices
    if (selectedTypes.has('purchase_invoice')) {
      searchQueries.push(
        this.db
          .select({
            id: corePurchaseInvoices.invoiceId,
            label: corePurchaseInvoices.invoiceNumber,
            subtitle: sql<string>`COALESCE(${corePurchaseInvoices.supplierInvoiceNumber}, '')`,
          })
          .from(corePurchaseInvoices)
          .where(
            or(
              ilike(corePurchaseInvoices.invoiceNumber, term),
              ilike(corePurchaseInvoices.supplierInvoiceNumber, term),
            ),
          )
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'purchase_invoice' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/supplier-invoices/${r.id}`,
            })),
          ),
      );
    }

    // 10. Sales Returns
    if (selectedTypes.has('sales_return')) {
      searchQueries.push(
        this.db
          .select({
            id: coreSalesReturns.returnId,
            label: coreSalesReturns.returnNumber,
            subtitle: sql<string>`COALESCE(${coreSalesReturns.notes}, '')`,
          })
          .from(coreSalesReturns)
          .where(ilike(coreSalesReturns.returnNumber, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'sales_return' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/sales-returns/${r.id}`,
            })),
          ),
      );
    }

    // 11. Purchase Returns
    if (selectedTypes.has('purchase_return')) {
      searchQueries.push(
        this.db
          .select({
            id: corePurchaseReturns.returnId,
            label: corePurchaseReturns.returnNumber,
            subtitle: sql<string>`COALESCE(${corePurchaseReturns.notes}, '')`,
          })
          .from(corePurchaseReturns)
          .where(ilike(corePurchaseReturns.returnNumber, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'purchase_return' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/purchase-orders/returns/${r.id}`,
            })),
          ),
      );
    }

    // 12. Sales Credit Notes
    if (selectedTypes.has('sales_credit_note')) {
      searchQueries.push(
        this.db
          .select({
            id: coreSalesCreditNotes.creditNoteId,
            label: coreSalesCreditNotes.creditNoteNumber,
            subtitle: sql<string>`COALESCE(${coreSalesCreditNotes.notes}, '')`,
          })
          .from(coreSalesCreditNotes)
          .where(ilike(coreSalesCreditNotes.creditNoteNumber, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'sales_credit_note' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/sales-credit-notes/${r.id}`,
            })),
          ),
      );
    }

    // 13. Purchase Debit Notes
    if (selectedTypes.has('purchase_debit_note')) {
      searchQueries.push(
        this.db
          .select({
            id: corePurchaseDebitNotes.debitNoteId,
            label: corePurchaseDebitNotes.debitNoteNumber,
            subtitle: sql<string>`COALESCE(${corePurchaseDebitNotes.supplierReferenceNumber}, ${corePurchaseDebitNotes.notes}, '')`,
          })
          .from(corePurchaseDebitNotes)
          .where(
            or(
              ilike(corePurchaseDebitNotes.debitNoteNumber, term),
              ilike(corePurchaseDebitNotes.supplierReferenceNumber, term),
            ),
          )
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'purchase_debit_note' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/purchase-debit-notes/${r.id}`,
            })),
          ),
      );
    }

    // 14. Transfer Orders
    if (selectedTypes.has('transfer_order')) {
      searchQueries.push(
        this.db
          .select({
            id: coreTransferOrders.transferOrderId,
            label: coreTransferOrders.orderNumber,
            subtitle: sql<string>`COALESCE(${coreTransferOrders.notes}, '')`,
          })
          .from(coreTransferOrders)
          .where(ilike(coreTransferOrders.orderNumber, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'transfer_order' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/inventory/transfers/${r.id}`,
            })),
          ),
      );
    }

    // 15. Work Orders
    if (selectedTypes.has('work_order')) {
      searchQueries.push(
        this.db
          .select({
            id: coreWorkOrders.workOrderId,
            label: coreWorkOrders.orderNumber,
            subtitle: coreWorkOrders.stateCode,
          })
          .from(coreWorkOrders)
          .where(ilike(coreWorkOrders.orderNumber, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'work_order' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/manufacturing/work-orders/${r.id}`,
            })),
          ),
      );
    }

    // 16. Contacts
    if (selectedTypes.has('contact')) {
      searchQueries.push(
        this.db
          .select({
            id: coreContacts.contactId,
            label: sql<string>`COALESCE(${coreContacts.fullName}, ${coreContacts.firstName} || ' ' || ${coreContacts.lastName}, ${coreContacts.email}, '')`,
            subtitle: sql<string>`COALESCE(${coreContacts.email}, ${coreContacts.phone}, ${coreContacts.jobTitle}, '')`,
          })
          .from(coreContacts)
          .where(
            or(
              ilike(coreContacts.firstName, term),
              ilike(coreContacts.lastName, term),
              ilike(coreContacts.fullName, term),
              ilike(coreContacts.email, term),
              ilike(coreContacts.phone, term),
            ),
          )
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'contact' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/crm/contacts/${r.id}`,
            })),
          ),
      );
    }

    // 17. Projects
    if (selectedTypes.has('project')) {
      searchQueries.push(
        this.db
          .select({
            id: coreProjects.projectId,
            label: coreProjects.name,
            subtitle: sql<string>`COALESCE(${coreProjects.type} || ' • ' || ${coreProjects.status}, '')`,
          })
          .from(coreProjects)
          .where(ilike(coreProjects.name, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'project' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/crm/projects/${r.id}`,
            })),
          ),
      );
    }

    // 18. Payments
    if (selectedTypes.has('payment')) {
      searchQueries.push(
        this.db
          .select({
            id: corePayments.paymentId,
            label: corePayments.paymentNumber,
            subtitle: sql<string>`COALESCE(${corePayments.referenceNumber}, ${corePayments.paymentType}, '')`,
          })
          .from(corePayments)
          .where(ilike(corePayments.paymentNumber, term))
          .limit(5)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'payment' as const,
              label: r.label,
              subtitle: r.subtitle,
              href: `/payments?paymentId=${r.id}`,
            })),
          ),
      );
    }

    const queryResults = await Promise.all(searchQueries);
    const results = queryResults.flat();

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
          sql`(e.entity_type = 'system' AND e.event_type = 'gl_posted') OR (e.entity_type = 'general_ledger' AND e.event_type = 'entry_posted') OR (e.entity_type = 'financial' AND e.event_type = 'gl_posted')`,
        );
      } else if (t === 'general_ledger.integrity_violation') {
        conditions.push(
          sql`(e.entity_type = 'system' AND e.event_type = 'ledger_integrity_violation') OR (e.entity_type = 'general_ledger' AND e.event_type = 'integrity_violation')`,
        );
      } else if (t === 'inventory_ledger.entry_posted') {
        conditions.push(
          sql`(e.entity_type = 'inventory_ledger' AND e.event_type = 'entry_posted')`,
        );
      } else if (t === 'warehouse.receipt_created') {
        conditions.push(
          sql`(e.entity_type = 'goods_receipt' AND e.event_type = 'created') OR (e.entity_type = 'warehouse' AND e.event_type = 'receipt_created')`,
        );
      } else if (t === 'warehouse.receipt_status_changed') {
        conditions.push(
          sql`(e.entity_type = 'goods_receipt' AND e.event_type = 'status_changed') OR (e.entity_type = 'warehouse' AND e.event_type = 'receipt_status_changed')`,
        );
      } else if (t === 'warehouse.shipment_dispatched') {
        conditions.push(
          sql`(e.entity_type = 'shipment' AND e.event_type = 'stock_dispatched') OR (e.entity_type = 'warehouse' AND e.event_type = 'shipment_dispatched')`,
        );
      } else if (t === 'warehouse.shipment_created') {
        conditions.push(
          sql`(e.entity_type = 'shipment' AND e.event_type = 'created') OR (e.entity_type = 'warehouse' AND e.event_type = 'shipment_created')`,
        );
      } else if (t === 'warehouse.shipment_status_changed') {
        conditions.push(
          sql`(e.entity_type = 'shipment' AND e.event_type = 'status_changed') OR (e.entity_type = 'warehouse' AND e.event_type = 'shipment_status_changed')`,
        );
      } else if (t === 'stock_adjusted') {
        conditions.push(
          sql`(e.entity_type = 'system' AND e.event_type = 'stock_adjusted') OR (e.entity_type = 'inventory_ledger' AND e.event_type = 'stock_adjusted')`,
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
          WHEN e.entity_type = 'system' AND e.event_type = 'ledger_integrity_violation' THEN 'general_ledger.integrity_violation'
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
        e.payload as "payload",
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
