import {
  text,
  integer,
  numeric,
  timestamp,
  date,
  uuid,
  jsonb,
  boolean,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { herobmCore, validCurrencyCheck } from './core.schema';

// ---------------------------------------------------------------------------
// payment_entries  (Cash flow records)
// ---------------------------------------------------------------------------
export const paymentEntries = herobmCore.table('payment_entries', {
  paymentId: uuid('payment_id').primaryKey().defaultRandom(),
  paymentNumber: text('payment_number').unique().notNull(),
  paymentType: text('payment_type', {
    enum: [
      'customer_receipt',
      'supplier_payment',
      'customer_refund',
      'supplier_refund',
      'direct_receipt',
      'direct_payment',
    ],
  }).notNull(),
  partyId: uuid('party_id'), // Optional for multi-line split payments
  paymentDate: timestamp('payment_date', { withTimezone: true }).notNull(),
  modeOfPayment: text('mode_of_payment').notNull(), // 'Cash', 'Wire', 'Credit Card'
  totalAmount: numeric('total_amount').notNull(),
  unallocatedAmount: numeric('unallocated_amount').notNull(),
  glAccountBank: uuid('gl_account_bank')
    .notNull()
    .references(() => glAccounts.glAccountId),
  referenceNumber: text('reference_number'),
  stateCode: text('state_code').notNull(),
  baseTotalAmount: numeric('base_total_amount'),
  baseUnallocatedAmount: numeric('base_unallocated_amount'),
  currencyCode: text('currency_code').notNull(),
  exchangeRate: numeric('exchange_rate').notNull(),
  createdBy: text('created_by'),
  abaExportedAt: timestamp('aba_exported_at', { withTimezone: true }),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// payment_lines  (Multi-line splits for cash flow)
// ---------------------------------------------------------------------------
export const paymentLines = herobmCore.table('payment_lines', {
  paymentLineId: uuid('payment_line_id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => paymentEntries.paymentId),
  glAccountId: uuid('gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  amount: numeric('amount').notNull(),
  memo: text('memo'),
});

// ---------------------------------------------------------------------------
// payment_allocations  (Linking cash to subledgers)
// ---------------------------------------------------------------------------
export const paymentAllocations = herobmCore.table('payment_allocations', {
  allocationId: uuid('allocation_id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => paymentEntries.paymentId),
  referenceType: text('reference_type').notNull(), // 'sales_invoice' | 'purchase_invoice'
  referenceId: uuid('reference_id').notNull(),
  allocatedAmount: numeric('allocated_amount').notNull(),
  discountAmount: numeric('discount_amount'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// cost_centers  (Financial dimensions for expense allocation)
// ---------------------------------------------------------------------------
export const costCenters = herobmCore.table('cost_centers', {
  costCenterId: uuid('cost_center_id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(), // e.g. "00"
  name: text('name').notNull(),
  isSystem: boolean('is_system').notNull(),
  isActive: boolean('is_active').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// activities  (Financial dimensions for expense allocation)
// ---------------------------------------------------------------------------
export const activities = herobmCore.table('activities', {
  activityId: uuid('activity_id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(), // e.g. "00"
  name: text('name').notNull(),
  isSystem: boolean('is_system').notNull(),
  isActive: boolean('is_active').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

// ===========================================================================
// GENERAL LEDGER (Native Double-Entry Accounting)
// ===========================================================================

// ---------------------------------------------------------------------------
// gl_accounts  (Chart of Accounts — hierarchical, customisable)
// ---------------------------------------------------------------------------
export const glAccounts = herobmCore.table(
  'gl_accounts',
  {
    glAccountId: uuid('gl_account_id').primaryKey().defaultRandom(),
    accountCode: text('account_code').unique().notNull(),
    name: text('name').notNull(),
    accountType: text('account_type', {
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    }).notNull(),
    parentAccountId: uuid('parent_account_id'), // self-ref for hierarchy
    isGroup: boolean('is_group').notNull(),
    isSystem: boolean('is_system').notNull(), // prevents deletion
    isBankAccount: boolean('is_bank_account').notNull(), // determines if it appears in payment/recon modules
    currencyCode: text('currency_code').notNull(), // GL customers can have different currencies
    metadata: jsonb('metadata').$type<Record<string, unknown>>(), // stores bank numbers, BSBs, routing, SWIFT, etc.
    isActive: boolean('is_active').notNull(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('gl_accounts'),
  }),
);

// ---------------------------------------------------------------------------
// gl_journal_entries  (Journal Entry header — one per financial event)
// ---------------------------------------------------------------------------
export const glJournalEntries = herobmCore.table('gl_journal_entries', {
  journalEntryId: uuid('journal_entry_id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').unique().notNull(),
  entryDate: date('entry_date').notNull(),
  memo: text('memo'),
  sourceType: text('source_type').notNull(), // sales_invoice | purchase_invoice | sales_credit_note | purchase_debit_note | manual | adjustment
  sourceId: uuid('source_id'), // FK to originating document (nullable for manual)
  isReversed: boolean('is_reversed').notNull(),
  reversedBy: uuid('reversed_by'), // self-ref to reversing JE
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// gl_reconciliations (Bank Reconciliation header)
// ---------------------------------------------------------------------------
export const glReconciliations = herobmCore.table('gl_reconciliations', {
  reconciliationId: uuid('reconciliation_id').primaryKey().defaultRandom(),
  glAccountId: uuid('gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  statementDate: date('statement_date').notNull(),
  statementBalance: numeric('statement_balance').notNull(),
  status: text('status').notNull(), // 'draft' | 'posted'
  createdBy: text('created_by'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  postedOn: timestamp('posted_on', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// gl_journal_lines  (Debits and Credits — the core of double-entry)
// ---------------------------------------------------------------------------
export const glJournalLines = herobmCore.table('gl_journal_lines', {
  journalLineId: uuid('journal_line_id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id')
    .notNull()
    .references(() => glJournalEntries.journalEntryId),
  glAccountId: uuid('gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  partyType: text('party_type'), // 'customer' | 'supplier'
  partyId: text('party_id'), // generic reference to customers/suppliers
  debit: numeric('debit').notNull(), // Base Currency
  credit: numeric('credit').notNull(), // Base Currency
  foreignDebit: numeric('foreign_debit').notNull(),
  foreignCredit: numeric('foreign_credit').notNull(),
  foreignCurrencyCode: text('foreign_currency_code'),
  exchangeRate: numeric('exchange_rate'),
  memo: text('memo'),
  isReconciled: boolean('is_reconciled').notNull(),
  reconciliationId: uuid('reconciliation_id').references(
    () => glReconciliations.reconciliationId,
  ),
  costCenterId: uuid('cost_center_id').references(
    () => costCenters.costCenterId,
  ),
  activityId: uuid('activity_id').references(() => activities.activityId),
  matchGroupId: uuid('match_group_id'),
});

// ---------------------------------------------------------------------------
// gl_settings  (Singleton config — fiscal year + default account mappings)
// ---------------------------------------------------------------------------
export const glSettings = herobmCore.table('gl_settings', {
  settingsId: uuid('settings_id').primaryKey().defaultRandom(),
  accountMetadataSchema: jsonb('account_metadata_schema').$type<unknown[]>(),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull(), // Sourced from settings JSON
  bankMatchDateToleranceDays: integer(
    'bank_match_date_tolerance_days',
  ).notNull(),
  defaultArAccountId: uuid('default_ar_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultApAccountId: uuid('default_ap_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultRevenueAccountId: uuid('default_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultCogsAccountId: uuid('default_cogs_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultSalesTaxAccountId: uuid('default_sales_tax_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultPurchaseTaxAccountId: uuid('default_purchase_tax_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultExpenseAccountId: uuid('default_expense_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultInventoryAccountId: uuid('default_inventory_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultGrniAccountId: uuid('default_grni_account_id').references(
    () => glAccounts.glAccountId,
  ),
  realisedFxGainAccountId: uuid('realised_fx_gain_account_id').references(
    () => glAccounts.glAccountId,
  ),
  realisedFxLossAccountId: uuid('realised_fx_loss_account_id').references(
    () => glAccounts.glAccountId,
  ),
  unrealisedFxGainAccountId: uuid('unrealised_fx_gain_account_id').references(
    () => glAccounts.glAccountId,
  ),
  unrealisedFxLossAccountId: uuid('unrealised_fx_loss_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultShrinkageAccountId: uuid('default_shrinkage_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultPpvAccountId: uuid('default_ppv_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultCostCenterId: uuid('default_cost_center_id').references(
    () => costCenters.costCenterId,
  ),
  defaultActivityId: uuid('default_activity_id').references(
    () => activities.activityId,
  ),
  baseCurrency: text('base_currency').notNull(),
  supportedBatchPaymentFormats: jsonb('supported_batch_payment_formats').$type<
    string[]
  >(),
  revenueRoutingPrecedence: text('revenue_routing_precedence').notNull(), // 'product_first' | 'customer_first'
  expenseRoutingPrecedence: text('expense_routing_precedence').notNull(), // 'product_first' | 'supplier_first'
  defaultFeeRevenueAccountId: uuid('default_fee_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultDiscountsReceivedAccountId: uuid(
    'default_discounts_received_account_id',
  ).references(() => glAccounts.glAccountId),
  defaultDiscountsGivenAccountId: uuid(
    'default_discounts_given_account_id',
  ).references(() => glAccounts.glAccountId),
});

// ---------------------------------------------------------------------------
// financial_events  (Financial domain audit log)
// ---------------------------------------------------------------------------
export const financialEvents = herobmCore.table('financial_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// reconciliation_events  (Reconciliation audit log)
// ---------------------------------------------------------------------------
export const reconciliationEvents = herobmCore.table('reconciliation_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  entityDisplayName: text('entity_display_name'),
  payload: jsonb('payload'),
  actor: text('actor'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// csv_mapping_profiles (Saved column mappings for bank CSV imports)
// ---------------------------------------------------------------------------
export const csvMappingProfiles = herobmCore.table('csv_mapping_profiles', {
  profileId: uuid('profile_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  dateColumn: text('date_column').notNull(),
  amountColumn: text('amount_column'),
  debitColumn: text('debit_column'),
  creditColumn: text('credit_column'),
  descriptionColumn: text('description_column').notNull(),
  typeColumn: text('type_column'),
  payeeColumn: text('payee_column'),
  referenceColumn: text('reference_column'),
  headerRows: integer('header_rows').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// reconciliation_rules (Rules engine for auto-tagging bank statement lines)
// ---------------------------------------------------------------------------
export const reconciliationRules = herobmCore.table('reconciliation_rules', {
  ruleId: uuid('rule_id').primaryKey().defaultRandom(),
  glAccountIds: jsonb('gl_account_ids').$type<string[]>(), // Nullable/empty for global rules
  conditionType: text('condition_type'), // 'contains', 'starts_with', 'exact_match'
  conditionValue: text('condition_value'),
  typeCondition: text('type_condition'), // exact match case insensitive
  payeeConditionType: text('payee_condition_type'), // 'contains', 'starts_with', 'exact_match'
  payeeConditionValue: text('payee_condition_value'),
  amountMin: numeric('amount_min'),
  amountMax: numeric('amount_max'),
  targetGlAccountId: uuid('target_gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  costCenterId: uuid('cost_center_id').references(
    () => costCenters.costCenterId,
  ),
  activityId: uuid('activity_id').references(() => activities.activityId),
  partyType: text('party_type'), // 'customer' | 'supplier'
  partyId: text('party_id'),
  memo: text('memo'),
  priority: integer('priority').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// gl_match_groups (Metadata about bank statement matches)
// ---------------------------------------------------------------------------
export const glMatchGroups = herobmCore.table('gl_match_groups', {
  matchGroupId: uuid('match_group_id').primaryKey(),
  matchType: text('match_type').notNull(), // 'manual', 'rule', 'auto'
  ruleId: uuid('rule_id').references(() => reconciliationRules.ruleId),
  createdBy: text('created_by').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// bank_statement_lines (Staging queue for unmatched bank import rows)
// ---------------------------------------------------------------------------
export const bankStatementLines = herobmCore.table('bank_statement_lines', {
  lineId: uuid('line_id').primaryKey().defaultRandom(),
  glAccountId: uuid('gl_account_id')
    .notNull()
    .references(() => glAccounts.glAccountId),
  date: date('date').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount').notNull(),
  reference: text('reference'),
  type: text('type'),
  payee: text('payee'),
  isReconciled: boolean('is_reconciled').notNull(),
  reconciliationId: uuid('reconciliation_id').references(
    () => glReconciliations.reconciliationId,
  ),
  matchedJournalLineId: uuid('matched_journal_line_id').references(
    () => glJournalLines.journalLineId,
  ),
  matchGroupId: uuid('match_group_id'),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});
