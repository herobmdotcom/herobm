import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
} from '../drizzle/modbm-core-schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { InventoryService } from '../inventory/inventory.service';
import {
  writeEvent as sharedWriteEvent,
  findOrder as sharedFindOrder,
  findOrderLine as sharedFindOrderLine,
} from './shipment-helpers';

import {
  RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';

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

    const result = await this.db.transaction(async (tx: any) => {
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

    const result = await this.db.transaction(async (tx: any) => {
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

    const result = await this.db.transaction(async (tx: any) => {
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

        await this.inventoryService.returnStock(tx, stockLines);
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

    const result = await this.db.transaction(async (tx: any) => {
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

    const result = await this.db.transaction(async (tx: any) => {
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

    await this.db.transaction(async (tx: any) => {
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
}
