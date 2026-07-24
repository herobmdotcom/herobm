"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const drizzle_module_1 = require("../../../../apps/api/src/drizzle/drizzle.module");
const schema_1 = require("../db/schema");
const herobm_core_schema_1 = require("../../../../apps/api/src/drizzle/herobm-core-schema");
const emit_event_1 = require("../../../../apps/api/src/common/emit-event");
const event_types_1 = require("../../../../apps/api/src/common/event-types");
let MaService = class MaService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getFeedback(projectId) {
        const feedbackList = await this.db.query.extMaProjectFeedback.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.extMaProjectFeedback.projectId, projectId),
            with: {
                actor: true,
            },
            orderBy: (fb, { desc }) => [desc(fb.createdOn)],
        });
        return feedbackList;
    }
    async addFeedback(projectId, dto) {
        const [newFeedback] = await this.db
            .insert(schema_1.extMaProjectFeedback)
            .values({
            projectId,
            actorId: dto.actorId,
            dealProposalReason: dto.dealProposalReason,
            dealRefusalReason: dto.dealRefusalReason,
            snapshotName: dto.snapshotName,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
        })
            .returning();
        await (0, emit_event_1.emitEvent)(this.db, {
            entityType: event_types_1.EntityType.PROJECT,
            entityId: projectId,
            eventType: event_types_1.EventType.UPDATED,
            entityDisplayName: 'Project',
            payload: {
                action: 'feedback_added',
                projectId,
                feedbackId: newFeedback.feedbackId,
            },
            actor: 'system',
        });
        await this.touchProject(projectId);
        return this.getFeedbackById(newFeedback.feedbackId);
    }
    async updateFeedback(projectId, feedbackId, dto) {
        const [updated] = await this.db
            .update(schema_1.extMaProjectFeedback)
            .set({
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
            modifiedOn: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.extMaProjectFeedback.projectId, projectId), (0, drizzle_orm_1.eq)(schema_1.extMaProjectFeedback.feedbackId, feedbackId)))
            .returning();
        if (!updated) {
            throw new common_1.NotFoundException('Feedback not found');
        }
        await (0, emit_event_1.emitEvent)(this.db, {
            entityType: event_types_1.EntityType.PROJECT,
            entityId: projectId,
            eventType: event_types_1.EventType.UPDATED,
            entityDisplayName: 'Project',
            payload: { action: 'feedback_updated', projectId, feedbackId },
            actor: 'system',
        });
        await this.touchProject(projectId);
        return this.getFeedbackById(feedbackId);
    }
    async getFeedbackById(feedbackId) {
        const fb = await this.db.query.extMaProjectFeedback.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.extMaProjectFeedback.feedbackId, feedbackId),
            with: { actor: true },
        });
        return fb;
    }
    async touchProject(projectId) {
        await this.db
            .update(herobm_core_schema_1.projects)
            .set({ modifiedOn: new Date() })
            .where((0, drizzle_orm_1.eq)(herobm_core_schema_1.projects.projectId, projectId));
    }
    async getSellerQualifications(actorId) {
        const list = await this.db.query.extMaSellerQualifications.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.extMaSellerQualifications.actorId, actorId),
            orderBy: (q, { desc }) => [desc(q.createdOn)],
        });
        return list;
    }
    async addSellerQualification(actorId, dto) {
        const [newQual] = await this.db.insert(schema_1.extMaSellerQualifications).values({
            actorId,
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
        }).returning();
        await this.emitActorUpdate(actorId, 'seller_qualification_added', newQual.qualificationId);
        return newQual;
    }
    async updateSellerQualification(actorId, qualificationId, dto) {
        const [updated] = await this.db.update(schema_1.extMaSellerQualifications).set({
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
            modifiedOn: new Date(),
        }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.extMaSellerQualifications.actorId, actorId), (0, drizzle_orm_1.eq)(schema_1.extMaSellerQualifications.qualificationId, qualificationId))).returning();
        if (!updated)
            throw new common_1.NotFoundException('Seller Qualification not found');
        await this.emitActorUpdate(actorId, 'seller_qualification_updated', qualificationId);
        return updated;
    }
    async getBuyerQualifications(actorId) {
        const list = await this.db.query.extMaBuyerQualifications.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.extMaBuyerQualifications.actorId, actorId),
            orderBy: (q, { desc }) => [desc(q.createdOn)],
        });
        return list;
    }
    async addBuyerQualification(actorId, dto) {
        const [newQual] = await this.db.insert(schema_1.extMaBuyerQualifications).values({
            actorId,
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
        }).returning();
        await this.emitActorUpdate(actorId, 'buyer_qualification_added', newQual.qualificationId);
        return newQual;
    }
    async updateBuyerQualification(actorId, qualificationId, dto) {
        const [updated] = await this.db.update(schema_1.extMaBuyerQualifications).set({
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
            modifiedOn: new Date(),
        }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.extMaBuyerQualifications.actorId, actorId), (0, drizzle_orm_1.eq)(schema_1.extMaBuyerQualifications.qualificationId, qualificationId))).returning();
        if (!updated)
            throw new common_1.NotFoundException('Buyer Qualification not found');
        await this.emitActorUpdate(actorId, 'buyer_qualification_updated', qualificationId);
        return updated;
    }
    async getStrategicIntelligence(actorId) {
        const list = await this.db.query.extMaStrategicIntelligence.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.extMaStrategicIntelligence.actorId, actorId),
            orderBy: (q, { desc }) => [desc(q.createdOn)],
        });
        return list;
    }
    async addStrategicIntelligence(actorId, dto) {
        const [newIntel] = await this.db.insert(schema_1.extMaStrategicIntelligence).values({
            actorId,
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
        }).returning();
        await this.emitActorUpdate(actorId, 'strategic_intelligence_added', newIntel.intelligenceId);
        return newIntel;
    }
    async updateStrategicIntelligence(actorId, intelligenceId, dto) {
        const [updated] = await this.db.update(schema_1.extMaStrategicIntelligence).set({
            ...dto,
            asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
            modifiedOn: new Date(),
        }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.extMaStrategicIntelligence.actorId, actorId), (0, drizzle_orm_1.eq)(schema_1.extMaStrategicIntelligence.intelligenceId, intelligenceId))).returning();
        if (!updated)
            throw new common_1.NotFoundException('Strategic Intelligence not found');
        await this.emitActorUpdate(actorId, 'strategic_intelligence_updated', intelligenceId);
        return updated;
    }
    async emitActorUpdate(actorId, action, itemId) {
        await (0, emit_event_1.emitEvent)(this.db, {
            entityType: event_types_1.EntityType.ACTOR,
            entityId: actorId,
            eventType: event_types_1.EventType.UPDATED,
            entityDisplayName: 'Actor',
            payload: { action, actorId, itemId },
            actor: 'system',
        });
        await this.touchActor(actorId);
    }
    async touchActor(actorId) {
        await this.db
            .update(herobm_core_schema_1.actors)
            .set({ modifiedOn: new Date() })
            .where((0, drizzle_orm_1.eq)(herobm_core_schema_1.actors.actorId, actorId));
    }
};
exports.MaService = MaService;
exports.MaService = MaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(drizzle_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], MaService);
//# sourceMappingURL=ma.service.js.map