import { relations } from 'drizzle-orm';

import {
  paymentEntries,
  paymentLines,
  paymentAllocations,
  costCenters,
  activities,
  glAccounts,
  glJournalEntries,
  glReconciliations,
  glJournalLines,
  glSettings,
  financialEvents,
  reconciliationEvents,
  csvMappingProfiles,
  reconciliationRules,
  glMatchGroups,
  bankStatementLines,
} from './gl.schema';

import {
  outbox,
  emailStatusEnum,
  emailOutbox,
  macros,
  userSettings,
  userEvents,
  tenantSettings,
  appSettings,
  pdfTemplates,
  pdfTemplateHooks,
  pdfTemplateContexts,
  businessReports,
  warehouseEvents,
  masterDataEvents,
  inventoryEvents,
  systemEvents,
  businessReportEvents,
  emailEvents,
  integrationEvents,
  groupEvents,
  dashboardTimeline,
  apiKeys,
  webhooks,
  casbinRule,
  integrations,
  pipelineJobs,
  users,
} from './system.schema';

export {
  paymentEntries,
  paymentLines,
  paymentAllocations,
  costCenters,
  activities,
  glAccounts,
  glJournalEntries,
  glReconciliations,
  glJournalLines,
  glSettings,
  financialEvents,
  reconciliationEvents,
  csvMappingProfiles,
  reconciliationRules,
  glMatchGroups,
  bankStatementLines,
};

export {
  outbox,
  emailStatusEnum,
  emailOutbox,
  macros,
  userSettings,
  userEvents,
  tenantSettings,
  appSettings,
  pdfTemplates,
  pdfTemplateHooks,
  pdfTemplateContexts,
  businessReports,
  warehouseEvents,
  masterDataEvents,
  inventoryEvents,
  systemEvents,
  businessReportEvents,
  emailEvents,
  integrationEvents,
  groupEvents,
  dashboardTimeline,
  apiKeys,
  webhooks,
  casbinRule,
  integrations,
  pipelineJobs,
  users,
};

import { herobmCore, validCurrencyCheck } from './core.schema';

import { taxCategories, taxPositions, taxPositionMappings } from './tax.schema';

export { taxCategories, taxPositions, taxPositionMappings };

import { exchangeRates } from './currency.schema';
export { exchangeRates };

import {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderReturns,
  salesOrderReturnLines,
  salesCreditNotes,
  salesCreditNoteLines,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesEvents,
  backorders,
  salesInvoices,
  salesInvoiceLines,
} from './sales.schema';
export {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderReturns,
  salesOrderReturnLines,
  salesCreditNotes,
  salesCreditNoteLines,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesEvents,
  backorders,
  salesInvoices,
  salesInvoiceLines,
};

import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseOrderReturnShipmentLines,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseInvoiceReceipts,
  goodsReceived,
  goodsReceivedLines,
  supplierExpiries,
  procurementEvents,
} from './purchasing.schema';

export {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseOrderReturnShipmentLines,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseInvoiceReceipts,
  goodsReceived,
  goodsReceivedLines,
  supplierExpiries,
  procurementEvents,
};

import {
  locations,
  zones,
  binTypeEnum,
  bins,
  inventoryEntries,
  inventoryLedger,
  binContents,
  productDefaultBins,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  inventoryLevels,
} from './inventory.schema';

export {
  locations,
  zones,
  binTypeEnum,
  bins,
  inventoryEntries,
  inventoryLedger,
  binContents,
  productDefaultBins,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  inventoryLevels,
};

// ---------------------------------------------------------------------------
// trading_terms  (Dictionary of standard payment cycles)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// product_groups  (Administrative grouping and GL routing)
import {
  productGroups,
  discountMatrix,
  productTypeEnum,
  productStructureEnum,
  uomDictionary,
  products,
  fractionalBehaviorEnum,
  productComponents,
  productUoms,
  productSuppliers,
} from './products.schema';

