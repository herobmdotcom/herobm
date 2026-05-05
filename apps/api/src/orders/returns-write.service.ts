import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { inArray, eq, sql, and, desc, isNull, sum } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderReturns,
  salesOrderReturnLines,
  orderEvents,
  outbox,
  glAccounts,
  bins,
  zones,
  products as coreProducts,
  accounts as coreAccounts,
  accountGroups,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { InventoryService } from '../inventory/inventory.service';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { computeLinePrice } from '@modbm/shared';
import {
  findOrder as sharedFindOrder,
  findOrderLine as sharedFindOrderLine,
} from './shipment-helpers';

import {
  RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { validateReturnQuantity } from './returns-math.utils';
import {
  CreateReturnDto,
  UpdateReturnDto,
  AddReturnLineDto,
  UpdateReturnLineDto,
} from './dto';

const VALID_RETURN_STATES = getValidStates(RETURN_STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class ReturnsWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(ReturnsWriteService.name);

  /**
   * Generate a human-readable return number (RET-YYYYMMDD-NNNN).
   */
  private async generateReturnNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RET-${today}-`;

    const result = await this.db
      .select({ returnNumber: salesOrderReturns.returnNumber })
      .from(salesOrderReturns)
      .where(sql`${salesOrderReturns.returnNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesOrderReturns.returnNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].returnNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Calculate how much quantity has already been returned for a given order line
   * across all non-cancelled returns.
   */
  private async getAlreadyReturnedQty(
    salesOrderLineId: string,
    excludeReturnId?: string,
  ): Promise<number> {
    const query = this.db
      .select({
        total: sql<string>`COALESCE(SUM(${salesOrderReturnLines.quantityReturned}::numeric), 0)::text`,
      })
      .from(salesOrderReturnLines)
      .innerJoin(
        salesOrderReturns,
        eq(salesOrderReturnLines.returnId, salesOrderReturns.returnId),
      )
      .where(
        and(
          eq(salesOrderReturnLines.salesOrderLineId, salesOrderLineId),
          sql`${salesOrderReturns.stateCode} != 'cancelled'`,
          excludeReturnId
            ? sql`${salesOrderReturns.returnId} != ${excludeReturnId}`
            : undefined,
        ),
      );

    const rows = await query;
    return parseFloat(rows[0]?.total ?? '0');
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new return against an invoiced order.
   */
  async createReturn(
    salesOrderId: string,
    dto: CreateReturnDto,
    actor: string,
  ) {
    // Validate the order exists and is invoiced
    const order = await this.findOrder(salesOrderId);
    if (order.stateCode !== 'invoiced') {
      throw new BadRequestException(
        `Cannot create a return against order in state '${order.stateCode}'. Order must be invoiced.`,
      );
    }

    // Validate all lines belong to this order and quantities are valid
    for (const line of dto.lines) {
      const orderLine = await this.findOrderLine(
        line.salesOrderLineId,
        salesOrderId,
      );
      const alreadyReturned = await this.getAlreadyReturnedQty(
        line.salesOrderLineId,
      );

      validateReturnQuantity(
        line.quantityReturned,
        orderLine.quantity,
        alreadyReturned,
        orderLine.lineNumber,
      );

      if (line.returnFee) {
        const fee = parseFloat(line.returnFee);
        if (fee < 0) {
          throw new BadRequestException(`Return fee cannot be negative`);
        }
      }
    }

    const returnNumber = await this.generateReturnNumber();

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [ret] = await tx
        .insert(salesOrderReturns)
        .values({
          returnNumber,
          salesOrderId,
          stateCode: 'draft',
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      // Insert return lines
      const lineValues = dto.lines.map((line) => ({
        returnId: ret.returnId,
        salesOrderLineId: line.salesOrderLineId,
        quantityReturned: line.quantityReturned,
        reason: line.reason,
        returnFee: line.returnFee ?? '0',
      }));

      if (lineValues.length > 0) {
        await tx.insert(salesOrderReturnLines).values(lineValues);
      }

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: salesOrderId,
        eventType: 'return_created',
        payload: {
          returnId: ret.returnId,
          returnNumber,
          lineCount: lineValues.length,
        },
        actor,
      });

      return ret;
    });

    this.logger.log(
      `Return created: ${returnNumber} for order ${salesOrderId} with ${dto.lines.length} lines by ${actor}`,
    );
    return result;
  }

  /**
   * Update return header fields (notes).
   */
  async updateReturn(returnId: string, dto: UpdateReturnDto, actor: string) {
    const existing = await this.findReturn(returnId);

    if (existing.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot update return in state '${existing.stateCode}'. Must be draft.`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

      const [updated] = await tx
        .update(salesOrderReturns)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        })
        .where(eq(salesOrderReturns.returnId, returnId))
        .returning();

      if (audit.hasChanges) {
        await emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: existing.salesOrderId,
          eventType: 'return_updated',
          payload: {
            returnId,
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        });
      }

      return updated;
    });

    return result;
  }

  /**
   * Transition return state.
   */
  async changeReturnState(
    returnId: string,
    newState: string,
    actor: string,
    locationId?: string,
  ) {
    if (!VALID_RETURN_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid return state: '${newState}'`);
    }

    const existing = await this.findReturn(returnId);
    const allowed = RETURN_STATE_TRANSITIONS[existing.stateCode];

    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition return from '${existing.stateCode}' to '${newState}'. ` +
          `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(salesOrderReturns)
        .set({ stateCode: newState, modifiedOn: new Date() })
        .where(eq(salesOrderReturns.returnId, returnId))
        .returning();

      // ── Inventory hook: return processed → restore on-hand ──
      if (newState === 'processed') {
        const returnLines = await tx
          .select()
          .from(salesOrderReturnLines)
          .where(eq(salesOrderReturnLines.returnId, returnId));

        // Resolve productIds from order lines
        const stockLines = [];
        for (const rl of returnLines) {
          const orderLine = await tx
            .select()
            .from(salesOrderLineItems)
            .where(
              eq(salesOrderLineItems.salesOrderLineId, rl.salesOrderLineId),
            )
            .limit(1)
            .then((r: any[]) => r[0]);
          if (orderLine) {
            stockLines.push({
              productId: orderLine.productId,
              quantity: rl.quantityReturned,
            });
          }
        }

        if (!locationId) {
          throw new BadRequestException(
            'A location context is required to process a return and receive items into inventory.',
          );
        }

        const [dockBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(bins.binNumber, 'RECEIVING'),
              eq(zones.locationId, locationId),
            ),
          )
          .limit(1);

        if (!dockBin) {
          throw new BadRequestException(
            `No RECEIVING bin found for location '${locationId}'.`,
          );
        }

        const receiveLines = stockLines.map((line) => ({
          productId: line.productId,
          binId: dockBin.binId,
          quantity: parseFloat(line.quantity),
        }));

        if (receiveLines.length > 0) {
          await this.inventoryService.recordInventoryMovement(tx, {
            entryNumber:
              'RET-' +
              existing.returnNumber +
              '-' +
              Date.now().toString().slice(-4),
            sourceType: 'SO_RETURN',
            sourceId: returnId,
            memo: 'RMA Received to Dock',
            userId: actor,
            lines: receiveLines,
          });
        }

        // Note: WAC is unaffected by sales returns, and quantityOnHand is no longer cached on the products table.
        // The dynamic inventory_levels view will automatically reflect the stock returned to the dock bin.

        // --- Financial Integration: Post Inventory/COGS reversal via Accounting Strategy ---
        const valuationStrategy = getValuationStrategy(
          this.appConfig.valuationMethod(),
        );
        let totalReturnCost = 0;

        for (const line of stockLines) {
          if (!line.productId) continue;
          const [product] = await tx
            .select()
            .from(coreProducts)
            .where(eq(coreProducts.productId, line.productId));

          if (product) {
            const cost = valuationStrategy.getCogs(
              {
                productId: product.productId,
                standardCost: product.standardCost || '0',
                weightedAverageCost: product.weightedAverageCost || '0',
              },
              parseFloat(line.quantity),
            );
            totalReturnCost += parseFloat(cost);
          }
        }

        const accountingStrategy = getAccountingStrategy(
          this.appConfig.inventoryAccountingMode(),
          {
            inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
            grniAccountId: this.appConfig.defaultGrniAccountId(),
            cogsAccountId: this.appConfig.defaultCogsAccountId(),
            shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
          },
        );

        const returnGl = accountingStrategy.onSalesReturn({
          amount: Number(totalReturnCost.toFixed(2)),
          memo: `Sales Return ${existing.returnNumber}`,
          costCenterId: (() => {
            // Will be resolved below
            return undefined;
          })(),
        });

        // Resolve customer account group dimensions for return posting
        const [retOrder] = await tx
          .select({
            costCenterId: accountGroups.defaultCostCenterId,
            activityId: accountGroups.defaultActivityId,
          })
          .from(salesOrders)
          .leftJoin(
            coreAccounts,
            eq(salesOrders.customerId, coreAccounts.accountId),
          )
          .leftJoin(
            accountGroups,
            eq(coreAccounts.accountGroupId, accountGroups.accountGroupId),
          )
          .where(eq(salesOrders.salesOrderId, existing.salesOrderId));

        const retCostCenterId = retOrder?.costCenterId || undefined;
        const retActivityId = retOrder?.activityId || undefined;

        const returnGlWithDims = accountingStrategy.onSalesReturn({
          amount: Number(totalReturnCost.toFixed(2)),
          memo: `Sales Return ${existing.returnNumber}`,
          costCenterId: retCostCenterId,
          activityId: retActivityId,
        });

        if (returnGlWithDims) {
          await this.glService.postJournalEntry(
            returnGlWithDims.lines as any,
            {
              actor,
              entryDate: new Date().toISOString().slice(0, 10),
              sourceType: returnGlWithDims.sourceType,
              sourceId: returnId,
              memo: `Sales Return ${existing.returnNumber}`,
            },
            tx,
          );
        }
      }

      const eventType =
        newState === 'processed' ? 'return_processed' : 'return_status_changed';

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: existing.salesOrderId,
        eventType,
        payload: {
          returnId,
          returnNumber: existing.returnNumber,
          from: existing.stateCode,
          to: newState,
        },
        actor,
      });

      // GL Credit Note: post journal entry when return is processed (atomic)
      if (newState === 'processed') {
        await this.postCreditNoteGl(returnId, existing, actor, tx);
      }

      return updated;
    });

    this.logger.log(
      `Return ${existing.returnNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
    );

    return result;
  }

  /**
   * Add a line to an existing return.
   */
  async addReturnLine(returnId: string, dto: AddReturnLineDto, actor: string) {
    const ret = await this.findReturn(returnId);

    if (ret.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot add lines to return in state '${ret.stateCode}'`,
      );
    }

    const orderLine = await this.findOrderLine(
      dto.salesOrderLineId,
      ret.salesOrderId,
    );
    const alreadyReturned = await this.getAlreadyReturnedQty(
      dto.salesOrderLineId,
    );
    const originalQty = parseFloat(orderLine.quantity);
    const requestedQty = parseFloat(dto.quantityReturned);

    if (requestedQty <= 0) {
      throw new BadRequestException(`Return quantity must be greater than 0`);
    }

    if (requestedQty > originalQty - alreadyReturned) {
      throw new BadRequestException(
        `Cannot return ${requestedQty}. Remaining returnable: ${originalQty - alreadyReturned}`,
      );
    }

    if (dto.returnFee) {
      const fee = parseFloat(dto.returnFee);
      if (fee < 0) {
        throw new BadRequestException(`Return fee cannot be negative`);
      }
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [line] = await tx
        .insert(salesOrderReturnLines)
        .values({
          returnId,
          salesOrderLineId: dto.salesOrderLineId,
          quantityReturned: dto.quantityReturned,
          reason: dto.reason,
          returnFee: dto.returnFee ?? '0',
        })
        .returning();

      await tx
        .update(salesOrderReturns)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderReturns.returnId, returnId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: ret.salesOrderId,
        eventType: 'return_line_added',
        payload: {
          returnId,
          returnLineId: line.returnLineId,
          salesOrderLineId: dto.salesOrderLineId,
          quantityReturned: dto.quantityReturned,
        },
        actor,
      });

      return line;
    });

    return result;
  }

  /**
   * Update a return line.
   */
  async updateReturnLine(
    returnId: string,
    lineId: string,
    dto: UpdateReturnLineDto,
    actor: string,
  ) {
    const ret = await this.findReturn(returnId);

    if (ret.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot update lines on return in state '${ret.stateCode}'`,
      );
    }

    const existingLine = await this.findReturnLine(lineId, returnId);

    // Validate new quantity if changed
    if (dto.quantityReturned !== undefined) {
      const requestedQty = parseFloat(dto.quantityReturned);
      if (requestedQty <= 0) {
        throw new BadRequestException(`Return quantity must be greater than 0`);
      }

      const orderLine = await this.findOrderLine(
        existingLine.salesOrderLineId,
        ret.salesOrderId,
      );
      const alreadyReturned = await this.getAlreadyReturnedQty(
        existingLine.salesOrderLineId,
        returnId,
      );
      const originalQty = parseFloat(orderLine.quantity);

      if (requestedQty > originalQty - alreadyReturned) {
        throw new BadRequestException(
          `Cannot return ${requestedQty}. Remaining returnable: ${originalQty - alreadyReturned}`,
        );
      }
    }

    if (dto.returnFee !== undefined) {
      const fee = parseFloat(dto.returnFee);
      if (fee < 0) {
        throw new BadRequestException(`Return fee cannot be negative`);
      }
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existingLine, AuditMode.DIFF);

      const [updated] = await tx
        .update(salesOrderReturnLines)
        .set({
          ...audit.changes,
        })
        .where(eq(salesOrderReturnLines.returnLineId, lineId))
        .returning();

      await tx
        .update(salesOrderReturns)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderReturns.returnId, returnId));

      if (audit.hasChanges) {
        await emitEvent(tx, {
          aggregateType: AggregateType.SALES_ORDER,
          aggregateId: ret.salesOrderId,
          eventType: 'return_line_updated',
          payload: {
            returnId,
            returnLineId: lineId,
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        });
      }

      return updated;
    });

    return result;
  }

  /**
   * Remove a return line.
   */
  async removeReturnLine(returnId: string, lineId: string, actor: string) {
    const ret = await this.findReturn(returnId);

    if (ret.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot remove lines from return in state '${ret.stateCode}'`,
      );
    }

    const existingLine = await this.findReturnLine(lineId, returnId);

    await this.db.transaction(async (tx: DrizzleDB) => {
      await tx
        .delete(salesOrderReturnLines)
        .where(eq(salesOrderReturnLines.returnLineId, lineId));

      await tx
        .update(salesOrderReturns)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderReturns.returnId, returnId));

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: ret.salesOrderId,
        eventType: 'return_line_removed',
        payload: {
          returnId,
          returnLineId: lineId,
          salesOrderLineId: existingLine.salesOrderLineId,
          quantityReturned: existingLine.quantityReturned,
        },
        actor,
      });
    });
  }

  /**
   * Get a single return with its lines.
   */
  async findOne(returnId: string) {
    const ret = await this.findReturn(returnId);

    const lines = await this.db
      .select()
      .from(salesOrderReturnLines)
      .where(eq(salesOrderReturnLines.returnId, returnId));

    return { ...ret, lines };
  }

  /**
   * List all returns for an order.
   */
  async findByOrder(salesOrderId: string) {
    const returns = await this.db
      .select()
      .from(salesOrderReturns)
      .where(eq(salesOrderReturns.salesOrderId, salesOrderId))
      .orderBy(salesOrderReturns.createdOn);

    // Fetch lines for each return
    const result = [];
    for (const ret of returns) {
      const lines = await this.db
        .select()
        .from(salesOrderReturnLines)
        .where(eq(salesOrderReturnLines.returnId, ret.returnId));
      result.push({ ...ret, lines });
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async findOrder(salesOrderId: string) {
    return sharedFindOrder(this.db, salesOrderId);
  }

  private async findOrderLine(lineId: string, salesOrderId: string) {
    return sharedFindOrderLine(this.db, lineId, salesOrderId);
  }

  private async findReturn(returnId: string) {
    const rows = await this.db
      .select()
      .from(salesOrderReturns)
      .where(eq(salesOrderReturns.returnId, returnId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Return '${returnId}' not found`);
    }
    return rows[0];
  }

  private async findReturnLine(lineId: string, returnId: string) {
    const rows = await this.db
      .select()
      .from(salesOrderReturnLines)
      .where(eq(salesOrderReturnLines.returnLineId, lineId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Return line '${lineId}' not found`);
    }

    if (rows[0].returnId !== returnId) {
      throw new BadRequestException(
        `Return line '${lineId}' does not belong to return '${returnId}'`,
      );
    }

    return rows[0];
  }

  // ---------------------------------------------------------------------------
  // GL Credit Note posting
  // ---------------------------------------------------------------------------

  private async postCreditNoteGl(
    returnId: string,
    existing: { returnNumber: string; salesOrderId: string },
    actor: string,
    tx?: DrizzleDB,
  ) {
    const queryDb = tx || this.db;
    const settings = await this.glService.getSettings();
    if (!settings?.defaultArAccountId || !settings?.defaultRevenueAccountId) {
      this.logger.warn(
        'GL settings incomplete — skipping credit note GL posting',
      );
      return;
    }

    // Resolve account codes from settings IDs
    const settingsIds = [
      settings.defaultArAccountId,
      settings.defaultRevenueAccountId,
      settings.defaultTaxAccountId,
    ].filter((id): id is string => !!id);

    const acctRows = await queryDb
      .select({
        glAccountId: glAccounts.glAccountId,
        accountCode: glAccounts.accountCode,
      })
      .from(glAccounts)
      .where(inArray(glAccounts.glAccountId, settingsIds));

    console.log('acctRows', acctRows);
    console.log('settingsIds', settingsIds);

    const idToCode = new Map(
      acctRows.map((a) => [a.glAccountId, a.accountCode]),
    );
    const arCode = idToCode.get(settings.defaultArAccountId);
    const revCode = settings.defaultRevenueAccountId
      ? idToCode.get(settings.defaultRevenueAccountId)
      : null;
    const taxCode = settings.defaultTaxAccountId
      ? idToCode.get(settings.defaultTaxAccountId)
      : null;

    if (!arCode || !revCode) {
      this.logger.warn(
        'AR or Revenue account code not found — skipping credit note GL',
      );
      return;
    }

    // Other Revenue account for fees (4900 by convention)
    const feeAccountCode = '4900';

    // Fetch order for customer info
    const order = await sharedFindOrder(queryDb, existing.salesOrderId);

    let customerCostCenterId: string | undefined;
    let customerActivityId: string | undefined;

    if (order.customerId) {
      const [custInfo] = await queryDb
        .select({
          costCenterId: accountGroups.defaultCostCenterId,
          activityId: accountGroups.defaultActivityId,
        })
        .from(coreAccounts)
        .leftJoin(
          accountGroups,
          eq(coreAccounts.accountGroupId, accountGroups.accountGroupId),
        )
        .where(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            order.customerId,
          )
            ? eq(coreAccounts.accountId, order.customerId)
            : eq(coreAccounts.externalId, order.customerId),
        );

      if (custInfo) {
        customerCostCenterId = custInfo.costCenterId || undefined;
        customerActivityId = custInfo.activityId || undefined;
      }
    }

    // Fetch return lines + join to order lines for pricing + GST
    const returnLines = await queryDb
      .select()
      .from(salesOrderReturnLines)
      .where(eq(salesOrderReturnLines.returnId, returnId));

    let totalCreditAmount = 0;
    let totalTaxAmount = 0;
    let totalFees = 0;
    const outboxLineDetails: any[] = [];

    for (const rl of returnLines) {
      const orderLine = await queryDb
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderLineId, rl.salesOrderLineId))
        .limit(1)
        .then((r: any[]) => r[0]);

      if (!orderLine) continue;

      const unitPrice = parseFloat(orderLine.pricePerUnit || '0');
      const disc = parseFloat(orderLine.discountPercentage || '0');
      const qty = parseFloat(rl.quantityReturned || '0');
      const fee = parseFloat(rl.returnFee || '0');

      // Resolve per-line GST rate from the line's taxCategoryId
      let taxRate = 0;
      if (orderLine.taxCategoryId) {
        try {
          const cat = await this.taxService.getById(orderLine.taxCategoryId);
          taxRate = parseFloat(cat.rate ?? '0');
        } catch {
          // Category not found — fall back to 0%
        }
      }

      const pricing = computeLinePrice({
        quantity: qty,
        pricePerUnit: unitPrice,
        discountPercentage: disc,
        taxRate: taxRate,
      });

      totalCreditAmount += pricing.amount;
      totalTaxAmount += pricing.tax;
      totalFees += fee;

      outboxLineDetails.push({
        salesOrderLineId: rl.salesOrderLineId,
        productId: orderLine.productId,
        quantity: qty,
        amount: pricing.amount,
        tax: pricing.tax,
        fee,
      });
    }

    if (totalCreditAmount <= 0) {
      this.logger.warn('No credit amount to post — skipping credit note GL');
      return;
    }

    // Net AR credit = credit amount + tax - fees
    const netArCredit = totalCreditAmount + totalTaxAmount - totalFees;

    // Build balanced journal lines (reverse of sales invoice):
    //   Debit Revenue
    //   Credit AR
    //   Credit Other Revenue (restocking fee income, if any)
    const glLines: any[] = [
      {
        accountCode: revCode,
        debit: totalCreditAmount,
        credit: 0,
        memo: `Sales return: ${existing.returnNumber}`,
        costCenterId: customerCostCenterId,
        activityId: customerActivityId,
      },
      {
        accountCode: arCode,
        debit: 0,
        credit: netArCredit,
        memo: `Credit note: ${existing.returnNumber}`,
        partyType: 'customer',
        partyId: order.customerId,
        costCenterId: customerCostCenterId,
        activityId: customerActivityId,
      },
    ];

    if (taxCode && totalTaxAmount > 0) {
      glLines.push({
        accountCode: taxCode,
        debit: totalTaxAmount,
        credit: 0,
        memo: `GST reversal: ${existing.returnNumber}`,
        costCenterId: customerCostCenterId,
        activityId: customerActivityId,
      });
    }

    if (totalFees > 0) {
      glLines.push({
        accountCode: feeAccountCode,
        debit: 0,
        credit: totalFees,
        memo: `Restocking fee: ${existing.returnNumber}`,
        costCenterId: customerCostCenterId,
        activityId: customerActivityId,
      });
    }

    await this.glService.postJournalEntry(
      glLines,
      {
        sourceType: 'sales_credit_note',
        sourceId: returnId,
        memo: `Credit note for return ${existing.returnNumber} on order ${order.orderNumber}`,
        actor,
      },
      tx,
    );

    // Write outbox event for downstream consumers (mirrors sales_invoiced pattern)
    await emitEvent(queryDb as any, {
      aggregateType: AggregateType.SALES_ORDER,
      aggregateId: existing.salesOrderId,
      eventType: 'credit_note_posted',
      payload: {
        returnId,
        returnNumber: existing.returnNumber,
        salesOrderId: existing.salesOrderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        totalCredit: totalCreditAmount,
        totalTax: totalTaxAmount,
        totalFees,
        netCredit: netArCredit,
        currency: order.currencyCode,
        lines: outboxLineDetails,
      },
      actor,
    });

    this.logger.log(
      `GL credit note posted for return ${existing.returnNumber}: credit=${totalCreditAmount}, tax=${totalTaxAmount}, fees=${totalFees}, netAR=${netArCredit}`,
    );
  }
}
