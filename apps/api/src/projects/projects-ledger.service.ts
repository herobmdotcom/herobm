import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, sql, ilike, inArray, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectTasks,
  projectLedgerEntries,
  projectBudgetLines,
  salesInvoices,
  salesInvoiceLines,
} from '@herobm/db-schema';
import {
  ConsumeExpenseDto,
  UpdateProjectLedgerEntryDto,
  ProjectLedgerQueryDto,
  ProjectLedgerEntryResponseDto,
} from './dto';
import {
  withCursorPagination,
  PaginatedResponse,
  parsePagination,
} from '../common/pagination';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PROJECT_STATE,
  PROJECT_LEDGER_ENTRY_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_SOURCE_TYPE,
  ProjectLedgerEntryType,
  computeLinePrice,
} from '@herobm/shared';

@Injectable()
export class ProjectsLedgerService {
  private readonly logger = new Logger(ProjectsLedgerService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findLedgerEntries(
    projectId: string,
    query: ProjectLedgerQueryDto,
    tx?: DrizzleDB,
  ): Promise<PaginatedResponse<ProjectLedgerEntryResponseDto>> {
    const db = tx || this.db;

    // 1. Verify project exists
    const [project] = await db
      .select({ projectId: projects.projectId })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const { page, limit, cursor, direction } = parsePagination(query);

    const conditions = [eq(projectLedgerEntries.projectId, projectId)];

    if (query.projectTaskId) {
      conditions.push(
        eq(projectLedgerEntries.projectTaskId, query.projectTaskId),
      );
    }
    if (query.lineType) {
      conditions.push(eq(projectLedgerEntries.lineType, query.lineType));
    }
    if (query.entryType) {
      conditions.push(eq(projectLedgerEntries.entryType, query.entryType));
    }
    if (query.isBillable !== undefined) {
      conditions.push(eq(projectLedgerEntries.isBillable, query.isBillable));
    }
    if (query.isBilled !== undefined) {
      conditions.push(eq(projectLedgerEntries.isBilled, query.isBilled));
    }
    if (query.fromDate) {
      conditions.push(
        sql`${projectLedgerEntries.postingDate} >= ${new Date(query.fromDate)}`,
      );
    }
    if (query.toDate) {
      conditions.push(
        sql`${projectLedgerEntries.postingDate} <= ${new Date(query.toDate)}`,
      );
    }
    if (query.q) {
      const term = `%${query.q}%`;
      conditions.push(ilike(projectLedgerEntries.description, term));
    }

    const whereClause = and(...conditions);

    const [countRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectLedgerEntries)
      .where(whereClause);

    const total = Number(countRes?.count || 0);

    let qb = db.select().from(projectLedgerEntries).$dynamic();

    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const {
      data: rawEntries,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { postingDate: string; ledgerId: string } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${projectLedgerEntries.postingDate} ${op} ${new Date(c.postingDate)}`,
          and(
            sql`${projectLedgerEntries.postingDate} = ${new Date(c.postingDate)}`,
            sql`${projectLedgerEntries.ledgerId} ${idOp} ${c.ledgerId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        const idOrderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(projectLedgerEntries.postingDate),
          idOrderFn(projectLedgerEntries.ledgerId),
        );
      },
      encodeRow: (row) => ({
        postingDate: row.postingDate
          ? new Date(row.postingDate).toISOString()
          : new Date().toISOString(),
        ledgerId: row.ledgerId,
      }),
    });

    if (rawEntries.length === 0) {
      return {
        data: [],
        page,
        limit,
        total,
        nextCursor,
        prevCursor,
      };
    }

    // Resolve relations (invoice numbers etc)
    const invoiceLineIds = rawEntries
      .map((e) => e.salesInvoiceLineId)
      .filter(Boolean) as string[];
    const sourceInvoiceIds = rawEntries
      .filter(
        (e) =>
          e.sourceType === PROJECT_SOURCE_TYPE.SALES_INVOICE &&
          Boolean(e.sourceId),
      )
      .map((e) => e.sourceId as string);

    const invoiceMap = new Map<
      string,
      { invoiceId: string; invoiceNumber: string }
    >();

