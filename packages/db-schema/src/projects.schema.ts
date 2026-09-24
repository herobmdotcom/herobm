import {
  text,
  boolean,
  numeric,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import {
  ProjectState,
  ProjectTaskState,
  ProjectBillingType,
  ResourceType,
  ProjectLineType,
  ProjectLedgerEntryType,
  ProjectSourceType,
} from '@herobm/shared';
import { herobmCore, validCurrencyCheck } from './core.schema';
import { users } from './system.schema';
import { customers, opportunities, suppliers, tradingTerms } from './crm.schema';
import { products, uomDictionary } from './products.schema';
import { inventoryEntries, locations, bins } from './inventory.schema';

// ---------------------------------------------------------------------------
// projects  (Master record for operational service projects and jobs)
// ---------------------------------------------------------------------------
export const projects = herobmCore.table(
  'projects',
  {
    projectId: uuid('project_id').primaryKey().defaultRandom(),
    projectNumber: text('project_number').unique().notNull(), // e.g. PRJ-2026-0001
    name: text('name').notNull(),
    description: text('description'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.customerId),
    opportunityId: uuid('opportunity_id').references(
      () => opportunities.opportunityId,
    ),
    stateCode: text('state_code').$type<ProjectState>().notNull(),
    stage: text('stage'),
    billingType: text('billing_type').$type<ProjectBillingType>().notNull(),
    projectManagerId: uuid('project_manager_id').references(() => users.userId),
    currencyCode: text('currency_code').notNull(),
    stagingLocationId: uuid('staging_location_id').references(
      (): any => locations.locationId,
    ),
    stagingBinId: uuid('staging_bin_id').references((): any => bins.binId),
    startDate: timestamp('start_date', { withTimezone: true }),
    targetEndDate: timestamp('target_end_date', { withTimezone: true }),
    actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    discountPercentage: numeric('discount_percentage', { precision: 5, scale: 2 }),
    tradingTermsId: uuid('trading_terms_id').references(
      () => tradingTerms.tradingTermsId,
    ),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('projects'),
    customerIdx: index('idx_projects_customer_id').on(t.customerId),
    tradingTermsIdx: index('idx_projects_trading_terms_id').on(t.tradingTermsId),
    stateIdx: index('idx_projects_state_code').on(t.stateCode),
    pmIdx: index('idx_projects_pm_id').on(t.projectManagerId),
    stagingLocIdx: index('idx_projects_staging_location_id').on(
      t.stagingLocationId,
    ),
    stagingBinIdx: index('idx_projects_staging_bin_id').on(t.stagingBinId),
  }),
);

// ---------------------------------------------------------------------------
// project_tasks  (Hierarchical Work Breakdown Structure - WBS)
// ---------------------------------------------------------------------------
export const projectTasks = herobmCore.table(
  'project_tasks',
  {
    projectTaskId: uuid('project_task_id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.projectId),
    taskCode: text('task_code').notNull(), // e.g. "1.0", "1.1"
    name: text('name').notNull(),
    description: text('description'),
    parentTaskId: uuid('parent_task_id').references(
      (): any => projectTasks.projectTaskId,
    ),
    stateCode: text('state_code').$type<ProjectTaskState>().notNull(),
    isMilestone: boolean('is_milestone').notNull(),
    isBillable: boolean('is_billable').notNull(),
    plannedStartDate: timestamp('planned_start_date', { withTimezone: true }),
    plannedEndDate: timestamp('planned_end_date', { withTimezone: true }),
    actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
    actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_project_tasks_project_id').on(t.projectId),
    parentIdx: index('idx_project_tasks_parent_task_id').on(t.parentTaskId),
  }),
);

// ---------------------------------------------------------------------------
// project_resources  (Labor Profiles, Contractors, and Equipment)
// ---------------------------------------------------------------------------
export const projectResources = herobmCore.table(
  'project_resources',
  {
    resourceId: uuid('resource_id').primaryKey().defaultRandom(),
    resourceNumber: text('resource_number').unique().notNull(), // e.g. RES-0001
    name: text('name').notNull(),
    resourceType: text('resource_type').$type<ResourceType>().notNull(),
    userId: uuid('user_id').references(() => users.userId),
    vendorId: uuid('vendor_id').references(() => suppliers.vendorId),
    serviceProductId: uuid('service_product_id').references(
      () => products.productId,
    ),
    baseUom: text('base_uom')
      .notNull()
      .references(() => uomDictionary.uomCode),
    directUnitCost: numeric('direct_unit_cost', {
      precision: 12,
      scale: 2,
    }).notNull(),
    unitPrice: numeric('unit_price', {
      precision: 12,
      scale: 2,
    }).notNull(),
    isActive: boolean('is_active').notNull(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_project_resources_user_id').on(t.userId),
    vendorIdx: index('idx_project_resources_vendor_id').on(t.vendorId),
  }),
);

