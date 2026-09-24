import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { projects, projectNotes } from '@herobm/db-schema';
import { CreateProjectNoteDto, ProjectNoteResponseDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ProjectsNotesService {
  private readonly logger = new Logger(ProjectsNotesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async verifyProjectExists(projectId: string, db: DrizzleDB) {
    const [project] = await db
      .select({ projectId: projects.projectId })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
  }

  async addProjectNote(
    projectId: string,
    dto: CreateProjectNoteDto,
    userId: string,
    tx?: DrizzleDB,
  ): Promise<ProjectNoteResponseDto> {
    const db = tx || this.db;
    await this.verifyProjectExists(projectId, db);

    const [newNote] = await db
      .insert(projectNotes)
      .values({
        projectId,
        content: dto.content,
        createdById: userId,
      })
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'project_note_added',
        projectId,
        noteId: newNote.noteId,
      },
      actor: userId,
    });

    await db
      .update(projects)
      .set({ modifiedOn: new Date() })
      .where(eq(projects.projectId, projectId));

    const createdNoteWithAuthor = await db.query.projectNotes.findFirst({
      where: eq(projectNotes.noteId, newNote.noteId),
      with: {
        createdBy: true,
      },
    });

    return (createdNoteWithAuthor ||
      newNote) as unknown as ProjectNoteResponseDto;
  }

  async getProjectNotes(
    projectId: string,
    tx?: DrizzleDB,
  ): Promise<ProjectNoteResponseDto[]> {
    const db = tx || this.db;
    await this.verifyProjectExists(projectId, db);

    const notes = await db.query.projectNotes.findMany({
      where: eq(projectNotes.projectId, projectId),
      orderBy: [desc(projectNotes.createdOn)],
      with: {
        createdBy: true,
      },
    });

    return notes as unknown as ProjectNoteResponseDto[];
  }

  async deleteProjectNote(
    projectId: string,
    noteId: string,
    userId: string,
    tx?: DrizzleDB,
  ): Promise<{ success: boolean }> {
    const db = tx || this.db;
    await this.verifyProjectExists(projectId, db);

    const [deleted] = await db
      .delete(projectNotes)
      .where(
        and(
          eq(projectNotes.projectId, projectId),
          eq(projectNotes.noteId, noteId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Project',
      payload: {
        action: 'project_note_deleted',
        projectId,
        noteId,
      },
      actor: userId,
    });

    await db
      .update(projects)
      .set({ modifiedOn: new Date() })
      .where(eq(projects.projectId, projectId));

    return { success: true };
  }
}
