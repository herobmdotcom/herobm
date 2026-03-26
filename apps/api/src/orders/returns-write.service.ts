import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql, and } from 'drizzle-orm';
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
  products as coreProducts,
} from '../drizzle/modbm-core-schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { InventoryService } from '../inventory/inventory.service';
import { GlService } from '../gl/gl.service';
import { GstCategoriesService } from '../gst/gst-categories.service';
import { computeLinePrice } from '@modbm/shared';
import {
  writeEvent as sharedWriteEvent,
  findOrder as sharedFindOrder,
  findOrderLine as sharedFindOrderLine,
} from './shipment-helpers';

import {
  RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';
import { getValuationStrategy } from '../inventory/valuation';

const VALID_RETURN_STATES = getValidStates(RETURN_STATE_TRANSITIONS);

interface CreateReturnDto {
  notes?: string;
  lines: Array<{
    salesOrderLineId: string;
    quantityReturned: string;
    reason?: string;
    returnFee?: string;
  }>;
}

interface UpdateReturnDto {
  notes?: string;
}

interface AddReturnLineDto {
  salesOrderLineId: string;
  quantityReturned: string;
  reason?: string;
  returnFee?: string;
}

interface UpdateReturnLineDto {
  quantityReturned?: string;
  reason?: string;
  returnFee?: string;
}

@Injectable()
export class ReturnsWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly glService: GlService,
    private readonly gstService: GstCategoriesService,
    private readonly configService: ConfigService,
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
   * Write an audit event and outbox record in the same transaction scope.
   */
  private async writeEvent(
    tx: any,
    salesOrderId: string,
    eventType: string,
    payload: any,
    actor: string,
  ): Promise<void> {
    await sharedWriteEvent(
      tx,
      salesOrderId,
      eventType,
      payload,
      actor,
      'sales_order_return',
    );
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
      const originalQty = parseFloat(orderLine.quantity);
      const requestedQty = parseFloat(line.quantityReturned);

      if (requestedQty <= 0) {
        throw new BadRequestException(`Return quantity must be greater than 0`);
      }

      if (requestedQty > originalQty - alreadyReturned) {
        throw new BadRequestException(
          `Cannot return ${requestedQty} of line ${orderLine.lineNumber}. ` +
            `Original qty: ${originalQty}, already returned: ${alreadyReturned}, ` +
            `remaining returnable: ${originalQty - alreadyReturned}`,
        );
      }

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

      await this.writeEvent(
        tx,
        salesOrderId,
        'return_created',
        {
          returnId: ret.returnId,
          returnNumber,
          lineCount: lineValues.length,
        },
        actor,
      );

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
        await this.writeEvent(
          tx,
          existing.salesOrderId,
          'return_updated',
          {
            returnId,
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        );
      }

      return updated;
    });

    return result;
  }

  /**
   * Transition return state.
   */
  async changeReturnState(returnId: string, newState: string, actor: string) {
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

        const [dockBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .where(eq(bins.binNumber, 'DOCK'))
          .limit(1);

        if (!dockBin) {
          throw new BadRequestException('System DOCK bin is missing.');
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

        // Update product global QOH
        const method = this.configService.get<string>(
          'INVENTORY_VALUATION_METHOD',
        );
        const strategy = getValuationStrategy(method);

        for (const line of stockLines) {
          if (!line.productId) continue;
          const [product] = await tx
            .select()
            .from(coreProducts)
            .where(eq(coreProducts.productId, line.productId));

          if (product) {
            const updatedProduct = strategy.onReturn(
              {
                productId: product.productId,
                standardCost: product.standardCost || '0',
                weightedAverageCost: product.weightedAverageCost || '0',
                quantityOnHand: product.quantityOnHand || '0',
              },
              parseFloat(line.quantity),
            );

            await tx
              .update(coreProducts)
              .set({
                quantityOnHand: updatedProduct.quantityOnHand,
                modifiedOn: new Date(),
              })
              .where(eq(coreProducts.productId, product.productId));
          }
        }
      }

      const eventType =
        newState === 'processed' ? 'return_processed' : 'return_status_changed';

      await this.writeEvent(
        tx,
        existing.salesOrderId,
        eventType,
        {
          returnId,
          returnNumber: existing.returnNumber,
          from: existing.stateCode,
          to: newState,
        },
        actor,
      );

      return updated;
    });

    this.logger.log(
      `Return ${existing.returnNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
    );

    // ── GL Credit Note: post journal entry when return is processed ──
    if (newState === 'processed') {
      try {
        await this.postCreditNoteGl(returnId, existing, actor);
      } catch (glErr) {
        // GL posting is non-fatal — log and continue
        this.logger.error(
          `GL credit note failed for return ${existing.returnNumber}: ${glErr}`,
        );
      }
    }

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

      await this.writeEvent(
        tx,
        ret.salesOrderId,
        'return_line_added',
        {
          returnId,
          returnLineId: line.returnLineId,
          salesOrderLineId: dto.salesOrderLineId,
          quantityReturned: dto.quantityReturned,
        },
        actor,
      );

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
        await this.writeEvent(
          tx,
          ret.salesOrderId,
          'return_line_updated',
          {
            returnId,
            returnLineId: lineId,
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        );
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

      await this.writeEvent(
        tx,
        ret.salesOrderId,
        'return_line_removed',
        {
          returnId,
          returnLineId: lineId,
          salesOrderLineId: existingLine.salesOrderLineId,
          quantityReturned: existingLine.quantityReturned,
        },
        actor,
      );
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
  ) {
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
    ].filter(Boolean);

    const acctRows = await this.db
      .select({
        glAccountId: glAccounts.glAccountId,
        accountCode: glAccounts.accountCode,
      })
      .from(glAccounts)
      .where(
        sql`${glAccounts.glAccountId} IN (${sql.join(
          settingsIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

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
    const order = await sharedFindOrder(this.db, existing.salesOrderId);

    // Fetch return lines + join to order lines for pricing + GST
    const returnLines = await this.db
      .select()
      .from(salesOrderReturnLines)
      .where(eq(salesOrderReturnLines.returnId, returnId));

    let totalCreditAmount = 0;
    let totalTaxAmount = 0;
    let totalFees = 0;
    const outboxLineDetails: any[] = [];

    for (const rl of returnLines) {
      const orderLine = await this.db
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

      // Resolve per-line GST rate from the line's gstCategoryId
      let gstRate = 0;
      if (orderLine.gstCategoryId) {
        try {
          const cat = await this.gstService.getById(orderLine.gstCategoryId);
          gstRate = parseFloat(cat.rate ?? '0');
        } catch {
          // Category not found — fall back to 0%
        }
      }

      const pricing = computeLinePrice({
        quantity: qty,
        pricePerUnit: unitPrice,
        discountPercentage: disc,
        taxRate: gstRate,
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
    //   Debit Revenue (return the revenue)
    //   Debit GST Payable (reverse the collected tax)
    //   Credit AR (reduce customer receivable, net of fees)
    //   Credit Other Revenue (restocking fee income, if any)
    const glLines: any[] = [
      {
        accountCode: revCode,
        debit: totalCreditAmount,
        credit: 0,
        memo: `Sales return: ${existing.returnNumber}`,
      },
      {
        accountCode: arCode,
        debit: 0,
        credit: netArCredit,
        memo: `Credit note: ${existing.returnNumber}`,
        partyType: 'customer',
        partyId: order.customerId,
      },
    ];

    if (taxCode && totalTaxAmount > 0) {
      glLines.push({
        accountCode: taxCode,
        debit: totalTaxAmount,
        credit: 0,
        memo: `GST reversal: ${existing.returnNumber}`,
      });
    }

    if (totalFees > 0) {
      glLines.push({
        accountCode: feeAccountCode,
        debit: 0,
        credit: totalFees,
        memo: `Restocking fee: ${existing.returnNumber}`,
      });
    }

    await this.glService.postJournalEntry(glLines, {
      sourceType: 'sales_credit_note',
      sourceId: returnId,
      memo: `Credit note for return ${existing.returnNumber} on order ${order.orderNumber}`,
      actor,
    });

    // Write outbox event for downstream consumers (mirrors sales_invoiced pattern)
    await this.db.insert(outbox).values({
      aggregateType: 'sales_credit_note',
      aggregateId: returnId,
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
    });

    this.logger.log(
      `GL credit note posted for return ${existing.returnNumber}: credit=${totalCreditAmount}, tax=${totalTaxAmount}, fees=${totalFees}, netAR=${netArCredit}`,
    );
  }
}
