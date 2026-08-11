import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  contacts,
  actorContactLinks,
  customers,
  suppliers,
  actors,
  projects,
  projectContacts,
} from '@herobm/db-schema';
import { CreateContactDto, UpdateContactDto, ContactResponseDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { CONTACT_STATE } from '@herobm/shared';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${contacts.fullName} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${contacts.fullName} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${contacts.email} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${contacts.email} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0 + 0`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(contacts.fullName, `%${rawSearchTerm}%`),
          ilike(contacts.email, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (!includeArchived) {
      conditions.push(sql`${contacts.stateCode} != ${CONTACT_STATE.ARCHIVED}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let qb = this.db
      .select({
        ...getTableColumns(contacts),
        score: scoreSql,
      })
      .from(contacts)
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
        contactId: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const scoreOp = dir === 'next' ? sql`<` : sql`>`;
        const nameOp = dir === 'next' ? sql`>` : sql`<`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;

        const cursorCond = or(
          sql`${scoreSql} ${scoreOp} ${c.score}`,
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${contacts.fullName}) ${nameOp} lower(${c.name})`,
          ),
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${contacts.fullName}) = lower(${c.name})`,
            sql`${contacts.contactId} ${idOp} ${c.contactId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? asc : desc;
        const scoreOp = dir === 'next' ? desc : asc;
        return q.orderBy(
          scoreOp(scoreSql),
          orderFn(sql`lower(${contacts.fullName})`),
          orderFn(contacts.contactId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        name: row.fullName || '',
        contactId: row.contactId,
      }),
    });

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(whereClause);

    const enrichedData = data.map((row) => this.mapToDto(row));

    return {
      data: enrichedData,
      page,
      limit,
      total: Number(count),
      nextCursor,
      prevCursor,
    };
  }

  async getContact(id: string): Promise<ContactResponseDto> {
    const contact = await this.db.query.contacts.findFirst({
      where: eq(contacts.contactId, id),
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    return this.mapToDto(contact);
  }

  async createContact(
    dto: CreateContactDto,
    userId: string,
  ): Promise<ContactResponseDto> {
    return await this.db.transaction(async (tx) => {
      let targetActorId: string | null = null;
      let targetProjectId: string | null = null;

      if (dto.entityType === 'customer' && dto.entityId) {
        const customer = await tx.query.customers.findFirst({
          where: eq(customers.customerId, dto.entityId),
        });
        if (!customer)
          throw new NotFoundException(
            `Customer with ID ${dto.entityId} not found`,
          );
        if (!customer.actorId)
          throw new BadRequestException(
            `Customer has no actor_id assigned yet.`,
          );
        targetActorId = customer.actorId;
      } else if (dto.entityType === 'actor' && dto.entityId) {
        const actor = await tx.query.actors.findFirst({
          where: eq(actors.actorId, dto.entityId),
        });
        if (!actor)
          throw new NotFoundException(
            `Actor with ID ${dto.entityId} not found`,
          );
        targetActorId = actor.actorId;
      } else if (dto.entityType === 'project' && dto.entityId) {
        const project = await tx.query.projects.findFirst({
          where: eq(projects.projectId, dto.entityId),
        });
        if (!project)
          throw new NotFoundException(
            `Project with ID ${dto.entityId} not found`,
          );
        targetProjectId = project.projectId;
      }

      const [newContact] = await tx
        .insert(contacts)
        .values({
          firstName: dto.firstName,
          lastName: dto.lastName,
          fullName: `${dto.firstName} ${dto.lastName}`.trim(),
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          jobTitle: dto.jobTitle,
        })
        .returning();

      if (targetActorId) {
        await tx.insert(actorContactLinks).values({
          actorId: targetActorId,
          contactId: newContact.contactId,
          linkType: 'employee',
          primaryFor: dto.primaryFor ?? (dto.isPrimary ? ['purchasing'] : []),
        });
      }

      if (targetProjectId) {
        await tx.insert(projectContacts).values({
          projectId: targetProjectId,
          contactId: newContact.contactId,
          roles: dto.projectRoles || [],
        });
      }

      await emitEvent(tx, {
        entityType: EntityType.CONTACT,
        entityId: newContact.contactId,
        eventType: EventType.CREATED,
        entityDisplayName: 'Contact',
        payload: {
          action: 'contact_created',
          contactId: newContact.contactId,
          contactName: `${newContact.firstName} ${newContact.lastName}`.trim(),
        },
        actor: userId,
      });

      return this.mapToDto(newContact, dto.primaryFor || []);
    });
  }

  async updateContact(
    id: string,
    dto: UpdateContactDto,
    userId: string,
  ): Promise<ContactResponseDto> {
    const contact = await this.db.query.contacts.findFirst({
      where: eq(contacts.contactId, id),
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const updatedFirstName = dto.firstName ?? contact.firstName;
    const updatedLastName = dto.lastName ?? contact.lastName;
    const fullName =
      `${updatedFirstName || ''} ${updatedLastName || ''}`.trim();

    return await this.db.transaction(async (tx) => {
      const [updatedContact] = await tx
        .update(contacts)
        .set({
          firstName: dto.firstName,
          lastName: dto.lastName,
          fullName: fullName || null,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          jobTitle: dto.jobTitle,
          modifiedOn: new Date(),
        })
        .where(eq(contacts.contactId, id))
        .returning();

      if (dto.primaryFor !== undefined) {
        // This is a naive implementation that sets primaryFor on ALL links for this contact to this actor.
        await tx
          .update(actorContactLinks)
          .set({ primaryFor: dto.primaryFor })
          .where(eq(actorContactLinks.contactId, id));
      } else if (dto.isPrimary !== undefined) {
        await tx
          .update(actorContactLinks)
          .set({ primaryFor: dto.isPrimary ? ['purchasing'] : [] })
          .where(eq(actorContactLinks.contactId, id));
      }

      await emitEvent(tx, {
        entityType: EntityType.CONTACT,
        entityId: updatedContact.contactId,
        eventType: EventType.UPDATED,
        entityDisplayName: 'Contact',
        payload: {
          action: 'contact_updated',
          contactId: updatedContact.contactId,
          contactName:
            `${updatedContact.firstName} ${updatedContact.lastName}`.trim(),
        },
        actor: userId,
      });

      return this.mapToDto(updatedContact, dto.primaryFor || []);
    });
  }

  async deleteContact(id: string, userId: string): Promise<void> {
    const contact = await this.db.query.contacts.findFirst({
      where: eq(contacts.contactId, id),
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await this.db.transaction(async (tx) => {
      await emitEvent(tx, {
        entityType: EntityType.CONTACT,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: 'Contact',
        payload: {
          action: 'contact_deleted',
          contactId: id,
          contactName: `${contact.firstName} ${contact.lastName}`.trim(),
        },
        actor: userId,
      });

      await tx
        .delete(actorContactLinks)
        .where(eq(actorContactLinks.contactId, id));
      await tx.delete(contacts).where(eq(contacts.contactId, id));
    });
  }

  async archiveContact(
    id: string,
    userId: string,
  ): Promise<ContactResponseDto> {
    const [updatedContact] = await this.db
      .update(contacts)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive/unarchive
      .set({ stateCode: CONTACT_STATE.ARCHIVED, modifiedOn: new Date() })
      .where(eq(contacts.contactId, id))
      .returning();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.CONTACT,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Contact',
      payload: {
        action: 'contact_archived',
        contactId: id,
      },
      actor: userId,
    });

    return this.mapToDto(updatedContact);
  }

  async unarchiveContact(
    id: string,
    userId: string,
  ): Promise<ContactResponseDto> {
    const [updatedContact] = await this.db
      .update(contacts)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive/unarchive
      .set({ stateCode: CONTACT_STATE.ACTIVE, modifiedOn: new Date() })
      .where(eq(contacts.contactId, id))
      .returning();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.CONTACT,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Contact',
      payload: {
        action: 'contact_unarchived',
        contactId: id,
      },
      actor: userId,
    });

    return this.mapToDto(updatedContact);
  }

  private mapToDto(
    record: typeof contacts.$inferSelect,
    primaryFor?: string[],
  ): ContactResponseDto {
    return {
      contactId: record.contactId,
      stateCode: record.stateCode,
      firstName: record.firstName || '',
      lastName: record.lastName || '',
      fullName: record.fullName,
      email: record.email,
      phone: record.phone,
      mobile: record.mobile,
      jobTitle: record.jobTitle,
      primaryFor: primaryFor || [],
      createdOn: record.createdOn,
      modifiedOn: record.modifiedOn,
    };
  }
}