export {
  productGroups,
  discountMatrix,
  productTypeEnum,
  productStructureEnum,
  uomDictionary,
  products,
  fractionalBehaviorEnum,
  productComponents,
  productUoms,
  productSuppliers,
};

import {
  organizations,
  contacts,
  organizationContactLinks,
  organizationOrganizationLinks,
  opportunities,
  opportunityNotes,
  opportunityOrganizations,
  opportunityContacts,
  organizationNotes,
  tradingTerms,
  customerGroups,
  supplierGroups,
  suppliers,
  customers,
  customerDeliveryAddresses,
  crmActivities,
  crmActivityContacts,
} from './crm.schema';

export {
  organizations,
  contacts,
  organizationContactLinks,
  organizationOrganizationLinks,
  opportunities,
  opportunityNotes,
  opportunityOrganizations,
  opportunityContacts,
  crmActivities,
  crmActivityContacts,
  organizationNotes,
  tradingTerms,
  customerGroups,
  supplierGroups,
  suppliers,
  customers,
  customerDeliveryAddresses,
};

export const pdfTemplatesRelations = relations(pdfTemplates, ({ many }) => ({
  hooks: many(pdfTemplateHooks),
}));

export const pdfTemplateHooksRelations = relations(
  pdfTemplateHooks,
  ({ one }) => ({
    template: one(pdfTemplates, {
      fields: [pdfTemplateHooks.reportId],
      references: [pdfTemplates.id],
    }),
  }),
);

export const customersRelations = relations(customers, ({ many, one }) => ({
  deliveryAddresses: many(customerDeliveryAddresses),
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.organizationId],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  organization: one(organizations, {
    fields: [suppliers.organizationId],
    references: [organizations.organizationId],
  }),
}));

export const customerDeliveryAddressesRelations = relations(
  customerDeliveryAddresses,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerDeliveryAddresses.customerId],
      references: [customers.customerId],
    }),
  }),
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  organizationContactLinks: many(organizationContactLinks),
  sourceLinks: many(organizationOrganizationLinks, { relationName: 'sourceOrganization' }),
  targetLinks: many(organizationOrganizationLinks, { relationName: 'targetOrganization' }),
  opportunityOrganizations: many(opportunityOrganizations),
  notes: many(organizationNotes),
  customers: many(customers),
  suppliers: many(suppliers),
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.userId],
  }),
  referredByOrganization: one(organizations, {
    fields: [organizations.referredByOrganizationId],
    references: [organizations.organizationId],
    relationName: 'organizationReferrals',
  }),
  referredOrganizations: many(organizations, {
    relationName: 'organizationReferrals',
  }),
  referredByContact: one(contacts, {
    fields: [organizations.referredByContactId],
    references: [contacts.contactId],
    relationName: 'contactReferrals',
  }),
}));

export const organizationNotesRelations = relations(organizationNotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationNotes.organizationId],
    references: [organizations.organizationId],
  }),
  createdBy: one(users, {
    fields: [organizationNotes.createdById],
    references: [users.userId],
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  organizationContactLinks: many(organizationContactLinks),
  opportunityContacts: many(opportunityContacts),
  referredOrganizations: many(organizations, {
    relationName: 'contactReferrals',
  }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  owner: one(users, {
    fields: [opportunities.ownerId],
    references: [users.userId],
  }),
  notes: many(opportunityNotes),
  opportunityOrganizations: many(opportunityOrganizations),
  opportunityContacts: many(opportunityContacts),
  salesOrders: many(salesOrders),
}));

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

export const opportunityNotesRelations = relations(opportunityNotes, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityNotes.opportunityId],
    references: [opportunities.opportunityId],
  }),
  createdBy: one(users, {
    fields: [opportunityNotes.createdById],
    references: [users.userId],
  }),
}));

export const organizationContactLinksRelations = relations(
  organizationContactLinks,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationContactLinks.organizationId],
      references: [organizations.organizationId],
    }),
    contact: one(contacts, {
      fields: [organizationContactLinks.contactId],
      references: [contacts.contactId],
    }),
  }),
);

