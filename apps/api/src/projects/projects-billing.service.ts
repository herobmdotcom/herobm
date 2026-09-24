import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { eq, inArray, and, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectTasks,
  projectLedgerEntries,
  salesInvoices,
  salesInvoiceLines,
} from '@herobm/db-schema';
import { BillProjectDto, ProjectBillingResponseDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { SalesInvoiceService } from '../invoices/sales-invoice.service';
import {
  PROJECT_STATE,
  PROJECT_TASK_STATE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_SOURCE_TYPE,
  computeLinePrice,
} from '@herobm/shared';

export async function unbillProjectInvoiceHelper(
  db: DrizzleDB,
  invoiceId: string,
  actor: string,
  logger?: Logger,
): Promise<{ unbilledCount: number; removedSaleCount: number }> {
  // 1. Fetch sales invoice lines
  const lines = await db
    .select({
      invoiceLineId: salesInvoiceLines.invoiceLineId,
      projectLedgerEntryId: salesInvoiceLines.projectLedgerEntryId,
    })
    .from(salesInvoiceLines)
    .where(eq(salesInvoiceLines.invoiceId, invoiceId));

  const lineIds = lines.map((l) => l.invoiceLineId);
  const directLedgerIds = lines
    .map((l) => l.projectLedgerEntryId)
    .filter(Boolean) as string[];

  // Also find invoice header to get projectId / invoiceNumber if present
  const [invoice] = await db
    .select({
      projectId: salesInvoices.projectId,
      invoiceNumber: salesInvoices.invoiceNumber,
    })
    .from(salesInvoices)
    .where(eq(salesInvoices.invoiceId, invoiceId))
    .limit(1);

  // 2. Query all linked project ledger entries
  const conditions = [];
  if (lineIds.length > 0) {
    conditions.push(inArray(projectLedgerEntries.salesInvoiceLineId, lineIds));
  }
  if (directLedgerIds.length > 0) {
    conditions.push(inArray(projectLedgerEntries.ledgerId, directLedgerIds));
  }
  conditions.push(
    and(
      eq(projectLedgerEntries.sourceType, PROJECT_SOURCE_TYPE.SALES_INVOICE),
      eq(projectLedgerEntries.sourceId, invoiceId),
    ),
  );

  const matchedEntries = await db
    .select({
      ledgerId: projectLedgerEntries.ledgerId,
      projectId: projectLedgerEntries.projectId,
      entryType: projectLedgerEntries.entryType,
    })
    .from(projectLedgerEntries)
    .where(or(...conditions));

  if (matchedEntries.length === 0) {
    return { unbilledCount: 0, removedSaleCount: 0 };
  }

  const usageEntryIds: string[] = [];
  const saleEntryIds: string[] = [];
  const affectedProjectIds = new Set<string>();

  if (invoice?.projectId) {
    affectedProjectIds.add(invoice.projectId);
  }

  for (const entry of matchedEntries) {
    affectedProjectIds.add(entry.projectId);
    if (entry.entryType === PROJECT_LEDGER_ENTRY_TYPE.SALE) {
      saleEntryIds.push(entry.ledgerId);
    } else {
      usageEntryIds.push(entry.ledgerId);
    }
  }

  // 3. Revert actual usage entries back to unbilled
  let unbilledCount = 0;
  if (usageEntryIds.length > 0) {
    const updated = await db
      .update(projectLedgerEntries)
      .set({
        isBilled: false,
        salesInvoiceLineId: null,
      })
      .where(inArray(projectLedgerEntries.ledgerId, usageEntryIds))
      .returning();
    unbilledCount = updated.length;
  }

  // 4. Remove synthetic sale entries that were generated for this invoice
  let removedSaleCount = 0;
  if (saleEntryIds.length > 0) {
    const deleted = await db
      .delete(projectLedgerEntries)
      .where(inArray(projectLedgerEntries.ledgerId, saleEntryIds))
      .returning();
    removedSaleCount = deleted.length;
  }

  // 5. Emit project audit event(s)
  if (affectedProjectIds.size > 0) {
    const projIdsArray = Array.from(affectedProjectIds);
    const affectedProjects = await db
      .select({
        projectId: projects.projectId,
        projectNumber: projects.projectNumber,
      })
      .from(projects)
      .where(inArray(projects.projectId, projIdsArray));

    const projectMap = new Map(
      affectedProjects.map((p) => [p.projectId, p.projectNumber]),
    );

    for (const projId of projIdsArray) {
      await emitEvent(db, {
        entityType: EntityType.PROJECT,
        entityId: projId,
        eventType: EventType.UPDATED,
        entityDisplayName: projectMap.get(projId) || projId,
        payload: {
          action: 'project_invoice_cancelled',
          projectId: projId,
          invoiceId,
          invoiceNumber: invoice?.invoiceNumber,
          unbilledCount,
          removedSaleCount,
          cancelledBy: actor,
        },
        actor,
      });
    }
  }

  logger?.log(
    `Reverted project billing for cancelled invoice ${invoice?.invoiceNumber || invoiceId}: ${unbilledCount} usage lines unbilled, ${removedSaleCount} sale lines removed across ${affectedProjectIds.size} project(s)`,
  );

  return { unbilledCount, removedSaleCount };
}

@Injectable()
export class ProjectsBillingService {
  private readonly logger = new Logger(ProjectsBillingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(forwardRef(() => SalesInvoiceService))
    private readonly salesInvoiceService: SalesInvoiceService,
  ) {}

  async billProject(
    projectId: string,
    dto: BillProjectDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectBillingResponseDto> {
    const run = async (db: DrizzleDB) => {
      // 1. Validate project exists and is eligible for billing
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .limit(1);

      if (!project) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }

      if (project.stateCode === PROJECT_STATE.CLOSED) {
        throw new BadRequestException('Cannot bill a closed project.');
      }

      if (!dto.lines || dto.lines.length === 0) {
        throw new BadRequestException(
          'At least one line item is required for project billing.',
        );
      }

      // Check for any projectLedgerEntryId in dto.lines that doesn't exist on this project
      const ledgerEntryIds = dto.lines
        .map((l) => l.projectLedgerEntryId)
        .filter(Boolean) as string[];

      if (ledgerEntryIds.length > 0) {
        const foundEntries = await db
          .select({ ledgerId: projectLedgerEntries.ledgerId })
          .from(projectLedgerEntries)
          .where(
            and(
              eq(projectLedgerEntries.projectId, projectId),
              inArray(projectLedgerEntries.ledgerId, ledgerEntryIds),
            ),
          );

        const foundIds = new Set(foundEntries.map((e) => e.ledgerId));
        const missingIds = ledgerEntryIds.filter((id) => !foundIds.has(id));
        if (missingIds.length > 0) {
          throw new BadRequestException(
            `Project ledger entry ${missingIds.join(', ')} not found in project ${projectId}`,
          );
        }
      }

      // 2. Delegate invoice and GL creation to SalesInvoiceService (Single-Writer Domain Principle)
      const invoiceResult = await this.salesInvoiceService.createProjectInvoice(
        {
          projectId: project.projectId,
          projectNumber: project.projectNumber,
          customerId: project.customerId,
          currencyCode: project.currencyCode,
          name: project.name,
          tradingTermsId: project.tradingTermsId,
        },
        dto,
        username,
        db,
      );

      // 3. Match invoice lines with project ledger entries and update/create project subledger entries
      let billedCount = 0;
      const invoiceLines = invoiceResult.lines || [];

      // Pre-fetch fallback task if any line needs one (No N+1)
      const needsFallbackTask = dto.lines.some(
        (l) => !l.projectLedgerEntryId && !l.projectTaskId,
      );
      let defaultTaskId: string | null = null;
      if (needsFallbackTask) {
        const [firstTask] = await db
          .select({ projectTaskId: projectTasks.projectTaskId })
          .from(projectTasks)
          .where(eq(projectTasks.projectId, projectId))
          .limit(1);

        if (firstTask) {
          defaultTaskId = firstTask.projectTaskId;
        } else {
          const [newTask] = await db
            .insert(projectTasks)
            .values({
              projectId,
              taskCode: 'BILL-GEN',
              name: 'General Project Billing',
              stateCode: PROJECT_TASK_STATE.NOT_STARTED,
              isMilestone: false,
              isBillable: true,
              createdBy: username,
            })
            .returning();
          defaultTaskId = newTask.projectTaskId;
        }
      }

      const saleInsertValues = [];

      for (let i = 0; i < dto.lines.length; i++) {
        const reqLine = dto.lines[i];
        const createdInvLine = invoiceLines[i];
        const invLineId = createdInvLine?.invoiceLineId;

        if (reqLine.projectLedgerEntryId) {
          // Time & Materials: Mark existing WIP ledger entry as billed
          const [updated] = await db
            .update(projectLedgerEntries)
            .set({
              isBilled: true,
              salesInvoiceLineId: invLineId,
            })
            .where(
              and(
                eq(projectLedgerEntries.ledgerId, reqLine.projectLedgerEntryId),
                eq(projectLedgerEntries.projectId, projectId),
              ),
            )
            .returning();

          if (updated) {
            billedCount++;
          }
        } else {
          // Milestone / Fixed Price / Progress Drawdown: Record a sale ledger entry
          const postingDate = dto.invoiceDate
            ? new Date(dto.invoiceDate)
            : new Date();

          const targetTaskId = reqLine.projectTaskId || defaultTaskId!;
          const calculatedPrice =
            typeof reqLine.amount === 'number'
              ? String(reqLine.amount)
              : String(
                  computeLinePrice({
                    quantity: reqLine.quantity,
                    pricePerUnit: reqLine.pricePerUnit,
                    discountPercentage: reqLine.discountPercentage || 0,
                    taxRate: 0,
                  }).amount.toFixed(2),
                );

          saleInsertValues.push({
            projectId,
            projectTaskId: targetTaskId,
            entryType: PROJECT_LEDGER_ENTRY_TYPE.SALE,
            lineType: PROJECT_LINE_TYPE.EXPENSE,
            sourceType: PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
            productId: reqLine.productId || null,
            description: reqLine.description,
            quantity: String(reqLine.quantity),
            unitCostBase: '0',
            totalCostBase: '0',
            unitPriceBase: String(reqLine.pricePerUnit),
            totalPriceBase: calculatedPrice,
            isBillable: true,
            isBilled: true,
            salesInvoiceLineId: invLineId,
            postingDate,
            createdBy: username,
          });
        }
      }

      if (saleInsertValues.length > 0) {
        const inserted = await db
          .insert(projectLedgerEntries)
          .values(saleInsertValues)
          .returning();
        billedCount += inserted.length;
      }

      // 4. Emit project audit event
      await emitEvent(db, {
        entityType: EntityType.PROJECT,
        entityId: projectId,
        eventType: EventType.UPDATED,
        entityDisplayName: project.projectNumber,
        payload: {
          action: 'project_billed',
          projectId,
          projectNumber: project.projectNumber,
          invoiceId: invoiceResult.invoiceId,
          invoiceNumber: invoiceResult.invoiceNumber,
          totalAmount: invoiceResult.totalAmount,
          billedCount,
          billedBy: username,
        },
        actor: username,
      });

      this.logger.log(
        `Project ${project.projectNumber} billed: Invoice ${invoiceResult.invoiceNumber} (${invoiceResult.totalAmount} ${project.currencyCode}) with ${billedCount} lines`,
      );

      return {
        invoiceId: invoiceResult.invoiceId,
        invoiceNumber: invoiceResult.invoiceNumber,
        totalAmount: invoiceResult.totalAmount,
        taxAmount: invoiceResult.taxAmount || '0',
        currencyCode: invoiceResult.currencyCode,
        stateCode: invoiceResult.stateCode,
        billedCount,
      };
    };

    try {
      if (tx) {
        return await run(tx);
      }
      return await this.db.transaction(run);
    } catch (err) {
      this.logger.error('BILL PROJECT FAILED:', err);
      throw err;
    }
  }

  async getProjectInvoices(projectId: string) {
    const [project] = await this.db
      .select({ projectId: projects.projectId })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.salesInvoiceService.findByProject(projectId);
  }

  async unbillProjectInvoice(
    invoiceId: string,
    actor: string,
    tx?: DrizzleDB,
  ): Promise<{ unbilledCount: number; removedSaleCount: number }> {
    const run = async (db: DrizzleDB) => {
      return unbillProjectInvoiceHelper(db, invoiceId, actor, this.logger);
    };

    if (tx) {
      return run(tx);
    }
    return this.db.transaction(run);
  }
}