    if (invoiceLineIds.length > 0) {
      const lineRows = await db
        .select({
          lineId: salesInvoiceLines.invoiceLineId,
          invoiceId: salesInvoices.invoiceId,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(salesInvoiceLines)
        .innerJoin(
          salesInvoices,
          eq(salesInvoiceLines.invoiceId, salesInvoices.invoiceId),
        )
        .where(inArray(salesInvoiceLines.invoiceLineId, invoiceLineIds));

      for (const row of lineRows) {
        invoiceMap.set(`line:${row.lineId}`, {
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
        });
      }
    }

    if (sourceInvoiceIds.length > 0) {
      const invRows = await db
        .select({
          invoiceId: salesInvoices.invoiceId,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(salesInvoices)
        .where(inArray(salesInvoices.invoiceId, sourceInvoiceIds));

      for (const row of invRows) {
        invoiceMap.set(`src:${row.invoiceId}`, {
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
        });
      }
    }

    // Fallback resolution for billed ledger entries
    const billedUnmapped = rawEntries
      .filter((e) => e.isBilled && !e.salesInvoiceLineId && !e.sourceId)
      .map((e) => e.ledgerId);

    if (billedUnmapped.length > 0) {
      const directLines = await db
        .select({
          ledgerId: salesInvoiceLines.projectLedgerEntryId,
          invoiceId: salesInvoices.invoiceId,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(salesInvoiceLines)
        .innerJoin(
          salesInvoices,
          eq(salesInvoiceLines.invoiceId, salesInvoices.invoiceId),
        )
        .where(inArray(salesInvoiceLines.projectLedgerEntryId, billedUnmapped));

      for (const dl of directLines) {
        if (dl.ledgerId) {
          invoiceMap.set(`ledger:${dl.ledgerId}`, {
            invoiceId: dl.invoiceId,
            invoiceNumber: dl.invoiceNumber,
          });
        }
      }
    }

    const data: ProjectLedgerEntryResponseDto[] = rawEntries.map((entry) => {
      const lineMatch = entry.salesInvoiceLineId
        ? invoiceMap.get(`line:${entry.salesInvoiceLineId}`)
        : undefined;
      const srcMatch = entry.sourceId
        ? invoiceMap.get(`src:${entry.sourceId}`)
        : undefined;
      const ledgerMatch = invoiceMap.get(`ledger:${entry.ledgerId}`);

      const inv = lineMatch || srcMatch || ledgerMatch;

      return {
        ...entry,
        salesInvoiceId: inv?.invoiceId || null,
        salesInvoiceNumber: inv?.invoiceNumber || null,
      } as unknown as ProjectLedgerEntryResponseDto;
    });

    return {
      data,
      page,
      limit,
      total,
      nextCursor,
      prevCursor,
    };
  }

  async consumeExpense(
    projectId: string,
    dto: ConsumeExpenseDto,
    username: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    // 1. Verify project exists and is not closed
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
        'Cannot record expenses on a closed project',
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

    // 3. Compute cost and billable price
    const qty = Number(dto.quantity !== undefined ? dto.quantity : 1);
    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestException('Expense quantity must be greater than 0');
    }

    const unitCost = Number(dto.unitCost || 0);
    const unitPrice =
      dto.unitBillablePrice !== undefined
        ? Number(dto.unitBillablePrice)
        : dto.unitPrice !== undefined
          ? Number(dto.unitPrice)
          : unitCost;

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

    const postingDate =
      dto.postingDate || dto.expenseDate
        ? new Date(dto.postingDate || dto.expenseDate!)
        : new Date();

    const finalDescription = dto.referenceNumber
      ? `${dto.description.trim()} [Ref: ${dto.referenceNumber}]`
      : dto.description.trim();

    // 4. Insert project ledger entry
    const [ledgerLine] = await db
      .insert(projectLedgerEntries)
      .values({
        projectId,
        projectTaskId: dto.projectTaskId,
        entryType: PROJECT_LEDGER_ENTRY_TYPE.USAGE,
        lineType: PROJECT_LINE_TYPE.EXPENSE,
        sourceType: dto.sourceType || PROJECT_SOURCE_TYPE.MANUAL_JOURNAL,
        sourceId: dto.sourceId || null,
        budgetLineId: dto.budgetLineId || null,
        description: finalDescription,
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

    // 5. Emit audit event
    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'expense_recorded',
        projectId,
        projectTaskId: dto.projectTaskId,
        ledgerId: ledgerLine.ledgerId,
        description: finalDescription,
        quantity: qty,
        unitCost,
        totalCost,
        unitPrice,
        totalPrice: computedPrice.amount,
        referenceNumber: dto.referenceNumber || null,
        notes: dto.notes || null,
        expenseDate: dto.expenseDate || null,
        recordedBy: username,
      },
    });

    return ledgerLine;
  }

  async updateLedgerEntry(
    projectId: string,
    ledgerId: string,
    dto: UpdateProjectLedgerEntryDto,
    username: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

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
        'Cannot modify ledger entries on a closed project',
      );
    }

    const [existing] = await db
      .select()
      .from(projectLedgerEntries)
      .where(
        and(
          eq(projectLedgerEntries.ledgerId, ledgerId),
          eq(projectLedgerEntries.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Project ledger entry with ID ${ledgerId} not found in project ${projectId}`,
      );
    }

    if (existing.isBilled) {
      throw new BadRequestException('Cannot modify a billed ledger entry');
    }

    if (dto.projectTaskId && dto.projectTaskId !== existing.projectTaskId) {
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
    }

    const quantity =
      dto.quantity !== undefined
        ? Number(dto.quantity)
        : Number(existing.quantity || 0);

    if (isNaN(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const unitCost =
      dto.unitCost !== undefined
        ? Number(dto.unitCost)
        : Number(existing.unitCostBase || 0);

    const unitPrice =
      dto.unitPrice !== undefined
        ? Number(dto.unitPrice)
        : Number(existing.unitPriceBase || 0);

    const lineDiscount =
      dto.discountPercentage !== undefined
        ? dto.discountPercentage
        : existing.discountPercentage
          ? parseFloat(existing.discountPercentage)
          : 0;

    const totalCost = quantity * unitCost;
    const computedPrice = computeLinePrice({
      quantity: quantity,
      pricePerUnit: unitPrice,
      discountPercentage: lineDiscount,
      taxRate: 0,
    });
    const totalPrice = computedPrice.amount;

    const updateData: Partial<typeof projectLedgerEntries.$inferInsert> = {
      quantity: String(quantity),
      unitCostBase: String(unitCost),
      totalCostBase: String(totalCost),
      unitPriceBase: String(unitPrice),
      discountPercentage: lineDiscount.toString(),
      totalPriceBase: computedPrice.amount.toString(),
    };

    if (dto.projectTaskId !== undefined) {
      updateData.projectTaskId = dto.projectTaskId;
    }
    if (dto.resourceId !== undefined) {
      updateData.resourceId = dto.resourceId;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description.trim() || null;
    }
    if (dto.postingDate !== undefined) {
      updateData.postingDate = new Date(dto.postingDate);
    }
    if (dto.isBillable !== undefined) {
      updateData.isBillable = dto.isBillable;
    }
    if (dto.budgetLineId !== undefined) {
      if (dto.budgetLineId === null || dto.budgetLineId === '') {
        updateData.budgetLineId = null;
      } else {
        const [bLine] = await db
          .select()
          .from(projectBudgetLines)
          .where(
            and(
              eq(projectBudgetLines.budgetLineId, dto.budgetLineId),
              eq(projectBudgetLines.projectId, projectId),
            ),
          )
          .limit(1);

        if (!bLine) {
          throw new BadRequestException(
            `Budget line ${dto.budgetLineId} not found on project ${projectId}`,
          );
        }
        updateData.budgetLineId = dto.budgetLineId;
      }
    }

    const [updated] = await db
      .update(projectLedgerEntries)
      .set(updateData)
      .where(eq(projectLedgerEntries.ledgerId, ledgerId))
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'ledger_entry_updated',
        projectId,
        ledgerId,
        lineType: updated.lineType,
        quantity,
        totalCost,
        totalPrice: computedPrice.amount,
        updatedBy: username,
      },
    });

    return updated;
  }

  async setLedgerEntryBillable(
    projectId: string,
    ledgerId: string,
    isBillable: boolean,
    username: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

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
        'Cannot modify ledger entries on a closed project',
      );
    }

    const [existing] = await db
      .select()
      .from(projectLedgerEntries)
      .where(
        and(
          eq(projectLedgerEntries.ledgerId, ledgerId),
          eq(projectLedgerEntries.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Project ledger entry with ID ${ledgerId} not found in project ${projectId}`,
      );
    }

    if (existing.isBilled) {
      throw new BadRequestException(
        'Cannot change billable status of an already billed ledger entry',
      );
    }

    const [updated] = await db
      .update(projectLedgerEntries)
      .set({ isBillable })
      .where(eq(projectLedgerEntries.ledgerId, ledgerId))
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'ledger_entry_billable_changed',
        projectId,
        ledgerId,
        isBillable,
        updatedBy: username,
      },
    });

    return updated;
  }

  async deleteLedgerEntry(
    projectId: string,
    ledgerId: string,
    username: string,
    tx?: DrizzleDB,
  ): Promise<{ deleted: boolean; ledgerId: string }> {
    const db = tx || this.db;

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
        'Cannot delete ledger entries on a closed project',
      );
    }

    const [existing] = await db
      .select()
      .from(projectLedgerEntries)
      .where(
        and(
          eq(projectLedgerEntries.ledgerId, ledgerId),
          eq(projectLedgerEntries.projectId, projectId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Project ledger entry with ID ${ledgerId} not found in project ${projectId}`,
      );
    }

    if (existing.isBilled) {
      throw new BadRequestException('Cannot delete a billed ledger entry');
    }

    await db
      .delete(projectLedgerEntries)
      .where(eq(projectLedgerEntries.ledgerId, ledgerId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.DELETED,
      entityDisplayName: project.projectNumber,
      payload: {
        action: 'ledger_entry_deleted',
        projectId,
        ledgerId,
        lineType: existing.lineType,
        deletedBy: username,
      },
    });

    return { deleted: true, ledgerId };
  }
}
