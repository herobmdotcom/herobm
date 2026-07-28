import { pgSchema, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { actors, projects } from '@api/drizzle/schema/index';

export const extMaExtensions = pgSchema('herobm_core'); // Still deploying to the same physical Postgres schema, but conceptually separate.

export const extMaSellerQualifications = extMaExtensions.table(
  'ext_ma_seller_qualifications',
  {
    qualificationId: uuid('qualification_id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.actorId),
    marketContext: text('market_context'),
    competitiveEnvironment: text('competitive_environment'),
    marketTrends: text('market_trends'),
    addedValue: text('added_value'),
    specificClients: text('specific_clients'),
    businessModel: text('business_model'),
    consolidationPerspectives: text('consolidation_perspectives'),
    interestedBuyersExist: boolean('interested_buyers_exist'),
    asOfDate: timestamp('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: text('snapshot_name'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
);

export const extMaBuyerQualifications = extMaExtensions.table(
  'ext_ma_buyer_qualifications',
  {
    qualificationId: uuid('qualification_id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.actorId),
    buyerActivity: text('buyer_activity'),
    businessModel: text('business_model'),
    geography: text('geography'),
    sizeCriteria: text('size_criteria'),
    financialCapacity: text('financial_capacity'),
    strategicFit: text('strategic_fit'),
    asOfDate: timestamp('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: text('snapshot_name'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
);

export const extMaStrategicIntelligence = extMaExtensions.table(
  'ext_ma_strategic_intelligence',
  {
    intelligenceId: uuid('intelligence_id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.actorId),
    managerIntent: text('manager_intent'),
    sectorInterests: text('sector_interests'),
    externalGrowthProjects: text('external_growth_projects'),
    futureSaleIntent: text('future_sale_intent'),
    timeline: text('timeline'),
    strategicRationale: text('strategic_rationale'),
    asOfDate: timestamp('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: text('snapshot_name'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
);

export const extMaProjectFeedback = extMaExtensions.table(
  'ext_ma_project_feedback',
  {
    feedbackId: uuid('feedback_id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.projectId),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => actors.actorId),
    dealProposalReason: text('deal_proposal_reason'),
    dealRefusalReason: text('deal_refusal_reason'),
    asOfDate: timestamp('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: text('snapshot_name'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
);

export const extMaProjectFeedbackRelations = relations(
  extMaProjectFeedback,
  ({ one }) => ({
    actor: one(actors, {
      fields: [extMaProjectFeedback.actorId],
      references: [actors.actorId],
    }),
    project: one(projects, {
      fields: [extMaProjectFeedback.projectId],
      references: [projects.projectId],
    }),
  }),
);

export const extMaSellerQualificationsRelations = relations(
  extMaSellerQualifications,
  ({ one }) => ({
    actor: one(actors, {
      fields: [extMaSellerQualifications.actorId],
      references: [actors.actorId],
    }),
  }),
);

export const extMaBuyerQualificationsRelations = relations(
  extMaBuyerQualifications,
  ({ one }) => ({
    actor: one(actors, {
      fields: [extMaBuyerQualifications.actorId],
      references: [actors.actorId],
    }),
  }),
);

export const extMaStrategicIntelligenceRelations = relations(
  extMaStrategicIntelligence,
  ({ one }) => ({
    actor: one(actors, {
      fields: [extMaStrategicIntelligence.actorId],
      references: [actors.actorId],
    }),
  }),
);


