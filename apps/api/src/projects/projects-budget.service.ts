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
import { projects, projectTasks, projectBudgetLines } from '@herobm/db-schema';
import { CreateProjectBudgetLineDto, UpdateProjectBudgetLineDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { PROJECT_TASK_STATE, computeLinePrice } from '@herobm/shared';

@Injectable()
export class ProjectsBudgetService {
  private readonly logger = new Logger(ProjectsBudgetService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createBudgetLine(
    projectId: string,
    dto: CreateProjectBudgetLineDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [project] = await db
      .select({
        projectId: projects.projectId,
        discountPercentage: projects.discountPercentage,
      })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const [targetTask] = await db
      .select({ stateCode: projectTasks.stateCode })
      .from(projectTasks)
      .where(eq(projectTasks.projectTaskId, dto.projectTaskId))
      .limit(1);

    if (targetTask?.stateCode === PROJECT_TASK_STATE.COMPLETED) {
      throw new BadRequestException(
        'Cannot add budget allocations to a completed task.',
      );
    }

    const lineDiscount =
      dto.discountPercentage !== undefined
        ? dto.discountPercentage
        : project.discountPercentage
          ? parseFloat(project.discountPercentage)
          : 0;

    const totalCost = Number(dto.plannedQuantity) * Number(dto.unitCost);
    const computedPrice = computeLinePrice({
      quantity: Number(dto.plannedQuantity),
      pricePerUnit: Number(dto.unitPrice),
      discountPercentage: lineDiscount,
      taxRate: 0,
    });
    const totalPrice = computedPrice.amount;

    const [budgetLine] = await db
      .insert(projectBudgetLines)
      .values({
        projectId,
        projectTaskId: dto.projectTaskId,
        lineType: dto.lineType,
        resourceId: dto.resourceId,
        productId: dto.productId,
        description: dto.description,
        plannedQuantity: String(dto.plannedQuantity),
        unitCost: String(dto.unitCost),
        totalCost: String(totalCost),
        unitPrice: String(dto.unitPrice),
        discountPercentage: lineDiscount.toString(),
        totalPrice: computedPrice.amount.toString(),
      })
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: `Budget line for ${projectId}`,
      payload: {
        action: 'project_budget_line_created',
        projectId,
        budgetLineId: budgetLine.budgetLineId,
        lineType: budgetLine.lineType,
        totalCost,
        totalPrice: computedPrice.amount,
        createdBy: username,
      },
    });

    return budgetLine;
  }

  async updateBudgetLine(
    projectId: string,
    lineId: string,
    dto: UpdateProjectBudgetLineDto,
    username: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [existing] = await db
      .select()
      .from(projectBudgetLines)
      .where(
        and(
          eq(projectBudgetLines.budgetLineId, lineId),
          eq(projectBudgetLines.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Budget line with ID ${lineId} not found in project ${projectId}`,
      );
    }

    const [targetTask] = await db
      .select({ stateCode: projectTasks.stateCode })
      .from(projectTasks)
      .where(eq(projectTasks.projectTaskId, existing.projectTaskId))
      .limit(1);

    if (targetTask?.stateCode === PROJECT_TASK_STATE.COMPLETED) {
      throw new BadRequestException(
        'Cannot modify budget allocations on a completed task.',
      );
    }

    const plannedQuantity =
      dto.plannedQuantity !== undefined
        ? Number(dto.plannedQuantity)
        : Number(existing.plannedQuantity);
    const unitCost =
      dto.unitCost !== undefined
        ? Number(dto.unitCost)
        : Number(existing.unitCost);
    const unitPrice =
      dto.unitPrice !== undefined
        ? Number(dto.unitPrice)
        : Number(existing.unitPrice);

    const lineDiscount =
      dto.discountPercentage !== undefined
        ? dto.discountPercentage
        : existing.discountPercentage
          ? parseFloat(existing.discountPercentage)
          : 0;

    const totalCost = plannedQuantity * unitCost;
    const computedPrice = computeLinePrice({
      quantity: plannedQuantity,
      pricePerUnit: unitPrice,
      discountPercentage: lineDiscount,
      taxRate: 0,
    });
    const totalPrice = computedPrice.amount;

    const updateData: Partial<typeof projectBudgetLines.$inferInsert> = {
      modifiedOn: new Date(),
      plannedQuantity: String(plannedQuantity),
      unitCost: String(unitCost),
      totalCost: String(totalCost),
      unitPrice: String(unitPrice),
      discountPercentage: lineDiscount.toString(),
      totalPrice: computedPrice.amount.toString(),
    };

    if (dto.projectTaskId !== undefined)
      updateData.projectTaskId = dto.projectTaskId;
    if (dto.lineType !== undefined) updateData.lineType = dto.lineType;
    if (dto.resourceId !== undefined) updateData.resourceId = dto.resourceId;
    if (dto.productId !== undefined) updateData.productId = dto.productId;
    if (dto.description !== undefined) updateData.description = dto.description;

    const [updated] = await db
      .update(projectBudgetLines)
      .set(updateData)
      .where(eq(projectBudgetLines.budgetLineId, lineId))
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: `Budget line for ${projectId}`,
      payload: {
        action: 'project_budget_line_updated',
        projectId,
        budgetLineId: lineId,
        lineType: updated.lineType,
        totalCost,
        totalPrice,
        updatedBy: username,
      },
    });

    return updated;
  }

  async deleteBudgetLine(
    projectId: string,
    lineId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<{ deleted: boolean; lineId: string }> {
    const db = tx || this.db;
    const [existing] = await db
      .select()
      .from(projectBudgetLines)
      .where(
        and(
          eq(projectBudgetLines.budgetLineId, lineId),
          eq(projectBudgetLines.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Budget line with ID ${lineId} not found in project ${projectId}`,
      );
    }

    const [targetTask] = await db
      .select({ stateCode: projectTasks.stateCode })
      .from(projectTasks)
      .where(eq(projectTasks.projectTaskId, existing.projectTaskId))
      .limit(1);

    if (targetTask?.stateCode === PROJECT_TASK_STATE.COMPLETED) {
      throw new BadRequestException(
        'Cannot delete budget allocations on a completed task.',
      );
    }

    await db
      .delete(projectBudgetLines)
      .where(eq(projectBudgetLines.budgetLineId, lineId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: `Budget line for ${projectId}`,
      payload: {
        action: 'project_budget_line_deleted',
        projectId,
        budgetLineId: lineId,
        deletedBy: username,
      },
    });

    return { deleted: true, lineId };
  }
}
