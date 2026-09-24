import { relations } from 'drizzle-orm';
import { pdfTemplates, pdfTemplateHooks, users, userSettings } from './system.schema';
import { organizations } from './crm.schema';

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
