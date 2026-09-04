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
  organization,
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
  organization,
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
  actors,
  contacts,
  actorContactLinks,
  actorActorLinks,
  opportunities,
  opportunityNotes,
  opportunityActors,
  opportunityContacts,
  actorNotes,
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
  actors,
  contacts,
  actorContactLinks,
  actorActorLinks,
  opportunities,
  opportunityNotes,
  opportunityActors,
  opportunityContacts,
  crmActivities,
  crmActivityContacts,
  actorNotes,
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
  actor: one(actors, {
    fields: [customers.actorId],
    references: [actors.actorId],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  actor: one(actors, {
    fields: [suppliers.actorId],
    references: [actors.actorId],
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

export const actorsRelations = relations(actors, ({ one, many }) => ({
  actorContactLinks: many(actorContactLinks),
  sourceLinks: many(actorActorLinks, { relationName: 'sourceActor' }),
  targetLinks: many(actorActorLinks, { relationName: 'targetActor' }),
  opportunityActors: many(opportunityActors),
  notes: many(actorNotes),
  customers: many(customers),
  suppliers: many(suppliers),
  owner: one(users, {
    fields: [actors.ownerId],
    references: [users.userId],
  }),
  referredByActor: one(actors, {
    fields: [actors.referredByActorId],
    references: [actors.actorId],
    relationName: 'actorReferrals',
  }),
  referredByContact: one(contacts, {
    fields: [actors.referredByContactId],
    references: [contacts.contactId],
    relationName: 'contactReferrals',
  }),
}));

export const actorNotesRelations = relations(actorNotes, ({ one }) => ({
  actor: one(actors, {
    fields: [actorNotes.actorId],
    references: [actors.actorId],
  }),
  createdBy: one(users, {
    fields: [actorNotes.createdById],
    references: [users.userId],
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  actorContactLinks: many(actorContactLinks),
  opportunityContacts: many(opportunityContacts),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  owner: one(users, {
    fields: [opportunities.ownerId],
    references: [users.userId],
  }),
  notes: many(opportunityNotes),
  opportunityActors: many(opportunityActors),
  opportunityContacts: many(opportunityContacts),
  salesOrders: many(salesOrders),
}));
export const projectsRelations = opportunitiesRelations;

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.customerId],
  }),
  opportunity: one(opportunities, {
    fields: [salesOrders.opportunityId],
    references: [opportunities.opportunityId],
  }),
  project: one(opportunities, {
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
export const projectNotesRelations = opportunityNotesRelations;

export const actorContactLinksRelations = relations(
  actorContactLinks,
  ({ one }) => ({
    actor: one(actors, {
      fields: [actorContactLinks.actorId],
      references: [actors.actorId],
    }),
    contact: one(contacts, {
      fields: [actorContactLinks.contactId],
      references: [contacts.contactId],
    }),
  }),
);

export const actorActorLinksRelations = relations(
  actorActorLinks,
  ({ one }) => ({
    sourceActor: one(actors, {
      fields: [actorActorLinks.sourceActorId],
      references: [actors.actorId],
      relationName: 'sourceActor',
    }),
    targetActor: one(actors, {
      fields: [actorActorLinks.targetActorId],
      references: [actors.actorId],
      relationName: 'targetActor',
    }),
  }),
);

export const opportunityActorsRelations = relations(opportunityActors, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityActors.opportunityId],
    references: [opportunities.opportunityId],
  }),
  actor: one(actors, {
    fields: [opportunityActors.actorId],
    references: [actors.actorId],
  }),
}));
export const projectActorsRelations = opportunityActorsRelations;

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
export const projectContactsRelations = opportunityContactsRelations;

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
  ownedActors: many(actors),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.userId],
  }),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one, many }) => ({
  actor: one(actors, {
    fields: [crmActivities.actorId],
    references: [actors.actorId],
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


