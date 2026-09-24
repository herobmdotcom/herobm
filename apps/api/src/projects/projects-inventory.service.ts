import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectTasks,
  projectBudgetLines,
  projectLedgerEntries,
  products,
  bins,
  zones,
} from '@herobm/db-schema';
import {
  IssueInventoryDto,
  ReturnInventoryDto,
  ProjectProfitabilityResponseDto,
} from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import {
  PROJECT_LINE_TYPE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_SOURCE_TYPE,
  PROJECT_TASK_STATE,
  computeLinePrice,
} from '@herobm/shared';

function generateStockEntryNumber(prefix: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${today}-${rand}`;
}

@Injectable()
export class ProjectsInventoryService {
  private readonly logger = new Logger(ProjectsInventoryService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(forwardRef(() => InventoryMovementService))
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  private async getProjectOrThrow(projectId: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return project;
  }

  async issueInventoryToProject(
    projectId: string,
    dto: IssueInventoryDto,
    username: string,
    passedTx?: DrizzleDB,
  ) {
    const run = async (tx: DrizzleDB) => {
      const project = await this.getProjectOrThrow(projectId, tx);

      // Verify product
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.productId, dto.productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${dto.productId} not found`,
        );
      }

      // Resolve Location and Bin (fallback to project staging location/bin)
      const locationId = dto.locationId || project.stagingLocationId;
      const binId = dto.binId || project.stagingBinId;

      if (!locationId || !binId) {
        throw new BadRequestException(
          'Location and Bin are required for material issue (or assign a staging location and bin to the project)',
        );
      }

      // Verify Bin and location
      const [bin] = await tx
        .select({
          binId: bins.binId,
          binNumber: bins.binNumber,
          zoneId: bins.zoneId,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(and(eq(bins.binId, binId), eq(zones.locationId, locationId)))
        .limit(1);

      if (!bin) {
        throw new BadRequestException(
          `Bin ${binId} not found in location ${locationId}`,
        );
      }

      // Determine unit cost and billable price
      const unitCost =
        dto.unitCost !== undefined
          ? dto.unitCost
          : Number(
              product.standardCost ||
                product.weightedAverageCost ||
                product.tradePrice ||
                0,
            );
      const unitPrice =
        dto.unitPrice !== undefined
          ? dto.unitPrice
          : Number(product.listPrice || unitCost * 1.3);

      let lineDiscount = 0;
      if (dto.discountPercentage !== undefined) {
        lineDiscount = Number(dto.discountPercentage);
      } else if (dto.budgetLineId) {
        const [bl] = await tx
          .select({ discountPercentage: projectBudgetLines.discountPercentage })
          .from(projectBudgetLines)
          .where(eq(projectBudgetLines.budgetLineId, dto.budgetLineId))
          .limit(1);
        if (bl && bl.discountPercentage) {
          lineDiscount = Number(bl.discountPercentage);
        } else if (project.discountPercentage) {
          lineDiscount = Number(project.discountPercentage);
        }
      } else if (project.discountPercentage) {
        lineDiscount = Number(project.discountPercentage);
      }

      const totalCost = Number(dto.quantity) * unitCost;
      const computedPrice = computeLinePrice({
        quantity: Number(dto.quantity),
        pricePerUnit: unitPrice,
        discountPercentage: lineDiscount,
        taxRate: 0,
      });
      const totalPrice = computedPrice.amount;

      // 1. Delegate inventory movement to InventoryMovementService
      const entryNumber = generateStockEntryNumber('STK-PRJ-ISSUE');
      const invMovement =
        await this.inventoryMovementService.recordInventoryMovement(tx, {
          entryNumber,
          sourceType: 'PROJECT_ISSUE',
          sourceId: projectId,
          memo:
            dto.memo || `Material issue to project ${project.projectNumber}`,
          userId: username,
          lines: [
            {
              productId: dto.productId,
              binId: binId,
              quantity: -Math.abs(dto.quantity),
              uomCode: product.baseUom || 'EA',
            },
          ],
        });

      // 2. Record project actual cost in Project Ledger
      const isFromStagingBin =
        project.stagingBinId && binId === project.stagingBinId;

      const [ledgerLine] = await tx
        .insert(projectLedgerEntries)
        .values({
          projectId,
          projectTaskId: dto.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.ITEM,
          sourceType: PROJECT_SOURCE_TYPE.INVENTORY_ISSUE,
          sourceId: invMovement?.entryId || null,
          inventoryEntryId: invMovement?.entryId || null,
          productId: dto.productId,
          budgetLineId: dto.budgetLineId || null,
          description: dto.memo || `Issued ${dto.quantity}x ${product.name}`,
          quantity: String(dto.quantity),
          unitCostBase: String(unitCost),
          totalCostBase: String(totalCost),
          unitPriceBase: String(unitPrice),
          discountPercentage: String(lineDiscount),
          totalPriceBase: String(totalPrice),
          isBillable: true,
          isBilled: false,
          postingDate: new Date(),
          createdBy: username,
        })
        .returning();

      // If issuing stock that was already staged (and charged at staging time),
      // offset the staging-level charge so the project total material cost is not double-counted
      if (isFromStagingBin) {
        let stagingTaskId: string | null = null;
        const [firstTask] = await tx
          .select({ projectTaskId: projectTasks.projectTaskId })
          .from(projectTasks)
          .where(eq(projectTasks.projectId, projectId))
          .limit(1);
        stagingTaskId = firstTask?.projectTaskId || null;

        if (stagingTaskId) {
          await tx.insert(projectLedgerEntries).values({
            projectId,
            projectTaskId: stagingTaskId,
            entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
            lineType: PROJECT_LINE_TYPE.ITEM,
            sourceType: PROJECT_SOURCE_TYPE.INVENTORY_ISSUE,
            productId: dto.productId,
            description: `Reallocated from staging to Task for ${dto.quantity}x ${product.name}`,
            quantity: String(-Math.abs(dto.quantity)),
            unitCostBase: String(unitCost),
            totalCostBase: String(-totalCost),
            unitPriceBase: String(unitPrice),
            discountPercentage: String(lineDiscount),
            totalPriceBase: String(-totalPrice),
            isBillable: true,
            isBilled: false,
            postingDate: new Date(),
            createdBy: username,
          });
        }
      }

      // 3. Emit Audit Event
      await emitEvent(tx, {
        entityType: EntityType.PROJECT_LEDGER,
        entityId: ledgerLine.ledgerId,
        eventType: EventType.CREATED,
        entityDisplayName: `Issue to ${project.projectNumber}`,
        payload: {
          action: 'project_material_issued',
          projectId,
          taskId: dto.projectTaskId,
          productId: dto.productId,
          productName: product.name,
          quantity: dto.quantity,
          totalCost,
          binId: binId,
          binNumber: bin.binNumber,
          issuedBy: username,
        },
      });

      return ledgerLine;
    };

    if (passedTx) {
      return run(passedTx);
    }
    return this.db.transaction(run);
  }

  async returnInventoryFromProject(
    projectId: string,
    dto: ReturnInventoryDto,
    username: string,
    passedTx?: DrizzleDB,
  ) {
    const run = async (tx: DrizzleDB) => {
      const project = await this.getProjectOrThrow(projectId, tx);

      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.productId, dto.productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${dto.productId} not found`,
        );
      }

      const [bin] = await tx
        .select({
          binId: bins.binId,
          binNumber: bins.binNumber,
          zoneId: bins.zoneId,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(eq(bins.binId, dto.binId), eq(zones.locationId, dto.locationId)),
        )
        .limit(1);

      if (!bin) {
        throw new BadRequestException(`Invalid destination bin ${dto.binId}`);
      }

      let unitCost = dto.unitCost;
      let unitPrice = dto.unitPrice;

      if (unitCost === undefined || unitPrice === undefined) {
        const [lastIssue] = await tx
          .select({
            unitCostBase: projectLedgerEntries.unitCostBase,
            unitPriceBase: projectLedgerEntries.unitPriceBase,
          })
          .from(projectLedgerEntries)
          .where(
            and(
              eq(projectLedgerEntries.projectId, projectId),
              eq(projectLedgerEntries.projectTaskId, dto.projectTaskId),
              eq(projectLedgerEntries.productId, dto.productId),
            ),
          )
          .orderBy(desc(projectLedgerEntries.postingDate))
          .limit(1);

        if (lastIssue) {
          if (unitCost === undefined) unitCost = Number(lastIssue.unitCostBase);
          if (unitPrice === undefined)
            unitPrice = Number(lastIssue.unitPriceBase);
        }
      }

      if (unitCost === undefined) {
        unitCost = Number(
          product.standardCost ||
            product.weightedAverageCost ||
            product.tradePrice ||
            0,
        );
      }
      if (unitPrice === undefined) {
        unitPrice = Number(product.listPrice || unitCost * 1.3);
      }

      const totalCost = Number(dto.quantity) * unitCost;
      const totalPrice = Number(dto.quantity) * unitPrice;

      // 1. Stock Return Movement via InventoryMovementService
      const entryNumber = generateStockEntryNumber('STK-PRJ-RETURN');
      const invMovement =
        await this.inventoryMovementService.recordInventoryMovement(tx, {
          entryNumber,
          sourceType: 'PROJECT_RETURN',
          sourceId: projectId,
          memo:
            dto.memo ||
            `Material returned from project ${project.projectNumber}`,
          userId: username,
          lines: [
            {
              productId: dto.productId,
              binId: dto.binId,
              quantity: Math.abs(dto.quantity),
              uomCode: product.baseUom || 'EA',
            },
          ],
        });

      // 2. Compensating project ledger entry (credit project cost)
      const [ledgerLine] = await tx
        .insert(projectLedgerEntries)
        .values({
          projectId,
          projectTaskId: dto.projectTaskId,
          entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
          lineType: PROJECT_LINE_TYPE.ITEM,
          sourceType: PROJECT_SOURCE_TYPE.INVENTORY_RETURN,
          sourceId: invMovement?.entryId || null,
          inventoryEntryId: invMovement?.entryId || null,
          productId: dto.productId,
          description: dto.memo || `Returned ${dto.quantity}x ${product.name}`,
          quantity: String(-Math.abs(dto.quantity)),
          unitCostBase: String(unitCost),
          totalCostBase: String(-totalCost),
          unitPriceBase: String(unitPrice),
          totalPriceBase: String(-totalPrice),
          isBillable: false,
          isBilled: false,
          postingDate: new Date(),
          createdBy: username,
        })
        .returning();

      // 3. Emit Audit Event
      await emitEvent(tx, {
        entityType: EntityType.PROJECT_LEDGER,
        entityId: ledgerLine.ledgerId,
        eventType: EventType.CREATED,
        entityDisplayName: `Return from ${project.projectNumber}`,
        payload: {
          action: 'project_material_returned',
          projectId,
          taskId: dto.projectTaskId,
          productId: dto.productId,
          productName: product.name,
          quantity: dto.quantity,
          totalCost: -totalCost,
          returnedBy: username,
        },
      });

      return ledgerLine;
    };

    if (passedTx) {
      return run(passedTx);
    }
    return this.db.transaction(run);
  }

  async getProfitability(
    projectId: string,
    tx?: DrizzleDB,
  ): Promise<ProjectProfitabilityResponseDto> {
    const db = tx || this.db;
    await this.getProjectOrThrow(projectId, db);

    const budgetLines = await db
      .select({
        totalCost: projectBudgetLines.totalCost,
        totalPrice: projectBudgetLines.totalPrice,
      })
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.projectId, projectId));

    const totalBudgetCost = budgetLines.reduce(
      (sum, l) => sum + Number(l.totalCost || 0),
      0,
    );
    const totalBudgetPrice = budgetLines.reduce(
      (sum, l) => sum + Number(l.totalPrice || 0),
      0,
    );

    const actualLines = await db
      .select({
        lineType: projectLedgerEntries.lineType,
        totalCostBase: projectLedgerEntries.totalCostBase,
        totalPriceBase: projectLedgerEntries.totalPriceBase,
        isBilled: projectLedgerEntries.isBilled,
      })
      .from(projectLedgerEntries)
      .where(eq(projectLedgerEntries.projectId, projectId));

    let laborActualCost = 0;
    let materialActualCost = 0;
    let expenseActualCost = 0;
    let totalActualCost = 0;
    let totalBillablePrice = 0;
    let totalBilledPrice = 0;

    for (const l of actualLines) {
      const cost = Number(l.totalCostBase || 0);
      const price = Number(l.totalPriceBase || 0);

      totalActualCost += cost;
      totalBillablePrice += price;
      if (l.isBilled) {
        totalBilledPrice += price;
      }

      if (l.lineType === PROJECT_LINE_TYPE.RESOURCE) {
        laborActualCost += cost;
      } else if (l.lineType === PROJECT_LINE_TYPE.ITEM) {
        materialActualCost += cost;
      } else if (l.lineType === PROJECT_LINE_TYPE.EXPENSE) {
        expenseActualCost += cost;
      }
    }

    const costVariance = totalBudgetCost - totalActualCost;
    const estimatedMarginPercent =
      totalBudgetPrice > 0
        ? ((totalBudgetPrice - totalBudgetCost) / totalBudgetPrice) * 100
        : 0;
    const actualMarginPercent =
      totalBillablePrice > 0
        ? ((totalBillablePrice - totalActualCost) / totalBillablePrice) * 100
        : 0;

    return {
      projectId,
      totalBudgetCost: Number(totalBudgetCost.toFixed(2)),
      totalBudgetPrice: Number(totalBudgetPrice.toFixed(2)),
      totalActualCost: Number(totalActualCost.toFixed(2)),
      totalBillablePrice: Number(totalBillablePrice.toFixed(2)),
      totalBilledPrice: Number(totalBilledPrice.toFixed(2)),
      costVariance: Number(costVariance.toFixed(2)),
      estimatedMarginPercent: Number(estimatedMarginPercent.toFixed(1)),
      actualMarginPercent: Number(actualMarginPercent.toFixed(1)),
      laborActualCost: Number(laborActualCost.toFixed(2)),
      materialActualCost: Number(materialActualCost.toFixed(2)),
      expenseActualCost: Number(expenseActualCost.toFixed(2)),
    };
  }

  async recordProjectStagingCharge(
    tx: DrizzleDB,
    params: {
      projectId: string;
      projectTaskId?: string | null;
      productId: string;
      quantity: number;
      unitCost?: number;
      unitPrice?: number;
      referenceNumber?: string;
      memo?: string;
      actor: string;
    },
  ) {
    const project = await this.getProjectOrThrow(params.projectId, tx);

    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.productId, params.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${params.productId} not found`,
      );
    }

    let unitCost = params.unitCost;
    let unitPrice = params.unitPrice;

    if (unitCost === undefined) {
      unitCost = Number(
        product.standardCost ||
          product.weightedAverageCost ||
          product.tradePrice ||
          0,
      );
    }
    if (unitPrice === undefined) {
      unitPrice = Number(product.listPrice || unitCost * 1.3);
    }

    const qty = Math.abs(params.quantity);
    const totalCost = qty * unitCost;
    const totalPrice = qty * unitPrice;

    let taskTaskId = params.projectTaskId;
    if (!taskTaskId) {
      const [firstTask] = await tx
        .select({ projectTaskId: projectTasks.projectTaskId })
        .from(projectTasks)
        .where(eq(projectTasks.projectId, params.projectId))
        .limit(1);
      taskTaskId = firstTask?.projectTaskId;
    }

    if (!taskTaskId) {
      const [defaultTask] = await tx
        .insert(projectTasks)
        .values({
          projectId: params.projectId,
          taskCode: '0.0',
          name: 'General / Staging',
          stateCode: PROJECT_TASK_STATE.NOT_STARTED,
          isMilestone: false,
          isBillable: false,
          createdBy: params.actor,
        })
        .returning();
      taskTaskId = defaultTask.projectTaskId;
    }

    // Staging ledger entry (debit project material cost / WIP)
    const [ledgerLine] = await tx
      .insert(projectLedgerEntries)
      .values({
        projectId: params.projectId,
        projectTaskId: taskTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.ITEM,
        sourceType: PROJECT_SOURCE_TYPE.INVENTORY_ISSUE,
        productId: params.productId,
        description:
          params.memo ||
          `Staged ${qty}x ${product.name} (Ref: ${params.referenceNumber || 'Transfer Staging Putaway'})`,
        quantity: String(qty),
        unitCostBase: String(unitCost),
        totalCostBase: String(totalCost),
        unitPriceBase: String(unitPrice),
        totalPriceBase: String(totalPrice),
        isBillable: true,
        isBilled: false,
        postingDate: new Date(),
        createdBy: params.actor,
      })
      .returning();

    await emitEvent(tx, {
      entityType: EntityType.PROJECT_LEDGER,
      entityId: ledgerLine.ledgerId,
      eventType: EventType.CREATED,
      entityDisplayName: `Staged to ${project.projectNumber}`,
      payload: {
        action: 'project_material_staged',
        projectId: params.projectId,
        taskId: taskTaskId,
        productId: params.productId,
        productName: product.name,
        quantity: qty,
        totalCost,
        stagedBy: params.actor,
      },
    });

    return ledgerLine;
  }

  async recordProjectReturnCredit(
    tx: DrizzleDB,
    params: {
      projectId: string;
      projectTaskId?: string | null;
      productId: string;
      quantity: number;
      unitCost?: number;
      unitPrice?: number;
      referenceNumber?: string;
      memo?: string;
      actor: string;
    },
  ) {
    const project = await this.getProjectOrThrow(params.projectId, tx);

    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.productId, params.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${params.productId} not found`,
      );
    }

    let unitCost = params.unitCost;
    let unitPrice = params.unitPrice;

    if (unitCost === undefined || unitPrice === undefined) {
      const conditions = [
        eq(projectLedgerEntries.projectId, params.projectId),
        eq(projectLedgerEntries.productId, params.productId),
      ];
      if (params.projectTaskId) {
        conditions.push(
          eq(projectLedgerEntries.projectTaskId, params.projectTaskId),
        );
      }
      const [lastIssue] = await tx
        .select({
          unitCostBase: projectLedgerEntries.unitCostBase,
          unitPriceBase: projectLedgerEntries.unitPriceBase,
        })
        .from(projectLedgerEntries)
        .where(and(...conditions))
        .orderBy(desc(projectLedgerEntries.postingDate))
        .limit(1);

      if (lastIssue) {
        if (unitCost === undefined) unitCost = Number(lastIssue.unitCostBase);
        if (unitPrice === undefined)
          unitPrice = Number(lastIssue.unitPriceBase);
      }
    }

    if (unitCost === undefined) {
      unitCost = Number(
        product.standardCost ||
          product.weightedAverageCost ||
          product.tradePrice ||
          0,
      );
    }
    if (unitPrice === undefined) {
      unitPrice = Number(product.listPrice || unitCost * 1.3);
    }

    const qty = Math.abs(params.quantity);
    const totalCost = qty * unitCost;
    const totalPrice = qty * unitPrice;

    let taskTaskId = params.projectTaskId;
    if (!taskTaskId) {
      const [firstTask] = await tx
        .select({ projectTaskId: projectTasks.projectTaskId })
        .from(projectTasks)
        .where(eq(projectTasks.projectId, params.projectId))
        .limit(1);
      taskTaskId = firstTask?.projectTaskId;
    }

    if (!taskTaskId) {
      const [defaultTask] = await tx
        .insert(projectTasks)
        .values({
          projectId: params.projectId,
          taskCode: '0.0',
          name: 'General / Staging',
          stateCode: PROJECT_TASK_STATE.NOT_STARTED,
          isMilestone: false,
          isBillable: false,
          createdBy: params.actor,
        })
        .returning();
      taskTaskId = defaultTask.projectTaskId;
    }

    // Compensating ledger entry (credit project cost)
    const [ledgerLine] = await tx
      .insert(projectLedgerEntries)
      .values({
        projectId: params.projectId,
        projectTaskId: taskTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.ITEM,
        sourceType: PROJECT_SOURCE_TYPE.INVENTORY_RETURN,
        productId: params.productId,
        description:
          params.memo ||
          `Returned ${qty}x ${product.name} (Ref: ${params.referenceNumber || 'Transfer Putaway'})`,
        quantity: String(-qty),
        unitCostBase: String(unitCost),
        totalCostBase: String(-totalCost),
        unitPriceBase: String(unitPrice),
        totalPriceBase: String(-totalPrice),
        isBillable: false,
        isBilled: false,
        postingDate: new Date(),
        createdBy: params.actor,
      })
      .returning();

    await emitEvent(tx, {
      entityType: EntityType.PROJECT_LEDGER,
      entityId: ledgerLine.ledgerId,
      eventType: EventType.CREATED,
      entityDisplayName: `Return from ${project.projectNumber}`,
      payload: {
        action: 'project_material_returned',
        projectId: params.projectId,
        taskId: params.projectTaskId,
        productId: params.productId,
        productName: product.name,
        quantity: qty,
        totalCost: -totalCost,
        returnedBy: params.actor,
      },
    });

    return ledgerLine;
  }
}
