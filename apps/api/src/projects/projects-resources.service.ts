import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, or, and, asc, sql, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectTasks,
  projectResources,
  projectResourceAssignments,
  projectBudgetLines,
  projectLedgerEntries,
  productSuppliers,
} from '@herobm/db-schema';
import {
  CreateProjectResourceDto,
  UpdateProjectResourceDto,
  ProjectResourceQueryDto,
  ProjectResourceResponseDto,
  AssignProjectResourceDto,
  ProjectResourceAssignmentResponseDto,
  ConsumeResourceDto,
  ProjectLedgerEntryResponseDto,
} from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PROJECT_RESOURCE_STATE,
  RESOURCE_TYPE,
  PROJECT_STATE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_SOURCE_TYPE,
  computeLinePrice,
} from '@herobm/shared';

function generateResourceNumber(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RES-${rand}`;
}

@Injectable()
export class ProjectsResourcesService {
  private readonly logger = new Logger(ProjectsResourcesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createResource(
    dto: CreateProjectResourceDto,
    username?: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceResponseDto> {
    const db = tx || this.db;
    const resourceNumber = generateResourceNumber();

    let directUnitCost =
      dto.directUnitCost !== undefined && dto.directUnitCost !== null
        ? String(dto.directUnitCost)
        : '0';

    if (
      (!dto.directUnitCost || Number(dto.directUnitCost) === 0) &&
      dto.resourceType === RESOURCE_TYPE.CONTRACTOR &&
      dto.vendorId &&
      dto.serviceProductId
    ) {
      const [supplierLink] = await db
        .select({
          costPrice: productSuppliers.costPrice,
          discountPercent: productSuppliers.discountPercent,
        })
        .from(productSuppliers)
        .where(
          and(
            eq(productSuppliers.productId, dto.serviceProductId),
            eq(productSuppliers.vendorId, dto.vendorId),
          ),
        )
        .limit(1);

      if (supplierLink && supplierLink.costPrice) {
        const cost = parseFloat(String(supplierLink.costPrice));
        if (!isNaN(cost)) {
          const disc = supplierLink.discountPercent
            ? parseFloat(String(supplierLink.discountPercent))
            : 0;
          const netCost = disc > 0 ? cost * (1 - disc / 100) : cost;
          directUnitCost = netCost.toFixed(2);
        }
      }
    }

    const [resource] = await db
      .insert(projectResources)
      .values({
        resourceNumber,
        name: dto.name,
        resourceType: dto.resourceType,
        userId: dto.userId || null,
        vendorId: dto.vendorId || null,
        serviceProductId: dto.serviceProductId || null,
        baseUom: dto.baseUom,
        directUnitCost,
        unitPrice: String(dto.unitPrice),
        isActive: dto.isActive ?? true,
      })
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT_RESOURCE,
      entityId: resource.resourceId,
      eventType: EventType.CREATED,
      entityDisplayName: resource.resourceNumber,
      payload: {
        action: 'project_resource_created',
        resourceId: resource.resourceId,
        resourceNumber: resource.resourceNumber,
        name: resource.name,
        resourceType: resource.resourceType,
        createdBy: username || 'system',
      },
    });

    return this.findResourceById(resource.resourceId, db);
  }

  async findAllResources(
    query?: ProjectResourceQueryDto,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceResponseDto[]> {
    const db = tx || this.db;
    const conditions = [];

    if (query?.q) {
      const term = `%${query.q}%`;
      conditions.push(
        or(
          ilike(projectResources.name, term),
          ilike(projectResources.resourceNumber, term),
        ),
      );
    }

    if (query?.resourceType) {
      conditions.push(eq(projectResources.resourceType, query.resourceType));
    }

    if (query?.isActive !== undefined) {
      conditions.push(eq(projectResources.isActive, query.isActive));
    } else if (query?.status) {
      if (query.status === PROJECT_RESOURCE_STATE.ACTIVE) {
        conditions.push(eq(projectResources.isActive, true));
      } else if (query.status === PROJECT_RESOURCE_STATE.ARCHIVED) {
        conditions.push(eq(projectResources.isActive, false));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.query.projectResources.findMany({
      where: whereClause,
      orderBy: [asc(projectResources.name)],
      with: {
        user: true,
        vendor: true,
        serviceProduct: true,
      },
    });

    return rows as unknown as ProjectResourceResponseDto[];
  }

  async findResourceById(
    resourceId: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceResponseDto> {
    const db = tx || this.db;
    const resource = await db.query.projectResources.findFirst({
      where: eq(projectResources.resourceId, resourceId),
      with: {
        user: true,
        vendor: true,
        serviceProduct: true,
      },
    });

    if (!resource) {
      throw new NotFoundException(
        `Project resource with ID ${resourceId} not found`,
      );
    }

    return resource as unknown as ProjectResourceResponseDto;
  }

  async updateResource(
    resourceId: string,
    dto: UpdateProjectResourceDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceResponseDto> {
    const db = tx || this.db;
    const existing = await this.findResourceById(resourceId, db);

    const updateData: Partial<typeof projectResources.$inferInsert> = {
      modifiedOn: new Date(),
    };

    if (dto.resourceNumber !== undefined)
      updateData.resourceNumber = dto.resourceNumber.trim();
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.resourceType !== undefined)
      updateData.resourceType = dto.resourceType;
    if (dto.userId !== undefined) updateData.userId = dto.userId;
    if (dto.vendorId !== undefined) updateData.vendorId = dto.vendorId;
    if (dto.serviceProductId !== undefined)
      updateData.serviceProductId = dto.serviceProductId;
    if (dto.baseUom !== undefined) updateData.baseUom = dto.baseUom;
    if (dto.directUnitCost !== undefined)
      updateData.directUnitCost = String(dto.directUnitCost);
    if (dto.unitPrice !== undefined)
      updateData.unitPrice = String(dto.unitPrice);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    await db
      .update(projectResources)
      .set(updateData)
      .where(eq(projectResources.resourceId, resourceId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT_RESOURCE,
      entityId: resourceId,
      eventType: EventType.UPDATED,
      entityDisplayName: existing.resourceNumber,
      payload: {
        action: 'project_resource_updated',
        resourceId,
        resourceNumber: existing.resourceNumber,
        updatedFields: Object.keys(updateData),
        updatedBy: username,
      },
    });

    return this.findResourceById(resourceId, db);
  }

  async archiveResource(
    resourceId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceResponseDto> {
    const db = tx || this.db;
    const existing = await this.findResourceById(resourceId, db);

    await db
      .update(projectResources)
      .set({ isActive: false, modifiedOn: new Date() })
      .where(eq(projectResources.resourceId, resourceId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT_RESOURCE,
      entityId: resourceId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: existing.resourceNumber,
      payload: {
        action: 'project_resource_archived',
        resourceId,
        resourceNumber: existing.resourceNumber,
        archivedBy: username,
      },
    });

    return this.findResourceById(resourceId, db);
  }

  async unarchiveResource(
    resourceId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceResponseDto> {
    const db = tx || this.db;
    const existing = await this.findResourceById(resourceId, db);

    await db
      .update(projectResources)
      .set({ isActive: true, modifiedOn: new Date() })
      .where(eq(projectResources.resourceId, resourceId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT_RESOURCE,
      entityId: resourceId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: existing.resourceNumber,
      payload: {
        action: 'project_resource_unarchived',
        resourceId,
        resourceNumber: existing.resourceNumber,
        unarchivedBy: username,
      },
    });

    return this.findResourceById(resourceId, db);
  }

  async deleteResource(
    resourceId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<{ deleted: boolean; resourceId: string }> {
    const db = tx || this.db;
    const existing = await this.findResourceById(resourceId, db);

    // Check references in budget lines
    const [budgetRef] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.resourceId, resourceId));

    if (Number(budgetRef?.count || 0) > 0) {
      throw new BadRequestException(
        `Resource ${existing.resourceNumber} (${existing.name}) is referenced by ${budgetRef.count} project budget line(s) and cannot be deleted. Archive it instead.`,
      );
    }

    // Check references in ledger entries
    const [ledgerRef] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectLedgerEntries)
      .where(eq(projectLedgerEntries.resourceId, resourceId));

    if (Number(ledgerRef?.count || 0) > 0) {
      throw new BadRequestException(
        `Resource ${existing.resourceNumber} (${existing.name}) is referenced by ${ledgerRef.count} project subledger entry/entries and cannot be deleted. Archive it instead.`,
      );
    }

    await db
      .delete(projectResources)
      .where(eq(projectResources.resourceId, resourceId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT_RESOURCE,
      entityId: resourceId,
      eventType: EventType.DELETED,
      entityDisplayName: existing.resourceNumber,
      payload: {
        action: 'project_resource_deleted',
        resourceId,
        resourceNumber: existing.resourceNumber,
        deletedBy: username,
      },
    });

    return { deleted: true, resourceId };
  }

  async consumeResource(
    projectId: string,
    dto: ConsumeResourceDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectLedgerEntryResponseDto> {
    const db = tx || this.db;

    // 1. Verify project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (project.stateCode === PROJECT_STATE.CLOSED) {
      throw new BadRequestException(
        'Cannot consume resources on a closed project',
      );
    }

    // 2. Verify task belongs to project
    const [task] = await db
      .select()
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.projectTaskId, dto.projectTaskId),
          eq(projectTasks.projectId, projectId),
        ),
      )
      .limit(1);

    if (!task) {
      throw new BadRequestException(
        `Task ${dto.projectTaskId} not found on project ${projectId}`,
      );
    }

    // 3. Verify resource
    const resource = await this.findResourceById(dto.resourceId, db);

    // 3b. Ensure resource is assigned to project (auto-assign if not yet assigned)
    const [existingAssignment] = await db
      .select({ assignmentId: projectResourceAssignments.assignmentId })
      .from(projectResourceAssignments)
      .where(
        and(
          eq(projectResourceAssignments.projectId, projectId),
          eq(projectResourceAssignments.resourceId, dto.resourceId),
        ),
      )
      .limit(1);

    if (!existingAssignment) {
      const [newAssignment] = await db
        .insert(projectResourceAssignments)
        .values({
          projectId,
          resourceId: dto.resourceId,
          notes: 'Auto-assigned via resource consumption',
          createdBy: username,
        })
        .returning();

      await emitEvent(db, {
        entityType: EntityType.PROJECT,
        entityId: projectId,
        eventType: EventType.UPDATED,
        entityDisplayName: project.projectNumber,
        payload: {
          action: 'project_resource_assigned',
          projectId,
          resourceId: dto.resourceId,
          assignmentId: newAssignment.assignmentId,
          assignedBy: username,
          autoAssigned: true,
        },
      });
    }

    // 4. Determine cost and billable price rates
    const qty = Number(dto.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestException('Resource quantity must be greater than 0');
    }

    const unitCost =
      dto.unitCost !== undefined
        ? Number(dto.unitCost)
        : Number(resource.directUnitCost || 0);

    const unitPrice =
      dto.unitPrice !== undefined
        ? Number(dto.unitPrice)
        : Number(resource.unitPrice || 0);

    const lineDiscount =
      dto.discountPercentage !== undefined
        ? dto.discountPercentage
        : project.discountPercentage
          ? parseFloat(project.discountPercentage)
          : 0;

    const totalCost = qty * unitCost;
    const computedPrice = computeLinePrice({
      quantity: qty,
      pricePerUnit: unitPrice,
      discountPercentage: lineDiscount,
      taxRate: 0,
    });
    const totalPrice = computedPrice.amount;

    const postingDate = dto.postingDate
      ? new Date(dto.postingDate)
      : new Date();

    // 5. Insert project ledger entry
    const [ledgerLine] = await db
      .insert(projectLedgerEntries)
      .values({
        projectId,
        projectTaskId: dto.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.RESOURCE,
        sourceType: PROJECT_SOURCE_TYPE.TIMESHEET,
        resourceId: dto.resourceId,
        userId: resource.userId || null,
        budgetLineId: dto.budgetLineId || null,
        description:
          dto.description?.trim() || `Resource usage: ${resource.name}`,
        quantity: String(qty),
        unitCostBase: String(unitCost),
        totalCostBase: String(totalCost),
        unitPriceBase: String(unitPrice),
        discountPercentage: lineDiscount.toString(),
        totalPriceBase: computedPrice.amount.toString(),
        isBillable: true,
        isBilled: false,
        postingDate,
        createdBy: username,
      })
      .returning();

    // 6. Emit audit event
    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'resource_consumed',
        projectId,
        projectTaskId: dto.projectTaskId,
        resourceId: dto.resourceId,
        ledgerId: ledgerLine.ledgerId,
        quantity: qty,
        totalCost,
        totalPrice: computedPrice.amount,
        consumedBy: username,
      },
    });

    return ledgerLine as unknown as ProjectLedgerEntryResponseDto;
  }

  async findAssignedResources(
    projectId: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceAssignmentResponseDto[]> {
    const db = tx || this.db;

    const [project] = await db
      .select({ projectId: projects.projectId })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const assignments = await db.query.projectResourceAssignments.findMany({
      where: eq(projectResourceAssignments.projectId, projectId),
      orderBy: [asc(projectResourceAssignments.createdOn)],
      with: {
        resource: {
          with: {
            user: true,
            vendor: true,
            serviceProduct: true,
          },
        },
      },
    });

    const ledgerTotals = await db
      .select({
        resourceId: projectLedgerEntries.resourceId,
        consumedQuantity: sql<string>`coalesce(sum(${projectLedgerEntries.quantity}::numeric), 0)`,
        totalCost: sql<string>`coalesce(sum(${projectLedgerEntries.totalCostBase}::numeric), 0)`,
      })
      .from(projectLedgerEntries)
      .where(
        and(
          eq(projectLedgerEntries.projectId, projectId),
          eq(projectLedgerEntries.lineType, PROJECT_LINE_TYPE.RESOURCE),
        ),
      )
      .groupBy(projectLedgerEntries.resourceId);

    const totalsMap = new Map<
      string,
      { consumedQuantity: number; totalCost: number }
    >();
    for (const t of ledgerTotals) {
      if (t.resourceId) {
        totalsMap.set(t.resourceId, {
          consumedQuantity: Number(t.consumedQuantity || 0),
          totalCost: Number(t.totalCost || 0),
        });
      }
    }

    return assignments.map((a) => {
      const stats = totalsMap.get(a.resourceId) || {
        consumedQuantity: 0,
        totalCost: 0,
      };
      return {
        assignmentId: a.assignmentId,
        projectId: a.projectId,
        resourceId: a.resourceId,
        notes: a.notes,
        createdOn: a.createdOn,
        createdBy: a.createdBy,
        resource: a.resource as unknown as ProjectResourceResponseDto,
        consumedQuantity: stats.consumedQuantity,
        totalCost: stats.totalCost,
      };
    });
  }

  async assignResourceToProject(
    projectId: string,
    dto: AssignProjectResourceDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResourceAssignmentResponseDto> {
    const db = tx || this.db;

    const [project] = await db
      .select({
        projectId: projects.projectId,
        projectNumber: projects.projectNumber,
        stateCode: projects.stateCode,
      })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (project.stateCode === PROJECT_STATE.CLOSED) {
      throw new BadRequestException(
        'Cannot assign resources to a closed project',
      );
    }

    const resource = await this.findResourceById(dto.resourceId, db);

    const [existing] = await db
      .select()
      .from(projectResourceAssignments)
      .where(
        and(
          eq(projectResourceAssignments.projectId, projectId),
          eq(projectResourceAssignments.resourceId, dto.resourceId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Resource ${resource.name} is already assigned to this project`,
      );
    }

    const [assignment] = await db
      .insert(projectResourceAssignments)
      .values({
        projectId,
        resourceId: dto.resourceId,
        notes: dto.notes?.trim() || null,
        createdBy: username,
      })
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'project_resource_assigned',
        projectId,
        resourceId: dto.resourceId,
        assignmentId: assignment.assignmentId,
        assignedBy: username,
      },
    });

    return {
      assignmentId: assignment.assignmentId,
      projectId: assignment.projectId,
      resourceId: assignment.resourceId,
      notes: assignment.notes,
      createdOn: assignment.createdOn,
      createdBy: assignment.createdBy,
      resource,
      consumedQuantity: 0,
      totalCost: 0,
    };
  }

  async removeResourceFromProject(
    projectId: string,
    resourceId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<{ unassigned: boolean; resourceId: string }> {
    const db = tx || this.db;

    const [project] = await db
      .select({
        projectId: projects.projectId,
        projectNumber: projects.projectNumber,
        stateCode: projects.stateCode,
      })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const [existing] = await db
      .select()
      .from(projectResourceAssignments)
      .where(
        and(
          eq(projectResourceAssignments.projectId, projectId),
          eq(projectResourceAssignments.resourceId, resourceId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Resource assignment not found on project ${projectId}`,
      );
    }

    await db
      .delete(projectResourceAssignments)
      .where(
        and(
          eq(projectResourceAssignments.projectId, projectId),
          eq(projectResourceAssignments.resourceId, resourceId),
        ),
      );

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'project_resource_unassigned',
        projectId,
        resourceId,
        unassignedBy: username,
      },
    });

    return { unassigned: true, resourceId };
  }
}
