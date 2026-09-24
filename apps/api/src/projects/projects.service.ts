import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { desc, eq, and, or, asc, sql, ilike, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  projects,
  projectTasks,
  projectLedgerEntries,
  projectNotes,
  binContents,
  products,
  bins,
  zones,
  customers,
  customerGroups,
  tradingTerms,
  discountMatrix,
  salesInvoices,
  salesInvoiceLines,
} from '@herobm/db-schema';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
  ProjectQueryDto,
  ProjectStateTransitionDto,
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
  PROJECT_TRANSITIONS,
  PROJECT_BILLING_TYPE,
  PROJECT_SOURCE_TYPE,
  getAllowedTransitions,
  BIN_TYPE,
  resolveEffectiveDiscount,
  DiscountRule,
} from '@herobm/shared';

function generateProjectNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRJ-${today}-${rand}`;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ---------------------------------------------------------------------------
  // Projects Master Operations
  // ---------------------------------------------------------------------------

  async createProject(
    dto: CreateProjectDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResponseDto> {
    const db = tx || this.db;
    const projectNumber = dto.projectNumber?.trim() || generateProjectNumber();

    if (dto.stagingBinId) {
      const [bin] = await db
        .select({
          binId: bins.binId,
          binType: bins.binType,
          zoneId: bins.zoneId,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.stagingBinId))
        .limit(1);

      if (!bin) {
        throw new NotFoundException(
          `Bin with ID ${dto.stagingBinId} not found`,
        );
      }
      if ((bin.binType as BIN_TYPE) !== BIN_TYPE.PROJECT) {
        throw new BadRequestException('Staging bin must be of type project');
      }
      if (dto.stagingLocationId && bin.locationId !== dto.stagingLocationId) {
        throw new BadRequestException(
          'Staging bin does not belong to the selected staging location',
        );
      }
    }

    let finalDiscountPercentage = dto.discountPercentage;

    if (dto.customerId) {
      const [customer] = await db
        .select({
          customerId: customers.customerId,
          customerGroupId: customers.customerGroupId,
        })
        .from(customers)
        .where(eq(customers.customerId, dto.customerId))
        .limit(1);

      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${dto.customerId} not found`,
        );
      }

      if (finalDiscountPercentage === undefined) {
        // Look up discount rules to find default
        const rules = await db
          .select()
          .from(discountMatrix)
          .where(
            or(
              eq(discountMatrix.customerId, dto.customerId),
              customer.customerGroupId
                ? eq(discountMatrix.customerGroupId, customer.customerGroupId)
                : sql`FALSE`,
            ),
          );
        const mappedRules: DiscountRule[] = rules.map((r) => ({
          ownerType: r.customerId ? 'customer' : 'customer_group',
          ownerId: r.customerId || r.customerGroupId || '',
          productGroupId: r.productGroupId,
          discountPercentage: r.discountPercentage,
        }));
        const resolved = resolveEffectiveDiscount(mappedRules, null);
        if (resolved) {
          finalDiscountPercentage = parseFloat(resolved);
        }
      }
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        projectNumber,
        name: dto.name,
        description: dto.description,
        customerId: dto.customerId,
        opportunityId: dto.opportunityId,
        stateCode: PROJECT_STATE.DRAFT,
        stage: dto.stage || 'Planning',
        billingType: dto.billingType || PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        projectManagerId: dto.projectManagerId,
        currencyCode: dto.currencyCode,
        stagingLocationId: dto.stagingLocationId || null,
        stagingBinId: dto.stagingBinId || null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        targetEndDate: dto.targetEndDate ? new Date(dto.targetEndDate) : null,
        notes: dto.notes,
        metadata: dto.metadata ?? {},
        discountPercentage:
          finalDiscountPercentage !== undefined
            ? finalDiscountPercentage.toString()
            : '0',
        tradingTermsId: dto.tradingTermsId || null,
        createdBy: username,
      })
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: newProject.projectId,
      eventType: EventType.CREATED,
      entityDisplayName: newProject.projectNumber,
      payload: {
        action: 'project_created',
        projectId: newProject.projectId,
        projectNumber: newProject.projectNumber,
        name: newProject.name,
        customerId: newProject.customerId,
        customerName: null,
        currencyCode: newProject.currencyCode,
        stage: newProject.stage,
        createdBy: username,
      },
    });

    return this.findOne(newProject.projectId, db);
  }

  async findAll(
    query: ProjectQueryDto,
    tx?: DrizzleDB,
  ): Promise<PaginatedResponse<ProjectResponseDto>> {
    const db = tx || this.db;
    const { page, limit, cursor, direction } = parsePagination(query);

    const conditions = [];

    if (query.q) {
      const term = `%${query.q}%`;
      conditions.push(
        or(
          ilike(projects.name, term),
          ilike(projects.projectNumber, term),
          ilike(projects.description, term),
        ),
      );
    }

    if (query.customerId) {
      conditions.push(eq(projects.customerId, query.customerId));
    }

    if (query.stage) {
      conditions.push(eq(projects.stage, query.stage));
    }

    const stateFilter = query.stateCode || query.status;
    if (stateFilter) {
      conditions.push(eq(projects.stateCode, stateFilter));
    }

    if (query.projectManagerId) {
      conditions.push(eq(projects.projectManagerId, query.projectManagerId));
    }

    if (query.opportunityId) {
      conditions.push(eq(projects.opportunityId, query.opportunityId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause);

    const total = Number(countRes?.count || 0);

    let qb = db.select().from(projects).$dynamic();
    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const {
      data: rawProjects,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { createdOn: string; projectId: string } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`>` : sql`<`;
        const cursorCond = or(
          sql`${projects.createdOn} ${op} ${new Date(c.createdOn)}`,
          and(
            sql`${projects.createdOn} = ${new Date(c.createdOn)}`,
            sql`${projects.projectId} ${idOp} ${c.projectId}`,
          ),
        );
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        const idOrderFn = dir === 'next' ? asc : desc;
        return q.orderBy(
          orderFn(projects.createdOn),
          idOrderFn(projects.projectId),
        );
      },
      encodeRow: (row) => ({
        createdOn: row.createdOn
          ? new Date(row.createdOn).toISOString()
          : new Date().toISOString(),
        projectId: row.projectId,
      }),
    });

    // Populate relations for each returned project
    const projectIds = rawProjects.map((p) => p.projectId);
    if (projectIds.length === 0) {
      return {
        data: [],
        page,
        limit,
        total,
        nextCursor,
        prevCursor,
      };
    }

    const populatedProjects = await Promise.all(
      projectIds.map((id) => this.findOne(id, db)),
    );

    return {
      data: populatedProjects,
      page,
      limit,
      total,
      nextCursor,
      prevCursor,
    };
  }

  async findOne(
    projectId: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResponseDto> {
    const db = tx || this.db;

    const project = await db.query.projects.findMany({
      where: eq(projects.projectId, projectId),
      limit: 1,
      with: {
        customer: {
          with: {
            organization: true,
          },
        },
        opportunity: true,
        projectManager: true,
        stagingLocation: true,
        stagingBin: true,
        tradingTerms: true,
        tasks: {
          orderBy: [asc(projectTasks.taskCode)],
        },
        budgetLines: {
          with: {
            resource: true,
            product: true,
          },
        },
        ledgerEntries: {
          orderBy: [desc(projectLedgerEntries.postingDate)],
          limit: 50,
          with: {
            product: true,
            resource: true,
            salesInvoiceLine: {
              with: {
                invoice: true,
              },
            },
          },
        },
        projectNotes: {
          with: {
            createdBy: true,
          },
          orderBy: [desc(projectNotes.createdOn)],
        },
      },
    });

    if (!project || project.length === 0) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const row = project[0];

    const rawLedgerEntries = row.ledgerEntries || [];
    interface ProjectLedgerEntryRow {
      ledgerId: string;
      sourceType?: string | null;
      sourceId?: string | null;
      isBilled?: boolean | null;
      salesInvoiceLine?: {
        invoice?: {
          invoiceId: string;
          invoiceNumber: string;
        } | null;
      } | null;
    }

    // Fallback resolution for entries that have sales_invoice source or are billed but direct salesInvoiceLine is missing
    const missingSourceInvoiceIds = (
      rawLedgerEntries as ProjectLedgerEntryRow[]
    )
      .filter(
        (e: ProjectLedgerEntryRow) =>
          !e.salesInvoiceLine?.invoice &&
          e.sourceType === PROJECT_SOURCE_TYPE.SALES_INVOICE &&
          Boolean(e.sourceId),
      )
      .map((e: ProjectLedgerEntryRow) => e.sourceId as string);

    const billedMissingLineLedgerIds = (
      rawLedgerEntries as ProjectLedgerEntryRow[]
    )
      .filter(
        (e: ProjectLedgerEntryRow) =>
          e.isBilled && !e.salesInvoiceLine?.invoice && !e.sourceId,
      )
      .map((e: ProjectLedgerEntryRow) => e.ledgerId);

    const fallbackInvoiceMap = new Map<
      string,
      { invoiceId: string; invoiceNumber: string }
    >();

    if (missingSourceInvoiceIds.length > 0) {
      const invs = await db
        .select({
          invoiceId: salesInvoices.invoiceId,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(salesInvoices)
        .where(inArray(salesInvoices.invoiceId, missingSourceInvoiceIds));

      for (const inv of invs) {
        fallbackInvoiceMap.set(inv.invoiceId, inv);
      }
    }

    if (billedMissingLineLedgerIds.length > 0) {
      const lines = await db
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
        .where(
          inArray(
            salesInvoiceLines.projectLedgerEntryId,
            billedMissingLineLedgerIds,
          ),
        );

      for (const l of lines) {
        if (l.ledgerId) {
          fallbackInvoiceMap.set(l.ledgerId, {
            invoiceId: l.invoiceId,
            invoiceNumber: l.invoiceNumber,
          });
        }
      }
    }

    const ledgerEntries = (rawLedgerEntries as ProjectLedgerEntryRow[]).map(
      (entry: ProjectLedgerEntryRow) => {
        const fallback =
          (entry.sourceId
            ? fallbackInvoiceMap.get(entry.sourceId)
            : undefined) || fallbackInvoiceMap.get(entry.ledgerId);
        const invoiceNumber =
          entry.salesInvoiceLine?.invoice?.invoiceNumber ??
          fallback?.invoiceNumber ??
          null;
        const invoiceId =
          entry.salesInvoiceLine?.invoice?.invoiceId ??
          fallback?.invoiceId ??
          null;

        return {
          ...entry,
          salesInvoiceNumber: invoiceNumber,
          salesInvoiceId: invoiceId,
        };
      },
    );

    let paymentTermsStr: string | null = null;
    let effectiveTermsId = row.tradingTermsId;
    if (!effectiveTermsId && row.customer) {
      effectiveTermsId = row.customer.tradingTermsId;
      if (!effectiveTermsId && row.customer.customerGroupId) {
        const [group] = await db
          .select({ tradingTermsId: customerGroups.tradingTermsId })
          .from(customerGroups)
          .where(
            eq(customerGroups.customerGroupId, row.customer.customerGroupId),
          )
          .limit(1);
        if (group) {
          effectiveTermsId = group.tradingTermsId;
        }
      }
    }

    if (effectiveTermsId) {
      const [term] = await db
        .select()
        .from(tradingTerms)
        .where(eq(tradingTerms.tradingTermsId, effectiveTermsId))
        .limit(1);
      if (term) {
        paymentTermsStr = `${term.code} (${term.days} Days)`;
      }
    }

    const customer = row.customer
      ? {
          ...row.customer,
          name: row.customer.organization?.name || null,
          customerName: row.customer.organization?.name || null,
          paymentTerms: paymentTermsStr || '30 Days (Default)',
        }
      : null;

    let stagingInventory: Array<{
      productId: string;
      productNumber: string;
      productName: string;
      actualQuantity: number;
      baseUom?: string;
    }> = [];

    if (row.stagingBinId) {
      const items = await db
        .select({
          productId: binContents.productId,
          productNumber: products.productNumber,
          productName: products.name,
          actualQuantity:
            sql<number>`COALESCE(${binContents.actualQuantity}::numeric, 0)`.mapWith(
              Number,
            ),
          baseUom: products.baseUom,
        })
        .from(binContents)
        .innerJoin(products, eq(binContents.productId, products.productId))
        .where(
          and(
            eq(binContents.binId, row.stagingBinId),
            sql`CAST(${binContents.actualQuantity} AS numeric) > 0`,
          ),
        );
      stagingInventory = items;
    }

    // Database-level actuals aggregation for all budget lines in this project
    const budgetActuals = await db
      .select({
        budgetLineId: projectLedgerEntries.budgetLineId,
        actualCost: sql<string>`coalesce(sum(${projectLedgerEntries.totalCostBase}::numeric), 0)`,
        actualRevenue: sql<string>`coalesce(sum(${projectLedgerEntries.totalPriceBase}::numeric), 0)`,
        actualQuantity: sql<string>`coalesce(sum(${projectLedgerEntries.quantity}::numeric), 0)`,
      })
      .from(projectLedgerEntries)
      .where(
        and(
          eq(projectLedgerEntries.projectId, projectId),
          sql`${projectLedgerEntries.budgetLineId} IS NOT NULL`,
        ),
      )
      .groupBy(projectLedgerEntries.budgetLineId);

    const budgetActualsMap = new Map<
      string,
      { actualCost: number; actualRevenue: number; actualQuantity: number }
    >();
    for (const ba of budgetActuals) {
      if (ba.budgetLineId) {
        budgetActualsMap.set(ba.budgetLineId, {
          actualCost: Number(ba.actualCost || 0),
          actualRevenue: Number(ba.actualRevenue || 0),
          actualQuantity: Number(ba.actualQuantity || 0),
        });
      }
    }

    const budgetLines = (row.budgetLines || []).map((b) => {
      const stats = budgetActualsMap.get(b.budgetLineId) || {
        actualCost: 0,
        actualRevenue: 0,
        actualQuantity: 0,
      };
      const totalPlannedCost = Number(
        b.totalCost || Number(b.plannedQuantity || 0) * Number(b.unitCost || 0),
      );
      const isOverBudget =
        totalPlannedCost > 0
          ? stats.actualCost > totalPlannedCost
          : stats.actualCost > 0;

      return {
        ...b,
        actualCost: stats.actualCost,
        actualRevenue: stats.actualRevenue,
        actualQuantity: stats.actualQuantity,
        isOverBudget,
      };
    });

    return {
      ...row,
      budgetLines,
      ledgerEntries,
      customer,
      paymentTerms: paymentTermsStr || '30 Days (Default)',
      stagingInventory,
    } as unknown as ProjectResponseDto;
  }

  async updateProject(
    projectId: string,
    dto: UpdateProjectDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResponseDto> {
    const db = tx || this.db;
    const existing = await this.findOne(projectId, db);

    const updateData: Partial<typeof projects.$inferInsert> = {
      modifiedOn: new Date(),
    };

    if (dto.projectNumber !== undefined && dto.projectNumber.trim()) {
      updateData.projectNumber = dto.projectNumber.trim();
    }
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
    if (dto.opportunityId !== undefined)
      updateData.opportunityId = dto.opportunityId;
    if (dto.billingType !== undefined) updateData.billingType = dto.billingType;
    if (dto.projectManagerId !== undefined)
      updateData.projectManagerId = dto.projectManagerId;
    if (dto.currencyCode !== undefined)
      updateData.currencyCode = dto.currencyCode;
    if (dto.stagingLocationId !== undefined)
      updateData.stagingLocationId = dto.stagingLocationId || null;
    if (dto.stagingBinId !== undefined) {
      if (dto.stagingBinId) {
        const [bin] = await db
          .select({
            binId: bins.binId,
            binType: bins.binType,
            zoneId: bins.zoneId,
            locationId: zones.locationId,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, dto.stagingBinId))
          .limit(1);

        if (!bin) {
          throw new NotFoundException(
            `Bin with ID ${dto.stagingBinId} not found`,
          );
        }
        if ((bin.binType as BIN_TYPE) !== BIN_TYPE.PROJECT) {
          throw new BadRequestException('Staging bin must be of type project');
        }
        const targetLocationId =
          dto.stagingLocationId !== undefined
            ? dto.stagingLocationId
            : existing.stagingLocationId;
        if (targetLocationId && bin.locationId !== targetLocationId) {
          throw new BadRequestException(
            'Staging bin does not belong to the selected staging location',
          );
        }
      }
      updateData.stagingBinId = dto.stagingBinId || null;
    }
    if (dto.startDate !== undefined)
      updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.targetEndDate !== undefined)
      updateData.targetEndDate = dto.targetEndDate
        ? new Date(dto.targetEndDate)
        : null;
    if (dto.stage !== undefined) updateData.stage = dto.stage;
    if (dto.discountPercentage !== undefined)
      updateData.discountPercentage = dto.discountPercentage.toString();
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.tradingTermsId !== undefined)
      updateData.tradingTermsId = dto.tradingTermsId || null;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

    await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.projectId, projectId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.UPDATED,
      entityDisplayName: existing.projectNumber,
      payload: {
        action: 'project_updated',
        projectId,
        updatedFields: Object.keys(updateData),
        updatedBy: username,
      },
    });

    return this.findOne(projectId, db);
  }

  async transitionState(
    projectId: string,
    dto: ProjectStateTransitionDto,
    username: string,
    tx?: DrizzleDB,
  ): Promise<ProjectResponseDto> {
    const db = tx || this.db;
    const existing = await this.findOne(projectId, db);

    const allowed = getAllowedTransitions(
      PROJECT_TRANSITIONS,
      existing.stateCode,
    );

    if (!allowed.includes(dto.stateCode)) {
      throw new BadRequestException(
        `Invalid transition from state '${existing.stateCode}' to '${dto.stateCode}'. Allowed destinations: ${allowed.join(', ') || 'none'}`,
      );
    }

    const updateData: Partial<typeof projects.$inferInsert> = {
      stateCode: dto.stateCode,
      modifiedOn: new Date(),
    };

    if (dto.stateCode === PROJECT_STATE.CLOSED) {
      if (!existing.actualEndDate) {
        updateData.actualEndDate = new Date();
      }
    }

    await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.projectId, projectId));

    await emitEvent(db, {
      entityType: EntityType.PROJECT,
      entityId: projectId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: existing.projectNumber,
      payload: {
        action: 'project_state_changed',
        fromState: existing.stateCode,
        toState: dto.stateCode,
        reason: dto.reason,
        transitionedBy: username,
      },
    });

    return this.findOne(projectId, db);
  }
}
