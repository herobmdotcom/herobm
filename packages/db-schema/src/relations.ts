import {
  pgSchema,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  jsonb,
  primaryKey,
  unique,
  uniqueIndex,
  index,
  check,
  pgEnum,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import {
  CURRENCIES,
  getValidStates,
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  PURCHASE_RETURN_TRANSITIONS,
  PURCHASE_RETURN_SHIPMENT_TRANSITIONS,
  PURCHASE_DEBIT_NOTE_TRANSITIONS,
  RETURN_TRANSITIONS,
  SALES_ORDER_PICK_TRANSITIONS,
  SalesOrderState,
  PurchaseOrderState,
  ShipmentState,
  PurchaseReturnState,
  PurchaseReturnShipmentState,
  PurchaseDebitNoteState,
  ReturnState,
  SalesOrderPickState,
  TransferOrderPickState,
  PaymentState,
  CustomerState,
  ProductState,
  SupplierState,
  ActorState,
  ContactState,
  ProjectState,
  SalesInvoiceState,
  GoodsReceivedState,
  CurrencyDef,
  SALES_ORDER_STATE,
  PURCHASE_ORDER_STATE,
  SHIPMENT_STATE,
  RETURN_STATE,
  SALES_ORDER_PICK_STATE,
  TRANSFER_ORDER_PICK_STATE,
  PRODUCT_STATE,
  SUPPLIER_STATE,
  CUSTOMER_STATE,
  MATCH_STATUS,
  PUTAWAY_STATUS,
  PURCHASE_INVOICE_STATE,
  SALES_INVOICE_STATE,
  SALES_CREDIT_NOTE_STATE,
  GOODS_RECEIVED_STATE,
  BACKORDER_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_SHIPMENT_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  PAYMENT_STATE,
  TRANSFER_ORDER_STATE,
  RECONCILIATION_STATE,
  PROJECT_STATE,
  ACTOR_STATE,
} from '@herobm/shared';

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
  projects,
  projectNotes,
  projectActors,
  projectContacts,
  actorNotes,
  tradingTerms,
  customerGroups,
  supplierGroups,
  suppliers,
  customers,
  customerDeliveryAddresses,
} from './crm.schema';

export {
  actors,
  contacts,
  actorContactLinks,
  actorActorLinks,
  projects,
  projectNotes,
  projectActors,
  projectContacts,
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
  projectActors: many(projectActors),
  notes: many(actorNotes),
  customers: many(customers),
  referredByActor: one(actors, {
    fields: [actors.referredByActorId],
    references: [actors.actorId],
    relationName: 'actorReferrals',
  }),
  referredByContact: one(contacts, {
    fields: [actors.referredByContactId],
    references: [contacts.contactId],
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
  projectContacts: many(projectContacts),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.userId],
  }),
  notes: many(projectNotes),
  projectActors: many(projectActors),
  projectContacts: many(projectContacts),
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

export const projectActorsRelations = relations(projectActors, ({ one }) => ({
  project: one(projects, {
    fields: [projectActors.projectId],
    references: [projects.projectId],
  }),
  actor: one(actors, {
    fields: [projectActors.actorId],
    references: [actors.actorId],
  }),
}));

export const projectContactsRelations = relations(
  projectContacts,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectContacts.projectId],
      references: [projects.projectId],
    }),
    contact: one(contacts, {
      fields: [projectContacts.contactId],
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

export const usersRelations = relations(users, ({ one }) => ({
  settings: one(userSettings, {
    fields: [users.userId],
    references: [userSettings.userId],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.userId],
  }),
}));

