import {
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uuid,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { herobmCore } from './core.schema';

import { locations } from './inventory.schema';
import { taxPositions, taxCategories } from './tax.schema';
import { tradingTerms } from './index';

export const outbox = herobmCore.table('outbox', {
  outboxId: uuid('outbox_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastError: text('last_error'),
});

export const emailStatusEnum = herobmCore.enum('email_status', [
  'pending',
  'sending',
  'sent',
  'failed',
  'dismissed',
]);

export const emailOutbox = herobmCore.table('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  toAddress: text('to_address').notNull(),
  replyTo: text('reply_to'),
  subject: text('subject').notNull(),
  htmlBody: text('html_body').notNull(),
  attachments:
    jsonb('attachments').$type<
      { filename: string; contentType: string; content?: string }[]
    >(),
  status: emailStatusEnum('status').notNull(),
  retries: integer('retries').notNull(),
  lastError: text('last_error'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const macros = herobmCore.table('macros', {
  macroId: uuid('macro_id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  macroType: text('macro_type').notNull(),
  content: text('content').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const userSettings = herobmCore.table('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  dashboardConfig: jsonb('dashboard_config').$type<Record<string, unknown>>(),
  reportConfigs: jsonb('report_configs').$type<Record<string, unknown>>(),
  preferences: jsonb('preferences').$type<Record<string, unknown>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userEvents = herobmCore.table('user_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const organization = herobmCore.table('organization', {
  organizationId: uuid('organization_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  postCode: text('post_code'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  companyNumber: text('company_number'),
  taxNumber: text('tax_number'),
  logoUrl: text('logo_url'),
  bankName: text('bank_name'),
  bankAccountName: text('bank_account_name'),
  bankAccountNumber: text('bank_account_number'),
  bankSwiftBic: text('bank_swift_bic'),
  bankIban: text('bank_iban'),
});

export const appSettings = herobmCore.table('app_settings', {
  settingsId: uuid('settings_id').primaryKey().defaultRandom(),
  defaultFulfillmentLocationId: uuid(
    'default_fulfillment_location_id',
  ).references(() => locations.locationId),
  defaultCustomerTermsId: uuid('default_customer_terms_id').references(
    () => tradingTerms.tradingTermsId,
  ),
  defaultSupplierTermsId: uuid('default_supplier_terms_id').references(
    () => tradingTerms.tradingTermsId,
  ),
  defaultCustomerTaxPositionId: uuid(
    'default_customer_tax_position_id',
  ).references(() => taxPositions.taxPositionId),
  defaultSupplierTaxPositionId: uuid(
    'default_supplier_tax_position_id',
  ).references(() => taxPositions.taxPositionId),
  defaultPurchaseTaxCategoryId: uuid(
    'default_purchase_tax_category_id',
  ).references(() => taxCategories.taxCategoryId),
  defaultSalesTaxCategoryId: uuid('default_sales_tax_category_id').references(
    () => taxCategories.taxCategoryId,
  ),
  inventoryValuationMethod: text('inventory_valuation_method').notNull(), // 'weighted_average' | 'fifo' | 'standard'
  inventoryAccountingMode: text('inventory_accounting_mode').notNull(), // 'periodic' | 'perpetual'
  creditLimitBehavior: text('credit_limit_behavior').notNull(), // 'hard' (block creation) | 'soft' (allow draft, block dispatch)
  smtpHost: text('smtp_host'),
  smtpPort: integer('smtp_port'),
  smtpUser: text('smtp_user'),
  smtpPassEncrypted: text('smtp_pass_encrypted'),
  smtpFromAddress: text('smtp_from_address'),
  actorTags: jsonb('actor_tags').$type<{ value: string; order: number }[]>(),
  actorContactRoles: jsonb('actor_contact_roles').$type<
    { value: string; order: number }[]
  >(),
  projectContactRoles: jsonb('project_contact_roles').$type<
    { value: string; order: number }[]
  >(),
  projectActorRoles: jsonb('project_actor_roles').$type<
    { value: string; order: number }[]
  >(),
  projectStatuses:
    jsonb('project_statuses').$type<{ value: string; order: number }[]>(),
  projectTypes:
    jsonb('project_types').$type<{ value: string; order: number }[]>(),
  referralModes:
    jsonb('referral_modes').$type<{ value: string; order: number }[]>(),
  apiRateLimit: numeric('api_rate_limit').notNull(),
  setupCompletedAt: timestamp('setup_completed_at', { withTimezone: true }),
  systemIdentifier: text('system_identifier'), // UUID generated on first boot for hardware locking
  activeLicenseKey: text('active_license_key'), // The raw JWT
  activeLicensePayload: jsonb('active_license_payload'), // Decoded payload cache
  taxProviderMappings: jsonb('tax_provider_mappings').$type<
    Record<string, string>
  >(),
  enrichmentProviderMappings: jsonb('enrichment_provider_mappings').$type<
    Record<string, Record<string, string>>
  >(),
});

export const pdfTemplates = herobmCore.table('pdf_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  template: text('template').notNull(),
  mockData: jsonb('mock_data').$type<Record<string, unknown>>(),
  contextResolver: text('context_resolver'),
  outputNamePattern: text('output_name_pattern'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pdfTemplateHooks = herobmCore.table('pdf_template_hooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  hookSlug: text('hook_slug').notNull().unique(),
  reportId: uuid('report_id')
    .references(() => pdfTemplates.id, { onDelete: 'cascade' })
    .notNull(),
  contextSlug: text('context_slug').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pdfTemplateContexts = herobmCore.table(
  'pdf_template_contexts',
  {
    templateId: uuid('template_id')
      .references(() => pdfTemplates.id, { onDelete: 'cascade' })
      .notNull(),
    context: text('context').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.templateId, t.context] }),
  }),
);

export const businessReports = herobmCore.table('business_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  dataSourceHook: text('data_source_hook').notNull(),
  uiConfig: jsonb('ui_config').$type<Record<string, unknown>>().notNull(),
  isSystem: boolean('is_system').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const warehouseEvents = herobmCore.table('warehouse_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const masterDataEvents = herobmCore.table('master_data_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const inventoryEvents = herobmCore.table('inventory_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const systemEvents = herobmCore.table('system_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const businessReportEvents = herobmCore.table('business_report_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const emailEvents = herobmCore.table('email_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const integrationEvents = herobmCore.table('integration_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const groupEvents = herobmCore.table('group_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const dashboardTimeline = herobmCore
  .view('dashboard_timeline', {
    eventId: uuid('event_id'),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    eventType: text('event_type'),
    entityDisplayName: text('entity_display_name'),
    payload: jsonb('payload'),
    actor: text('actor'),
    createdOn: timestamp('created_on', { withTimezone: true }),
  })
  .existing();

export const apiKeys = herobmCore.table('api_keys', {
  apiKeyId: uuid('api_key_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  prefix: text('prefix').notNull(),
  role: text('role').notNull(),
  isActive: boolean('is_active').notNull(),
  createdBy: text('created_by').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const webhooks = herobmCore.table('webhooks', {
  webhookId: uuid('webhook_id').primaryKey().defaultRandom(),
  targetUrl: text('target_url').notNull(),
  eventTypes: jsonb('event_types').notNull(),
  secretKey: text('secret_key').notNull(),
  isActive: boolean('is_active').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const casbinRule = herobmCore.table('casbin_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  ptype: text('ptype').notNull(),
  v0: text('v0'),
  v1: text('v1'),
  v2: text('v2'),
  v3: text('v3'),
  v4: text('v4'),
  v5: text('v5'),
});

export const integrations = herobmCore.table('integrations', {
  integrationId: uuid('integration_id').primaryKey().defaultRandom(),
  provider: text('provider').unique().notNull(),
  config: jsonb('config').notNull(),
  isActive: boolean('is_active').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const pipelineJobs = herobmCore.table('_pipeline_jobs', {
  jobId: text('job_id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  progressJson: jsonb('progress_json'),
  logsJson: jsonb('logs_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = herobmCore.table('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  email: text('email'),
  role: text('role').notNull(), // admin | sales | warehouse | procurement
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
