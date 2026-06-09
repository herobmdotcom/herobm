import { pgSchema, uuid, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

export const modbmCore = pgSchema('modbm_core');

export const outbox = modbmCore.table('outbox', {
  outboxId: uuid('outbox_id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
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
  businessNumber: text('business_number'),
  isTaxRegistered: boolean('is_tax_registered').notNull().default(false),
});

export const suppliers = modbmCore.table('suppliers', {
  vendorId: uuid('vendor_id').primaryKey(),
  externalId: text('external_id'),
  businessNumber: text('business_number'),
  isTaxRegistered: boolean('is_tax_registered').notNull().default(false),
});

export const webhooks = modbmCore.table('webhooks', {
  webhookId: uuid('webhook_id').primaryKey(),
  targetUrl: text('target_url').notNull(),
  eventTypes: jsonb('event_types').notNull(),
  secretKey: text('secret_key').notNull(),
  isActive: boolean('is_active').notNull(),
});

export const systemEvents = modbmCore.table('system_events', {
  eventId: uuid('event_id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }),
});

export const emailStatusEnum = modbmCore.enum('email_status', ['pending', 'sending', 'sent', 'failed', 'dismissed']);

export const emailOutbox = modbmCore.table('email_outbox', {
  id: uuid('id').primaryKey(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  toAddress: text('to_address').notNull(),
  replyTo: text('reply_to'),
  subject: text('subject').notNull(),
  htmlBody: text('html_body').notNull(),
  attachments: jsonb('attachments'),
  status: emailStatusEnum('status').notNull(),
  retries: text('retries'), // integer
  lastError: text('last_error'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const appSettings = modbmCore.table('app_settings', {
  settingsId: uuid('settings_id').primaryKey(),
  smtpHost: text('smtp_host'),
  smtpPort: text('smtp_port'), // integer
  smtpUser: text('smtp_user'),
  smtpPassEncrypted: text('smtp_pass_encrypted'),
  smtpFromAddress: text('smtp_from_address'),
});
