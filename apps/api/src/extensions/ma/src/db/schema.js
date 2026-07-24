"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extMaStrategicIntelligenceRelations = exports.extMaBuyerQualificationsRelations = exports.extMaSellerQualificationsRelations = exports.extMaProjectFeedbackRelations = exports.extMaProjectFeedback = exports.extMaStrategicIntelligence = exports.extMaBuyerQualifications = exports.extMaSellerQualifications = exports.extMaExtensions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const herobm_core_schema_1 = require("../../../../apps/api/src/drizzle/herobm-core-schema");
exports.extMaExtensions = (0, pg_core_1.pgSchema)('herobm_core');
exports.extMaSellerQualifications = exports.extMaExtensions.table('ext_ma_seller_qualifications', {
    qualificationId: (0, pg_core_1.uuid)('qualification_id').primaryKey().defaultRandom(),
    actorId: (0, pg_core_1.uuid)('actor_id')
        .notNull()
        .references(() => herobm_core_schema_1.actors.actorId),
    marketContext: (0, pg_core_1.text)('market_context'),
    competitiveEnvironment: (0, pg_core_1.text)('competitive_environment'),
    marketTrends: (0, pg_core_1.text)('market_trends'),
    addedValue: (0, pg_core_1.text)('added_value'),
    specificClients: (0, pg_core_1.text)('specific_clients'),
    businessModel: (0, pg_core_1.text)('business_model'),
    consolidationPerspectives: (0, pg_core_1.text)('consolidation_perspectives'),
    interestedBuyersExist: (0, pg_core_1.boolean)('interested_buyers_exist'),
    asOfDate: (0, pg_core_1.timestamp)('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: (0, pg_core_1.text)('snapshot_name'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
exports.extMaBuyerQualifications = exports.extMaExtensions.table('ext_ma_buyer_qualifications', {
    qualificationId: (0, pg_core_1.uuid)('qualification_id').primaryKey().defaultRandom(),
    actorId: (0, pg_core_1.uuid)('actor_id')
        .notNull()
        .references(() => herobm_core_schema_1.actors.actorId),
    buyerActivity: (0, pg_core_1.text)('buyer_activity'),
    businessModel: (0, pg_core_1.text)('business_model'),
    geography: (0, pg_core_1.text)('geography'),
    sizeCriteria: (0, pg_core_1.text)('size_criteria'),
    financialCapacity: (0, pg_core_1.text)('financial_capacity'),
    strategicFit: (0, pg_core_1.text)('strategic_fit'),
    asOfDate: (0, pg_core_1.timestamp)('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: (0, pg_core_1.text)('snapshot_name'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
exports.extMaStrategicIntelligence = exports.extMaExtensions.table('ext_ma_strategic_intelligence', {
    intelligenceId: (0, pg_core_1.uuid)('intelligence_id').primaryKey().defaultRandom(),
    actorId: (0, pg_core_1.uuid)('actor_id')
        .notNull()
        .references(() => herobm_core_schema_1.actors.actorId),
    managerIntent: (0, pg_core_1.text)('manager_intent'),
    sectorInterests: (0, pg_core_1.text)('sector_interests'),
    externalGrowthProjects: (0, pg_core_1.text)('external_growth_projects'),
    futureSaleIntent: (0, pg_core_1.text)('future_sale_intent'),
    timeline: (0, pg_core_1.text)('timeline'),
    strategicRationale: (0, pg_core_1.text)('strategic_rationale'),
    asOfDate: (0, pg_core_1.timestamp)('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: (0, pg_core_1.text)('snapshot_name'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
exports.extMaProjectFeedback = exports.extMaExtensions.table('ext_ma_project_feedback', {
    feedbackId: (0, pg_core_1.uuid)('feedback_id').primaryKey().defaultRandom(),
    projectId: (0, pg_core_1.uuid)('project_id')
        .notNull()
        .references(() => herobm_core_schema_1.projects.projectId),
    actorId: (0, pg_core_1.uuid)('actor_id')
        .notNull()
        .references(() => herobm_core_schema_1.actors.actorId),
    dealProposalReason: (0, pg_core_1.text)('deal_proposal_reason'),
    dealRefusalReason: (0, pg_core_1.text)('deal_refusal_reason'),
    asOfDate: (0, pg_core_1.timestamp)('as_of_date', { withTimezone: true }).defaultNow(),
    snapshotName: (0, pg_core_1.text)('snapshot_name'),
    createdOn: (0, pg_core_1.timestamp)('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: (0, pg_core_1.timestamp)('modified_on', { withTimezone: true }).defaultNow(),
});
exports.extMaProjectFeedbackRelations = (0, drizzle_orm_1.relations)(exports.extMaProjectFeedback, ({ one }) => ({
    actor: one(herobm_core_schema_1.actors, {
        fields: [exports.extMaProjectFeedback.actorId],
        references: [herobm_core_schema_1.actors.actorId],
    }),
    project: one(herobm_core_schema_1.projects, {
        fields: [exports.extMaProjectFeedback.projectId],
        references: [herobm_core_schema_1.projects.projectId],
    }),
}));
exports.extMaSellerQualificationsRelations = (0, drizzle_orm_1.relations)(exports.extMaSellerQualifications, ({ one }) => ({
    actor: one(herobm_core_schema_1.actors, {
        fields: [exports.extMaSellerQualifications.actorId],
        references: [herobm_core_schema_1.actors.actorId],
    }),
}));
exports.extMaBuyerQualificationsRelations = (0, drizzle_orm_1.relations)(exports.extMaBuyerQualifications, ({ one }) => ({
    actor: one(herobm_core_schema_1.actors, {
        fields: [exports.extMaBuyerQualifications.actorId],
        references: [herobm_core_schema_1.actors.actorId],
    }),
}));
exports.extMaStrategicIntelligenceRelations = (0, drizzle_orm_1.relations)(exports.extMaStrategicIntelligence, ({ one }) => ({
    actor: one(herobm_core_schema_1.actors, {
        fields: [exports.extMaStrategicIntelligence.actorId],
        references: [herobm_core_schema_1.actors.actorId],
    }),
}));
//# sourceMappingURL=schema.js.map