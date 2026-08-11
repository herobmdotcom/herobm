import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and, gte, or } from 'drizzle-orm';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
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
  transferOrders,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderLines,
  locations,
  actors,
} from '@herobm/db-schema';
import { AppConfigService } from '../../settings/app-config.service';
import { getValuationStrategy } from '../../inventory/valuation';
import { getAccountingStrategy } from '../../inventory/inventory-accounting';
import {
  findOrder,
  findOrderLine,
  findShipment,
  findShipmentLine,
  assertShipmentQtyAvailable,
  getInvoicedPerLine,
  getCommittedPerLine,
} from '../shipment-helpers';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import { calculateAuditTrail, AuditMode } from '../../common/audit';
import { evaluateLifecycleRules } from '../order-lifecycle-rules';
import { GlService } from '../../gl/gl.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  AddShipmentLineDto,
  UpdateShipmentLineDto,
} from '../dto';

import {
  SHIPMENT_STATE,
  SHIPMENT_TRANSITIONS as SHIPMENT_STATE_TRANSITIONS,
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_PICK_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';
import type { SalesOrderPickState } from '@herobm/shared';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { ShipmentsCoreService } from './shipments-core.service';

const VALID_SHIPMENT_STATES = getValidStates(SHIPMENT_STATE_TRANSITIONS);

// ============================================================================
// DTOs
// ============================================================================

// DTOs imported from ./dto

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ShipmentsStateService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly shipmentsCoreService: ShipmentsCoreService,
  ) {}

  private readonly logger = new Logger(ShipmentsStateService.name);

  // -------------------------------------------------------------------------
  // Number generation
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
            unitCost: orderLine.unitCost,
            isPhysical:
              !product ||
              !product.productType ||
              product.productType === 'inventory',
            uomCode: orderLine.unitOfMeasure,
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
              shippedQty:
                sql<number>`SUM(ABS(${inventoryLedger.quantity}::numeric))`.mapWith(
                  Number,
                ),
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
                uomCode: line.uomCode || 'EA',
                unitCost: line.unitCost,
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
            await this.inventoryMovementService.recordInventoryMovement(
              innerTx,
              {
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
              },
            );
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
                // @herobm-skip-audit - Internal tracking split, business event emitted by changeShipmentState
                await innerTx
                  .update(salesOrderPicks)
                  .set({
                    quantity: String(pickQty - take),
                    modifiedOn: new Date(),
                  })
                  .where(eq(salesOrderPicks.pickId, pick.pickId));

                // @herobm-skip-audit - Internal tracking split, business event emitted by changeShipmentState
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
                const cogsAmount =
                  line.unitCost != null
                    ? (parseFloat(line.unitCost) * line.quantity).toFixed(2)
                    : strategy.getCogs(
                        {
                          productId: product.productId,
                          standardCost: product.standardCost || '0',
                          weightedAverageCost:
                            product.weightedAverageCost || '0',
                        },
                        line.quantity,
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
                ppvAccountId: this.appConfig.defaultPpvAccountId(),
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
              .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  public async executeDispatch(
    innerTx: DrizzleDB,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    shipment: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    shipmentLines: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    physicalStockLines: any[],
    actor: string,
  ) {
    const method = this.appConfig.valuationMethod();
    const strategy = getValuationStrategy(method);

    const pickHistory = await innerTx
      .select({
        binId: inventoryLedger.binId,
        productId: inventoryLedger.productId,
        netPicked:
          sql<number>`SUM(${inventoryLedger.quantity}::numeric)`.mapWith(
            Number,
          ),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        (p: any) => p.productId === line.productId && p.netPicked > 0,
      );

      for (const pick of availablePicks) {
        if (remainingToShip <= 0) break;
        const take = Math.min(remainingToShip, pick.netPicked);
        dispatchLines.push({
          productId: line.productId!,
          binId: pick.binId,
          quantity: -take,
          uomCode: line.uomCode || 'EA',
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
      await this.inventoryMovementService.recordInventoryMovement(innerTx, {
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
        const cogsAmount =
          line.unitCost != null
            ? (parseFloat(line.unitCost) * parseFloat(line.quantity)).toFixed(2)
            : strategy.getCogs(
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
        ppvAccountId: this.appConfig.defaultPpvAccountId(),
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
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .where(eq(salesOrders.salesOrderId, shipment.salesOrderId));
    if (order) {
      customerCostCenterId =
        order.costCenterId || this.appConfig.defaultCostCenterId() || undefined;
      customerActivityId =
        order.activityId || this.appConfig.defaultActivityId() || undefined;
    }

    const dispatchGl = accountingStrategy.onGoodsDispatch({
      amount: Number(totalCogs.toFixed(2)),
      memo: `Dispatch ${shipment.shipmentNumber}`,
      costCenterId: customerCostCenterId,
      activityId: customerActivityId,
    });

    if (dispatchGl) {
      await this.glService.postJournalEntry(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const allowed = SALES_ORDER_PICK_TRANSITIONS[existing.stateCode as any];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition sales order pick from '${existing.stateCode}' to '${newState}'.`,
      );
    }

    await tx
      .update(salesOrderPicks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
