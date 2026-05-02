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
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastError: text('last_error'),
});

export const accounts = modbmCore.table('accounts', {
  accountId: uuid('account_id').primaryKey(),
  accountNumber: text('account_number').notNull(),
  name: text('name').notNull(),
  currencyCode: text('currency_code').notNull(),
  externalId: text('external_id'),
});

export const suppliers = modbmCore.table('suppliers', {
  vendorId: uuid('vendor_id').primaryKey(),
  externalId: text('external_id'),
});


