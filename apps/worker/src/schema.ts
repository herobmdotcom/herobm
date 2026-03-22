import { pgSchema, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const modbmCore = pgSchema('modbm_core');

export const outbox = modbmCore.table('outbox', {
  outboxId: uuid('outbox_id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  createdOn: timestamp('created_on', { withTimezone: true }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const accounts = modbmCore.table('accounts', {
  accountId: uuid('account_id').primaryKey(),
  erpnextId: text('erpnext_id'),
});

export const suppliers = modbmCore.table('suppliers', {
  vendorId: uuid('vendor_id').primaryKey(),
  erpnextId: text('erpnext_id'),
});

export const salesInvoices = modbmCore.table('sales_invoices', {
  invoiceId: uuid('invoice_id').primaryKey(),
  erpnextJournalId: text('erpnext_journal_id'),
});

export const purchaseInvoices = modbmCore.table('purchase_invoices', {
  invoiceId: uuid('invoice_id').primaryKey(),
  erpnextJournalId: text('erpnext_journal_id'),
});
