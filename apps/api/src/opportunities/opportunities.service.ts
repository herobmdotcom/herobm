import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { desc, eq, ne, sql, and, or, asc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  opportunities,
  opportunityNotes,
  opportunityContacts,
  opportunityActors,
  actors,
  contacts,
  users,
  salesOrders,
  salesOrderLineItems,
  masterDataEvents,
} from '@herobm/db-schema';

import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityResponseDto,
  CreateOpportunityNoteDto,
  OpportunityNoteResponseDto,
  CreateOpportunityContactDto,
  UpdateOpportunityContactDto,
  CreateOpportunityActorDto,
  UpdateOpportunityActorDto,
  OpportunityQueryDto,
} from './dto';
import {
  PaginationQuery,
  withCursorPagination,
  PaginatedResponse,
  parsePagination,
} from '../common/pagination';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { OPPORTUNITY_STATE } from '@herobm/shared';

@Injectable()
export class OpportunitiesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createOpportunity(
    dto: CreateOpportunityDto,
    userId: string,
  ): Promise<OpportunityResponseDto> {
    const [newOpportunity] = await this.db
      .insert(opportunities)
      .values({
        stateCode: OPPORTUNITY_STATE.ACTIVE,
        name: dto.name,
        type: dto.type,
        status: dto.status || 'open',
        ownerId: dto.ownerId,
        estimatedValue: dto.estimatedValue,
        currencyCode: dto.currencyCode,
        targetCloseDate: dto.targetCloseDate
          ? new Date(dto.targetCloseDate)
          : null,
        probability: dto.probability,
        actualValue: dto.actualValue,
        description: dto.description,
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: newOpportunity.opportunityId,
      eventType: EventType.CREATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_created',
        opportunityId: newOpportunity.opportunityId,
        opportunityName: newOpportunity.name,
      },
      actor: userId,
    });

    return this.mapResponse(newOpportunity);
  }

  async updateOpportunity(
    id: string,
    dto: UpdateOpportunityDto,
    userId: string,
  ): Promise<OpportunityResponseDto> {
    const updateValues: Record<string, unknown> = {
      modifiedOn: new Date(),
    };
    if (dto.name !== undefined) updateValues.name = dto.name;
    if (dto.type !== undefined) updateValues.type = dto.type;
    if (dto.status !== undefined) updateValues.status = dto.status;
    if (dto.ownerId !== undefined) updateValues.ownerId = dto.ownerId;
    if (dto.estimatedValue !== undefined)
      updateValues.estimatedValue = dto.estimatedValue;
    if (dto.currencyCode !== undefined)
      updateValues.currencyCode = dto.currencyCode;
    if (dto.targetCloseDate !== undefined)
      updateValues.targetCloseDate = dto.targetCloseDate
        ? new Date(dto.targetCloseDate)
        : null;
    if (dto.probability !== undefined)
      updateValues.probability = dto.probability;
    if (dto.actualValue !== undefined)
      updateValues.actualValue = dto.actualValue;
    if (dto.description !== undefined)
      updateValues.description = dto.description;

    const [updatedOpportunity] = await this.db
      .update(opportunities)
      .set(updateValues)
      .where(eq(opportunities.opportunityId, id))
      .returning();

    if (!updatedOpportunity) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: updatedOpportunity.opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_updated',
        opportunityId: updatedOpportunity.opportunityId,
        opportunityName: updatedOpportunity.name,
      },
      actor: userId,
    });

    return this.mapResponse(updatedOpportunity);
  }

  async archiveOpportunity(
    id: string,
    userId: string,
  ): Promise<OpportunityResponseDto> {
    const [updatedOpportunity] = await this.db
      .update(opportunities)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive
      .set({ stateCode: OPPORTUNITY_STATE.ARCHIVED, modifiedOn: new Date() })
      .where(eq(opportunities.opportunityId, id))
      .returning();

    if (!updatedOpportunity) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_archived',
        opportunityId: id,
      },
      actor: userId,
    });

    return this.mapResponse(updatedOpportunity);
  }

  async unarchiveOpportunity(
    id: string,
    userId: string,
  ): Promise<OpportunityResponseDto> {
    const [updatedOpportunity] = await this.db
      .update(opportunities)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for unarchive
      .set({ stateCode: OPPORTUNITY_STATE.ACTIVE, modifiedOn: new Date() })
      .where(eq(opportunities.opportunityId, id))
      .returning();

    if (!updatedOpportunity) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_unarchived',
        opportunityId: id,
      },
      actor: userId,
    });

    return this.mapResponse(updatedOpportunity);
  }

  async getOpportunity(id: string): Promise<OpportunityResponseDto> {
    const opp = await this.db.query.opportunities.findFirst({
      where: eq(opportunities.opportunityId, id),
      with: {
        owner: true,
        notes: {
          with: {
            createdBy: true,
          },
        },
        opportunityActors: {
          with: {
            actor: true,
          },
        },
        opportunityContacts: {
          with: {
            contact: true,
          },
        },
      },
    });

    if (!opp) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    const [revenueRes] = await this.db
      .select({
        dealRevenue:
          sql<number>`COALESCE(SUM(${salesOrderLineItems.totalAmount}::numeric), 0)::float8`.mapWith(
            Number,
          ),
        quoteCount: sql<number>`COUNT(DISTINCT ${salesOrders.salesOrderId})::int`,
      })
      .from(salesOrders)
      .leftJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .where(
        and(
          eq(salesOrders.opportunityId, id),
          sql`${salesOrders.stateCode} NOT IN ('cancelled', 'archived')`,
        ),
      );

    const events = await this.db
      .select()
      .from(masterDataEvents)
      .where(eq(masterDataEvents.entityId, id))
      .orderBy(sql`${masterDataEvents.createdOn} DESC`);

    return this.mapResponse({
      ...opp,
      events,
      dealRevenue: revenueRes?.dealRevenue ?? 0,
      quoteCount: revenueRes?.quoteCount ?? 0,
    });
  }

  async addOpportunityNote(
    opportunityId: string,
    dto: CreateOpportunityNoteDto,
    userId: string,
  ): Promise<OpportunityNoteResponseDto> {
    await this.getOpportunity(opportunityId);

    const [newNote] = await this.db
      .insert(opportunityNotes)
      .values({
        opportunityId,
        content: dto.content,
        createdById: userId,
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_note_added',
        opportunityId,
        noteId: newNote.noteId,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return newNote as unknown as OpportunityNoteResponseDto;
  }

  async getOpportunityNotes(
    opportunityId: string,
  ): Promise<OpportunityNoteResponseDto[]> {
    await this.getOpportunity(opportunityId);

    const notes = await this.db.query.opportunityNotes.findMany({
      where: eq(opportunityNotes.opportunityId, opportunityId),
      orderBy: [desc(opportunityNotes.createdOn)],
      with: {
        createdBy: true,
      },
    });

    return notes as unknown as OpportunityNoteResponseDto[];
  }

  async deleteOpportunityNote(
    opportunityId: string,
    noteId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const [deleted] = await this.db
      .delete(opportunityNotes)
      .where(
        and(
          eq(opportunityNotes.opportunityId, opportunityId),
          eq(opportunityNotes.noteId, noteId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Note not found for this opportunity');
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_note_removed',
        opportunityId,
        noteId,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async addOpportunityContact(
    opportunityId: string,
    dto: CreateOpportunityContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const contact = await this.db.query.contacts.findFirst({
      where: eq(contacts.contactId, dto.contactId),
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${dto.contactId} not found`);
    }

    const existing = await this.db.query.opportunityContacts.findFirst({
      where: and(
        eq(opportunityContacts.opportunityId, opportunityId),
        eq(opportunityContacts.contactId, dto.contactId),
      ),
    });

    if (existing) {
      await this.db
        .update(opportunityContacts)
        .set({ roles: dto.roles })
        .where(
          eq(
            opportunityContacts.opportunityContactId,
            existing.opportunityContactId,
          ),
        );
    } else {
      await this.db.insert(opportunityContacts).values({
        opportunityId,
        contactId: dto.contactId,
        roles: dto.roles,
      });
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_contact_linked',
        opportunityId,
        contactId: dto.contactId,
        contactName:
          contact.fullName || `${contact.firstName} ${contact.lastName}`,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async updateOpportunityContact(
    opportunityId: string,
    contactId: string,
    dto: UpdateOpportunityContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const existing = await this.db.query.opportunityContacts.findFirst({
      where: and(
        eq(opportunityContacts.opportunityId, opportunityId),
        eq(opportunityContacts.contactId, contactId),
      ),
    });

    if (!existing) {
      throw new NotFoundException(
        'Contact link not found for this opportunity',
      );
    }

    await this.db
      .update(opportunityContacts)
      .set({ roles: dto.roles })
      .where(
        eq(
          opportunityContacts.opportunityContactId,
          existing.opportunityContactId,
        ),
      );

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_contact_roles_updated',
        opportunityId,
        contactId,
        roles: dto.roles,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async deleteOpportunityContact(
    opportunityId: string,
    contactId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const contact = await this.db.query.contacts.findFirst({
      where: eq(contacts.contactId, contactId),
    });

    const [deleted] = await this.db
      .delete(opportunityContacts)
      .where(
        and(
          eq(opportunityContacts.opportunityId, opportunityId),
          eq(opportunityContacts.contactId, contactId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException(
        'Contact link not found for this opportunity',
      );
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_contact_unlinked',
        opportunityId,
        contactId,
        contactName: contact
          ? contact.fullName || `${contact.firstName} ${contact.lastName}`
          : undefined,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async addOpportunityActor(
    opportunityId: string,
    dto: CreateOpportunityActorDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const actor = await this.db.query.actors.findFirst({
      where: eq(actors.actorId, dto.actorId),
    });

    if (!actor) {
      throw new NotFoundException(`Actor with ID ${dto.actorId} not found`);
    }

    const existing = await this.db.query.opportunityActors.findFirst({
      where: and(
        eq(opportunityActors.opportunityId, opportunityId),
        eq(opportunityActors.actorId, dto.actorId),
      ),
    });

    if (existing) {
      await this.db
        .update(opportunityActors)
        .set({ roles: dto.roles })
        .where(
          eq(opportunityActors.opportunityActorId, existing.opportunityActorId),
        );
    } else {
      await this.db.insert(opportunityActors).values({
        opportunityId,
        actorId: dto.actorId,
        roles: dto.roles,
      });
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_actor_linked',
        opportunityId,
        actorId: dto.actorId,
        actorName: actor.name,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async updateOpportunityActor(
    opportunityId: string,
    actorId: string,
    dto: UpdateOpportunityActorDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const existing = await this.db.query.opportunityActors.findFirst({
      where: and(
        eq(opportunityActors.opportunityId, opportunityId),
        eq(opportunityActors.actorId, actorId),
      ),
    });

    if (!existing) {
      throw new NotFoundException('Actor link not found for this opportunity');
    }

    await this.db
      .update(opportunityActors)
      .set({ roles: dto.roles })
      .where(
        eq(opportunityActors.opportunityActorId, existing.opportunityActorId),
      );

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_actor_roles_updated',
        opportunityId,
        actorId,
        roles: dto.roles,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async deleteOpportunityActor(
    opportunityId: string,
    actorId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.getOpportunity(opportunityId);

    const actor = await this.db.query.actors.findFirst({
      where: eq(actors.actorId, actorId),
    });

    const [deleted] = await this.db
      .delete(opportunityActors)
      .where(
        and(
          eq(opportunityActors.opportunityId, opportunityId),
          eq(opportunityActors.actorId, actorId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Actor link not found for this opportunity');
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: opportunityId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_actor_unlinked',
        opportunityId,
        actorId,
        actorName: actor?.name,
      },
      actor: userId,
    });

    await this.touchOpportunity(opportunityId);
    return { success: true };
  }

  async getOpportunities(
    query?: PaginationQuery & OpportunityQueryDto,
  ): Promise<PaginatedResponse<OpportunityResponseDto>> {
    const includeArchived = query?.includeArchived ?? false;
    const { limit = 50, direction = 'next', cursor } = parsePagination(query);
    const conditions = [];

    if (!includeArchived) {
      conditions.push(ne(opportunities.stateCode, OPPORTUNITY_STATE.ARCHIVED));
    }
    if (query?.actorId) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${opportunityActors} WHERE ${opportunityActors.opportunityId} = ${opportunities.opportunityId} AND ${opportunityActors.actorId} = ${query.actorId})`,
      );
    }
    if (query?.contactId) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${opportunityContacts} WHERE ${opportunityContacts.opportunityId} = ${opportunities.opportunityId} AND ${opportunityContacts.contactId} = ${query.contactId})`,
      );
    }
    if (query?.status) {
      conditions.push(eq(opportunities.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let qb = this.db.select().from(opportunities).$dynamic();
    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        opportunityId: string;
        createdOn: Date;
      } | null,
      direction,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic query builder type bypass
      applyWhere: (q: any, c: any, dir: any) => {
        const op = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;

        const cursorCond = or(
          sql`${opportunities.createdOn} ${op} ${new Date(c.createdOn)}`,
          and(
            sql`${opportunities.createdOn} = ${new Date(c.createdOn)}`,
            sql`${opportunities.opportunityId} ${idOp} ${c.opportunityId}`,
          ),
        );

        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic query builder type bypass
      applyOrderBy: (q: any, dir: any) => {
        const sortOrder = dir === 'next' ? desc : asc;
        const idSortOrder = dir === 'next' ? asc : desc;
        return q.orderBy(
          sortOrder(opportunities.createdOn),
          idSortOrder(opportunities.opportunityId),
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic entity row type bypass
      encodeRow: (item: any) => ({
        opportunityId: item.opportunityId,
        createdOn: item.createdOn,
      }),
    });

    // Eagerly enrich page with actors and owner for immediate cards display
    const enrichedData = await this.enrichOpportunities(data);

    return {
      data: enrichedData.map((o) => this.mapResponse(o)),
      limit,
      nextCursor,
      prevCursor,
    };
  }

  async deleteOpportunity(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [deletedOpportunity] = await this.db
      .delete(opportunities)
      .where(eq(opportunities.opportunityId, id))
      .returning();

    if (!deletedOpportunity) {
      throw new NotFoundException(`Opportunity with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.OPPORTUNITY,
      entityId: id,
      eventType: EventType.DELETED,
      entityDisplayName: 'Opportunity',
      payload: {
        action: 'opportunity_deleted',
        opportunityId: id,
        opportunityName: deletedOpportunity.name,
      },
      actor: userId,
    });

    return { success: true };
  }

  private async enrichOpportunities<
    T extends { opportunityId: string; ownerId?: string | null },
  >(
    items: T[],
  ): Promise<(T & { opportunityActors?: unknown[]; owner?: unknown })[]> {
    if (!items || items.length === 0) return [];
    const oppIds = items.map((i) => i.opportunityId);

    // Fetch linked actors
    const linkedActors = await this.db.query.opportunityActors.findMany({
      where: inArray(opportunityActors.opportunityId, oppIds),
      with: {
        actor: true,
      },
    });

    // Fetch owners
    const ownerIds = [
      ...new Set(items.map((i) => i.ownerId).filter(Boolean)),
    ] as string[];
    const loadedOwners =
      ownerIds.length > 0
        ? await this.db.query.users.findMany({
            where: inArray(users.userId, ownerIds),
          })
        : [];

    const actorsByOpp = new Map<string, unknown[]>();
    for (const la of linkedActors) {
      const list = actorsByOpp.get(la.opportunityId) || [];
      list.push(la);
      actorsByOpp.set(la.opportunityId, list);
    }

    const ownersById = new Map<string, unknown>();
    for (const u of loadedOwners) {
      ownersById.set(u.userId, u);
    }

    // Fetch live quote deal revenue and quote counts
    const revenueRows = await this.db
      .select({
        opportunityId: salesOrders.opportunityId,
        dealRevenue:
          sql<number>`COALESCE(SUM(${salesOrderLineItems.totalAmount}::numeric), 0)::float8`.mapWith(
            Number,
          ),
        quoteCount: sql<number>`COUNT(DISTINCT ${salesOrders.salesOrderId})::int`,
      })
      .from(salesOrders)
      .leftJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .where(
        and(
          inArray(salesOrders.opportunityId, oppIds),
          sql`${salesOrders.stateCode} NOT IN ('cancelled', 'archived')`,
        ),
      )
      .groupBy(salesOrders.opportunityId);

    const revenueByOpp = new Map<
      string,
      { dealRevenue: number; quoteCount: number }
    >();
    for (const r of revenueRows) {
      if (r.opportunityId) {
        revenueByOpp.set(r.opportunityId, {
          dealRevenue: Number(r.dealRevenue || 0),
          quoteCount: Number(r.quoteCount || 0),
        });
      }
    }

    return items.map((item) => ({
      ...item,
      opportunityActors: actorsByOpp.get(item.opportunityId) || [],
      owner: item.ownerId ? ownersById.get(item.ownerId) : null,
      dealRevenue: revenueByOpp.get(item.opportunityId)?.dealRevenue ?? 0,
      quoteCount: revenueByOpp.get(item.opportunityId)?.quoteCount ?? 0,
    }));
  }

  // @herobm-skip-audit
  private async touchOpportunity(opportunityId: string) {
    await this.db
      .update(opportunities)
      .set({ modifiedOn: new Date() })
      .where(eq(opportunities.opportunityId, opportunityId));
  }

  private mapResponse(item: Record<string, unknown>): OpportunityResponseDto {
    return item as unknown as OpportunityResponseDto;
  }
}
