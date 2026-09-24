import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectTasks,
  projectBudgetLines,
  projectLedgerEntries,
} from '@herobm/db-schema';
import { CreateProjectTaskDto, UpdateProjectTaskDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PROJECT_STATE,
  PROJECT_TASK_STATE,
  PROJECT_TASK_TRANSITIONS,
  getAllowedTransitions,
} from '@herobm/shared';

@Injectable()
export class ProjectsTasksService {
  private readonly logger = new Logger(ProjectsTasksService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createTask(
    projectId: string,
    dto: CreateProjectTaskDto,
    username: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [project] = await db
      .select({ projectId: projects.projectId })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const [newTask] = await db
      .insert(projectTasks)
      .values({
        projectId,
        taskCode: dto.taskCode,
        name: dto.name,
        description: dto.description,
        parentTaskId: dto.parentTaskId,
        stateCode: PROJECT_TASK_STATE.NOT_STARTED,
        isMilestone: dto.isMilestone ?? false,
        isBillable: dto.isBillable ?? true,
        plannedStartDate: dto.plannedStartDate
          ? new Date(dto.plannedStartDate)
          : null,
        plannedEndDate: dto.plannedEndDate
          ? new Date(dto.plannedEndDate)
          : null,
        createdBy: username,
      })
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT_TASK,
      entityId: newTask.projectTaskId,
      eventType: EventType.CREATED,
      entityDisplayName: newTask.taskCode,
      payload: {
        action: 'project_task_created',
        projectId,
        taskId: newTask.projectTaskId,
        taskCode: newTask.taskCode,
        name: newTask.name,
        createdBy: username,
      },
    });

    return newTask;
  }

  async updateTask(
    taskId: string,
    dto: UpdateProjectTaskDto,
    username: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [existing] = await db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectTaskId, taskId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Project task with ID ${taskId} not found`);
    }

    if (existing.stateCode === PROJECT_TASK_STATE.COMPLETED) {
      throw new BadRequestException(
        'Completed tasks are finalized and cannot be modified.',
      );
    }

    if (dto.stateCode && dto.stateCode !== existing.stateCode) {
      const allowed = getAllowedTransitions(
        PROJECT_TASK_TRANSITIONS,
        existing.stateCode,
      );
      if (!allowed.includes(dto.stateCode)) {
        throw new BadRequestException(
          `Invalid task transition from '${existing.stateCode}' to '${dto.stateCode}'. Allowed destinations: ${allowed.join(', ') || 'none'}`,
        );
      }

      if (dto.stateCode === PROJECT_TASK_STATE.IN_PROGRESS) {
        const [project] = await db
          .select({ stateCode: projects.stateCode })
          .from(projects)
          .where(eq(projects.projectId, existing.projectId))
          .limit(1);

        if (!project || project.stateCode !== PROJECT_STATE.ACTIVE) {
          throw new BadRequestException(
            'Cannot start a task unless the project is active',
          );
        }
      }
    }

    const updateData: Partial<typeof projectTasks.$inferInsert> = {
      modifiedOn: new Date(),
    };

    if (dto.taskCode !== undefined) updateData.taskCode = dto.taskCode;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.parentTaskId !== undefined)
      updateData.parentTaskId = dto.parentTaskId;
    if (dto.stateCode !== undefined) updateData.stateCode = dto.stateCode;
    if (dto.isMilestone !== undefined) updateData.isMilestone = dto.isMilestone;
    if (dto.isBillable !== undefined) updateData.isBillable = dto.isBillable;
    if (dto.plannedStartDate !== undefined)
      updateData.plannedStartDate = dto.plannedStartDate
        ? new Date(dto.plannedStartDate)
        : null;
    if (dto.plannedEndDate !== undefined)
      updateData.plannedEndDate = dto.plannedEndDate
        ? new Date(dto.plannedEndDate)
        : null;
    if (dto.actualStartDate !== undefined)
      updateData.actualStartDate = dto.actualStartDate
        ? new Date(dto.actualStartDate)
        : null;
    if (dto.actualEndDate !== undefined)
      updateData.actualEndDate = dto.actualEndDate
        ? new Date(dto.actualEndDate)
        : null;

    if (
      dto.stateCode === PROJECT_TASK_STATE.COMPLETED &&
      !updateData.actualEndDate
    ) {
      updateData.actualEndDate = new Date();
    }

    const [updated] = await db
      .update(projectTasks)
      .set(updateData)
      .where(eq(projectTasks.projectTaskId, taskId))
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT_TASK,
      entityId: updated.projectTaskId,
      eventType: EventType.UPDATED,
      entityDisplayName: updated.taskCode,
      payload: {
        action: 'project_task_updated',
        projectId: existing.projectId,
        taskId: updated.projectTaskId,
        taskCode: updated.taskCode,
        name: updated.name,
        stateCode: updated.stateCode,
        updatedBy: username,
      },
    });

    return updated;
  }

  async deleteTask(
    projectId: string,
    taskId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<{ deleted: boolean; taskId: string }> {
    const db = tx || this.db;
    const [existing] = await db
      .select()
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.projectTaskId, taskId),
          eq(projectTasks.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Project task with ID ${taskId} not found in project ${projectId}`,
      );
    }

    if (existing.stateCode === PROJECT_TASK_STATE.COMPLETED) {
      throw new BadRequestException('Completed tasks cannot be deleted.');
    }

    // Check for child tasks
    const [childTask] = await db
      .select({ id: projectTasks.projectTaskId })
      .from(projectTasks)
      .where(eq(projectTasks.parentTaskId, taskId))
      .limit(1);

    if (childTask) {
      throw new BadRequestException(
        'Cannot delete a task that has child subtasks. Please delete or reassign subtasks first.',
      );
    }

    // Check for linked budget lines
    const [budgetLine] = await db
      .select({ id: projectBudgetLines.budgetLineId })
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.projectTaskId, taskId))
      .limit(1);

    if (budgetLine) {
      throw new BadRequestException(
        'Cannot delete a task that has budget line allocations. Please delete or reassign budget lines first.',
      );
    }

    // Check for linked ledger entries (actuals)
    const [ledgerEntry] = await db
      .select({ id: projectLedgerEntries.ledgerId })
      .from(projectLedgerEntries)
      .where(eq(projectLedgerEntries.projectTaskId, taskId))
      .limit(1);

    if (ledgerEntry) {
      throw new BadRequestException(
        'Cannot delete a task with posted actual ledger transactions.',
      );
    }

    await db.delete(projectTasks).where(eq(projectTasks.projectTaskId, taskId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT_TASK,
      entityId: taskId,
      eventType: EventType.DELETED,
      entityDisplayName: existing.taskCode,
      payload: {
        action: 'project_task_deleted',
        projectId,
        taskId,
        taskCode: existing.taskCode,
        name: existing.name,
        deletedBy: username,
      },
    });

    return { deleted: true, taskId };
  }
}
