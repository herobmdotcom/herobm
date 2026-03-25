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
}
