import { relations } from 'drizzle-orm';
import {
  salesOrders,
  salesOrderLineItems,
  salesInvoices,
  salesInvoiceLines,
} from './sales.schema';
import { customers, opportunities } from './crm.schema';
import { projects } from './projects.schema';
import { products } from './products.schema';

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.customerId],
  }),
  opportunity: one(opportunities, {
    fields: [salesOrders.opportunityId],
    references: [opportunities.opportunityId],
  }),
  lines: many(salesOrderLineItems),
}));

export const salesInvoicesRelations = relations(salesInvoices, ({ one, many }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesInvoices.salesOrderId],
    references: [salesOrders.salesOrderId],
  }),
  project: one(projects, {
    fields: [salesInvoices.projectId],
    references: [projects.projectId],
  }),
  customer: one(customers, {
    fields: [salesInvoices.customerId],
    references: [customers.customerId],
  }),
  lines: many(salesInvoiceLines),
}));

export const salesInvoiceLinesRelations = relations(salesInvoiceLines, ({ one }) => ({
  invoice: one(salesInvoices, {
    fields: [salesInvoiceLines.invoiceId],
    references: [salesInvoices.invoiceId],
  }),
  salesOrderLine: one(salesOrderLineItems, {
    fields: [salesInvoiceLines.salesOrderLineId],
    references: [salesOrderLineItems.salesOrderLineId],
  }),
  product: one(products, {
    fields: [salesInvoiceLines.productId],
    references: [products.productId],
  }),
}));

