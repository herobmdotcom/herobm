import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  sql,
  inArray,
  exists,
} from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  crmActivities,
  crmActivityContacts,
  actors,
  contacts,
  opportunities,
  opportunityContacts,
  users,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { parsePagination, PaginatedResponse } from '../common/pagination';
import {
  CreateCrmActivityDto,
  UpdateCrmActivityDto,
  CrmActivityQueryDto,
  CrmActivityResponseDto,
  ActivityContactDto,
} from './dto';

@Injectable()
export class CrmActivitiesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(
    dto: CreateCrmActivityDto,
    user: { userId: string; username: string },
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;

    const [created] = await db
      .insert(crmActivities)
      .values({
        type: dto.type,
        subject: dto.subject,
        description: dto.description || null,
        status: dto.status,
        priority: dto.priority,
        actorId: dto.actorId || null,
        opportunityId: dto.opportunityId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToUserId: dto.assignedToUserId || null,
        completedAt: dto.status === 'completed' ? sql`clock_timestamp()` : null,
        completedByUserId: dto.status === 'completed' ? user.userId : null,
        createdBy: user.username,
        createdById: user.userId || null,
        createdOn: sql`clock_timestamp()`,
        modifiedOn: sql`clock_timestamp()`,
      })
      .returning();

    if (dto.contactIds && dto.contactIds.length > 0) {
      const uniqueContactIds = Array.from(new Set(dto.contactIds));
      await db.insert(crmActivityContacts).values(
        uniqueContactIds.map((cId) => ({
          activityId: created.activityId,
          contactId: cId,
        })),
      );
    }

    // 1. Audit event for CRM Activity
    await emitEvent(db, {
      entityType: EntityType.CRM_ACTIVITY,
      entityId: created.activityId,
      eventType: EventType.CREATED,
      entityDisplayName: `${dto.type.toUpperCase()}: ${dto.subject}`,
      payload: {
        action: 'crm_activity_logged',
        activityId: created.activityId,
        activityType: created.type,
        subject: created.subject,
        status: created.status,
        priority: created.priority,
        actorId: created.actorId,
        contactIds: dto.contactIds || [],
        opportunityId: created.opportunityId,
        dueDate: created.dueDate,
        assignedToUserId: created.assignedToUserId,
      },
      actor: user.username,
    });

    // 2. Audit event for linked Actor if present
    if (created.actorId) {
      await emitEvent(db, {
        entityType: EntityType.ACTOR,
        entityId: created.actorId,
        eventType: EventType.UPDATED,
        entityDisplayName: 'Actor',
        payload: {
          action: 'crm_activity_logged',
          activityId: created.activityId,
          activityType: created.type,
          subject: created.subject,
          status: created.status,
        },
        actor: user.username,
      });
    }

    // 3. Audit events for linked Contacts if present
    if (dto.contactIds && dto.contactIds.length > 0) {
      const uniqueContactIds = Array.from(new Set(dto.contactIds));
      for (const cId of uniqueContactIds) {
        await emitEvent(db, {
          entityType: EntityType.CONTACT,
          entityId: cId,
          eventType: EventType.UPDATED,
          entityDisplayName: 'Contact',
          payload: {
            action: 'crm_activity_logged',
            activityId: created.activityId,
            activityType: created.type,
            subject: created.subject,
            status: created.status,
          },
          actor: user.username,
        });
      }
    }

    // 4. Audit event for linked Opportunity if present
    if (created.opportunityId) {
      await emitEvent(db, {
        entityType: EntityType.OPPORTUNITY,
        entityId: created.opportunityId,
        eventType: EventType.UPDATED,
        entityDisplayName: 'Opportunity',
        payload: {
          action: 'crm_activity_logged',
          activityId: created.activityId,
          activityType: created.type,
          subject: created.subject,
          status: created.status,
        },
        actor: user.username,
      });
    }

    // 5. Automatically link involved contacts to Opportunity if activity is linked to an Opportunity
    if (created.opportunityId && dto.contactIds && dto.contactIds.length > 0) {
      await this.ensureOpportunityContacts(
        created.opportunityId,
        dto.contactIds,
        user,
        db,
      );
    }

    return this.findOne(created.activityId, db);
  }

  async findAll(
    query?: CrmActivityQueryDto,
    currentUserId?: string,
    tx?: DrizzleDB,
  ): Promise<PaginatedResponse<CrmActivityResponseDto>> {
    const db = tx || this.db;
    const { page, limit, offset, searchTerm } = parsePagination(query);

    const conditions = [];

    if (query?.actorId) {
      conditions.push(eq(crmActivities.actorId, query.actorId));
    }
    if (query?.contactId) {
      conditions.push(
        exists(
          db
            .select()
            .from(crmActivityContacts)
            .where(
              and(
                eq(crmActivityContacts.activityId, crmActivities.activityId),
                eq(crmActivityContacts.contactId, query.contactId),
              ),
            ),
        ),
      );
    }
    if (query?.opportunityId) {
      conditions.push(eq(crmActivities.opportunityId, query.opportunityId));
    }
    if (query?.assignedToUserId) {
      conditions.push(
        eq(crmActivities.assignedToUserId, query.assignedToUserId),
      );
    }
    if (query?.myTasks === 'true' && currentUserId) {
      conditions.push(
        and(
          eq(crmActivities.assignedToUserId, currentUserId),
          eq(crmActivities.type, 'task'),
        ),
      );
    }
    if (query?.type) {
      conditions.push(eq(crmActivities.type, query.type));
    }
    if (query?.status) {
      conditions.push(eq(crmActivities.status, query.status));
    }
    if (query?.priority) {
      conditions.push(eq(crmActivities.priority, query.priority));
    }
    if (searchTerm) {
      conditions.push(
        or(
          ilike(crmActivities.subject, searchTerm),
          ilike(crmActivities.description, searchTerm),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = db
      .select({
        activityId: crmActivities.activityId,
        type: crmActivities.type,
        subject: crmActivities.subject,
        description: crmActivities.description,
        status: crmActivities.status,
        priority: crmActivities.priority,
        actorId: crmActivities.actorId,
        opportunityId: crmActivities.opportunityId,
        dueDate: crmActivities.dueDate,
        assignedToUserId: crmActivities.assignedToUserId,
        completedAt: crmActivities.completedAt,
        completedByUserId: crmActivities.completedByUserId,
        createdBy: crmActivities.createdBy,
        createdById: crmActivities.createdById,
        createdOn: crmActivities.createdOn,
        modifiedOn: crmActivities.modifiedOn,
        actorName: actors.name,
        opportunityName: opportunities.name,
        assignedToName: sql<
          string | null
        >`COALESCE(${users.displayName}, ${users.username})`,
      })
      .from(crmActivities)
      .leftJoin(actors, eq(crmActivities.actorId, actors.actorId))
      .leftJoin(
        opportunities,
        eq(crmActivities.opportunityId, opportunities.opportunityId),
      )
      .leftJoin(users, eq(crmActivities.assignedToUserId, users.userId))
      .$dynamic();

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmActivities)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
      .orderBy(
        // Open tasks first
        sql`CASE WHEN ${crmActivities.status} = 'open' THEN 0 ELSE 1 END`,
        // Then by due date (nearest first for open tasks)
        asc(crmActivities.dueDate),
        // Then by modified date desc
        desc(crmActivities.modifiedOn),
      )
      .limit(limit)
      .offset(offset);

    let contactsByActivityId = new Map<string, ActivityContactDto[]>();
    if (rows.length > 0) {
      const activityIds = rows.map((r) => r.activityId);
      const contactRows = await db
        .select({
          activityId: crmActivityContacts.activityId,
          contactId: contacts.contactId,
          fullName: contacts.fullName,
          email: contacts.email,
          jobTitle: contacts.jobTitle,
        })
        .from(crmActivityContacts)
        .innerJoin(
          contacts,
          eq(crmActivityContacts.contactId, contacts.contactId),
        )
        .where(inArray(crmActivityContacts.activityId, activityIds));

      contactsByActivityId = new Map<string, ActivityContactDto[]>();
      for (const row of contactRows) {
        const list = contactsByActivityId.get(row.activityId) || [];
        list.push({
          contactId: row.contactId,
          fullName: row.fullName ?? '',
          email: row.email,
          jobTitle: row.jobTitle,
        });
        contactsByActivityId.set(row.activityId, list);
      }
    }

    const data = rows.map((r) => ({
      ...r,
      contacts: contactsByActivityId.get(r.activityId) || [],
    })) as unknown as CrmActivityResponseDto[];

    return {
      data,
      page,
      limit,
      total,
    };
  }

  async findOne(id: string, tx?: DrizzleDB): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;

    const [activity] = await db
      .select({
        activityId: crmActivities.activityId,
        type: crmActivities.type,
        subject: crmActivities.subject,
        description: crmActivities.description,
        status: crmActivities.status,
        priority: crmActivities.priority,
        actorId: crmActivities.actorId,
        opportunityId: crmActivities.opportunityId,
        dueDate: crmActivities.dueDate,
        assignedToUserId: crmActivities.assignedToUserId,
        completedAt: crmActivities.completedAt,
        completedByUserId: crmActivities.completedByUserId,
        createdBy: crmActivities.createdBy,
        createdById: crmActivities.createdById,
        createdOn: crmActivities.createdOn,
        modifiedOn: crmActivities.modifiedOn,
        actorName: actors.name,
        opportunityName: opportunities.name,
        assignedToName: sql<
          string | null
        >`COALESCE(${users.displayName}, ${users.username})`,
      })
      .from(crmActivities)
      .leftJoin(actors, eq(crmActivities.actorId, actors.actorId))
      .leftJoin(
        opportunities,
        eq(crmActivities.opportunityId, opportunities.opportunityId),
      )
      .leftJoin(users, eq(crmActivities.assignedToUserId, users.userId))
      .where(eq(crmActivities.activityId, id));

    if (!activity) {
      throw new NotFoundException(`CRM Activity with ID ${id} not found`);
    }

    const contactRows = await db
      .select({
        contactId: contacts.contactId,
        fullName: contacts.fullName,
        email: contacts.email,
        jobTitle: contacts.jobTitle,
      })
      .from(crmActivityContacts)
      .innerJoin(
        contacts,
        eq(crmActivityContacts.contactId, contacts.contactId),
      )
      .where(eq(crmActivityContacts.activityId, id));

    const attachedContacts: ActivityContactDto[] = contactRows.map((c) => ({
      contactId: c.contactId,
      fullName: c.fullName ?? '',
      email: c.email,
      jobTitle: c.jobTitle,
    }));

    return {
      ...activity,
      contacts: attachedContacts,
    } as unknown as CrmActivityResponseDto;
  }

  async update(
    id: string,
    dto: UpdateCrmActivityDto,
    user: { userId: string; username: string },
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;

    const existing = await this.findOne(id, db);

    const updatePayload: Record<string, unknown> = {
      modifiedOn: sql`clock_timestamp()`,
    };

    if (dto.type !== undefined) updatePayload.type = dto.type;
    if (dto.subject !== undefined) updatePayload.subject = dto.subject;
    if (dto.description !== undefined)
      updatePayload.description = dto.description || null;
    if (dto.priority !== undefined) updatePayload.priority = dto.priority;
    if (dto.actorId !== undefined) updatePayload.actorId = dto.actorId || null;
    if (dto.opportunityId !== undefined)
      updatePayload.opportunityId = dto.opportunityId || null;
    if (dto.dueDate !== undefined)
      updatePayload.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.assignedToUserId !== undefined)
      updatePayload.assignedToUserId = dto.assignedToUserId || null;

    if (dto.status !== undefined) {
      updatePayload.status = dto.status;
      if (dto.status === 'completed' && existing.status !== 'completed') {
        updatePayload.completedAt = sql`clock_timestamp()`;
        updatePayload.completedByUserId = user.userId;
      } else if (
        dto.status !== 'completed' &&
        existing.status === 'completed'
      ) {
        updatePayload.completedAt = null;
        updatePayload.completedByUserId = null;
      }
    }

    await db
      .update(crmActivities)
      .set(updatePayload)
      .where(eq(crmActivities.activityId, id));

    if (dto.contactIds !== undefined) {
      await db
        .delete(crmActivityContacts)
        .where(eq(crmActivityContacts.activityId, id));

      if (dto.contactIds.length > 0) {
        const uniqueContactIds = Array.from(new Set(dto.contactIds));
        await db.insert(crmActivityContacts).values(
          uniqueContactIds.map((cId) => ({
            activityId: id,
            contactId: cId,
          })),
        );
      }
    }

    await emitEvent(db, {
      entityType: EntityType.CRM_ACTIVITY,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: `${existing.type.toUpperCase()}: ${dto.subject || existing.subject}`,
      payload: {
        action: 'crm_activity_updated',
        activityId: id,
        changes: dto,
      },
      actor: user.username,
    });

    const targetOpportunityId =
      dto.opportunityId !== undefined
        ? dto.opportunityId
        : existing.opportunityId;

    let targetContactIds: string[] | undefined = dto.contactIds;
    if (
      targetContactIds === undefined &&
      dto.opportunityId &&
      dto.opportunityId !== existing.opportunityId
    ) {
      targetContactIds = existing.contacts?.map((c) => c.contactId);
    }

    if (
      targetOpportunityId &&
      targetContactIds &&
      targetContactIds.length > 0
    ) {
      await this.ensureOpportunityContacts(
        targetOpportunityId,
        targetContactIds,
        user,
        db,
      );
    }

    return this.findOne(id, db);
  }

  async complete(
    id: string,
    user: { userId: string; username: string },
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;
    const existing = await this.findOne(id, db);

    await db
      .update(crmActivities)
      .set({
        status: 'completed',
        completedAt: sql`clock_timestamp()`,
        completedByUserId: user.userId,
        modifiedOn: sql`clock_timestamp()`,
      })
      .where(eq(crmActivities.activityId, id));

    await emitEvent(db, {
      entityType: EntityType.CRM_ACTIVITY,
      entityId: id,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: `${existing.type.toUpperCase()}: ${existing.subject}`,
      payload: {
        action: 'crm_activity_completed',
        activityId: id,
        previousStatus: existing.status,
        newStatus: 'completed',
      },
      actor: user.username,
    });

    return this.findOne(id, db);
  }

  async remove(
    id: string,
    user: { username: string },
    tx?: DrizzleDB,
  ): Promise<{ success: boolean }> {
    const db = tx || this.db;
    const existing = await this.findOne(id, db);

    await db.delete(crmActivities).where(eq(crmActivities.activityId, id));

    await emitEvent(db, {
      entityType: EntityType.CRM_ACTIVITY,
      entityId: id,
      eventType: EventType.DELETED,
      entityDisplayName: `${existing.type.toUpperCase()}: ${existing.subject}`,
      payload: {
        action: 'crm_activity_deleted',
        activityId: id,
        type: existing.type,
        subject: existing.subject,
      },
      actor: user.username,
    });

    return { success: true };
  }

  private async ensureOpportunityContacts(
    opportunityId: string,
    contactIds: string[],
    user: { username: string },
    db: DrizzleDB,
  ): Promise<void> {
    if (!opportunityId || !contactIds || contactIds.length === 0) {
      return;
    }

    const uniqueContactIds = Array.from(new Set(contactIds));

    // Find which contacts are already linked to this opportunity
    const existing = await db
      .select({ contactId: opportunityContacts.contactId })
      .from(opportunityContacts)
      .where(
        and(
          eq(opportunityContacts.opportunityId, opportunityId),
          inArray(opportunityContacts.contactId, uniqueContactIds),
        ),
      );

    const existingContactIdSet = new Set(existing.map((e) => e.contactId));
    const contactsToInsert = uniqueContactIds.filter(
      (cId) => !existingContactIdSet.has(cId),
    );

    if (contactsToInsert.length > 0) {
      await db.insert(opportunityContacts).values(
        contactsToInsert.map((cId) => ({
          opportunityId,
          contactId: cId,
        })),
      );

      for (const cId of contactsToInsert) {
        await emitEvent(db, {
          entityType: EntityType.OPPORTUNITY,
          entityId: opportunityId,
          eventType: EventType.UPDATED,
          entityDisplayName: 'Opportunity',
          payload: {
            action: 'opportunity_contact_linked',
            opportunityId,
            contactId: cId,
            source: 'crm_activity',
          },
          actor: user.username,
        });
      }
    }
  }
}
