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
import { parsePagination, withCursorPagination } from '../common/pagination';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  organizations,
  organizationContactLinks,
  organizationOrganizationLinks,
  organizationNotes,
  masterDataEvents,
  contacts,
  users,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { ORGANIZATION_STATE } from '@herobm/shared';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationResponseDto,
  UpdateOrganizationContactDto,
  CreateOrganizationContactDto,
  CreateOrganizationNoteDto,
  OrganizationNoteResponseDto,
  CreateOrganizationLinkDto,
  OrganizationLinkResponseDto,
  SuccessResponseDto,
  OrganizationQueryDto,
} from './dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createOrganization(
    dto: CreateOrganizationDto,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    const [newOrg] = await this.db
      .insert(organizations)
      .values({
        ...dto,
        isTaxRegistered: dto.isTaxRegistered ?? false,
        stateCode: ORGANIZATION_STATE.ACTIVE,
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: newOrg.organizationId,
      eventType: EventType.CREATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_created',
        organizationId: newOrg.organizationId,
        organizationName: newOrg.name,
      },
      actor: userId,
    });

    return newOrg as unknown as OrganizationResponseDto;
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    const [updatedOrg] = await this.db
      .update(organizations)
      .set({ ...dto, modifiedOn: new Date() })
      .where(eq(organizations.organizationId, id))
      .returning();

    if (!updatedOrg) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: updatedOrg.organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_updated',
        organizationId: updatedOrg.organizationId,
        organizationName: updatedOrg.name,
      },
      actor: userId,
    });

    return updatedOrg as unknown as OrganizationResponseDto;
  }

  async getOrganization(id: string): Promise<OrganizationResponseDto> {
    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.organizationId, id),
      with: {
        owner: true,
        notes: {
          with: {
            createdBy: true,
          },
        },
        organizationContactLinks: {
          with: {
            contact: true,
          },
        },
        customers: true,
        suppliers: true,
        referredByOrganization: true,
        referredByContact: true,
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    const events = await this.db
      .select()
      .from(masterDataEvents)
      .where(eq(masterDataEvents.entityId, id))
      .orderBy(sql`${masterDataEvents.createdOn} DESC`);

    const orgWithRefs = org as typeof org & {
      referredByOrganization?: { name: string } | null;
      referredByContact?: { fullName: string } | null;
      owner?: { displayName?: string | null; username: string } | null;
    };

    const result = {
      ...org,
      events,
      referredByOrganizationName:
        orgWithRefs.referredByOrganization?.name || null,
      referredByContactName: orgWithRefs.referredByContact?.fullName || null,
      ownerDisplayName:
        orgWithRefs.owner?.displayName || orgWithRefs.owner?.username || null,
    };

    return result as unknown as OrganizationResponseDto;
  }

  async getOrganizations(query?: OrganizationQueryDto) {
    const { page, limit, cursor, direction, searchTerm, includeArchived } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${organizations.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${organizations.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(ilike(organizations.name, `%${rawSearchTerm}%`));
    }

    if (!includeArchived) {
      conditions.push(
        sql`${organizations.stateCode} != ${ORGANIZATION_STATE.ARCHIVED}`,
      );
    }

    if (query?.ownerId) {
      if (query.ownerId === 'unassigned') {
        conditions.push(sql`${organizations.ownerId} IS NULL`);
      } else {
        conditions.push(eq(organizations.ownerId, query.ownerId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let qb = this.db
      .select({
        ...getTableColumns(organizations),
        score: scoreSql,
        ownerDisplayName: sql<
          string | null
        >`COALESCE(${users.displayName}, ${users.username})`,
      })
      .from(organizations)
      .leftJoin(users, eq(organizations.ownerId, users.userId))
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
        organizationId: string;
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
            sql`lower(${organizations.name}) ${nameOp} lower(${c.name})`,
          ),
          and(
            sql`${scoreSql} = ${c.score}`,
            sql`lower(${organizations.name}) = lower(${c.name})`,
            sql`${organizations.organizationId} ${idOp} ${c.organizationId}`,
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
          nameSortOrder(sql`lower(${organizations.name})`),
          nameSortOrder(organizations.organizationId),
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle pagination requires loose typing here
      encodeRow: (item: any) => ({
        score: Number(item.score || 0),
        name: item.name || '',
        organizationId: item.organizationId,
      }),
    });

    return {
      data: data as unknown as OrganizationResponseDto[],
      nextCursor,
      prevCursor,
    };
  }

  async deleteOrganization(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [deletedOrg] = await this.db
      .delete(organizations)
      .where(eq(organizations.organizationId, id))
      .returning();

    if (!deletedOrg) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: id,
      eventType: EventType.DELETED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_deleted',
        organizationId: id,
        organizationName: deletedOrg.name,
      },
      actor: userId,
    });

    return { success: true };
  }

  async archiveOrganization(
    id: string,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    const [updatedOrg] = await this.db
      .update(organizations)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive/unarchive
      .set({ stateCode: ORGANIZATION_STATE.ARCHIVED, modifiedOn: new Date() })
      .where(eq(organizations.organizationId, id))
      .returning();

    if (!updatedOrg) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_archived',
        organizationId: id,
      },
      actor: userId,
    });

    return updatedOrg as unknown as OrganizationResponseDto;
  }

  async unarchiveOrganization(
    id: string,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    const [updatedOrg] = await this.db
      .update(organizations)
      // eslint-disable-next-line no-restricted-syntax -- Allowed for archive/unarchive
      .set({ stateCode: ORGANIZATION_STATE.ACTIVE, modifiedOn: new Date() })
      .where(eq(organizations.organizationId, id))
      .returning();

    if (!updatedOrg) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: id,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_unarchived',
        organizationId: id,
      },
      actor: userId,
    });

    return updatedOrg as unknown as OrganizationResponseDto;
  }

  // @herobm-skip-audit
  private async touchOrganization(organizationId: string) {
    await this.db
      .update(organizations)
      .set({ modifiedOn: new Date() })
      .where(eq(organizations.organizationId, organizationId));
  }

  async addNote(
    organizationId: string,
    dto: CreateOrganizationNoteDto,
    userId: string,
  ): Promise<OrganizationNoteResponseDto> {
    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.organizationId, organizationId),
    });
    if (!org) {
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );
    }

    const [note] = await this.db
      .insert(organizationNotes)
      .values({
        organizationId,
        content: dto.content,
        createdById: userId,
      })
      .returning();

    const fetchedNote = await this.db.query.organizationNotes.findFirst({
      where: eq(organizationNotes.noteId, note.noteId),
      with: { createdBy: true },
    });

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'note_added',
        organizationId,
        organizationName: org?.name,
        noteId: note.noteId,
      },
      actor: userId,
    });

    await this.touchOrganization(organizationId);

    return fetchedNote as unknown as OrganizationNoteResponseDto;
  }

  async removeNote(
    organizationId: string,
    noteId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [deleted] = await this.db
      .delete(organizationNotes)
      .where(
        and(
          eq(organizationNotes.organizationId, organizationId),
          eq(organizationNotes.noteId, noteId),
        ),
      )
      .returning();
    if (!deleted) {
      throw new NotFoundException(`Note not found`);
    }

    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.organizationId, organizationId),
    });

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'note_removed',
        organizationId,
        organizationName: org?.name,
        noteId,
      },
      actor: userId,
    });

    await this.touchOrganization(organizationId);
    return { success: true };
  }

  async updateContact(
    organizationId: string,
    contactId: string,
    dto: UpdateOrganizationContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [updated] = await this.db
      .update(organizationContactLinks)
      .set({ primaryFor: dto.primaryFor })
      .where(
        and(
          eq(organizationContactLinks.organizationId, organizationId),
          eq(organizationContactLinks.contactId, contactId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException(`Organization contact link not found`);
    }

    const [org, contact] = await Promise.all([
      this.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, organizationId),
      }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'contact_updated',
        organizationId,
        organizationName: org?.name,
        contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
        primaryFor: dto.primaryFor,
      },
      actor: userId,
    });

    await this.touchOrganization(organizationId);

    return { success: true };
  }

  async addContact(
    organizationId: string,
    dto: CreateOrganizationContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db.insert(organizationContactLinks).values({
      organizationId,
      contactId: dto.contactId,
      primaryFor: dto.primaryFor || [],
      linkType: 'employee',
    });

    const [org, contact] = await Promise.all([
      this.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, organizationId),
      }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, dto.contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'contact_added',
        organizationId,
        organizationName: org?.name,
        contactId: dto.contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
        primaryFor: dto.primaryFor || [],
      },
      actor: userId,
    });

    await this.touchOrganization(organizationId);

    return { success: true };
  }

  async removeContact(
    organizationId: string,
    contactId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db
      .delete(organizationContactLinks)
      .where(
        and(
          eq(organizationContactLinks.organizationId, organizationId),
          eq(organizationContactLinks.contactId, contactId),
        ),
      );

    const [org, contact] = await Promise.all([
      this.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, organizationId),
      }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'contact_removed',
        organizationId,
        organizationName: org?.name,
        contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
      },
      actor: userId,
    });

    await this.touchOrganization(organizationId);

    return { success: true };
  }

  async getOrganizationLinks(
    organizationId: string,
  ): Promise<OrganizationLinkResponseDto[]> {
    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.organizationId, organizationId),
    });
    if (!org) {
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );
    }

    const links = await this.db.query.organizationOrganizationLinks.findMany({
      where: or(
        eq(organizationOrganizationLinks.sourceOrganizationId, organizationId),
        eq(organizationOrganizationLinks.targetOrganizationId, organizationId),
      ),
      with: {
        sourceOrganization: {
          columns: {
            organizationId: true,
            name: true,
            industry: true,
          },
        },
        targetOrganization: {
          columns: {
            organizationId: true,
            name: true,
            industry: true,
          },
        },
      },
      orderBy: [desc(organizationOrganizationLinks.createdOn)],
    });

    return links as unknown as OrganizationLinkResponseDto[];
  }

  async addOrganizationLink(
    sourceOrganizationId: string,
    dto: CreateOrganizationLinkDto,
    userId: string,
  ): Promise<OrganizationLinkResponseDto> {
    if (sourceOrganizationId === dto.targetOrganizationId) {
      throw new BadRequestException('Cannot link an organization to itself');
    }

    const [source, target] = await Promise.all([
      this.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, sourceOrganizationId),
      }),
      this.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, dto.targetOrganizationId),
      }),
    ]);

    if (!source) {
      throw new NotFoundException(
        `Organization with ID ${sourceOrganizationId} not found`,
      );
    }
    if (!target) {
      throw new NotFoundException(
        `Target organization with ID ${dto.targetOrganizationId} not found`,
      );
    }

    const [newLink] = await this.db
      .insert(organizationOrganizationLinks)
      .values({
        sourceOrganizationId,
        targetOrganizationId: dto.targetOrganizationId,
        linkType: dto.linkType,
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: sourceOrganizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_link_added',
        linkId: newLink.linkId,
        sourceOrganizationId,
        targetOrganizationId: dto.targetOrganizationId,
        linkType: dto.linkType,
      },
      actor: userId,
    });

    await this.touchOrganization(sourceOrganizationId);

    const fetched = await this.db.query.organizationOrganizationLinks.findFirst(
      {
        where: eq(organizationOrganizationLinks.linkId, newLink.linkId),
        with: {
          sourceOrganization: {
            columns: { organizationId: true, name: true, industry: true },
          },
          targetOrganization: {
            columns: { organizationId: true, name: true, industry: true },
          },
        },
      },
    );

    return fetched as unknown as OrganizationLinkResponseDto;
  }

  async removeOrganizationLink(
    organizationId: string,
    linkId: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const [deleted] = await this.db
      .delete(organizationOrganizationLinks)
      .where(
        and(
          eq(organizationOrganizationLinks.linkId, linkId),
          or(
            eq(
              organizationOrganizationLinks.sourceOrganizationId,
              organizationId,
            ),
            eq(
              organizationOrganizationLinks.targetOrganizationId,
              organizationId,
            ),
          ),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException(
        `Link with ID ${linkId} not found for organization ${organizationId}`,
      );
    }

    await emitEvent(this.db, {
      entityType: EntityType.ORGANIZATION,
      entityId: organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization',
      payload: {
        action: 'organization_link_removed',
        linkId,
      },
      actor: userId,
    });

    await this.touchOrganization(organizationId);

    return { success: true };
  }
}
