import {
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  numeric,
} from 'drizzle-orm/pg-core';
import { herobmCore, validCurrencyCheck } from './core.schema';
import { users } from './system.schema';
import { glAccounts, costCenters, activities } from './gl.schema';
import { taxPositions } from './tax.schema';
import {
  ActorState,
  ContactState,
  OpportunityState,
  CustomerState,
  SupplierState,
  CrmActivityType,
  CrmActivityStatus,
  CrmActivityPriority,
} from '@herobm/shared';

// ---------------------------------------------------------------------------
// actors (CRM Core: Central Business Entity)
// ---------------------------------------------------------------------------
export const actors = herobmCore.table('actors', {
  actorId: uuid('actor_id').primaryKey().defaultRandom(),
  stateCode: text('state_code')
    .$type<ActorState>()
    .notNull(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => users.userId),
  legalStatus: text('legal_status'),
  headquartersAddressLine1: text('headquarters_address_line1'),
  headquartersAddressLine2: text('headquarters_address_line2'),
  headquartersCity: text('headquarters_city'),
  headquartersStateOrProvince: text('headquarters_state_or_province'),
  headquartersPostalCode: text('headquarters_postal_code'),
  headquartersCountry: text('headquarters_country'),
  website: text('website'),
  industry: text('industry'),
  telephone: text('telephone'),
  fax: text('fax'),
  email: text('email'),
  businessNumber: text('business_number'),
  isTaxRegistered: boolean('is_tax_registered').notNull(),
  referralMode: text('referral_mode'),
  referredByActorId: uuid('referred_by_actor_id').references(
    (): any => actors.actorId,
  ), // Self-reference
  referredByContactId: uuid('referred_by_contact_id').references(
    (): any => contacts.contactId,
  ), // Reference to contacts
  referralNote: text('referral_note'),
  tags: text('tags').array(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const contacts = herobmCore.table('contacts', {
  contactId: uuid('contact_id').primaryKey().defaultRandom(),
  stateCode: text('state_code')
    .$type<ContactState>()
    .notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'),
  jobTitle: text('job_title'),
  email: text('email'),
  phone: text('phone'),
  mobile: text('mobile'),
  linkedinProfile: text('linkedin_profile'),
  referredByActorId: uuid('referred_by_actor_id').references(
    (): any => actors.actorId,
  ),
  referredByContactId: uuid('referred_by_contact_id').references(
    (): any => contacts.contactId,
  ), // Self-reference
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const actorContactLinks = herobmCore.table('actor_contact_links', {
  linkId: uuid('link_id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => actors.actorId),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.contactId),
  linkType: text('link_type', {
    enum: ['employee', 'advisor', 'board_member'],
  }).notNull(),
  primaryFor: text('primary_for').array(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const actorActorLinks = herobmCore.table('actor_actor_links', {
  linkId: uuid('link_id').primaryKey().defaultRandom(),
  sourceActorId: uuid('source_actor_id')
    .notNull()
    .references(() => actors.actorId),
  targetActorId: uuid('target_actor_id')
    .notNull()
    .references(() => actors.actorId),
  linkType: text('link_type', {
    enum: ['parent_company', 'subsidiary', 'partner', 'referrer'],
  }).notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const opportunities = herobmCore.table('opportunities', {
  opportunityId: uuid('opportunity_id').primaryKey().defaultRandom(),
  stateCode: text('state_code')
    .$type<OpportunityState>()
    .notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  type: text('type').notNull(),
  estimatedValue: numeric('estimated_value'),
  currencyCode: text('currency_code'),
  targetCloseDate: timestamp('target_close_date', { withTimezone: true }),
  probability: integer('probability'),
  actualValue: numeric('actual_value'),
  description: text('description'),
  ownerId: uuid('owner_id').references(() => users.userId),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const opportunityNotes = herobmCore.table('opportunity_notes', {
  noteId: uuid('note_id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.opportunityId),
  content: text('content').notNull(),
  createdById: uuid('created_by_id').references(() => users.userId),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const opportunityActors = herobmCore.table('opportunity_actors', {
  opportunityActorId: uuid('opportunity_actor_id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.opportunityId),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => actors.actorId),
  roles: text('roles').array(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const opportunityContacts = herobmCore.table('opportunity_contacts', {
  opportunityContactId: uuid('opportunity_contact_id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.opportunityId),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.contactId),
  roles: text('roles').array(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const actorNotes = herobmCore.table('actor_notes', {
  noteId: uuid('note_id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => actors.actorId),
  content: text('content').notNull(),
  createdById: uuid('created_by_id').references(() => users.userId),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

export const tradingTerms = herobmCore.table('trading_terms', {
  tradingTermsId: uuid('trading_terms_id').primaryKey().defaultRandom(),
  sourceId: text('source_id'),
  source: text('source'),
  code: text('code').unique().notNull(), // e.g., 'NET30', 'COD', 'EOM'
  description: text('description').notNull(),
  days: integer('days').notNull(), // Number of days allowed
  type: text('type').notNull(), // 'net' | 'end_of_month' | 'cash_on_delivery'
  isActive: boolean('is_active').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const customerGroups = herobmCore.table('customer_groups', {
  customerGroupId: uuid('customer_group_id').primaryKey().defaultRandom(),
  groupCode: text('group_code').unique().notNull(),
  name: text('name').notNull(),
  stateCode: text('state_code').$type<CustomerState>().notNull(),
  defaultArAccountId: uuid('default_ar_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultRevenueAccountId: uuid('default_revenue_account_id').references(
    () => glAccounts.glAccountId,
  ),
  tradingTermsId: uuid('trading_terms_id').references(
    () => tradingTerms.tradingTermsId,
  ),
  defaultCostCenterId: uuid('default_cost_center_id').references(
    () => costCenters.costCenterId,
  ),
  defaultActivityId: uuid('default_activity_id').references(
    () => activities.activityId,
  ),
  earlyPaymentDiscount: numeric('early_payment_discount'),
  earlyPaymentDiscountDays: integer('early_payment_discount_days'),
  creditLimit: numeric('credit_limit'), // 0 = cash only/no limit policy
  isOnCreditHold: boolean('is_on_credit_hold').notNull(),
  taxPositionId: uuid('tax_position_id').references(
    () => taxPositions.taxPositionId,
  ),
});

export const supplierGroups = herobmCore.table('supplier_groups', {
  supplierGroupId: uuid('supplier_group_id').primaryKey().defaultRandom(),
  groupCode: text('group_code').unique().notNull(),
  name: text('name').notNull(),
  defaultApAccountId: uuid('default_ap_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultExpenseAccountId: uuid('default_expense_account_id').references(
    () => glAccounts.glAccountId,
  ),
  defaultCostCenterId: uuid('default_cost_center_id').references(
    () => costCenters.costCenterId,
  ),
  defaultActivityId: uuid('default_activity_id').references(
    () => activities.activityId,
  ),
  tradingTermsId: uuid('trading_terms_id').references(
    () => tradingTerms.tradingTermsId,
  ),
  taxPositionId: uuid('tax_position_id').references(
    () => taxPositions.taxPositionId,
  ),
  earlyPaymentDiscount: numeric('early_payment_discount'),
  earlyPaymentDiscountDays: integer('early_payment_discount_days'),
  creditLimit: numeric('credit_limit'),
  isPurchasingBlocked: boolean('is_purchasing_blocked').notNull(),
  purchasingBlockReason: text('purchasing_block_reason', {
    enum: [
      'compliance_breach',
      'quality_issues',
      'dispute',
      'financial_risk',
      'other',
    ],
  }),
  isPaymentBlocked: boolean('is_payment_blocked').notNull(),
  paymentBlockReason: text('payment_block_reason', {
    enum: ['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'],
  }),
  blockNotes: text('block_notes'),
});

export const suppliers = herobmCore.table(
  'suppliers',
  {
    vendorId: uuid('vendor_id').primaryKey().defaultRandom(),
    vendorNumber: text('vendor_number').unique().notNull(),
    supplierGroupId: uuid('supplier_group_id').references(
      () => supplierGroups.supplierGroupId,
    ),
    actorId: uuid('actor_id').references(() => actors.actorId),
    tradingTermsId: uuid('trading_terms_id').references(
      () => tradingTerms.tradingTermsId,
    ),
    earlyPaymentDiscount: numeric('early_payment_discount'),
    earlyPaymentDiscountDays: integer('early_payment_discount_days'),
    creditLimit: numeric('credit_limit'),
    isPurchasingBlocked: boolean('is_purchasing_blocked').notNull(),
    purchasingBlockReason: text('purchasing_block_reason', {
      enum: [
        'compliance_breach',
        'quality_issues',
        'dispute',
        'financial_risk',
        'other',
      ],
    }),
    isPaymentBlocked: boolean('is_payment_blocked'),
    paymentBlockReason: text('payment_block_reason', {
      enum: ['invoice_dispute', 'missing_goods', 'contractual_breach', 'other'],
    }),
    blockNotes: text('block_notes'),
    currencyCode: text('currency_code').notNull(),
    stateCode: text('state_code').$type<SupplierState>().notNull(),
    externalId: text('external_id'),
    notes: text('notes'),
    bankAccountName: text('bank_account_name'),
    bankBsb: text('bank_bsb'),
    bankAccountNumber: text('bank_account_number'),
    taxPositionId: uuid('tax_position_id').references(
      () => taxPositions.taxPositionId,
    ),
    sourceId: text('source_id').unique(),
    source: text('source').notNull(),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('suppliers'),
  }),
);

export const customers = herobmCore.table(
  'customers',
  {
    customerId: uuid('customer_id').primaryKey().defaultRandom(),
    customerNumber: text('customer_number').unique().notNull(),
    customerGroupId: uuid('customer_group_id').references(
      () => customerGroups.customerGroupId,
    ),
    actorId: uuid('actor_id').references(() => actors.actorId),
    stateCode: text('state_code').$type<CustomerState>().notNull(),
    taxPositionId: uuid('tax_position_id').references(
      () => taxPositions.taxPositionId,
    ),
    currencyCode: text('currency_code').notNull(),
    tradingTermsId: uuid('trading_terms_id').references(
      () => tradingTerms.tradingTermsId,
    ),
    earlyPaymentDiscount: numeric('early_payment_discount'),
    earlyPaymentDiscountDays: integer('early_payment_discount_days'),
    creditLimit: numeric('credit_limit'), // Nullable. Overrides group if NOT NULL.
    isOnCreditHold: boolean('is_on_credit_hold'), // Manual override per account
    overrideCreditHoldUntil: timestamp('override_credit_hold_until', {
      withTimezone: true,
    }),
    bankAccountName: text('bank_account_name'),
    bankBsb: text('bank_bsb'),
    bankAccountNumber: text('bank_account_number'),

    externalId: text('external_id'),
    sourceId: text('source_id').unique(),
    source: text('source').notNull(),
    priceTier: text('price_tier'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('customers'),
  }),
);

export const customerDeliveryAddresses = herobmCore.table(
  'customer_delivery_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.customerId),
    addressName: text('address_name'),
    companyName: text('company_name'),
    recipientName: text('recipient_name'),
    recipientPhone: text('recipient_phone'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    stateOrProvince: text('state_or_province'),
    postalCode: text('postal_code'),
    country: text('country'),
    isPrimary: boolean('is_primary').notNull(),
    sourceId: text('source_id'),
    source: text('source').notNull(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
);

// ---------------------------------------------------------------------------
// crmActivities (Human Interactions & Follow-up Tasks)
// ---------------------------------------------------------------------------
export const crmActivities = herobmCore.table('crm_activities', {
  activityId: uuid('activity_id').primaryKey().defaultRandom(),
  type: text('type').$type<CrmActivityType>().notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  status: text('status').$type<CrmActivityStatus>().notNull(),
  priority: text('priority').$type<CrmActivityPriority>().notNull(),
  actorId: uuid('actor_id').references(() => actors.actorId),
  opportunityId: uuid('opportunity_id').references(() => opportunities.opportunityId),
  dueDate: timestamp('due_date', { withTimezone: true }),
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.userId),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedByUserId: uuid('completed_by_user_id').references(() => users.userId),
  createdBy: text('created_by').notNull(),
  createdById: uuid('created_by_id').references(() => users.userId),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});

export const crmActivityContacts = herobmCore.table('crm_activity_contacts', {
  activityContactId: uuid('activity_contact_id').primaryKey().defaultRandom(),
  activityId: uuid('activity_id')
    .notNull()
    .references(() => crmActivities.activityId, { onDelete: 'cascade' }),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.contactId, { onDelete: 'cascade' }),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
});

