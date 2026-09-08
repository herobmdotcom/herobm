import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  eq,
  ne,
  and,
  or,
  ilike,
  desc,
  asc,
  sql,
  inArray,
  exists,
  isNotNull,
} from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  crmActivities,
  crmActivityContacts,
  organizations,
  contacts,
  opportunities,
  opportunityContacts,
  users,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  parsePagination,
  withCursorPagination,
  PaginatedResponse,
} from '../common/pagination';
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

    const assignedToUserId =
      dto.type === 'task' && !dto.opportunityId && !dto.assignedToUserId
        ? user.userId
        : dto.assignedToUserId || null;

    const targetOrganizationId = dto.organizationId ?? null;

    const [created] = await db
      .insert(crmActivities)
      .values({
        type: dto.type,
        subject: dto.subject,
        description: dto.description || null,
        status: dto.status,
        priority: dto.priority,
        organizationId: targetOrganizationId,
        opportunityId: dto.opportunityId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToUserId,
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
        organizationId: created.organizationId,
        contactIds: dto.contactIds || [],
        opportunityId: created.opportunityId,
        dueDate: created.dueDate,
        assignedToUserId: created.assignedToUserId,
      },
      actor: user.username,
    });

    // 2. Audit event for linked Organization if present
    if (created.organizationId) {
      await emitEvent(db, {
        entityType: EntityType.ORGANIZATION,
        entityId: created.organizationId,
        eventType: EventType.UPDATED,
        entityDisplayName: 'Organization',
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

    return this.findOne(created.activityId, user, db);
  }

  async findAll(
    query?: CrmActivityQueryDto,
    currentUser?: string | { userId?: string; role?: string },
    tx?: DrizzleDB,
  ): Promise<PaginatedResponse<CrmActivityResponseDto>> {
    const db = tx || this.db;
    const currentUserId =
      typeof currentUser === 'string' ? currentUser : currentUser?.userId;
    const currentUserRole =
      typeof currentUser === 'object' ? currentUser?.role : undefined;
    const { page, limit, cursor, direction, searchTerm } =
      parsePagination(query);

    const conditions = [];

    // Task Privacy Rule:
    // - Tasks attached to opportunities are public across the organization.
    // - Tasks not attached to opportunities are private: visible only to assignee and creator (and admins).
    // - Non-task activities (call, meeting, email, note) remain public.
    if (currentUserRole !== 'admin') {
      const taskVisibilityConditions = [
        ne(crmActivities.type, 'task'),
        isNotNull(crmActivities.opportunityId),
      ];
      if (currentUserId) {
        taskVisibilityConditions.push(
          eq(crmActivities.assignedToUserId, currentUserId),
          eq(crmActivities.createdById, currentUserId),
        );
      }
      conditions.push(or(...taskVisibilityConditions));
    }

    if (query?.organizationId) {
      conditions.push(eq(crmActivities.organizationId, query.organizationId));
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
    if (query?.isOverdue === 'true') {
      conditions.push(
        and(
          eq(crmActivities.type, 'task'),
          ne(crmActivities.status, 'completed'),
          ne(crmActivities.status, 'cancelled'),
          isNotNull(crmActivities.dueDate),
          sql`${crmActivities.dueDate} < clock_timestamp()`,
        ),
      );
    }
    if (query?.dueDateFrom) {
      conditions.push(
        sql`${crmActivities.dueDate} >= ${new Date(query.dueDateFrom)}`,
      );
    }
    if (query?.dueDateTo) {
      conditions.push(
        sql`${crmActivities.dueDate} <= ${new Date(query.dueDateTo)}`,
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
        organizationId: crmActivities.organizationId,
        opportunityId: crmActivities.opportunityId,
        dueDate: crmActivities.dueDate,
        assignedToUserId: crmActivities.assignedToUserId,
        completedAt: crmActivities.completedAt,
        completedByUserId: crmActivities.completedByUserId,
        createdBy: crmActivities.createdBy,
        createdById: crmActivities.createdById,
        createdOn: crmActivities.createdOn,
        modifiedOn: crmActivities.modifiedOn,
        organizationName: organizations.name,
        opportunityName: opportunities.name,
        assignedToName: sql<
          string | null
        >`COALESCE(${users.displayName}, ${users.username})`,
      })
      .from(crmActivities)
      .leftJoin(
        organizations,
        eq(crmActivities.organizationId, organizations.organizationId),
      )
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

    const qb = whereClause ? baseQuery.where(whereClause) : baseQuery;

    const isDueDateSort =
      query?.sort === 'dueDate' || query?.myTasks === 'true';

    const {
      data: rows,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        modifiedOn?: string;
        dueDate?: string | null;
        activityId: string;
      } | null,
      direction,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing
      applyWhere: (q: any, c: any, dir: any) => {
        if (isDueDateSort) {
          const op = dir === 'next' ? sql`>` : sql`<`;
          const idOp = dir === 'next' ? sql`>` : sql`<`;
          const cursorCond = c.dueDate
            ? or(
                sql`${crmActivities.dueDate} ${op} ${c.dueDate}`,
                and(
                  sql`${crmActivities.dueDate} = ${c.dueDate}`,
                  sql`${crmActivities.activityId} ${idOp} ${c.activityId}`,
                ),
                dir === 'next'
                  ? sql`${crmActivities.dueDate} IS NULL`
                  : sql`false`,
              )
            : and(
                sql`${crmActivities.dueDate} IS NULL`,
                sql`${crmActivities.activityId} ${idOp} ${c.activityId}`,
              );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        }
        const op = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${crmActivities.modifiedOn} ${op} ${c.modifiedOn}`,
          and(
            sql`${crmActivities.modifiedOn} = ${c.modifiedOn}`,
            sql`${crmActivities.activityId} ${idOp} ${c.activityId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing
      applyOrderBy: (q: any, dir: any) => {
        if (isDueDateSort) {
          return q.orderBy(
            dir === 'next'
              ? sql`${crmActivities.dueDate} ASC NULLS LAST`
              : sql`${crmActivities.dueDate} DESC NULLS FIRST`,
            dir === 'next'
              ? asc(crmActivities.activityId)
              : desc(crmActivities.activityId),
          );
        }
        const orderFn = dir === 'next' ? desc : asc;
        const idFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(crmActivities.modifiedOn),
          idFn(crmActivities.activityId),
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing
      encodeRow: (row: any) => {
        if (isDueDateSort) {
          return {
            dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
            activityId: row.activityId,
          };
        }
        return {
          modifiedOn: row.modifiedOn
            ? new Date(row.modifiedOn).toISOString()
            : new Date().toISOString(),
          activityId: row.activityId,
        };
      },
    });

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
      nextCursor,
      prevCursor,
    };
  }

  async findOne(
    id: string,
    userOrTx?: { userId?: string; role?: string } | DrizzleDB,
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    let user: { userId?: string; role?: string } | undefined;
    let db: DrizzleDB;
    if (userOrTx && 'select' in userOrTx) {
      db = userOrTx;
    } else {
      user = userOrTx as { userId?: string; role?: string } | undefined;
      db = tx || this.db;
    }

    const [activity] = await db
      .select({
        activityId: crmActivities.activityId,
        type: crmActivities.type,
        subject: crmActivities.subject,
        description: crmActivities.description,
        status: crmActivities.status,
        priority: crmActivities.priority,
        organizationId: crmActivities.organizationId,
        opportunityId: crmActivities.opportunityId,
        dueDate: crmActivities.dueDate,
        assignedToUserId: crmActivities.assignedToUserId,
        completedAt: crmActivities.completedAt,
        completedByUserId: crmActivities.completedByUserId,
        createdBy: crmActivities.createdBy,
        createdById: crmActivities.createdById,
        createdOn: crmActivities.createdOn,
        modifiedOn: crmActivities.modifiedOn,
        organizationName: organizations.name,
        opportunityName: opportunities.name,
        assignedToName: sql<
          string | null
        >`COALESCE(${users.displayName}, ${users.username})`,
      })
      .from(crmActivities)
      .leftJoin(
        organizations,
        eq(crmActivities.organizationId, organizations.organizationId),
      )
      .leftJoin(
        opportunities,
        eq(crmActivities.opportunityId, opportunities.opportunityId),
      )
      .leftJoin(users, eq(crmActivities.assignedToUserId, users.userId))
      .where(eq(crmActivities.activityId, id));

    if (!activity) {
      throw new NotFoundException(`CRM Activity with ID ${id} not found`);
    }

    // Task Privacy Rule:
    // Standalone tasks without an opportunity are private: visible only to assignee, creator, and admins.
    if (
      activity.type === 'task' &&
      !activity.opportunityId &&
      user?.role !== 'admin'
    ) {
      const isAssignee = Boolean(
        user?.userId && activity.assignedToUserId === user.userId,
      );
      const isCreator = Boolean(
        user?.userId && activity.createdById === user.userId,
      );

      if (!isAssignee && !isCreator) {
        throw new NotFoundException(`CRM Activity with ID ${id} not found`);
      }
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
    user: { userId: string; username: string; role?: string },
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;

    const existing = await this.findOne(id, user, db);

    const updatePayload: Record<string, unknown> = {
      modifiedOn: sql`clock_timestamp()`,
    };

    if (dto.type !== undefined) updatePayload.type = dto.type;
    if (dto.subject !== undefined) updatePayload.subject = dto.subject;
    if (dto.description !== undefined)
      updatePayload.description = dto.description || null;
    if (dto.priority !== undefined) updatePayload.priority = dto.priority;
    if (dto.organizationId !== undefined)
      updatePayload.organizationId = dto.organizationId || null;
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

    return this.findOne(id, user, db);
  }

  async complete(
    id: string,
    user: { userId: string; username: string; role?: string },
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;
    const existing = await this.findOne(id, user, db);

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

    return this.findOne(id, user, db);
  }

  async reopen(
    id: string,
    user: { userId: string; username: string; role?: string },
    tx?: DrizzleDB,
  ): Promise<CrmActivityResponseDto> {
    const db = tx || this.db;
    const existing = await this.findOne(id, user, db);

    await db
      .update(crmActivities)
      .set({
        status: 'open',
        completedAt: null,
        completedByUserId: null,
        modifiedOn: sql`clock_timestamp()`,
      })
      .where(eq(crmActivities.activityId, id));

    await emitEvent(db, {
      entityType: EntityType.CRM_ACTIVITY,
      entityId: id,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: `${existing.type.toUpperCase()}: ${existing.subject}`,
      payload: {
        action: 'crm_activity_reopened',
        activityId: id,
        previousStatus: existing.status,
        newStatus: 'open',
      },
      actor: user.username,
    });

    return this.findOne(id, user, db);
  }

  async remove(
    id: string,
    user: { userId?: string; username: string; role?: string },
    tx?: DrizzleDB,
  ): Promise<{ success: boolean }> {
    const db = tx || this.db;
    const existing = await this.findOne(id, user, db);

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
