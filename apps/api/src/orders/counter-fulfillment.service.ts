import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  products as coreProducts,
  bins,
  binContents,
  zones,
  locations,
  customerGroups,
  customers as coreAccounts,
  actors,
} from '@herobm/db-schema';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { findOrder, getCommittedPerLine } from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  FulfillCounterOrderDto,
  CounterFulfillmentResponseDto,
  CounterFulfilledLineDto,
} from './dto';
import {
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
  SalesOrderState,
  isStockedProductLine,
} from '@herobm/shared';
import {
  filterPickableBins,
  isPickableBinCondition,
} from '../inventory/inventory-math.utils';

@Injectable()
export class CounterFulfillmentService {
  private readonly logger = new Logger(CounterFulfillmentService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  /**
   * Fulfill sales order lines over the counter by directly issuing physical stock
   * from pickable bins at the fulfillment location, posting COGS, and advancing
   * the order state (to SHIPPED or PICKING) without creating freight/parcel shipments.
   */
  async fulfillCounterOrder(
    salesOrderId: string,
    dto: FulfillCounterOrderDto,
    actor: string,
    tx?: DrizzleDB,
  ): Promise<CounterFulfillmentResponseDto> {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const order = await findOrder(innerTx, salesOrderId);

        if (
          order.stateCode !== SALES_ORDER_STATE.CONFIRMED &&
          order.stateCode !== SALES_ORDER_STATE.PICKING
        ) {
          throw new BadRequestException(
            `Cannot fulfill order in state '${order.stateCode}'. Order must be in '${SALES_ORDER_STATE.CONFIRMED}' or '${SALES_ORDER_STATE.PICKING}'.`,
          );
        }

        const lines = await innerTx
          .select({
            salesOrderLineId: salesOrderLineItems.salesOrderLineId,
            lineNumber: salesOrderLineItems.lineNumber,
            productId: salesOrderLineItems.productId,
            productDescription: salesOrderLineItems.productDescription,
            quantity: salesOrderLineItems.quantity,
            unitCost: salesOrderLineItems.unitCost,
            unitOfMeasure: salesOrderLineItems.unitOfMeasure,
            fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
            productType: coreProducts.productType,
            productNumber: coreProducts.productNumber,
            productName: coreProducts.name,
            standardCost: coreProducts.standardCost,
            weightedAverageCost: coreProducts.weightedAverageCost,
          })
          .from(salesOrderLineItems)
          .leftJoin(
            coreProducts,
            eq(salesOrderLineItems.productId, coreProducts.productId),
          )
          .where(eq(salesOrderLineItems.salesOrderId, salesOrderId))
          .orderBy(salesOrderLineItems.lineNumber);

        if (lines.length === 0) {
          throw new BadRequestException('Order contains no lines to fulfill.');
        }

        const committedMap = await getCommittedPerLine(innerTx, salesOrderId);

        const fulfilledLines: CounterFulfilledLineDto[] = [];
        const dispatchLines: Array<{
          productId: string;
          binId: string;
          quantity: number;
          uomCode: string;
        }> = [];
        const cogsDetails: Array<{
          productId: string;
          quantity: number;
          cogsAmount: string;
        }> = [];

        const valuationMethod = this.appConfig.valuationMethod();
        const valuationStrategy = getValuationStrategy(valuationMethod);

        const stockedProductIds = [
          ...new Set(
            lines
              .filter(
                (l) =>
                  isStockedProductLine({
                    productId: l.productId,
                    productType: l.productType,
                  }) && l.productId,
              )
              .map((l) => l.productId as string),
          ),
        ];

        const allProductBins =
          stockedProductIds.length > 0
            ? await innerTx
                .select({
                  productId: binContents.productId,
                  locationId: zones.locationId,
                  binId: bins.binId,
                  binNumber: bins.binNumber,
                  zoneCode: zones.code,
                  binType: bins.binType,
                  isUnavailable: bins.isUnavailable,
                  onHand: binContents.actualQuantity,
                })
                .from(binContents)
                .innerJoin(bins, eq(binContents.binId, bins.binId))
                .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
                .where(
                  and(
                    inArray(binContents.productId, stockedProductIds),
                    isPickableBinCondition(bins),
                  ),
                )
            : [];

        for (const line of lines) {
          const orderedQty = parseFloat(line.quantity || '0');
          const alreadyCommitted = committedMap.get(line.salesOrderLineId) || 0;
          const remainingQty = Math.max(0, orderedQty - alreadyCommitted);

          let qtyToFulfill = remainingQty;
          let requestedBinId: string | undefined;

          if (dto.lines && dto.lines.length > 0) {
            const reqLine = dto.lines.find(
              (l) => l.salesOrderLineId === line.salesOrderLineId,
            );
            if (!reqLine) {
              continue; // Not requested in partial fulfillment
            }
            qtyToFulfill = parseFloat(reqLine.quantityToFulfill || '0');
            requestedBinId = reqLine.binId;
          }

          if (qtyToFulfill <= 0) {
            continue;
          }

          if (qtyToFulfill > remainingQty + 0.0001) {
            throw new BadRequestException(
              `Cannot fulfill ${qtyToFulfill} for line ${line.lineNumber}. Only ${remainingQty} remaining unfulfilled.`,
            );
          }

          const isStocked = isStockedProductLine({
            productId: line.productId,
            productType: line.productType,
          });

          const locationId =
            line.fulfillmentLocationId || order.fulfillmentLocationId;

          if (isStocked && line.productId) {
            // Find available stock in pickable bins at this location
            const productBins = allProductBins.filter(
              (pb) =>
                pb.productId === line.productId && pb.locationId === locationId,
            );

            const pickableBins = filterPickableBins(productBins).sort(
              (a, b) =>
                parseFloat(String(b.onHand || 0)) -
                parseFloat(String(a.onHand || 0)),
            );

            const totalAvailableOnHand = pickableBins.reduce(
              (sum, b) => sum + parseFloat(String(b.onHand || 0)),
              0,
            );

            if (qtyToFulfill > totalAvailableOnHand + 0.0001) {
              if (dto.allowPartialFulfillment) {
                qtyToFulfill = totalAvailableOnHand;
              } else {
                throw new BadRequestException(
                  `Insufficient stock on hand for line ${line.lineNumber} (${line.productNumber || line.productDescription}). Requested: ${qtyToFulfill}, Available: ${totalAvailableOnHand}`,
                );
              }
            }

            if (qtyToFulfill <= 0) {
              continue;
            }

            let remainingStockToTake = qtyToFulfill;

            const binsToTakeFrom = requestedBinId
              ? pickableBins.filter((b) => b.binId === requestedBinId)
              : pickableBins;

            if (requestedBinId && binsToTakeFrom.length === 0) {
              throw new BadRequestException(
                `Specified bin ${requestedBinId} is not an available pickable bin for line ${line.lineNumber}.`,
              );
            }

            for (const b of binsToTakeFrom) {
              if (remainingStockToTake <= 0) break;
              const binOnHand = parseFloat(String(b.onHand || 0));
              if (binOnHand <= 0) continue;

              const take = Math.min(remainingStockToTake, binOnHand);

              // 1. Record sales_order_picks entry directly as SHIPPED
              // @herobm-skip-audit -- Counter sale immediate handover pick line record
              await innerTx.insert(salesOrderPicks).values({
                salesOrderId,
                salesOrderLineId: line.salesOrderLineId,
                productId: line.productId,
                quantity: String(take),
                binId: b.binId,
                stateCode: SALES_ORDER_PICK_STATE.SHIPPED,
                createdBy: actor,
              });

              // 2. Add inventory ledger movement line
              dispatchLines.push({
                productId: line.productId,
                binId: b.binId,
                quantity: -take,
                uomCode: line.unitOfMeasure || 'EA',
              });

              // 3. Compute COGS
              const cogsAmount =
                line.unitCost != null
                  ? (parseFloat(line.unitCost) * take).toFixed(2)
                  : valuationStrategy.getCogs(
                      {
                        productId: line.productId,
                        standardCost: line.standardCost || '0',
                        weightedAverageCost: line.weightedAverageCost || '0',
                      },
                      take,
                    );

              cogsDetails.push({
                productId: line.productId,
                quantity: take,
                cogsAmount,
              });

              fulfilledLines.push({
                salesOrderLineId: line.salesOrderLineId,
                productId: line.productId,
                quantityFulfilled: String(take),
                binId: b.binId,
                binNumber: `${b.zoneCode}.${b.binNumber}`,
              });

              remainingStockToTake -= take;
            }

            if (remainingStockToTake > 0) {
              throw new BadRequestException(
                `Could not allocate full quantity ${qtyToFulfill} from pickable bins for line ${line.lineNumber}. Short by ${remainingStockToTake}`,
              );
            }
          } else {
            // Non-stock / service / custom line
            fulfilledLines.push({
              salesOrderLineId: line.salesOrderLineId,
              productId: line.productId || undefined,
              quantityFulfilled: String(qtyToFulfill),
            });
          }
        }

        if (fulfilledLines.length === 0) {
          throw new BadRequestException('No line quantities were fulfilled.');
        }

        // 4. Record Inventory Movements in Ledger
        if (dispatchLines.length > 0) {
          const timestampSeq = Date.now().toString().slice(-4);
          await this.inventoryMovementService.recordInventoryMovement(innerTx, {
            entryNumber: `DSP-OTC-${order.orderNumber}-${timestampSeq}`,
            sourceType: 'SO_COUNTER_SALE',
            sourceId: salesOrderId,
            memo: dto.notes || 'Over-the-Counter Sale Handover',
            userId: actor,
            lines: dispatchLines,
          });
        }

        // 5. Post COGS GL Journal Entry
        const totalCogs = cogsDetails.reduce(
          (sum, d) => sum + parseFloat(d.cogsAmount || '0'),
          0,
        );

        if (totalCogs > 0) {
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

          let customerCostCenterId: string | undefined;
          let customerActivityId: string | undefined;

          if (order.customerId) {
            const [cust] = await innerTx
              .select({
                costCenterId: customerGroups.defaultCostCenterId,
                activityId: customerGroups.defaultActivityId,
              })
              .from(coreAccounts)
              .leftJoin(
                customerGroups,
                eq(
                  coreAccounts.customerGroupId,
                  customerGroups.customerGroupId,
                ),
              )
              .where(eq(coreAccounts.customerId, order.customerId))
              .limit(1);

            if (cust) {
              customerCostCenterId = cust.costCenterId || undefined;
              customerActivityId = cust.activityId || undefined;
            }
          }

          const dispatchGl = accountingStrategy.onGoodsDispatch({
            amount: Number(totalCogs.toFixed(2)),
            memo: `Counter Handover ${order.orderNumber}`,
            costCenterId: customerCostCenterId,
            activityId: customerActivityId,
          });

          if (dispatchGl) {
            if (!dispatchGl.lines || dispatchGl.lines.length < 2) {
              throw new BadRequestException(
                'Cannot fulfill counter order: COGS or Inventory Asset account is not configured in GL Settings.',
              );
            }

            await this.glService.postJournalEntry(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GL journal lines structure
              dispatchGl.lines as any[],
              {
                actor,
                entryDate: new Date().toISOString().slice(0, 10),
                sourceType: dispatchGl.sourceType,
                sourceId: salesOrderId,
                memo: `Counter Handover ${order.orderNumber}`,
              },
              innerTx,
            );
          }
        }

        // 6. Update order status: SHIPPED if fully fulfilled, PICKING if partially fulfilled
        const updatedCommittedMap = await getCommittedPerLine(
          innerTx,
          salesOrderId,
        );
        const isFullyCommitted = lines.every((l) => {
          const ordered = parseFloat(l.quantity || '0');
          const isPhysical = isStockedProductLine({
            productId: l.productId,
            productType: l.productType,
          });
          if (!isPhysical) return true;
          const committed = updatedCommittedMap.get(l.salesOrderLineId) || 0;
          return committed >= ordered - 0.0001;
        });

        const targetState: SalesOrderState = isFullyCommitted
          ? SALES_ORDER_STATE.SHIPPED
          : SALES_ORDER_STATE.PICKING;

        const updatedOrder = await this.changeSalesOrderState(
          innerTx,
          salesOrderId,
          order.orderNumber,
          order.stateCode,
          targetState,
          actor,
          isFullyCommitted
            ? 'All lines fulfilled over the counter'
            : 'Partial lines fulfilled over the counter',
          {
            fulfillmentType: 'counter_pickup',
            fulfilledLines,
            cogsAmount: totalCogs.toFixed(2),
          },
        );

        this.logger.log(
          `Order ${order.orderNumber} fulfilled over the counter (${fulfilledLines.length} lines, state: ${targetState}) by ${actor}`,
        );

        return {
          salesOrderId,
          orderNumber: order.orderNumber,
          stateCode: updatedOrder.stateCode,
          fulfilledLines,
          cogsAmount: totalCogs.toFixed(2),
          message: isFullyCommitted
            ? 'Order fully fulfilled over the counter'
            : 'Order partially fulfilled over the counter',
        };
      },
    );

    return result;
  }

  private async changeSalesOrderState(
    tx: DrizzleDB,
    salesOrderId: string,
    orderNumber: string,
    oldState: SalesOrderState,
    newState: SalesOrderState,
    actor: string,
    reason: string,
    additionalPayload: Record<string, unknown> = {},
  ) {
    const [updatedOrder] = await tx
      .update(salesOrders)
      .set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle typed enum column
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(salesOrders.salesOrderId, salesOrderId))
      .returning();

    await emitEvent(tx, {
      entityType: EntityType.SALES_ORDER,
      entityId: salesOrderId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: orderNumber,
      payload: {
        from: oldState,
        to: newState,
        reason,
        ...additionalPayload,
      },
      actor,
    });

    return updatedOrder;
  }
}