export const organizationOrganizationLinksRelations = relations(
  organizationOrganizationLinks,
  ({ one }) => ({
    sourceOrganization: one(organizations, {
      fields: [organizationOrganizationLinks.sourceOrganizationId],
      references: [organizations.organizationId],
      relationName: 'sourceOrganization',
    }),
    targetOrganization: one(organizations, {
      fields: [organizationOrganizationLinks.targetOrganizationId],
      references: [organizations.organizationId],
      relationName: 'targetOrganization',
    }),
  }),
);

export const opportunityOrganizationsRelations = relations(opportunityOrganizations, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityOrganizations.opportunityId],
    references: [opportunities.opportunityId],
  }),
  organization: one(organizations, {
    fields: [opportunityOrganizations.organizationId],
    references: [organizations.organizationId],
  }),
}));

export const opportunityContactsRelations = relations(
  opportunityContacts,
  ({ one }) => ({
    opportunity: one(opportunities, {
      fields: [opportunityContacts.opportunityId],
      references: [opportunities.opportunityId],
    }),
    contact: one(contacts, {
      fields: [opportunityContacts.contactId],
      references: [contacts.contactId],
    }),
  }),
);

import {
  workOrders,
  workOrderComponents,
  workOrderPicks,
} from './manufacturing.schema';

export { workOrders, workOrderComponents, workOrderPicks };

export const workOrdersRelations = relations(workOrders, ({ many, one }) => ({
  components: many(workOrderComponents),
  picks: many(workOrderPicks),
  product: one(products, {
    fields: [workOrders.productId],
    references: [products.productId],
  }),
  location: one(locations, {
    fields: [workOrders.locationId],
    references: [locations.locationId],
  }),
  wipBin: one(bins, {
    fields: [workOrders.wipBinId],
    references: [bins.binId],
  }),
  outputBin: one(bins, {
    fields: [workOrders.outputBinId],
    references: [bins.binId],
  }),
}));

export const workOrderComponentsRelations = relations(
  workOrderComponents,
  ({ one, many }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderComponents.workOrderId],
      references: [workOrders.workOrderId],
    }),
    product: one(products, {
      fields: [workOrderComponents.productId],
      references: [products.productId],
    }),
    picks: many(workOrderPicks),
  }),
);

export const workOrderPicksRelations = relations(
  workOrderPicks,
  ({ one }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderPicks.workOrderId],
      references: [workOrders.workOrderId],
    }),
    component: one(workOrderComponents, {
      fields: [workOrderPicks.workOrderComponentId],
      references: [workOrderComponents.workOrderComponentId],
    }),
    bin: one(bins, {
      fields: [workOrderPicks.binId],
      references: [bins.binId],
    }),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [users.userId],
    references: [userSettings.userId],
  }),
  ownedOrganizations: many(organizations),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.userId],
  }),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [crmActivities.organizationId],
    references: [organizations.organizationId],
  }),
  activityContacts: many(crmActivityContacts),
  opportunity: one(opportunities, {
    fields: [crmActivities.opportunityId],
    references: [opportunities.opportunityId],
  }),
  assignedToUser: one(users, {
    fields: [crmActivities.assignedToUserId],
    references: [users.userId],
    relationName: 'assignedActivities',
  }),
  completedByUser: one(users, {
    fields: [crmActivities.completedByUserId],
    references: [users.userId],
    relationName: 'completedActivities',
  }),
  createdByUser: one(users, {
    fields: [crmActivities.createdById],
    references: [users.userId],
    relationName: 'createdActivities',
  }),
}));

export const crmActivityContactsRelations = relations(crmActivityContacts, ({ one }) => ({
  activity: one(crmActivities, {
    fields: [crmActivityContacts.activityId],
    references: [crmActivities.activityId],
  }),
  contact: one(contacts, {
    fields: [crmActivityContacts.contactId],
    references: [contacts.contactId],
  }),
}));


