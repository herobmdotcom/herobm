import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectNotes,
  projectContacts,
  projectActors,
  masterDataEvents,
  contacts,
  actors,
} from '../drizzle/herobm-core-schema';

import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
  CreateProjectNoteDto,
  ProjectNoteResponseDto,
  CreateProjectContactDto,
  UpdateProjectContactDto,
  CreateProjectActorDto,
  UpdateProjectActorDto,
} from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createProject(
    dto: CreateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    const [newProject] = await this.db.insert(projects).values(dto).returning();

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: newProject.projectId,
      eventType: EventType.CREATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'project_created',
        projectId: newProject.projectId,
        projectName: newProject.name,
      },
      actor: userId,
    });

    return newProject as unknown as ProjectResponseDto;
  }

  async updateProject(
    id: string,
    dto: UpdateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    const [updatedProject] = await this.db
      .update(projects)
      .set({ ...dto, modifiedOn: new Date() })
      .where(eq(projects.projectId, id))
      .returning();

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: updatedProject.projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'project_updated',
        projectId: updatedProject.projectId,
        projectName: updatedProject.name,
      },
      actor: userId,
    });

    return updatedProject as unknown as ProjectResponseDto;
  }

  async getProject(id: string): Promise<ProjectResponseDto> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.projectId, id),
      with: {
        owner: true,
        notes: {
          with: {
            createdBy: true,
          },
        },
        projectActors: {
          with: {
            actor: true,
          },
        },
        projectContacts: {
          with: {
            contact: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const events = await this.db
      .select()
      .from(masterDataEvents)
      .where(eq(masterDataEvents.entityId, id))
      .orderBy(sql`${masterDataEvents.createdOn} DESC`);

    return { ...project, events } as unknown as ProjectResponseDto;
  }

  async addNote(
    projectId: string,
    dto: CreateProjectNoteDto,
    userId: string,
  ): Promise<ProjectNoteResponseDto> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.projectId, projectId),
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const [note] = await this.db
      .insert(projectNotes)
      .values({
        projectId,
        content: dto.content,
        createdById: userId,
      })
      .returning();

    // Fetch the note again to get the createdBy user relation populated
    const fetchedNote = await this.db.query.projectNotes.findFirst({
      where: eq(projectNotes.noteId, note.noteId),
      with: { createdBy: true },
    });

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'note_added',
        projectId,
        projectName: project.name,
        noteId: note.noteId,
      },
      actor: userId,
    });

    await this.touchProject(projectId);

    return fetchedNote as unknown as ProjectNoteResponseDto;
  }

  async removeNote(
    projectId: string,
    noteId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [deleted] = await this.db
      .delete(projectNotes)
      .where(
        and(
          eq(projectNotes.projectId, projectId),
          eq(projectNotes.noteId, noteId),
        ),
      )
      .returning();
    if (!deleted) {
      throw new NotFoundException(`Note not found`);
    }

    const project = await this.db.query.projects.findFirst({
      where: eq(projects.projectId, projectId),
    });

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'note_removed',
        projectId,
        projectName: project?.name,
        noteId,
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async addContact(
    projectId: string,
    dto: CreateProjectContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db.insert(projectContacts).values({
      projectId,
      contactId: dto.contactId,
      roles: dto.roles || [],
    });

    const [project, contact] = await Promise.all([
      this.db.query.projects.findFirst({
        where: eq(projects.projectId, projectId),
      }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, dto.contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'contact_added',
        projectId,
        projectName: project?.name,
        contactId: dto.contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
        roles: dto.roles || [],
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async removeContact(
    projectId: string,
    contactId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db
      .delete(projectContacts)
      .where(
        and(
          eq(projectContacts.projectId, projectId),
          eq(projectContacts.contactId, contactId),
        ),
      );

    const [project, contact] = await Promise.all([
      this.db.query.projects.findFirst({
        where: eq(projects.projectId, projectId),
      }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'contact_removed',
        projectId,
        projectName: project?.name,
        contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async updateContact(
    projectId: string,
    contactId: string,
    dto: UpdateProjectContactDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [updated] = await this.db
      .update(projectContacts)
      .set({ roles: dto.roles || [] })
      .where(
        and(
          eq(projectContacts.projectId, projectId),
          eq(projectContacts.contactId, contactId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('Project contact link not found');
    }

    const [project, contact] = await Promise.all([
      this.db.query.projects.findFirst({
        where: eq(projects.projectId, projectId),
      }),
      this.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contactId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'contact_updated',
        projectId,
        projectName: project?.name,
        contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : undefined,
        roles: dto.roles || [],
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async addActor(
    projectId: string,
    dto: CreateProjectActorDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db.insert(projectActors).values({
      projectId,
      actorId: dto.actorId,
      roles: dto.roles || [],
    });

    const [project, actor] = await Promise.all([
      this.db.query.projects.findFirst({
        where: eq(projects.projectId, projectId),
      }),
      this.db.query.actors.findFirst({
        where: eq(actors.actorId, dto.actorId),
      }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'actor_added',
        projectId,
        projectName: project?.name,
        actorId: dto.actorId,
        actorName: actor?.name,
        roles: dto.roles || [],
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async updateActor(
    projectId: string,
    actorId: string,
    dto: UpdateProjectActorDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [updated] = await this.db
      .update(projectActors)
      .set({ roles: dto.roles || [] })
      .where(
        and(
          eq(projectActors.projectId, projectId),
          eq(projectActors.actorId, actorId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('Project actor link not found');
    }

    const [project, actor] = await Promise.all([
      this.db.query.projects.findFirst({
        where: eq(projects.projectId, projectId),
      }),
      this.db.query.actors.findFirst({ where: eq(actors.actorId, actorId) }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'actor_updated',
        projectId,
        projectName: project?.name,
        actorId,
        actorName: actor?.name,
        roles: dto.roles || [],
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async removeActor(
    projectId: string,
    actorId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.db
      .delete(projectActors)
      .where(
        and(
          eq(projectActors.projectId, projectId),
          eq(projectActors.actorId, actorId),
        ),
      );

    const [project, actor] = await Promise.all([
      this.db.query.projects.findFirst({
        where: eq(projects.projectId, projectId),
      }),
      this.db.query.actors.findFirst({ where: eq(actors.actorId, actorId) }),
    ]);

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'actor_removed',
        projectId,
        projectName: project?.name,
        actorId,
        actorName: actor?.name,
      },
      actor: userId,
    });

    await this.touchProject(projectId);
    return { success: true };
  }

  async getProjects(): Promise<ProjectResponseDto[]> {
    const allProjects = await this.db.query.projects.findMany({
      with: {
        projectActors: true,
        projectContacts: true,
      },
      orderBy: (projects, { desc }) => [desc(projects.createdOn)],
    });
    return allProjects as unknown as ProjectResponseDto[];
  }

  async deleteProject(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const [deletedProject] = await this.db
      .delete(projects)
      .where(eq(projects.projectId, id))
      .returning();

    if (!deletedProject) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.PROJECT,
      entityId: id,
      eventType: EventType.DELETED,
      entityDisplayName: 'Project',
      payload: {
        action: 'project_deleted',
        projectId: id,
        projectName: deletedProject.name,
      },
      actor: userId,
    });

    return { success: true };
  }

  // @herobm-skip-audit
  private async touchProject(projectId: string) {
    await this.db
      .update(projects)
      .set({ modifiedOn: new Date() })
      .where(eq(projects.projectId, projectId));
  }
}
