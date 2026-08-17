import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { SalesCreditNoteService } from '../invoices/sales-credit-note.service';

import {
  eq,
  sql,
  and,
  or,
  ilike,
  desc,
  asc,
  inArray,
  getTableColumns,
} from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderReturns,
  salesOrderReturnLines,
  salesCreditNotes,
  salesEvents,
  outbox,
  bins,
  zones,
  products as coreProducts,
  customers as coreAccounts,
  customerGroups,
  locations,
  salesInvoices,
  actors,
  taxCategories,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { GlService } from '../gl/gl.service';

import {
  findOrder as sharedFindOrder,
  findOrderLine as sharedFindOrderLine,
  getCommittedPerLine,
} from './shipment-helpers';

import {
  RETURN_STATE,
  SALES_ORDER_STATE,
  RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
  getValidStates,
  PUTAWAY_STATUS,
  RETURN_RESOLUTION,
} from '@herobm/shared';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { validateReturnQuantity } from './returns-math.utils';
import {
  CreateReturnDto,
  UpdateReturnDto,
  AddReturnLineDto,
  UpdateReturnLineDto,
  ReceiveReturnDto,
  CreateOrderDto,
} from './dto';
import { InventoryMovementService } from '../inventory/inventory-movement.service';

const VALID_RETURN_STATES = getValidStates(RETURN_STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class ReturnsWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly glService: GlService,
    private readonly appConfig: AppConfigService,
    public readonly creditNoteService: SalesCreditNoteService,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  private readonly logger = new Logger(ReturnsWriteService.name);

  /**
   * Generate a human-readable return number (RET-YYYYMMDD-NNNN).
   */
  private async generateReturnNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RET-${today}-`;
    const result = await db
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
    tx?: DrizzleDB,
  ): Promise<number> {
    const db = tx || this.db;
    const query = db
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
          sql`${salesOrderReturns.stateCode} != ${RETURN_STATE.CANCELLED}`,
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

  /** Allowed order states for creating a return (goods must be shipping or shipped). */
  private static readonly RETURNABLE_ORDER_STATES = [
    SALES_ORDER_STATE.PICKING,
    SALES_ORDER_STATE.SHIPPED,
    SALES_ORDER_STATE.INVOICED,
  ];

  /**
   * Create a new return against an order that has been at least partially shipped.
   */
  async createReturn(
    salesOrderId: string,
    dto: CreateReturnDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const order = await this.findOrder(salesOrderId, innerTx);
        if (
          !ReturnsWriteService.RETURNABLE_ORDER_STATES.includes(
            order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
          )
        ) {
          throw new BadRequestException(
            `Cannot create a return against order in state '${order.stateCode}'. ` +
              `Order must be in one of: ${ReturnsWriteService.RETURNABLE_ORDER_STATES.join(', ')}.`,
          );
        }

        // Build shipped quantity map once (for all lines)
        const shippedMap = await getCommittedPerLine(innerTx, salesOrderId);

        // Validate all lines belong to this order and quantities are valid
        for (const line of dto.lines) {
          const orderLine = await this.findOrderLine(
            line.salesOrderLineId,
            salesOrderId,
            innerTx,
          );
          const alreadyReturned = await this.getAlreadyReturnedQty(
            line.salesOrderLineId,
            undefined,
            innerTx,
          );

          // Validate against shipped qty (not ordered qty)
          const shippedQty = shippedMap.get(line.salesOrderLineId) ?? 0;
          validateReturnQuantity(
            line.quantityReturned,
            shippedQty,
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

        const returnNumber = await this.generateReturnNumber(innerTx);

        const [ret] = await innerTx
          .insert(salesOrderReturns)
          .values({
            returnNumber,
            salesOrderId,
            stateCode: RETURN_STATE.DRAFT,
            locationId: dto.locationId || order.fulfillmentLocationId,
            notes: dto.notes,
            createdBy: actor,
          })
          .returning();

        // Insert return lines
        const lineValues = await Promise.all(
          dto.lines.map(async (line) => {
            const [lineDetails] = await innerTx
              .select({
                productNumber: coreProducts.productNumber,
                productName: coreProducts.name,
                productDescription: salesOrderLineItems.productDescription,
                pricePerUnit: salesOrderLineItems.pricePerUnit,
                discountPercentage: salesOrderLineItems.discountPercentage,
                taxCategoryId: salesOrderLineItems.taxCategoryId,
              })
              .from(salesOrderLineItems)
              .leftJoin(
                coreProducts,
                eq(salesOrderLineItems.productId, coreProducts.productId),
              )
              .where(
                eq(salesOrderLineItems.salesOrderLineId, line.salesOrderLineId),
              )
              .limit(1);

            return {
              returnId: ret.returnId,
              salesOrderLineId: line.salesOrderLineId,
              quantityReturned: line.quantityReturned,
              reason: line.reason,
              resolution: line.resolution || RETURN_RESOLUTION.REFUND,
              returnFee: line.returnFee ?? '0',
              putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
              productNumber: lineDetails?.productNumber || null,
              productName:
                lineDetails?.productName ||
                lineDetails?.productDescription ||
                null,
              pricePerUnit: lineDetails?.pricePerUnit || '0',
              discountPercentage: lineDetails?.discountPercentage || '0',
              taxCategoryId: lineDetails?.taxCategoryId || null,
            };
          }),
        );

        if (lineValues.length > 0) {
          await innerTx.insert(salesOrderReturnLines).values(lineValues);
        }

        await emitEvent(innerTx, {
          entityType: EntityType.SALES_ORDER,
          entityId: salesOrderId,
          eventType: EventType.RETURN_CREATED,
          entityDisplayName: order.orderNumber,
          payload: {
            returnId: ret.returnId,
            returnNumber,
            lineCount: lineValues.length,
          },
          actor,
        });

        await emitEvent(innerTx, {
          entityType: EntityType.SALES_RETURN,
          entityId: ret.returnId,
          eventType: EventType.CREATED,
          entityDisplayName: returnNumber,
          payload: {
            salesOrderId,
            lineCount: lineValues.length,
          },
          actor,
        });

        return ret;
      },
    );

    this.logger.log(
      `Return created: ${result.returnNumber} for order ${salesOrderId} with ${dto.lines.length} lines by ${actor}`,
    );
    return result;
  }

  /**
   * Update return header fields (notes).
   */
  async updateReturn(
    returnId: string,
    dto: UpdateReturnDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const existing = await this.findReturn(returnId, tx);

    if (
      existing.stateCode !== RETURN_STATE.DRAFT &&
      existing.stateCode !== RETURN_STATE.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot update return in state '${existing.stateCode}'. Must be draft or confirmed.`,
      );
    }

    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

        const [updated] = await innerTx
          .update(salesOrderReturns)
          .set({
            ...audit.changes,
            modifiedOn: new Date(),
          })
          .where(eq(salesOrderReturns.returnId, returnId))
          .returning();

        if (audit.hasChanges) {
          const [order] = await innerTx
            .select({ orderNumber: salesOrders.orderNumber })
            .from(salesOrders)
            .where(eq(salesOrders.salesOrderId, existing.salesOrderId));
          await emitEvent(innerTx, {
            entityType: EntityType.SALES_ORDER,
            entityId: existing.salesOrderId,
            eventType: EventType.RETURN_UPDATED,
            entityDisplayName: order.orderNumber,
            payload: {
              returnId,
              returnNumber: existing.returnNumber,
              changes: audit.changes,
            },
            actor,
          });

          await emitEvent(innerTx, {
            entityType: EntityType.SALES_RETURN,
            entityId: returnId,
            eventType: EventType.UPDATED,
            entityDisplayName: existing.returnNumber,
            payload: audit.changes,
            actor,
          });
        }

        return updated;
      },
    );

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
    tx?: DrizzleDB,
  ) {
    if (!VALID_RETURN_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid return state: '${newState}'`);
    }

    const existing = await this.findReturn(returnId, tx);
    const allowed = RETURN_STATE_TRANSITIONS[existing.stateCode];

    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition return from '${existing.stateCode}' to '${newState}'. ` +
          `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const [updated] = await innerTx
          .update(salesOrderReturns)
          .set({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
            stateCode: newState as any,
            modifiedOn: new Date(),
          })
          .where(eq(salesOrderReturns.returnId, returnId))
          .returning();

        if (newState === RETURN_STATE.PROCESSED) {
          // 1. Generate Credit Note for refunded items
          await this.creditNoteService.createCreditNote(
            { returnId, lines: [] },
            actor,
            innerTx,
          );
        }

        const [order] = await innerTx
          .select({ orderNumber: salesOrders.orderNumber })
          .from(salesOrders)
          .where(eq(salesOrders.salesOrderId, existing.salesOrderId));
        await emitEvent(innerTx, {
          entityType: EntityType.SALES_ORDER,
          entityId: existing.salesOrderId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: order.orderNumber,
          payload: {
            entity: 'return',
            entityId: returnId,
            from: existing.stateCode,
            to: newState,
            returnNumber: existing.returnNumber,
          },
          actor,
        });

        await emitEvent(innerTx, {
          entityType: EntityType.SALES_RETURN,
          entityId: returnId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: existing.returnNumber,
          payload: {
            from: existing.stateCode,
            to: newState,
          },
          actor,
        });

        return updated;
      },
    );

    this.logger.log(
      `Return ${existing.returnNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
    );

    return result;
  }

  /**
   * Add a line to an existing return.
   */
  async addReturnLine(
    returnId: string,
    dto: AddReturnLineDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const ret = await this.findReturn(returnId, innerTx);

        if (ret.stateCode !== RETURN_STATE.DRAFT) {
          throw new BadRequestException(
            `Cannot add lines to return in state '${ret.stateCode}'`,
          );
        }

        const orderLine = await this.findOrderLine(
          dto.salesOrderLineId,
          ret.salesOrderId,
          innerTx,
        );
        const alreadyReturned = await this.getAlreadyReturnedQty(
          dto.salesOrderLineId,
          undefined,
          innerTx,
        );

        // Validate against shipped qty (not ordered qty)
        const shippedMap = await getCommittedPerLine(innerTx, ret.salesOrderId);
        const shippedQty = shippedMap.get(dto.salesOrderLineId) ?? 0;
        const requestedQty = parseFloat(dto.quantityReturned);

        if (requestedQty <= 0) {
          throw new BadRequestException(
            `Return quantity must be greater than 0`,
          );
        }

        if (requestedQty > shippedQty - alreadyReturned) {
          throw new BadRequestException(
            `Cannot return ${requestedQty}. Shipped: ${shippedQty}, already returned: ${alreadyReturned}, remaining returnable: ${shippedQty - alreadyReturned}`,
          );
        }

        if (dto.returnFee) {
          const fee = parseFloat(dto.returnFee);
          if (fee < 0) {
            throw new BadRequestException(`Return fee cannot be negative`);
          }
        }

        const [line] = await innerTx
          .insert(salesOrderReturnLines)
          .values({
            returnId,
            salesOrderLineId: dto.salesOrderLineId,
            quantityReturned: dto.quantityReturned,
            reason: dto.reason,
            resolution: dto.resolution || RETURN_RESOLUTION.REFUND,
            returnFee: dto.returnFee ?? '0',
            quantityReceived: '0',
            putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
          })
          .returning();

        await innerTx
          .update(salesOrderReturns)
          .set({ modifiedOn: new Date() })
          .where(eq(salesOrderReturns.returnId, returnId));

        const [order] = await innerTx
          .select({ orderNumber: salesOrders.orderNumber })
          .from(salesOrders)
          .where(eq(salesOrders.salesOrderId, ret.salesOrderId));
        await emitEvent(innerTx, {
          entityType: EntityType.SALES_ORDER,
          entityId: ret.salesOrderId,
          eventType: EventType.RETURN_LINE_ADDED,
          entityDisplayName: order.orderNumber,
          payload: {
            returnId,
            returnLineId: line.returnLineId,
            salesOrderLineId: dto.salesOrderLineId,
            quantityReturned: dto.quantityReturned,
          },
          actor,
        });

        return line;
      },
    );

    return result;
  }

  /**
   * Fetch a return by ID (throws NotFoundException if missing).
   */
  async receiveReturnLines(
    returnId: string,
    dto: ReceiveReturnDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const ret = await this.findReturn(returnId, innerTx);

        if (
          ret.stateCode !== RETURN_STATE.CONFIRMED &&
          ret.stateCode !== RETURN_STATE.PARTIALLY_RECEIVED
        ) {
          throw new BadRequestException(
            `Cannot receive lines for return in state '${ret.stateCode}'`,
          );
        }

        const returnLines = await innerTx
          .select()
          .from(salesOrderReturnLines)
          .where(eq(salesOrderReturnLines.returnId, returnId));

        const linesToReceive = new Map<string, number>();
        for (const line of dto.lines) {
          const qty = parseFloat(line.quantityReceived);
          if (qty > 0) {
            linesToReceive.set(line.returnLineId, qty);
          }
        }

        if (linesToReceive.size === 0) {
          throw new BadRequestException('No quantities provided for receipt.');
        }

        const stockLines = [];
        let totalReturnCost = 0;
        const valuationStrategy = getValuationStrategy(
          this.appConfig.valuationMethod(),
        );

        for (const rl of returnLines) {
          const newlyReceived = linesToReceive.get(rl.returnLineId) || 0;
          if (newlyReceived > 0) {
            const expected = parseFloat(rl.quantityReturned);
            const previouslyReceived = parseFloat(rl.quantityReceived || '0');

            if (previouslyReceived + newlyReceived > expected) {
              throw new BadRequestException(
                `Cannot receive more than expected. Expected: ${expected}, Previously Received: ${previouslyReceived}, Attempting to Receive: ${newlyReceived}`,
              );
            }

            const orderLine = await innerTx
              .select()
              .from(salesOrderLineItems)
              .where(
                eq(salesOrderLineItems.salesOrderLineId, rl.salesOrderLineId),
              )
              .limit(1)
              .then((r) => r[0]);

            if (orderLine) {
              stockLines.push({
                productId: orderLine.productId!,
                quantity: newlyReceived,
                uomCode: orderLine.unitOfMeasure,
              });

              // Calculate COGS
              const [product] = await innerTx
                .select()
                .from(coreProducts)
                .where(eq(coreProducts.productId, orderLine.productId!));

              if (product) {
                const cost =
                  orderLine.unitCost != null
                    ? (parseFloat(orderLine.unitCost) * newlyReceived).toFixed(
                        2,
                      )
                    : valuationStrategy.getCogs(
                        {
                          productId: product.productId,
                          standardCost: product.standardCost || '0',
                          weightedAverageCost:
                            product.weightedAverageCost || '0',
                        },
                        newlyReceived,
                      );
                totalReturnCost += parseFloat(cost);
              }
            }

            const updatedQty = (previouslyReceived + newlyReceived).toString();
            // Update quantity_received on the return line
            await innerTx
              .update(salesOrderReturnLines)
              .set({
                quantityReceived: updatedQty,
                putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
              })
              .where(eq(salesOrderReturnLines.returnLineId, rl.returnLineId));
          }
        }

        if (stockLines.length > 0) {
          // Receive into the CUSTOMER_RETURNS bin (HANDLING zone)
          const [returnsBin] = await innerTx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(bins.binNumber, 'CUSTOMER_RETURNS'),
                eq(zones.locationId, dto.locationId),
              ),
            )
            .limit(1);

          if (!returnsBin) {
            throw new BadRequestException(
              `No CUSTOMER_RETURNS bin found for location '${dto.locationId}'.`,
            );
          }

          const receiveLines = stockLines.map((line) => ({
            productId: line.productId,
            binId: returnsBin.binId,
            quantity: line.quantity,
            uomCode: line.uomCode || 'EA',
          }));

          await this.inventoryMovementService.recordInventoryMovement(innerTx, {
            entryNumber:
              'RET-' + ret.returnNumber + '-' + Date.now().toString().slice(-4),
            sourceType: 'SO_RETURN',
            sourceId: returnId,
            memo: `RMA Received to Returns Bin (Partial)`,
            userId: actor,
            lines: receiveLines,
          });

          // Post Inventory/COGS GL reversal via Accounting Strategy
          const accountingStrategy = getAccountingStrategy(
            this.appConfig.inventoryAccountingMode(),
            {
              inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
              grniAccountId: this.appConfig.defaultGrniAccountId(),
              cogsAccountId: this.appConfig.defaultCogsAccountId(),
              shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
              ppvAccountId: this.appConfig.defaultPpvAccountId(),
            },
          );

          const [retOrder] = await innerTx
            .select({
              costCenterId: customerGroups.defaultCostCenterId,
              activityId: customerGroups.defaultActivityId,
            })
            .from(salesOrders)
            .leftJoin(
              coreAccounts,
              eq(salesOrders.customerId, coreAccounts.customerId),
            )
            .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
            .leftJoin(
              customerGroups,
              eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
            )
            .where(eq(salesOrders.salesOrderId, ret.salesOrderId));

          const retCostCenterId = retOrder?.costCenterId || undefined;
          const retActivityId = retOrder?.activityId || undefined;

          const returnGlWithDims = accountingStrategy.onSalesReturn({
            amount: Number(totalReturnCost.toFixed(2)),
            memo: `Sales Return ${ret.returnNumber} (Partial)`,
            costCenterId: retCostCenterId,
            activityId: retActivityId,
          });

          if (returnGlWithDims) {
            await this.glService.postJournalEntry(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
              returnGlWithDims.lines as any[],
              {
                actor,
                entryDate: new Date().toISOString().slice(0, 10),
                sourceType: returnGlWithDims.sourceType,
                sourceId: returnId,
                memo: `Sales Return ${ret.returnNumber} (Partial)`,
              },
              innerTx,
            );
          }
        }

        // Check if fully received
        const updatedReturnLines = await innerTx
          .select()
          .from(salesOrderReturnLines)
          .where(eq(salesOrderReturnLines.returnId, returnId));

        let fullyReceived = true;
        for (const rl of updatedReturnLines) {
          if (
            parseFloat(rl.quantityReceived || '0') <
            parseFloat(rl.quantityReturned)
          ) {
            fullyReceived = false;
            break;
          }
        }

        const newState = fullyReceived
          ? RETURN_STATE.RECEIVED
          : RETURN_STATE.PARTIALLY_RECEIVED;

        if (ret.stateCode !== newState) {
          await this.changeReturnState(
            returnId,
            newState,
            actor,
            undefined,
            innerTx,
          );
        }

        // Emit event for received lines
        await emitEvent(innerTx as unknown as DrizzleDB, {
          entityType: EntityType.SALES_RETURN,
          entityId: returnId,
          eventType: EventType.UPDATED,
          entityDisplayName: ret.returnNumber,
          payload: {},
          actor,
        });

        return await this.findReturn(returnId, innerTx);
      },
    );

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
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const ret = await this.findReturn(returnId, innerTx);

        if (
          ret.stateCode !== RETURN_STATE.DRAFT &&
          ret.stateCode !== RETURN_STATE.CONFIRMED
        ) {
          throw new BadRequestException(
            `Cannot update lines on return in state '${ret.stateCode}'`,
          );
        }

        const existingLine = await this.findReturnLine(
          lineId,
          returnId,
          innerTx,
        );

        // Validate new quantity if changed
        if (dto.quantityReturned !== undefined) {
          const requestedQty = parseFloat(dto.quantityReturned);
          if (requestedQty <= 0) {
            throw new BadRequestException(
              `Return quantity must be greater than 0`,
            );
          }

          const orderLine = await this.findOrderLine(
            existingLine.salesOrderLineId,
            ret.salesOrderId,
            innerTx,
          );
          const alreadyReturned = await this.getAlreadyReturnedQty(
            existingLine.salesOrderLineId,
            returnId,
            innerTx,
          );

          // Validate against shipped qty (not ordered qty)
          const shippedMap = await getCommittedPerLine(
            innerTx,
            ret.salesOrderId,
          );
          const shippedQty = shippedMap.get(existingLine.salesOrderLineId) ?? 0;

          if (requestedQty > shippedQty - alreadyReturned) {
            throw new BadRequestException(
              `Cannot return ${requestedQty}. Shipped: ${shippedQty}, already returned: ${alreadyReturned}, remaining returnable: ${shippedQty - alreadyReturned}`,
            );
          }
        }

        if (dto.returnFee !== undefined) {
          const fee = parseFloat(dto.returnFee);
          if (fee < 0) {
            throw new BadRequestException(`Return fee cannot be negative`);
          }
        }

        const audit = calculateAuditTrail(dto, existingLine, AuditMode.DIFF);

        const [updated] = await innerTx
          .update(salesOrderReturnLines)
          .set({
            ...audit.changes,
          })
          .where(eq(salesOrderReturnLines.returnLineId, lineId))
          .returning();

        await innerTx
          .update(salesOrderReturns)
          .set({ modifiedOn: new Date() })
          .where(eq(salesOrderReturns.returnId, returnId));

        if (audit.hasChanges) {
          const [order] = await innerTx
            .select({ orderNumber: salesOrders.orderNumber })
            .from(salesOrders)
            .where(eq(salesOrders.salesOrderId, ret.salesOrderId));
          await emitEvent(innerTx, {
            entityType: EntityType.SALES_ORDER,
            entityId: ret.salesOrderId,
            eventType: EventType.RETURN_LINE_UPDATED,
            entityDisplayName: order.orderNumber,
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
      },
    );

    return result;
  }

  /**
   * Remove a return line.
   */
  async removeReturnLine(
    returnId: string,
    lineId: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    await (tx || this.db).transaction(async (innerTx: DrizzleDB) => {
      const ret = await this.findReturn(returnId, innerTx);

      if (
        ret.stateCode !== RETURN_STATE.DRAFT &&
        ret.stateCode !== RETURN_STATE.CONFIRMED
      ) {
        throw new BadRequestException(
          `Cannot remove lines from return in state '${ret.stateCode}'`,
        );
      }

      const existingLine = await this.findReturnLine(lineId, returnId, innerTx);

      await innerTx
        .delete(salesOrderReturnLines)
        .where(eq(salesOrderReturnLines.returnLineId, lineId));

      await innerTx
        .update(salesOrderReturns)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderReturns.returnId, returnId));

      const [order] = await innerTx
        .select({ orderNumber: salesOrders.orderNumber })
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ret.salesOrderId));
      await emitEvent(innerTx, {
        entityType: EntityType.SALES_ORDER,
        entityId: ret.salesOrderId,
        eventType: EventType.RETURN_LINE_REMOVED,
        entityDisplayName: order.orderNumber,
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
    const rows = await this.db
      .select({
        returnId: salesOrderReturns.returnId,
        returnNumber: salesOrderReturns.returnNumber,
        salesOrderId: salesOrderReturns.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: actors.name,
        stateCode: salesOrderReturns.stateCode,
        locationId: salesOrderReturns.locationId,
        locationName: locations.name,
        createdOn: salesOrderReturns.createdOn,
        createdBy: salesOrderReturns.createdBy,
        notes: salesOrderReturns.notes,
        currencyCode: salesOrders.currencyCode,
      })
      .from(salesOrderReturns)
      .innerJoin(
        salesOrders,
        eq(salesOrderReturns.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        locations,
        eq(salesOrderReturns.locationId, locations.locationId),
      )
      .where(eq(salesOrderReturns.returnId, returnId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Return '${returnId}' not found`);
    }
    const ret = rows[0];

    const lines = await this.db
      .select({
        returnLineId: salesOrderReturnLines.returnLineId,
        salesOrderLineId: salesOrderReturnLines.salesOrderLineId,
        quantityReturned: salesOrderReturnLines.quantityReturned,
        reason: salesOrderReturnLines.reason,
        resolution: salesOrderReturnLines.resolution,
        returnFee: salesOrderReturnLines.returnFee,
        productId: sql<string>`coalesce(${coreProducts.productId}, ${salesOrderLineItems.productId})`,
        productNumber: sql<string>`coalesce(${coreProducts.productNumber}, ${salesOrderReturnLines.productNumber}, '')`,
        description: sql<string>`coalesce(${salesOrderReturnLines.productName}, ${salesOrderLineItems.productDescription}, ${coreProducts.name}, '')`,
        pricePerUnit: sql<string>`coalesce(${salesOrderReturnLines.pricePerUnit}, ${salesOrderLineItems.pricePerUnit}, '0')`,
        discountPercentage: sql<string>`coalesce(${salesOrderReturnLines.discountPercentage}, ${salesOrderLineItems.discountPercentage}, '0')`,
        taxRate: sql<string>`coalesce(${taxCategories.rate}, '0')`,
        putawayStatus: salesOrderReturnLines.putawayStatus,
      })
      .from(salesOrderReturnLines)
      .leftJoin(
        salesOrderLineItems,
        eq(
          salesOrderReturnLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .leftJoin(
        taxCategories,
        eq(
          sql`coalesce(${salesOrderReturnLines.taxCategoryId}, ${salesOrderLineItems.taxCategoryId})`,
          taxCategories.taxCategoryId,
        ),
      )
      .where(eq(salesOrderReturnLines.returnId, returnId));

    const events = await this.db
      .select()
      .from(salesEvents)
      .where(eq(salesEvents.entityId, returnId))
      .orderBy(desc(salesEvents.createdOn));

    const creditNotes = await this.db
      .select({
        creditNoteId: salesCreditNotes.creditNoteId,
        creditNoteNumber: salesCreditNotes.creditNoteNumber,
        stateCode: salesCreditNotes.stateCode,
        createdOn: salesCreditNotes.createdOn,
        totalAmount: salesCreditNotes.totalAmount,
        taxAmount: salesCreditNotes.taxAmount,
        feeAmount: salesCreditNotes.feeAmount,
        outstandingAmount: salesCreditNotes.outstandingAmount,
      })
      .from(salesCreditNotes)
      .where(eq(salesCreditNotes.returnId, returnId));

    return {
      ...ret,
      lines,
      events,
      creditNotes,
      creditNoteNumber: creditNotes[0]?.creditNoteNumber ?? null,
    };
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

    // Fetch lines and credit note number for each return
    const result = [];
    for (const ret of returns) {
      const lines = await this.db
        .select()
        .from(salesOrderReturnLines)
        .where(eq(salesOrderReturnLines.returnId, ret.returnId));

      // Look up associated credit note (if return is processed)
      const [creditNote] = await this.db
        .select({ creditNoteNumber: salesCreditNotes.creditNoteNumber })
        .from(salesCreditNotes)
        .where(eq(salesCreditNotes.returnId, ret.returnId))
        .limit(1);

      result.push({
        ...ret,
        lines,
        creditNoteNumber: creditNote?.creditNoteNumber ?? null,
      });
    }

    return result;
  }

  /**
   * List all returns globally, optionally filtered by state, location, search, and customer.
   */
  async findGlobal(
    query?: PaginationQuery | string,
    stateCode?: string,
    locationId?: string,
  ) {
    const queryObj =
      typeof query === 'object' && query !== null ? query : undefined;
    const { limit, cursor, direction, searchTerm, customerId } =
      parsePagination(queryObj);

    const targetState =
      (typeof query === 'string' ? query : queryObj?.state) || stateCode;
    const targetLoc = locationId;
    const targetCustomer = queryObj?.customerId || customerId;

    let qb = this.db
      .select({
        ...getTableColumns(salesOrderReturns),
        orderNumber: salesOrders.orderNumber,
        salesOrderNumber: salesOrders.orderNumber,
        customerId: coreAccounts.customerId,
        customerNumber: coreAccounts.customerNumber,
        customerName: actors.name,
      })
      .from(salesOrderReturns)
      .leftJoin(
        salesOrders,
        eq(salesOrderReturns.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .$dynamic();

    const conditions = [];

    if (targetState) {
      const states = targetState.split(',');
      if (states.length === 1) {
        conditions.push(
          eq(salesOrderReturns.stateCode, targetState as any), // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
        );
      } else {
        conditions.push(
          inArray(salesOrderReturns.stateCode, states as any[]), // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
        );
      }
    }

    if (targetLoc) {
      conditions.push(
        or(
          eq(salesOrderReturns.locationId, targetLoc),
          eq(salesOrders.fulfillmentLocationId, targetLoc),
        ),
      );
    }

    if (targetCustomer) {
      conditions.push(eq(coreAccounts.customerId, targetCustomer));
    }

    if (searchTerm) {
      conditions.push(
        or(
          ilike(salesOrderReturns.returnNumber, searchTerm),
          ilike(salesOrderReturns.notes, searchTerm),
          ilike(salesOrders.orderNumber, searchTerm),
          ilike(coreAccounts.customerNumber, searchTerm),
          ilike(actors.name, searchTerm),
        ),
      );
    }

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const {
      data: returns,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { createdOn: string; returnId: string } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const dateOp = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`<` : sql`>`;
        return q.where(
          or(
            sql`${salesOrderReturns.createdOn} ${dateOp} ${c.createdOn}`,
            and(
              sql`${salesOrderReturns.createdOn} = ${c.createdOn}`,
              sql`${salesOrderReturns.returnId} ${idOp} ${c.returnId}`,
            ),
          ),
        );
      },
      applyOrderBy: (q, dir) => {
        const order = dir === 'next' ? desc : asc;
        return q.orderBy(
          order(salesOrderReturns.createdOn),
          order(salesOrderReturns.returnId),
        );
      },
      encodeRow: (row) => ({
        createdOn: row.createdOn,
        returnId: row.returnId,
      }),
    });

    if (returns.length === 0) {
      return { data: [], limit, nextCursor, prevCursor };
    }

    const returnIds = returns.map((r) => r.returnId);
    const linesQuery = await this.db
      .select({
        line: salesOrderReturnLines,
        productId: sql<string>`coalesce(${coreProducts.productId}, ${salesOrderLineItems.productId})`,
        productNumber: sql<string>`coalesce(${coreProducts.productNumber}, ${salesOrderReturnLines.productNumber}, '')`,
        productDescription: sql<string>`coalesce(${salesOrderReturnLines.productName}, ${salesOrderLineItems.productDescription}, ${coreProducts.name}, '')`,
        pricePerUnit: sql<string>`coalesce(${salesOrderReturnLines.pricePerUnit}, ${salesOrderLineItems.pricePerUnit}, '0')`,
        discountPercentage: sql<string>`coalesce(${salesOrderReturnLines.discountPercentage}, ${salesOrderLineItems.discountPercentage}, '0')`,
        taxRate: sql<string>`coalesce(${taxCategories.rate}, '0')`,
      })
      .from(salesOrderReturnLines)
      .leftJoin(
        salesOrderLineItems,
        eq(
          salesOrderReturnLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .leftJoin(
        taxCategories,
        eq(
          sql`coalesce(${salesOrderReturnLines.taxCategoryId}, ${salesOrderLineItems.taxCategoryId})`,
          taxCategories.taxCategoryId,
        ),
      )
      .where(inArray(salesOrderReturnLines.returnId, returnIds));

    const linesByReturn = new Map<
      string,
      (typeof salesOrderReturnLines.$inferSelect & {
        productId: string | null;
        productNumber: string;
        productDescription: string;
        pricePerUnit: string;
        discountPercentage: string;
        taxRate: string;
      })[]
    >();
    for (const l of linesQuery) {
      const rId = l.line.returnId;
      if (!linesByReturn.has(rId)) linesByReturn.set(rId, []);
      linesByReturn.get(rId)!.push({
        ...l.line,
        productId: l.productId,
        productNumber: l.productNumber,
        productDescription: l.productDescription,
        pricePerUnit: l.pricePerUnit,
        discountPercentage: l.discountPercentage,
        taxRate: l.taxRate,
      });
    }

    const result = returns.map((r) => ({
      ...r,
      lines: linesByReturn.get(r.returnId) || [],
    }));

    return {
      data: result,
      limit,
      nextCursor,
      prevCursor,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async findOrder(salesOrderId: string, tx?: DrizzleDB) {
    return sharedFindOrder(tx || this.db, salesOrderId);
  }

  private async findOrderLine(
    lineId: string,
    salesOrderId: string,
    tx?: DrizzleDB,
  ) {
    return sharedFindOrderLine(tx || this.db, lineId, salesOrderId);
  }

  private async findReturn(returnId: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select()
      .from(salesOrderReturns)
      .where(eq(salesOrderReturns.returnId, returnId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Return '${returnId}' not found`);
    }
    return rows[0];
  }

  private async findReturnLine(
    lineId: string,
    returnId: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const rows = await db
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
