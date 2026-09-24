import { relations } from 'drizzle-orm';
import { users } from './system.schema';
import { salesOrders } from './sales.schema';
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
  suppliers,
  customers,
  customerDeliveryAddresses,
  crmActivities,
  crmActivityContacts,
} from './crm.schema';

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