// ---------------------------------------------------------------------------
// project_budget_lines  (Planning & Budget Estimates)
// ---------------------------------------------------------------------------
export const projectBudgetLines = herobmCore.table(
  'project_budget_lines',
  {
    budgetLineId: uuid('budget_line_id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.projectId),
    projectTaskId: uuid('project_task_id')
      .notNull()
      .references(() => projectTasks.projectTaskId),
    lineType: text('line_type').$type<ProjectLineType>().notNull(),
    resourceId: uuid('resource_id').references(
      () => projectResources.resourceId,
    ),
    productId: uuid('product_id').references(() => products.productId),
    description: text('description'),
    plannedQuantity: numeric('planned_quantity').notNull(),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
    totalCost: numeric('total_cost', { precision: 12, scale: 2 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    discountPercentage: numeric('discount_percentage', { precision: 5, scale: 2 }),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_project_budget_lines_project_id').on(t.projectId),
    taskIdx: index('idx_project_budget_lines_task_id').on(t.projectTaskId),
  }),
);

// ---------------------------------------------------------------------------
// project_ledger_entries  (Immutable Single Source of Truth for Actual Costs & Usages)
// ---------------------------------------------------------------------------
export const projectLedgerEntries = herobmCore.table(
  'project_ledger_entries',
  {
    ledgerId: uuid('ledger_id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.projectId),
    projectTaskId: uuid('project_task_id')
      .notNull()
      .references(() => projectTasks.projectTaskId),
    entryType: text('entry_type').$type<ProjectLedgerEntryType>().notNull(), // usage, sale
    lineType: text('line_type').$type<ProjectLineType>().notNull(), // resource, item, expense
    sourceType: text('source_type').$type<ProjectSourceType>().notNull(), // timesheet, inventory_issue, purchase_invoice, manual_journal
    sourceId: uuid('source_id'),
    inventoryEntryId: uuid('inventory_entry_id').references(
      () => inventoryEntries.entryId,
    ),
    resourceId: uuid('resource_id').references(
      () => projectResources.resourceId,
    ),
    productId: uuid('product_id').references(() => products.productId),
    userId: uuid('user_id').references(() => users.userId),
    description: text('description'),
    quantity: numeric('quantity').notNull(),
    unitCostBase: numeric('unit_cost_base', {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalCostBase: numeric('total_cost_base', {
      precision: 12,
      scale: 2,
    }).notNull(),
    unitPriceBase: numeric('unit_price_base', {
      precision: 12,
      scale: 2,
    }).notNull(),
    discountPercentage: numeric('discount_percentage', { precision: 5, scale: 2 }),
    totalPriceBase: numeric('total_price_base', {
      precision: 12,
      scale: 2,
    }).notNull(),
    isBillable: boolean('is_billable').notNull(),
    isBilled: boolean('is_billed').notNull(),
    salesInvoiceLineId: uuid('sales_invoice_line_id'),
    budgetLineId: uuid('budget_line_id').references(
      () => projectBudgetLines.budgetLineId,
      { onDelete: 'set null' },
    ),
    postingDate: timestamp('posting_date', { withTimezone: true }).notNull(),
    createdBy: text('created_by').notNull(),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_project_ledger_entries_project_id').on(t.projectId),
    taskIdx: index('idx_project_ledger_entries_task_id').on(t.projectTaskId),
    sourceIdx: index('idx_project_ledger_entries_source').on(
      t.sourceType,
      t.sourceId,
    ),
    budgetLineIdx: index('idx_project_ledger_entries_budget_line_id').on(
      t.budgetLineId,
    ),
    dateIdx: index('idx_project_ledger_entries_posting_date').on(t.postingDate),
    userIdx: index('idx_project_ledger_entries_user_id').on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// project_notes (Internal chronological notes and audit entries for a project)
// ---------------------------------------------------------------------------
export const projectNotes = herobmCore.table(
  'project_notes',
  {
    noteId: uuid('note_id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.projectId, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdById: uuid('created_by_id').references(() => users.userId),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_project_notes_project_id').on(t.projectId),
    createdByIdx: index('idx_project_notes_created_by_id').on(t.createdById),
  }),
);

// ---------------------------------------------------------------------------
// project_resource_assignments (Project Staffing / Assigned Resources)
// ---------------------------------------------------------------------------
export const projectResourceAssignments = herobmCore.table(
  'project_resource_assignments',
  {
    assignmentId: uuid('assignment_id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.projectId, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => projectResources.resourceId, { onDelete: 'restrict' }),
    notes: text('notes'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by'),
  },
  (t) => ({
    projectIdx: index('idx_project_resource_assignments_project_id').on(t.projectId),
    resourceIdx: index('idx_project_resource_assignments_resource_id').on(t.resourceId),
    projectResourceUnq: uniqueIndex('unq_project_resource_assignments_project_resource').on(
      t.projectId,
      t.resourceId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// project_settings (Domain-specific settings & metadata schema)
// ---------------------------------------------------------------------------
export const projectSettings = herobmCore.table('project_settings', {
  settingsId: uuid('settings_id').primaryKey().defaultRandom(),
  projectMetadataSchema: jsonb('project_metadata_schema').$type<Record<string, unknown>>(),
  createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
  modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
});


