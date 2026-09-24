import { relations } from 'drizzle-orm';
import {
  projects,
  projectTasks,
  projectResources,
  projectResourceAssignments,
  projectBudgetLines,
  projectLedgerEntries,
  projectNotes,
} from './projects.schema';
import { customers, opportunities, suppliers, tradingTerms } from './crm.schema';
import { users } from './system.schema';
import { locations, bins, inventoryEntries, transferOrders, transferOrderLines } from './inventory.schema';
import { products } from './products.schema';
import { salesInvoiceLines } from './sales.schema';

export const projectsRelations = relations(projects, ({ one, many }) => ({
  customer: one(customers, {
    fields: [projects.customerId],
    references: [customers.customerId],
  }),
  tradingTerms: one(tradingTerms, {
    fields: [projects.tradingTermsId],
    references: [tradingTerms.tradingTermsId],
  }),
  opportunity: one(opportunities, {
    fields: [projects.opportunityId],
    references: [opportunities.opportunityId],
  }),
  projectManager: one(users, {
    fields: [projects.projectManagerId],
    references: [users.userId],
  }),
  stagingLocation: one(locations, {
    fields: [projects.stagingLocationId],
    references: [locations.locationId],
    relationName: 'projectStagingLocation',
  }),
  stagingBin: one(bins, {
    fields: [projects.stagingBinId],
    references: [bins.binId],
    relationName: 'projectStagingBin',
  }),
  tasks: many(projectTasks),
  budgetLines: many(projectBudgetLines),
  ledgerEntries: many(projectLedgerEntries),
  assignedResources: many(projectResourceAssignments),
  projectNotes: many(projectNotes),
  transferOrders: many(transferOrders),
}));

export const projectNotesRelations = relations(projectNotes, ({ one }) => ({
  project: one(projects, {
    fields: [projectNotes.projectId],
    references: [projects.projectId],
  }),
  createdBy: one(users, {
    fields: [projectNotes.createdById],
    references: [users.userId],
  }),
}));

export const projectTasksRelations = relations(projectTasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectTasks.projectId],
    references: [projects.projectId],
  }),
  parentTask: one(projectTasks, {
    fields: [projectTasks.parentTaskId],
    references: [projectTasks.projectTaskId],
    relationName: 'subTasks',
  }),
  subTasks: many(projectTasks, {
    relationName: 'subTasks',
  }),
  budgetLines: many(projectBudgetLines),
  ledgerEntries: many(projectLedgerEntries),
  transferOrders: many(transferOrders),
  transferOrderLines: many(transferOrderLines),
}));

export const projectResourcesRelations = relations(projectResources, ({ one, many }) => ({
  user: one(users, {
    fields: [projectResources.userId],
    references: [users.userId],
  }),
  vendor: one(suppliers, {
    fields: [projectResources.vendorId],
    references: [suppliers.vendorId],
  }),
  serviceProduct: one(products, {
    fields: [projectResources.serviceProductId],
    references: [products.productId],
  }),
  budgetLines: many(projectBudgetLines),
  ledgerEntries: many(projectLedgerEntries),
  assignments: many(projectResourceAssignments),
}));

export const projectResourceAssignmentsRelations = relations(
  projectResourceAssignments,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectResourceAssignments.projectId],
      references: [projects.projectId],
    }),
    resource: one(projectResources, {
      fields: [projectResourceAssignments.resourceId],
      references: [projectResources.resourceId],
    }),
  }),
);

export const projectBudgetLinesRelations = relations(projectBudgetLines, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectBudgetLines.projectId],
    references: [projects.projectId],
  }),
  task: one(projectTasks, {
    fields: [projectBudgetLines.projectTaskId],
    references: [projectTasks.projectTaskId],
  }),
  resource: one(projectResources, {
    fields: [projectBudgetLines.resourceId],
    references: [projectResources.resourceId],
  }),
  product: one(products, {
    fields: [projectBudgetLines.productId],
    references: [products.productId],
  }),
  ledgerEntries: many(projectLedgerEntries),
}));

export const projectLedgerEntriesRelations = relations(projectLedgerEntries, ({ one }) => ({
  project: one(projects, {
    fields: [projectLedgerEntries.projectId],
    references: [projects.projectId],
  }),
  task: one(projectTasks, {
    fields: [projectLedgerEntries.projectTaskId],
    references: [projectTasks.projectTaskId],
  }),
  resource: one(projectResources, {
    fields: [projectLedgerEntries.resourceId],
    references: [projectResources.resourceId],
  }),
  product: one(products, {
    fields: [projectLedgerEntries.productId],
    references: [products.productId],
  }),
  user: one(users, {
    fields: [projectLedgerEntries.userId],
    references: [users.userId],
  }),
  inventoryEntry: one(inventoryEntries, {
    fields: [projectLedgerEntries.inventoryEntryId],
    references: [inventoryEntries.entryId],
  }),
  budgetLine: one(projectBudgetLines, {
    fields: [projectLedgerEntries.budgetLineId],
    references: [projectBudgetLines.budgetLineId],
  }),
  salesInvoiceLine: one(salesInvoiceLines, {
    fields: [projectLedgerEntries.salesInvoiceLineId],
    references: [salesInvoiceLines.invoiceLineId],
  }),
}));

