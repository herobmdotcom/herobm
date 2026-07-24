import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
// Use dynamic import path mapping or relative paths to core components
import { DRIZZLE } from '../../../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../../../drizzle/drizzle.module';
import {
  extMaProjectFeedback,
  extMaSellerQualifications,
  extMaBuyerQualifications,
  extMaStrategicIntelligence,
} from '../db/schema';
import { projects, actors } from '../../../../drizzle/herobm-core-schema';
import {
  CreateProjectFeedbackDto,
  UpdateProjectFeedbackDto,
  ProjectFeedbackResponseDto,
  CreateSellerQualificationDto,
  UpdateSellerQualificationDto,
  SellerQualificationResponseDto,
  CreateBuyerQualificationDto,
  UpdateBuyerQualificationDto,
  BuyerQualificationResponseDto,
  CreateStrategicIntelligenceDto,
  UpdateStrategicIntelligenceDto,
  StrategicIntelligenceResponseDto,
} from './dto';
import { emitEvent } from '../../../../common/emit-event';
import { EntityType, EventType } from '../../../../common/event-types';

@Injectable()
export class MaService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getFeedback(projectId: string): Promise<ProjectFeedbackResponseDto[]> {
    const feedbackList = await this.db.query.extMaProjectFeedback.findMany({
      where: eq(extMaProjectFeedback.projectId, projectId),
      with: {
        actor: true,
      },
      orderBy: (fb: any, { desc }: any) => [desc(fb.createdOn)],
    });
    return feedbackList as unknown as ProjectFeedbackResponseDto[];
  }

  async addFeedback(
    projectId: string,
    dto: CreateProjectFeedbackDto,
  ): Promise<ProjectFeedbackResponseDto> {
    const [newFeedback] = await this.db
      .insert(extMaProjectFeedback)
      .values({
        projectId,
        actorId: dto.actorId,
        dealProposalReason: dto.dealProposalReason,
        dealRefusalReason: dto.dealRefusalReason,
        snapshotName: dto.snapshotName,
        asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT as any,
      entityId: projectId,
      eventType: EventType.UPDATED as any,
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

  async updateFeedback(
    projectId: string,
    feedbackId: string,
    dto: UpdateProjectFeedbackDto,
  ): Promise<ProjectFeedbackResponseDto> {
    const [updated] = await this.db
      .update(extMaProjectFeedback)
      .set({
        ...dto,
        asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
        modifiedOn: new Date(),
      })
      .where(
        and(
          eq(extMaProjectFeedback.projectId, projectId),
          eq(extMaProjectFeedback.feedbackId, feedbackId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('Feedback not found');
    }

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT as any,
      entityId: projectId,
      eventType: EventType.UPDATED as any,
      entityDisplayName: 'Project',
      payload: { action: 'feedback_updated', projectId, feedbackId },
      actor: 'system',
    });

    await this.touchProject(projectId);

    return this.getFeedbackById(feedbackId);
  }

  private async getFeedbackById(
    feedbackId: string,
  ): Promise<ProjectFeedbackResponseDto> {
    const fb = await this.db.query.extMaProjectFeedback.findFirst({
      where: eq(extMaProjectFeedback.feedbackId, feedbackId),
      with: { actor: true },
    });
    return fb as unknown as ProjectFeedbackResponseDto;
  }

  private async touchProject(projectId: string) {
    await this.db
      .update(projects)
      .set({ modifiedOn: new Date() })
      .where(eq(projects.projectId, projectId));
  }

  // --- Seller Qualifications ---
  async getSellerQualifications(actorId: string): Promise<SellerQualificationResponseDto[]> {
    const list = await this.db.query.extMaSellerQualifications.findMany({
      where: eq(extMaSellerQualifications.actorId, actorId),
      orderBy: (q: any, { desc }: any) => [desc(q.createdOn)],
    });
    return list as unknown as SellerQualificationResponseDto[];
  }

  async addSellerQualification(actorId: string, dto: CreateSellerQualificationDto): Promise<SellerQualificationResponseDto> {
    const [newQual] = await this.db.insert(extMaSellerQualifications).values({
      actorId,
      ...dto,
      asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
    }).returning();

    await this.emitActorUpdate(actorId, 'seller_qualification_added', newQual.qualificationId);
    return newQual as unknown as SellerQualificationResponseDto;
  }

  async updateSellerQualification(actorId: string, qualificationId: string, dto: UpdateSellerQualificationDto): Promise<SellerQualificationResponseDto> {
    const [updated] = await this.db.update(extMaSellerQualifications).set({
      ...dto,
      asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
      modifiedOn: new Date(),
    }).where(and(eq(extMaSellerQualifications.actorId, actorId), eq(extMaSellerQualifications.qualificationId, qualificationId))).returning();
    if (!updated) throw new NotFoundException('Seller Qualification not found');
    await this.emitActorUpdate(actorId, 'seller_qualification_updated', qualificationId);
    return updated as unknown as SellerQualificationResponseDto;
  }

  // --- Buyer Qualifications ---
  async getBuyerQualifications(actorId: string): Promise<BuyerQualificationResponseDto[]> {
    const list = await this.db.query.extMaBuyerQualifications.findMany({
      where: eq(extMaBuyerQualifications.actorId, actorId),
      orderBy: (q: any, { desc }: any) => [desc(q.createdOn)],
    });
    return list as unknown as BuyerQualificationResponseDto[];
  }

  async addBuyerQualification(actorId: string, dto: CreateBuyerQualificationDto): Promise<BuyerQualificationResponseDto> {
    const [newQual] = await this.db.insert(extMaBuyerQualifications).values({
      actorId,
      ...dto,
      asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
    }).returning();
    await this.emitActorUpdate(actorId, 'buyer_qualification_added', newQual.qualificationId);
    return newQual as unknown as BuyerQualificationResponseDto;
  }

  async updateBuyerQualification(actorId: string, qualificationId: string, dto: UpdateBuyerQualificationDto): Promise<BuyerQualificationResponseDto> {
    const [updated] = await this.db.update(extMaBuyerQualifications).set({
      ...dto,
      asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
      modifiedOn: new Date(),
    }).where(and(eq(extMaBuyerQualifications.actorId, actorId), eq(extMaBuyerQualifications.qualificationId, qualificationId))).returning();
    if (!updated) throw new NotFoundException('Buyer Qualification not found');
    await this.emitActorUpdate(actorId, 'buyer_qualification_updated', qualificationId);
    return updated as unknown as BuyerQualificationResponseDto;
  }

  // --- Strategic Intelligence ---
  async getStrategicIntelligence(actorId: string): Promise<StrategicIntelligenceResponseDto[]> {
    const list = await this.db.query.extMaStrategicIntelligence.findMany({
      where: eq(extMaStrategicIntelligence.actorId, actorId),
      orderBy: (q: any, { desc }: any) => [desc(q.createdOn)],
    });
    return list as unknown as StrategicIntelligenceResponseDto[];
  }

  async addStrategicIntelligence(actorId: string, dto: CreateStrategicIntelligenceDto): Promise<StrategicIntelligenceResponseDto> {
    const [newIntel] = await this.db.insert(extMaStrategicIntelligence).values({
      actorId,
      ...dto,
      asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
    }).returning();
    await this.emitActorUpdate(actorId, 'strategic_intelligence_added', newIntel.intelligenceId);
    return newIntel as unknown as StrategicIntelligenceResponseDto;
  }

  async updateStrategicIntelligence(actorId: string, intelligenceId: string, dto: UpdateStrategicIntelligenceDto): Promise<StrategicIntelligenceResponseDto> {
    const [updated] = await this.db.update(extMaStrategicIntelligence).set({
      ...dto,
      asOfDate: dto.asOfDate ? new Date(dto.asOfDate) : undefined,
      modifiedOn: new Date(),
    }).where(and(eq(extMaStrategicIntelligence.actorId, actorId), eq(extMaStrategicIntelligence.intelligenceId, intelligenceId))).returning();
    if (!updated) throw new NotFoundException('Strategic Intelligence not found');
    await this.emitActorUpdate(actorId, 'strategic_intelligence_updated', intelligenceId);
    return updated as unknown as StrategicIntelligenceResponseDto;
  }

  private async emitActorUpdate(actorId: string, action: string, itemId: string) {
    await emitEvent(this.db, {
      entityType: EntityType.ACTOR as any,
      entityId: actorId,
      eventType: EventType.UPDATED as any,
      entityDisplayName: 'Actor',
      payload: { action, actorId, itemId },
      actor: 'system',
    });
    await this.touchActor(actorId);
  }

  private async touchActor(actorId: string) {
    await this.db
      .update(actors)
      .set({ modifiedOn: new Date() })
      .where(eq(actors.actorId, actorId));
  }
}


