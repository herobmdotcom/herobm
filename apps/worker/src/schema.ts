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
