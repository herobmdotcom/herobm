import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import {
  eq,
  ilike,
  or,
  sql,
  and,
  asc,
  desc,
  getTableColumns,
} from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  actors,
  actorContactLinks,
  actorNotes,
  masterDataEvents,
  contacts,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { ACTOR_STATE } from '@herobm/shared';
import {
  CreateActorDto,
  UpdateActorDto,
  ActorResponseDto,
  UpdateActorContactDto,
  CreateActorContactDto,
  CreateActorNoteDto,
  ActorNoteResponseDto,
} from './dto';

@Injectable()
export class ActorsService {
  private readonly logger = new Logger(ActorsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createActor(
    dto: CreateActorDto,
    userId: string,
  ): Promise<ActorResponseDto> {
    const [newActor] = await this.db
      .insert(actors)
      .values({ isTaxRegistered: false, stateCode: ACTOR_STATE.ACTIVE, ...dto })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: newActor.actorId,
      eventType: EventType.CREATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'actor_created',
        actorId: newActor.actorId,
        actorName: newActor.name,
      },
      actor: userId,
    });

    return newActor as unknown as ActorResponseDto;
  }

  async updateActor(
    id: string,
    dto: UpdateActorDto,
    userId: string,
  ): Promise<ActorResponseDto> {
    const [updatedActor] = await this.db
      .update(actors)
      .set({ ...dto, modifiedOn: new Date() })
      .where(eq(actors.actorId, id))
      .returning();

    if (!updatedActor) {
      throw new NotFoundException(`Actor with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: updatedActor.actorId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'actor_updated',
        actorId: updatedActor.actorId,
        actorName: updatedActor.name,
      },
      actor: userId,
    });

    return updatedActor as unknown as ActorResponseDto;
  }

  async getActor(id: string): Promise<ActorResponseDto> {
    const actor = await this.db.query.actors.findFirst({
      where: eq(actors.actorId, id),
      with: {
        notes: {
          with: {
            createdBy: true,
          },
        },
        actorContactLinks: {
          with: {
            contact: true,
          },
        },
        referredByActor: true,
        referredByContact: true,
      },
    });

    if (!actor) {
      throw new NotFoundException(`Actor with ID ${id} not found`);
    }

    const events = await this.db
      .select()
      .from(masterDataEvents)
      .where(eq(masterDataEvents.entityId, id))
      .orderBy(sql`${masterDataEvents.createdOn} DESC`);

    const actorWithRefs = actor as typeof actor & {
      referredByActor?: { name: string } | null;
      referredByContact?: { fullName: string } | null;
    };

    const result = {
      ...actor,
      events,
      referredByActorName: actorWithRefs.referredByActor?.name || null,
      referredByContactName: actorWithRefs.referredByContact?.fullName || null,
    };

    return result as unknown as ActorResponseDto;
  }

  async getActors(query?: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(ilike(actors.name, `%${rawSearchTerm}%`));
    }

    if (!includeArchived) {
      conditions.push(sql`${actors.stateCode} != ${ACTOR_STATE.ARCHIVED}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let qb = this.db
      .select({
        ...getTableColumns(actors),
        score: scoreSql,
      })
      .from(actors)
      .$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        score: number;
        name: string;
        actorId: string;
      } | null,
      direction: direction,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing here
      applyWhere: (q: any, c: any, dir: any) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const nameOp = dir === 'next' ? sql`>` : sql`<`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;

        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${actors.name}) ${nameOp} lower(${c.name})`,
          ),
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${actors.name}) = lower(${c.name})`,
            sql`${actors.actorId} ${idOp} ${c.actorId}`,
          ),
        );

        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing here
      applyOrderBy: (q: any, dir: any) => {
        const sortOrder = dir === 'next' ? desc : asc;
        const nameSortOrder = dir === 'next' ? asc : desc;
        return q.orderBy(
          sortOrder(scoreSql),
          nameSortOrder(sql`lower(${actors.name})`),
          nameSortOrder(actors.actorId),
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing here
      encodeRow: (item: any) => ({
        score: Number(item.score || 0),
        name: item.name || '',
        actorId: item.actorId,
      }),
    });

    return {
      data: data as unknown as ActorResponseDto[],
      nextCursor,
      prevCursor,
    };
  }

  async deleteActor(id: string, userId: string): Promise<{ success: boolean }> {
    const [deletedActor] = await this.db
      .delete(actors)
      .where(eq(actors.actorId, id))
      .returning();

    if (!deletedActor) {
      throw new NotFoundException(`Actor with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: id,
      eventType: EventType.DELETED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'actor_deleted',
        actorId: id,
        actorName: deletedActor.name,
      },
      actor: userId,
    });

    return { success: true };
  }

  async archiveActor(id: string, userId: string): Promise<ActorResponseDto> {
    const [updatedActor] = await this.db
      .update(actors)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive/unarchive
      .set({ stateCode: ACTOR_STATE.ARCHIVED, modifiedOn: new Date() })
      .where(eq(actors.actorId, id))
      .returning();

    if (!updatedActor) {
      throw new NotFoundException(`Actor with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'actor_archived',
        actorId: id,
      },
      actor: userId,
    });

    return updatedActor as unknown as ActorResponseDto;
  }

  async unarchiveActor(id: string, userId: string): Promise<ActorResponseDto> {
    const [updatedActor] = await this.db
      .update(actors)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive/unarchive
      .set({ stateCode: ACTOR_STATE.ACTIVE, modifiedOn: new Date() })
      .where(eq(actors.actorId, id))
      .returning();

    if (!updatedActor) {
      throw new NotFoundException(`Actor with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'actor_unarchived',
        actorId: id,
      },
      actor: userId,
    });

    return updatedActor as unknown as ActorResponseDto;
  }

  // @herobm-skip-audit
  private async touchActor(actorId: string) {
    await this.db
      .update(actors)
      .set({ modifiedOn: new Date() })
      .where(eq(actors.actorId, actorId));
  }

  async addNote(
    actorId: string,
    dto: CreateActorNoteDto,
    userId: string,
  ): Promise<ActorNoteResponseDto> {
    const actor = await this.db.query.actors.findFirst({
      where: eq(actors.actorId, actorId),
    });
    if (!actor) {
      throw new NotFoundException(`Actor with ID ${actorId} not found`);
    }

    const [note] = await this.db
      .insert(actorNotes)
      .values({
        actorId,
        content: dto.content,
        createdById: userId,
      })
      .returning();

    const fetchedNote = await this.db.query.actorNotes.findFirst({
      where: eq(actorNotes.noteId, note.noteId),
      with: { createdBy: true },
    });

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: actorId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'note_added',
        actorId,
        actorName: actor?.name,
        noteId: note.noteId,
      },
      actor: userId,
    });

    await this.touchActor(actorId);

    return fetchedNote as unknown as ActorNoteResponseDto;
  }

  async removeNote(
    actorId: string,
    noteId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [deleted] = await this.db
      .delete(actorNotes)
      .where(
        and(eq(actorNotes.actorId, actorId), eq(actorNotes.noteId, noteId)),
      )
      .returning();
    if (!deleted) {
      throw new NotFoundException(`Note not found`);
    }

    const actor = await this.db.query.actors.findFirst({
      where: eq(actors.actorId, actorId),
    });

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: actorId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'note_removed',
        actorId,
        actorName: actor?.name,
        noteId,
      },
      actor: userId,
    });

    await this.touchActor(actorId);
    return { success: true };
  }

  async updateContact(
    actorId: string,
    contactId: string,
    dto: UpdateActorContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [updated] = await this.db
      .update(actorContactLinks)
      .set({ primaryFor: dto.primaryFor })
      .where(
        and(
          eq(actorContactLinks.actorId, actorId),
          eq(actorContactLinks.contactId, contactId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException(`Actor contact link not found`);
    }

    const [actor, contact] = await Promise.all([
      this.db.query.actors.findFirst({ where: eq(actors.actorId, actorId) }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: actorId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'contact_updated',
        actorId,
        actorName: actor?.name,
        contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
        primaryFor: dto.primaryFor,
      },
      actor: userId,
    });

    await this.touchActor(actorId);

    return { success: true };
  }

  async addContact(
    actorId: string,
    dto: CreateActorContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db.insert(actorContactLinks).values({
      actorId,
      contactId: dto.contactId,
      primaryFor: dto.primaryFor || [],
      linkType: 'employee',
    });

    const [actor, contact] = await Promise.all([
      this.db.query.actors.findFirst({ where: eq(actors.actorId, actorId) }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, dto.contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: actorId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'contact_added',
        actorId,
        actorName: actor?.name,
        contactId: dto.contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
        primaryFor: dto.primaryFor || [],
      },
      actor: userId,
    });

    await this.touchActor(actorId);

    return { success: true };
  }

  async removeContact(
    actorId: string,
    contactId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db
      .delete(actorContactLinks)
      .where(
        and(
          eq(actorContactLinks.actorId, actorId),
          eq(actorContactLinks.contactId, contactId),
        ),
      );

    const [actor, contact] = await Promise.all([
      this.db.query.actors.findFirst({ where: eq(actors.actorId, actorId) }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.ACTOR,
      entityId: actorId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Actor',
      payload: {
        action: 'contact_removed',
        actorId,
        actorName: actor?.name,
        contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
      },
      actor: userId,
    });

    await this.touchActor(actorId);

    return { success: true };
  }
}
