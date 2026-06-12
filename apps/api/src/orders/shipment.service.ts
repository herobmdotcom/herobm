import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesOrderLineItems,
  products as coreProducts,
  bins,
  inventoryEntries,
  inventoryLedger,
  customers as coreAccounts,
  customerGroups,
  backorders,
  purchaseOrders,
  systemEvents,
  warehouseEvents,
  salesOrderPicks,
} from '../drizzle/modbm-core-schema';
import { AppConfigService } from '../settings/app-config.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import {
  findOrder,
  findOrderLine,
  findShipment,
  findShipmentLine,
  assertShipmentQtyAvailable,
  getInvoicedPerLine,
  getCommittedPerLine,
} from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { evaluateLifecycleRules } from './order-lifecycle-rules';
import { InventoryService } from '../inventory/inventory.service';
import { GlService } from '../gl/gl.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  AddShipmentLineDto,
  UpdateShipmentLineDto,
} from './dto';

import {
  SHIPMENT_STATE,
  SHIPMENT_TRANSITIONS as SHIPMENT_STATE_TRANSITIONS,
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_PICK_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';
import type { SalesOrderPickState } from '@modbm/shared';

const VALID_SHIPMENT_STATES = getValidStates(SHIPMENT_STATE_TRANSITIONS);

// ============================================================================
// DTOs
// ============================================================================

// DTOs imported from ./dto

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ShipmentService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly inventoryService: InventoryService,
    private readonly glService: GlService,
  ) {}

  private readonly logger = new Logger(ShipmentService.name);

  // -------------------------------------------------------------------------
  // Number generation
  // -------------------------------------------------------------------------

  async generateShipmentNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SHP-${today}-`;

    const result = await db
      .select({ shipmentNumber: salesOrderShipments.shipmentNumber })
      .from(salesOrderShipments)
      .where(sql`${salesOrderShipments.shipmentNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesOrderShipments.shipmentNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].shipmentNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Create a new shipment against an order in picking state.
   */
  async createShipment(
    salesOrderId: string,
    dto: CreateShipmentDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const order = await findOrder(innerTx, salesOrderId);
        if (order.stateCode !== SALES_ORDER_STATE.PICKING) {
          throw new BadRequestException(
            `Cannot create shipment for order in state '${order.stateCode}'. Order must be in ${SALES_ORDER_STATE.PICKING}.`,
          );
        }

        let shipmentLocationId: string | null = null;

        // Validate every line: shipped qty must be available
        for (const line of dto.lines) {
          const orderLine = await findOrderLine(
            innerTx,
            line.salesOrderLineId,
            salesOrderId,
          );

          if (!shipmentLocationId && orderLine.fulfillmentLocationId) {
            shipmentLocationId = orderLine.fulfillmentLocationId;
          } else if (
            shipmentLocationId &&
            orderLine.fulfillmentLocationId &&
            shipmentLocationId !== orderLine.fulfillmentLocationId
          ) {
            throw new BadRequestException(
              `Cannot mix lines from different fulfillment locations in a single shipment. Line ${orderLine.lineNumber} belongs to a different location.`,
            );
          }

          await assertShipmentQtyAvailable(
            innerTx,
            salesOrderId,
            line.salesOrderLineId,
            parseFloat(line.quantityShipped),
            orderLine.lineNumber,
          );
        }

        const shipmentNumber = await this.generateShipmentNumber(innerTx);

        const [shipment] = await innerTx
          .insert(salesOrderShipments)
          .values({
            shipmentNumber,
            salesOrderId,
            stateCode: SHIPMENT_STATE.DRAFT, // Create as draft first, then transition to dispatched
            notes: dto.notes,
            trackingNumber: dto.trackingNumber,
            fulfillmentLocationId: shipmentLocationId,
            createdBy: actor,
          })
          .returning();

        const lineValues = dto.lines.map((line) => ({
          shipmentId: shipment.shipmentId,
          salesOrderLineId: line.salesOrderLineId,
          quantityShipped: line.quantityShipped,
        }));

        if (lineValues.length > 0) {
          await innerTx.insert(salesOrderShipmentLines).values(lineValues);
        }

        const stockLines = [];
        for (const line of lineValues) {
          const orderLine = await findOrderLine(
            innerTx,
            line.salesOrderLineId,
            salesOrderId,
          );
          const [product] = await innerTx
            .select({ productType: coreProducts.productType })
            .from(coreProducts)
            .where(eq(coreProducts.productId, orderLine.productId!));

          stockLines.push({
            productId: orderLine.productId,
            quantity: line.quantityShipped,
            isPhysical:
              !product ||
              !product.productType ||
              product.productType === 'inventory',
          });
        }
        const physicalStockLines = stockLines.filter((l) => l.isPhysical);

        await this.executeDispatch(
          innerTx,
          shipment,
          lineValues,
          physicalStockLines,
          actor,
        );

        // Transition to dispatched — MUST happen after lines are inserted so lifecycle rules see the shipped qty
        const updatedShipment = await this.changeShipmentState(
          shipment.shipmentId,
          SHIPMENT_STATE.DISPATCHED,
          actor,
          innerTx,
          true,
        );

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipment.shipmentId,
          eventType: EventType.SHIPMENT_CREATED,
          entityDisplayName: shipmentNumber,
          payload: {
            shipmentId: shipment.shipmentId,
            shipmentNumber,
            lineCount: lineValues.length,
          },
          actor,
        });

        return updatedShipment;
      },
    );

    this.logger.log(
      `Shipment created: ${result.shipmentNumber} for order ${salesOrderId} with ${dto.lines.length} lines by ${actor}`,
    );
    return result;
  }

  /**
   * Update shipment header (notes, tracking). Editable in any non-cancelled state.
   */
  async updateShipment(
    shipmentId: string,
    dto: UpdateShipmentDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode === SHIPMENT_STATE.CANCELLED) {
          throw new BadRequestException(`Cannot update a cancelled shipment.`);
        }

        const [updated] = await innerTx
          .update(salesOrderShipments)
          .set({
            ...(dto.notes !== undefined && { notes: dto.notes }),
            ...(dto.trackingNumber !== undefined && {
              trackingNumber: dto.trackingNumber,
            }),
            modifiedOn: new Date(),
          })
          .where(eq(salesOrderShipments.shipmentId, shipmentId))
          .returning();

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
          eventType: EventType.SHIPMENT_UPDATED,
          entityDisplayName: shipment.shipmentNumber,
          payload: {
            shipmentId,
            changes: dto,
          },
          actor,
        });

        return updated;
      },
    );

    return result;
  }

  /**
   * Transition shipment state.
   */
  async changeShipmentState(
    shipmentId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
    allowCancel = false,
  ) {
    if (!VALID_SHIPMENT_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid shipment state: '${newState}'`);
    }

    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);
        const allowed = SHIPMENT_STATE_TRANSITIONS[shipment.stateCode];

        if (!allowed || !allowed.includes(newState)) {
          throw new BadRequestException(
            `Cannot transition shipment from '${shipment.stateCode}' to '${newState}'. ` +
              `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
          );
        }

        if (newState === SHIPMENT_STATE.CANCELLED && !allowCancel) {
          throw new BadRequestException(
            'Please use the dedicated POST /cancel endpoint to cancel a shipment.',
          );
        }

        const [updated] = await innerTx
          .update(salesOrderShipments)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set({ stateCode: newState as any, modifiedOn: new Date() })
          .where(eq(salesOrderShipments.shipmentId, shipmentId))
          .returning();

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: shipment.shipmentNumber,
          payload: {
            entity: 'shipment',
            entityId: shipmentId,
            shipmentNumber: shipment.shipmentNumber,
            from: shipment.stateCode,
            to: newState,
          },
          actor,
        });

        const autoTransitions = await evaluateLifecycleRules(
          innerTx,
          shipment.salesOrderId,
          { entity: 'shipment', id: shipmentId, action: newState },
          actor,
        );

        this.logger.log(
          `Shipment ${shipment.shipmentNumber} state: ${shipment.stateCode} → ${newState} by ${actor}`,
        );

        return { ...updated, _autoTransitions: autoTransitions };
      },
    );

    return result;
  }

  /**
   * Cancel a shipment.
   * Reverses inventory, picks, and financial entries if the shipment was dispatched.
   */
  async cancelShipment(shipmentId: string, actor: string, tx?: DrizzleDB) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode === SHIPMENT_STATE.CANCELLED) {
          throw new BadRequestException('Shipment is already cancelled.');
        }

        const allowed = SHIPMENT_STATE_TRANSITIONS[shipment.stateCode];
        if (!allowed || !allowed.includes(SHIPMENT_STATE.CANCELLED)) {
          throw new BadRequestException(
            `Cannot transition shipment from '${shipment.stateCode}' to '${SHIPMENT_STATE.CANCELLED}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
          );
        }

        // ── Inventory hooks ──
        // Fetch shipment lines to get quantities
        const shipmentLines = await innerTx
          .select()
          .from(salesOrderShipmentLines)
          .where(eq(salesOrderShipmentLines.shipmentId, shipmentId));

        // Resolve productIds from order lines
        const stockLines = [];
        for (const sl of shipmentLines) {
          const orderLine = await findOrderLine(
            innerTx,
            sl.salesOrderLineId,
            shipment.salesOrderId,
          );
          const [product] = await innerTx
            .select({ productType: coreProducts.productType })
            .from(coreProducts)
            .where(eq(coreProducts.productId, orderLine.productId!));

          stockLines.push({
            productId: orderLine.productId,
            quantity: sl.quantityShipped,
            isPhysical:
              !product ||
              !product.productType ||
              product.productType === 'inventory',
          });
        }

        const physicalStockLines = stockLines.filter((l) => l.isPhysical);

        if (shipment.stateCode === SHIPMENT_STATE.DISPATCHED) {
          const invoicedMap = await getInvoicedPerLine(
            innerTx,
            shipment.salesOrderId,
          );
          const shippedMap = await getCommittedPerLine(
            innerTx,
            shipment.salesOrderId,
          );

          for (const line of shipmentLines) {
            const invoiced = invoicedMap.get(line.salesOrderLineId) || 0;
            const currentlyShipped = shippedMap.get(line.salesOrderLineId) || 0;
            const newShipped = currentlyShipped;

            if (invoiced > newShipped) {
              const orderLine = await findOrderLine(
                innerTx,
                line.salesOrderLineId,
                shipment.salesOrderId,
              );
              throw new BadRequestException(
                `Cannot transition shipment: reverting line ${orderLine.lineNumber} drops shipped quantity (${newShipped}) below already invoiced quantity (${invoiced}). Please reverse the invoice via a Credit Note first.`,
              );
            }
          }

          const previousDispatch = await innerTx
            .select({
              binId: inventoryLedger.binId,
              productId: inventoryLedger.productId,
              shippedQty: sql<number>`SUM(ABS(${inventoryLedger.quantity}::numeric))`,
            })
            .from(inventoryLedger)
            .innerJoin(
              inventoryEntries,
              eq(inventoryLedger.entryId, inventoryEntries.entryId),
            )
            .where(
              and(
                eq(inventoryEntries.sourceId, shipmentId),
                eq(inventoryEntries.sourceType, 'SO_SHIPMENT'),
              ),
            )
            .groupBy(inventoryLedger.binId, inventoryLedger.productId);

          const returnLines = [];
          for (const line of physicalStockLines) {
            let remainingToRevert = parseFloat(line.quantity);
            const availableDispatches = previousDispatch.filter(
              (p) => p.productId === line.productId && p.shippedQty > 0,
            );

            for (const prev of availableDispatches) {
              if (remainingToRevert <= 0) break;
              const putBack = Math.min(remainingToRevert, prev.shippedQty);
              returnLines.push({
                productId: line.productId!,
                binId: prev.binId,
                quantity: putBack,
              });
              prev.shippedQty -= putBack;
              remainingToRevert -= putBack;
            }

            if (remainingToRevert > 0) {
              throw new BadRequestException(
                `System Integrity Error: Could not map reverted shipment quantities back to their original shipping bins for product ${line.productId}.`,
              );
            }
          }

          if (returnLines.length > 0) {
            await this.inventoryService.recordInventoryMovement(innerTx, {
              entryNumber:
                'REV-' +
                shipment.shipmentNumber +
                '-' +
                Date.now().toString().slice(-4),
              sourceType: 'SO_SHIPMENT',
              sourceId: shipmentId,
              memo: 'Dispatch Reversed',
              userId: actor,
              lines: returnLines,
            });
          }

          // Revert sales_order_picks from shipped back to picked
          for (const sl of shipmentLines) {
            let remainingToRevert = parseFloat(sl.quantityShipped);
            const linePicks = await innerTx
              .select()
              .from(salesOrderPicks)
              .where(
                and(
                  eq(salesOrderPicks.salesOrderLineId, sl.salesOrderLineId),
                  eq(salesOrderPicks.stateCode, SALES_ORDER_PICK_STATE.SHIPPED),
                ),
              );

            for (const pick of linePicks) {
              if (remainingToRevert <= 0) break;
              const pickQty = parseFloat(pick.quantity);
              const take = Math.min(remainingToRevert, pickQty);

              if (take === pickQty) {
                await this.changePickState(
                  pick.pickId,
                  SALES_ORDER_PICK_STATE.PICKED,
                  actor,
                  innerTx,
                );
              } else {
                // Partial pick reversal - split the pick
                await innerTx
                  .update(salesOrderPicks)
                  .set({
                    quantity: String(pickQty - take),
                    modifiedOn: new Date(),
                  })
                  .where(eq(salesOrderPicks.pickId, pick.pickId));

                await innerTx.insert(salesOrderPicks).values({
                  salesOrderId: pick.salesOrderId,
                  salesOrderLineId: pick.salesOrderLineId,
                  productId: pick.productId,
                  binId: pick.binId,
                  quantity: String(take),
                  stateCode: SALES_ORDER_PICK_STATE.PICKED,
                  createdBy: actor,
                });
              }
              remainingToRevert -= take;
            }
          }

          // --- Financial Integration: Post COGS Reversal Entry via Accounting Strategy ---
          if (returnLines.length > 0) {
            let totalCogsReversed = 0;
            const strategy = getValuationStrategy(
              this.appConfig.valuationMethod(),
            );

            for (const line of returnLines) {
              const isUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  line.productId,
                );
              const [product] = await innerTx
                .select()
                .from(coreProducts)
                .where(
                  isUuid
                    ? eq(coreProducts.productId, line.productId)
                    : eq(coreProducts.productNumber, line.productId),
                );

              if (product) {
                const cogsAmount = strategy.getCogs(
                  {
                    productId: product.productId,
                    standardCost: product.standardCost || '0',
                    weightedAverageCost: product.weightedAverageCost || '0',
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  parseFloat(line.quantity as any),
                );
                totalCogsReversed += parseFloat(cogsAmount);
              }
            }

            const reversalStrategy = getAccountingStrategy(
              this.appConfig.inventoryAccountingMode(),
              {
                inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
                grniAccountId: this.appConfig.defaultGrniAccountId(),
                cogsAccountId: this.appConfig.defaultCogsAccountId(),
                shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
              },
            );

            // Resolve customer customer group dimensions for reversal posting
            let revCostCenterId: string | undefined;
            let revActivityId: string | undefined;
            const [revOrder] = await innerTx
              .select({
                costCenterId: customerGroups.defaultCostCenterId,
                activityId: customerGroups.defaultActivityId,
              })
              .from(salesOrders)
              .leftJoin(
                coreAccounts,
                eq(salesOrders.customerId, coreAccounts.customerId),
              )
              .leftJoin(
                customerGroups,
                eq(
                  coreAccounts.customerGroupId,
                  customerGroups.customerGroupId,
                ),
              )
              .where(eq(salesOrders.salesOrderId, shipment.salesOrderId));
            if (revOrder) {
              revCostCenterId = revOrder.costCenterId || undefined;
              revActivityId = revOrder.activityId || undefined;
            }

            const reversalGl = reversalStrategy.onDispatchReversal({
              amount: Number(totalCogsReversed.toFixed(2)),
              memo: `Dispatch Reversal ${shipment.shipmentNumber}`,
              costCenterId: revCostCenterId,
              activityId: revActivityId,
            });

            if (reversalGl) {
              await this.glService.postJournalEntry(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reversalGl.lines as any[],
                {
                  actor,
                  entryDate: new Date().toISOString().slice(0, 10),
                  sourceType: reversalGl.sourceType,
                  sourceId: shipmentId,
                  memo: `Dispatch Reversal ${shipment.shipmentNumber}`,
                },
                innerTx,
              );
            }
          }

          // Synchronous COGS reversal completed above.
        }

        const updated = await this.changeShipmentState(
          shipmentId,
          SHIPMENT_STATE.CANCELLED,
          actor,
          innerTx,
          true,
        );

        return updated;
      },
    );

    return result;
  }

  /**
   * Add a line to a draft shipment.
   */
  async addShipmentLine(
    shipmentId: string,
    dto: AddShipmentLineDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode !== SHIPMENT_STATE.DRAFT) {
          throw new BadRequestException(
            `Cannot add lines to shipment in state '${shipment.stateCode}'`,
          );
        }

        const orderLine = await findOrderLine(
          innerTx,
          dto.salesOrderLineId,
          shipment.salesOrderId,
        );
        await assertShipmentQtyAvailable(
          innerTx,
          shipment.salesOrderId,
          dto.salesOrderLineId,
          parseFloat(dto.quantityShipped),
          orderLine.lineNumber,
        );

        const [line] = await innerTx
          .insert(salesOrderShipmentLines)
          .values({
            shipmentId,
            salesOrderLineId: dto.salesOrderLineId,
            quantityShipped: dto.quantityShipped,
          })
          .returning();

        await innerTx
          .update(salesOrderShipments)
          .set({ modifiedOn: new Date() })
          .where(eq(salesOrderShipments.shipmentId, shipmentId));

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
          eventType: EventType.SHIPMENT_LINE_ADDED,
          entityDisplayName: shipment.shipmentNumber,
          payload: {
            shipmentId,
            shipmentLineId: line.shipmentLineId,
            salesOrderLineId: dto.salesOrderLineId,
            quantityShipped: dto.quantityShipped,
          },
          actor,
        });

        return line;
      },
    );

    return result;
  }

  /**
   * Update a shipment line (quantity).
   */
  async updateShipmentLine(
    shipmentId: string,
    lineId: string,
    dto: UpdateShipmentLineDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode !== SHIPMENT_STATE.DRAFT) {
          throw new BadRequestException(
            `Cannot update lines for shipment in state '${shipment.stateCode}'`,
          );
        }

        const existingLine = await findShipmentLine(
          innerTx,
          lineId,
          shipmentId,
        );

        if (dto.quantityShipped !== undefined) {
          const orderLine = await findOrderLine(
            innerTx,
            existingLine.salesOrderLineId,
            shipment.salesOrderId,
          );
          await assertShipmentQtyAvailable(
            innerTx,
            shipment.salesOrderId,
            existingLine.salesOrderLineId,
            parseFloat(dto.quantityShipped),
            orderLine.lineNumber,
            lineId,
          );
        }

        const [updated] = await innerTx
          .update(salesOrderShipmentLines)
          .set({
            ...(dto.quantityShipped !== undefined && {
              quantityShipped: dto.quantityShipped,
            }),
          })
          .where(eq(salesOrderShipmentLines.shipmentLineId, lineId))
          .returning();

        await innerTx
          .update(salesOrderShipments)
          .set({ modifiedOn: new Date() })
          .where(eq(salesOrderShipments.shipmentId, shipmentId));

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
          eventType: EventType.SHIPMENT_LINE_UPDATED,
          entityDisplayName: shipment.shipmentNumber,
          payload: {
            shipmentId,
            shipmentLineId: lineId,
            changes: dto,
          },
          actor,
        });

        return updated;
      },
    );

    return result;
  }

  /**
   * Remove a shipment line.
   */
  async removeShipmentLine(
    shipmentId: string,
    lineId: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    await (tx || this.db).transaction(async (innerTx: DrizzleDB) => {
      const shipment = await findShipment(innerTx, shipmentId);

      if (shipment.stateCode !== SHIPMENT_STATE.DRAFT) {
        throw new BadRequestException(
          `Cannot remove lines from shipment in state '${shipment.stateCode}'`,
        );
      }

      const existingLine = await findShipmentLine(innerTx, lineId, shipmentId);

      await innerTx
        .delete(salesOrderShipmentLines)
        .where(eq(salesOrderShipmentLines.shipmentLineId, lineId));

      await innerTx
        .update(salesOrderShipments)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderShipments.shipmentId, shipmentId));

      await emitEvent(innerTx, {
        entityType: EntityType.SHIPMENT,
        entityId: shipmentId,
        eventType: EventType.SHIPMENT_LINE_REMOVED,
        entityDisplayName: shipment.shipmentNumber,
        payload: {
          shipmentId,
          shipmentLineId: lineId,
          salesOrderLineId: existingLine.salesOrderLineId,
          quantityShipped: existingLine.quantityShipped,
        },
        actor,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  async findOne(shipmentId: string) {
    const rows = await this.db
      .select({
        shipmentId: salesOrderShipments.shipmentId,
        shipmentNumber: salesOrderShipments.shipmentNumber,
        salesOrderId: salesOrderShipments.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: coreAccounts.name,
        stateCode: salesOrderShipments.stateCode,
        notes: salesOrderShipments.notes,
        trackingNumber: salesOrderShipments.trackingNumber,
        createdBy: salesOrderShipments.createdBy,
        createdOn: salesOrderShipments.createdOn,
        modifiedOn: salesOrderShipments.modifiedOn,
        deliveryName: salesOrders.deliveryName,
        deliveryPhone: salesOrders.deliveryPhone,
        deliveryAddressLine1: salesOrders.deliveryAddressLine1,
        deliveryAddressLine2: salesOrders.deliveryAddressLine2,
        deliveryCity: salesOrders.deliveryCity,
        deliveryState: salesOrders.deliveryState,
        deliveryPostalCode: salesOrders.deliveryPostalCode,
        deliveryCountry: salesOrders.deliveryCountry,
        shippingNotes: salesOrders.shippingNotes,
      })
      .from(salesOrderShipments)
      .innerJoin(
        salesOrders,
        eq(salesOrderShipments.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .where(eq(salesOrderShipments.shipmentId, shipmentId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Shipment '${shipmentId}' not found`);
    }

    const shipment = rows[0];

    const lines = await this.db
      .select({
        shipmentLineId: salesOrderShipmentLines.shipmentLineId,
        salesOrderLineId: salesOrderShipmentLines.salesOrderLineId,
        quantityShipped: salesOrderShipmentLines.quantityShipped,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        productDescription: salesOrderLineItems.productDescription,
        orderNumber: salesOrders.orderNumber,
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesOrderShipmentLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .innerJoin(
        salesOrders,
        eq(salesOrderLineItems.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderShipmentLines.shipmentId, shipmentId));

    const events = await this.db
      .select({
        eventId: warehouseEvents.eventId,
        entityType: warehouseEvents.entityType,
        entityId: warehouseEvents.entityId,
        eventType: warehouseEvents.eventType,
        payload: warehouseEvents.payload,
        actor: warehouseEvents.actor,
        createdOn: warehouseEvents.createdOn,
      })
      .from(warehouseEvents)
      .where(
        and(
          eq(warehouseEvents.entityType, EntityType.SHIPMENT),
          eq(warehouseEvents.entityId, shipmentId),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return { ...shipment, lines, events };
  }

  async findByOrder(salesOrderId: string) {
    const shipments = await this.db
      .select()
      .from(salesOrderShipments)
      .where(eq(salesOrderShipments.salesOrderId, salesOrderId))
      .orderBy(desc(salesOrderShipments.createdOn));

    const result = [];
    for (const shipment of shipments) {
      const lines = await this.db
        .select({
          shipmentLineId: salesOrderShipmentLines.shipmentLineId,
          salesOrderLineId: salesOrderShipmentLines.salesOrderLineId,
          quantityShipped: salesOrderShipmentLines.quantityShipped,
          productId: salesOrderLineItems.productId,
          productNumber: coreProducts.productNumber,
        })
        .from(salesOrderShipmentLines)
        .innerJoin(
          salesOrderLineItems,
          eq(
            salesOrderShipmentLines.salesOrderLineId,
            salesOrderLineItems.salesOrderLineId,
          ),
        )
        .leftJoin(
          coreProducts,
          eq(salesOrderLineItems.productId, coreProducts.productId),
        )
        .where(eq(salesOrderShipmentLines.shipmentId, shipment.shipmentId));
      result.push({ ...shipment, lines });
    }

    return result;
  }

  /**
   * Fetch a flattened, global list of Sales Order Shipments.
   * Useful for the "All Shipments" page.
   */
  async findAll(query: {
    days?: number;
    salesOrderId?: string;
    limit?: number;
  }) {
    const { days = 30, salesOrderId, limit = 100 } = query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];

    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(salesOrderShipments.createdOn, cutoffDate));
    }

    if (salesOrderId) {
      conditions.push(eq(salesOrderShipments.salesOrderId, salesOrderId));
    }

    const data = await this.db
      .select({
        shipmentId: salesOrderShipments.shipmentId,
        shipmentNumber: salesOrderShipments.shipmentNumber,
        salesOrderId: salesOrderShipments.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: coreAccounts.name,
        stateCode: salesOrderShipments.stateCode,
        createdOn: salesOrderShipments.createdOn,
        notes: salesOrderShipments.notes,
        trackingNumber: salesOrderShipments.trackingNumber,
      })
      .from(salesOrderShipments)
      .innerJoin(
        salesOrders,
        eq(salesOrderShipments.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .where(and(...conditions))
      .orderBy(desc(salesOrderShipments.createdOn))
      .limit(limit > 0 ? limit : 100);

    if (data.length === 0) return [];

    const shipmentIds = data.map((s) => s.shipmentId);

    // Fetch PO mappings for these shipments via backorder allocations
    const poLinks = await this.db
      .select({
        shipmentId: salesOrderShipmentLines.shipmentId,
        poNumber: purchaseOrders.orderNumber,
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        backorders,
        eq(
          salesOrderShipmentLines.salesOrderLineId,
          backorders.salesOrderLineId,
        ),
      )
      .innerJoin(
        purchaseOrders,
        eq(backorders.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(
        sql`${salesOrderShipmentLines.shipmentId} IN (${sql.join(
          shipmentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const poMap = new Map<string, Set<string>>();
    for (const link of poLinks) {
      if (!poMap.has(link.shipmentId)) poMap.set(link.shipmentId, new Set());
      if (link.poNumber) poMap.get(link.shipmentId)!.add(link.poNumber);
    }

    return data.map((s) => ({
      ...s,
      purchaseOrders: Array.from(poMap.get(s.shipmentId) || []),
    }));
  }

  public async executeDispatch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    innerTx: DrizzleDB,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shipment: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shipmentLines: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    physicalStockLines: any[],
    actor: string,
  ) {
    const method = this.appConfig.valuationMethod();
    const strategy = getValuationStrategy(method);

    const pickHistory = await innerTx
      .select({
        binId: inventoryLedger.binId,
        productId: inventoryLedger.productId,
        netPicked: sql<number>`SUM(${inventoryLedger.quantity}::numeric)`,
      })
      .from(inventoryLedger)
      .innerJoin(
        inventoryEntries,
        eq(inventoryLedger.entryId, inventoryEntries.entryId),
      )
      .innerJoin(bins, eq(inventoryLedger.binId, bins.binId))
      .where(
        and(
          eq(inventoryEntries.sourceId, shipment.salesOrderId),
          eq(inventoryEntries.sourceType, 'SO_PICK'),
          eq(bins.binNumber, 'SHIPPING'),
        ),
      )
      .groupBy(inventoryLedger.binId, inventoryLedger.productId);

    const dispatchLines = [];
    for (const line of physicalStockLines) {
      let remainingToShip = parseFloat(line.quantity);
      const availablePicks = pickHistory.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.productId === line.productId && p.netPicked > 0,
      );

      for (const pick of availablePicks) {
        if (remainingToShip <= 0) break;
        const take = Math.min(remainingToShip, pick.netPicked);
        dispatchLines.push({
          productId: line.productId!,
          binId: pick.binId,
          quantity: -take,
        });
        pick.netPicked -= take;
        remainingToShip -= take;
      }

      if (remainingToShip > 0) {
        throw new BadRequestException(
          `System Integrity Error: Could not find enough successfully picked stock in SHIPPING bins for product ${line.productId} to dispatch ${line.quantity}. Missing ${remainingToShip}`,
        );
      }
    }

    if (dispatchLines.length > 0) {
      await this.inventoryService.recordInventoryMovement(innerTx, {
        entryNumber:
          'DSP-' +
          shipment.shipmentNumber +
          '-' +
          Date.now().toString().slice(-4),
        sourceType: 'SO_SHIPMENT',
        sourceId: shipment.shipmentId,
        memo: 'Goods Dispatched',
        userId: actor,
        lines: dispatchLines,
      });
    }

    // Transition sales_order_picks to shipped
    for (const sl of shipmentLines) {
      let remainingToShip = parseFloat(sl.quantityShipped);
      const linePicks = await innerTx
        .select()
        .from(salesOrderPicks)
        .where(
          and(
            eq(salesOrderPicks.salesOrderLineId, sl.salesOrderLineId),
            eq(salesOrderPicks.stateCode, SALES_ORDER_PICK_STATE.PICKED),
          ),
        );

      for (const pick of linePicks) {
        if (remainingToShip <= 0) break;
        const pickQty = parseFloat(pick.quantity);
        const take = Math.min(remainingToShip, pickQty);
        if (take === pickQty) {
          await this.changePickState(
            pick.pickId,
            SALES_ORDER_PICK_STATE.SHIPPED,
            actor,
            innerTx,
          );
        } else {
          // Partial pick shipped - split the pick
          await innerTx
            .update(salesOrderPicks)
            .set({
              quantity: String(pickQty - take),
              modifiedOn: new Date(),
            })
            .where(eq(salesOrderPicks.pickId, pick.pickId));
          await innerTx.insert(salesOrderPicks).values({
            salesOrderId: pick.salesOrderId,
            salesOrderLineId: pick.salesOrderLineId,
            productId: pick.productId,
            binId: pick.binId,
            quantity: String(take),
            stateCode: SALES_ORDER_PICK_STATE.SHIPPED,
            createdBy: pick.createdBy,
          });
        }
        remainingToShip -= take;
      }
    }

    // Calculate COGS and record outbox event for GL mapping
    const cogsDetails = [];
    for (const line of physicalStockLines) {
      if (!line.productId) continue;

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          line.productId,
        );

      const [product] = await innerTx
        .select()
        .from(coreProducts)
        .where(
          isUuid
            ? eq(coreProducts.productId, line.productId)
            : eq(coreProducts.productNumber, line.productId),
        );

      if (product) {
        const cogsAmount = strategy.getCogs(
          {
            productId: product.productId,
            standardCost: product.standardCost || '0',
            weightedAverageCost: product.weightedAverageCost || '0',
          },
          parseFloat(line.quantity),
        );

        cogsDetails.push({
          productId: line.productId,
          quantity: line.quantity,
          cogsAmount,
        });
      }
    }

    // --- Financial Integration: Post COGS Journal Entry via Accounting Strategy ---
    const totalCogs = cogsDetails.reduce(
      (sum, detail) => sum + parseFloat(detail.cogsAmount),
      0,
    );

    const accountingStrategy = getAccountingStrategy(
      this.appConfig.inventoryAccountingMode(),
      {
        inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
        grniAccountId: this.appConfig.defaultGrniAccountId(),
        cogsAccountId: this.appConfig.defaultCogsAccountId(),
        shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
      },
    );

    // Resolve customer customer group dimensions for COGS posting
    let customerCostCenterId: string | undefined;
    let customerActivityId: string | undefined;
    const [order] = await innerTx
      .select({
        customerId: salesOrders.customerId,
        costCenterId: customerGroups.defaultCostCenterId,
        activityId: customerGroups.defaultActivityId,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .where(eq(salesOrders.salesOrderId, shipment.salesOrderId));
    if (order) {
      customerCostCenterId = order.costCenterId || undefined;
      customerActivityId = order.activityId || undefined;
    }

    const dispatchGl = accountingStrategy.onGoodsDispatch({
      amount: Number(totalCogs.toFixed(2)),
      memo: `Dispatch ${shipment.shipmentNumber}`,
      costCenterId: customerCostCenterId,
      activityId: customerActivityId,
    });

    if (dispatchGl) {
      await this.glService.postJournalEntry(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatchGl.lines as any[],
        {
          actor,
          entryDate: new Date().toISOString().slice(0, 10),
          sourceType: dispatchGl.sourceType,
          sourceId: shipment.shipmentId,
          memo: `Dispatch ${shipment.shipmentNumber}`,
        },
        innerTx,
      );
    }

    await emitEvent(innerTx, {
      entityType: EntityType.SHIPMENT,
      entityId: shipment.shipmentId,
      eventType: EventType.STOCK_DISPATCHED,
      entityDisplayName: shipment.shipmentNumber,
      payload: {
        shipmentId: shipment.shipmentId,
        shipmentNumber: shipment.shipmentNumber,
        salesOrderId: shipment.salesOrderId,
        cogsDetails,
      },
      actor,
    });
  }
  private async changePickState(
    pickId: string,
    newState: SalesOrderPickState,
    actor: string,
    tx: DrizzleDB,
  ) {
    const [existing] = await tx
      .select({
        stateCode: salesOrderPicks.stateCode,
        salesOrderId: salesOrderPicks.salesOrderId,
      })
      .from(salesOrderPicks)
      .where(eq(salesOrderPicks.pickId, pickId))
      .limit(1);

    if (!existing) return;
    if (existing.stateCode === newState) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allowed = SALES_ORDER_PICK_TRANSITIONS[existing.stateCode as any];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition sales order pick from '${existing.stateCode}' to '${newState}'.`,
      );
    }

    await tx
      .update(salesOrderPicks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ stateCode: newState as any, modifiedOn: new Date() })
      .where(eq(salesOrderPicks.pickId, pickId));

    if (newState === SALES_ORDER_PICK_STATE.CANCELLED) {
      const [order] = await tx
        .select({ orderNumber: salesOrders.orderNumber })
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, existing.salesOrderId));
      await emitEvent(tx, {
        entityType: EntityType.WAREHOUSE,
        entityId: pickId,
        eventType: EventType.PICK_CANCELLED,
        entityDisplayName: order.orderNumber,
        payload: {
          pickId,
          salesOrderId: existing.salesOrderId,
        },
        actor,
      });
    }
  }
}
