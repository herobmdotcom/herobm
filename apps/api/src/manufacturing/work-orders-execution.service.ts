import {
  Injectable,
  Inject,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  workOrders,
  workOrderPicks,
  bins,
  binContents,
  zones,
  products,
} from '@herobm/db-schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { isPickableBinCondition } from '../inventory/inventory-math.utils';
import {
  WORK_ORDER_STATE,
  WORK_ORDER_TRANSITIONS,
  WORK_ORDER_PICK_STATE,
  PUTAWAY_STATUS,
  BIN_TYPE,
  type WorkOrderState,
} from '@herobm/shared';
import Decimal from 'decimal.js';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { WorkOrdersQueryService } from './work-orders-query.service';
import { BackordersService } from '../orders/backorders.service';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';

@Injectable()
export class WorkOrdersExecutionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(forwardRef(() => InventoryMovementService))
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly queryService: WorkOrdersQueryService,
    @Inject(forwardRef(() => BackordersService))
    private readonly backordersService: BackordersService,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
  ) {}

  async changeWorkOrderState(
    id: string,
    newState: WorkOrderState,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

    const allowedNext = WORK_ORDER_TRANSITIONS[wo.stateCode] || [];
    if (!allowedNext.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition Work Order from state '${wo.stateCode}' to '${newState}'`,
      );
    }

    await db
      .update(workOrders)
      .set({
        stateCode: newState,
        modifiedOn: new Date(),
      })
      .where(eq(workOrders.workOrderId, id));

    await emitEvent(db, {
      entityType: EntityType.WORK_ORDER,
      entityId: id,
      eventType: EventType.STATUS_CHANGED,
      actor: username || 'system',
      entityDisplayName: wo.orderNumber,
      payload: {
        previousState: wo.stateCode,
        newState,
        productId: wo.productId,
        productName: wo.productName,
        locationId: wo.locationId,
        locationName: wo.locationName,
      },
    });

    return await this.queryService.findOne(id, db);
  }

  async release(id: string, username?: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

    if (!wo.wipBinId || !wo.outputBinId) {
      throw new BadRequestException('WIP Bin and Output Bin must be set.');
    }

    const executeRelease = async (innerTx: DrizzleDB) => {
      await this.changeWorkOrderState(
        id,
        WORK_ORDER_STATE.IN_PROGRESS,
        username,
        innerTx,
      );

      const compProductIds = [
        ...new Set(wo.components.map((c) => c.productId)),
      ];

      const stockMap = new Map<string, number>();
      if (compProductIds.length > 0) {
        const stockRows = await innerTx
          .select({
            productId: binContents.productId,
            onHand:
              sql<number>`COALESCE(SUM(${binContents.actualQuantity}::numeric), 0)`.mapWith(
                Number,
              ),
          })
          .from(binContents)
          .innerJoin(bins, eq(binContents.binId, bins.binId))
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(zones.locationId, wo.locationId),
              inArray(binContents.productId, compProductIds),
              isPickableBinCondition(bins),
            ),
          )
          .groupBy(binContents.productId);

        for (const r of stockRows) {
          stockMap.set(r.productId, r.onHand);
        }
      }

      for (const comp of wo.components) {
        const expectedQty = parseFloat(comp.expectedQuantity || '0');
        const availableOnHand = stockMap.get(comp.productId) || 0;
        const shortfall = Math.max(0, expectedQty - availableOnHand);

        if (shortfall > 0) {
          await this.backordersService.createShortfallDemand(innerTx, {
            demandWorkOrderId: id,
            workOrderComponentId: comp.workOrderComponentId,
            productId: comp.productId,
            quantity: shortfall.toString(),
            actor: username || 'system',
          });
        }

        const [pick] = await innerTx
          .insert(workOrderPicks)
          .values({
            workOrderId: id,
            workOrderComponentId: comp.workOrderComponentId,
            quantity: comp.expectedQuantity,
            stateCode: WORK_ORDER_PICK_STATE.PENDING,
            createdBy: username || null,
          })
          .returning();

        await emitEvent(innerTx, {
          entityType: EntityType.WORK_ORDER_PICK,
          entityId: pick.pickId,
          eventType: EventType.CREATED,
          actor: username || 'system',
          entityDisplayName: wo.orderNumber,
          payload: {
            workOrderId: id,
            orderNumber: wo.orderNumber,
            productId: comp.productId,
            productName: comp.productName,
            quantity: comp.expectedQuantity,
          },
        });
      }

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: id,
        eventType: EventType.STATUS_CHANGED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          orderNumber: wo.orderNumber,
          productId: wo.productId,
          productName: wo.productName,
          locationId: wo.locationId,
          locationName: wo.locationName,
        },
      });
    };

    if (tx) {
      await executeRelease(tx);
    } else {
      await this.db.transaction(executeRelease);
    }

    return await this.queryService.findOne(id, tx);
  }

  async completeBuild(
    id: string,
    outputBinId?: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

    let componentsCost = new Decimal(0);
    for (const comp of wo.components) {
      const qty = new Decimal(comp.expectedQuantity || '0');
      const cost = comp.unitCost ? new Decimal(comp.unitCost) : new Decimal(0);
      componentsCost = componentsCost.plus(qty.mul(cost));
    }

    const targetQty = new Decimal(wo.targetQuantity || '0');
    const unitAssemblyCost = wo.assemblyCostPerUnit
      ? new Decimal(wo.assemblyCostPerUnit)
      : new Decimal(0);
    const assemblyTotal = unitAssemblyCost.mul(targetQty);
    const additionalCost = wo.additionalCost
      ? new Decimal(wo.additionalCost)
      : new Decimal(0);

    const totalCostNum = componentsCost
      .plus(assemblyTotal)
      .plus(additionalCost);
    const laborAndOverheadCost = assemblyTotal.plus(additionalCost);
    const finishedProductUnitCost = targetQty.gt(0)
      ? totalCostNum.div(targetQty).toFixed(4)
      : '0.0000';

    const executeComplete = async (innerTx: DrizzleDB) => {
      await this.changeWorkOrderState(
        id,
        WORK_ORDER_STATE.COMPLETED,
        username,
        innerTx,
      );

      await innerTx
        .update(workOrders)
        .set({
          completedQuantity: wo.targetQuantity,
          totalCost: totalCostNum.toFixed(2),
          putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
        })
        .where(eq(workOrders.workOrderId, id));

      await innerTx
        .update(workOrderPicks)
        // eslint-disable-next-line no-restricted-syntax -- Bulk updating work order pick state on completion
        .set({ stateCode: WORK_ORDER_PICK_STATE.PICKED })
        .where(eq(workOrderPicks.workOrderId, id));

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER_PICK,
        entityId: id,
        eventType: EventType.STATUS_CHANGED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          workOrderId: id,
          orderNumber: wo.orderNumber,
          stateCode: WORK_ORDER_PICK_STATE.PICKED,
        },
      });

      let buildOutputBinId = outputBinId || wo.outputBinId || wo.wipBinId;
      if (!buildOutputBinId) {
        const [defaultBin] = await innerTx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(zones.locationId, wo.locationId))
          .limit(1);
        buildOutputBinId = defaultBin?.binId;
      }

      if (!buildOutputBinId) {
        throw new BadRequestException(
          `No active storage bin available at location ${wo.locationId} for completed product output`,
        );
      }

      // --- Financial Integration & Valuation Updates ---
      // Fetch product to blend WAC before recordInventoryMovement so QOH does not include output yet
      const valuationMethodCode = this.appConfig.valuationMethod();
      const valuationStrategy = getValuationStrategy(valuationMethodCode);

      const [stockRow] = await innerTx
        .select({
          onHand:
            sql<number>`COALESCE(SUM(${binContents.actualQuantity}::numeric), 0)`.mapWith(
              Number,
            ),
        })
        .from(binContents)
        .where(eq(binContents.productId, wo.productId));

      const currentQoh = stockRow?.onHand || 0;

      const [finishedProduct] = await innerTx
        .select({
          productId: products.productId,
          standardCost: products.standardCost,
          weightedAverageCost: products.weightedAverageCost,
        })
        .from(products)
        .where(eq(products.productId, wo.productId))
        .limit(1);

      if (finishedProduct) {
        const productData = {
          ...finishedProduct,
          standardCost: finishedProduct.standardCost || '0',
          weightedAverageCost: finishedProduct.weightedAverageCost || '0',
        };

        const valuation = valuationStrategy.onGoodsReceipt(
          productData,
          currentQoh,
          targetQty.toNumber(),
          finishedProductUnitCost,
        );

        await innerTx
          .update(products)
          .set({ weightedAverageCost: valuation.newWeightedAverageCost })
          .where(eq(products.productId, wo.productId));
      }

      const movementLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
        unitCost?: string;
        originalQuantity?: number;
      }[] = [
        {
          productId: wo.productId,
          binId: buildOutputBinId,
          quantity: targetQty.toNumber(),
          uomCode: wo.baseUom || 'EA',
          unitCost: finishedProductUnitCost,
          originalQuantity: targetQty.toNumber(),
        },
      ];

      if (wo.wipBinId) {
        for (const comp of wo.components) {
          const compQty = parseFloat(comp.expectedQuantity || '0');
          if (compQty > 0) {
            movementLines.push({
              productId: comp.productId,
              binId: wo.wipBinId,
              quantity: -compQty,
              uomCode: comp.baseUom || 'EA',
              unitCost: comp.unitCost || undefined,
            });
          }
        }
      }

      if (movementLines.length > 0) {
        await this.inventoryMovementService.recordInventoryMovement(innerTx, {
          entryNumber: `WO-BLD-${wo.orderNumber}`,
          sourceType: 'WORK_ORDER',
          sourceId: id,
          memo: `Completed Work Order build for ${wo.orderNumber}`,
          userId: username || 'system',
          lines: movementLines,
        });
      }

      // Post Journal Entry via Accounting Strategy
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

      const glResult = accountingStrategy.onWorkOrderCompletion({
        finishedGoodsValue: totalCostNum
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber(),
        componentsCost: componentsCost
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber(),
        laborAndOverheadCost: laborAndOverheadCost
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber(),
        memo: `Work Order Completion ${wo.orderNumber}`,
        costCenterId: this.appConfig.defaultCostCenterId() || undefined,
        activityId: this.appConfig.defaultActivityId() || undefined,
      });

      if (glResult) {
        await this.glService.postJournalEntry(
          glResult.lines as Parameters<GlService['postJournalEntry']>[0],
          {
            actor: username || 'system',
            entryDate: new Date().toISOString().slice(0, 10),
            sourceType: glResult.sourceType,
            sourceId: id,
            memo: `Work Order Completion ${wo.orderNumber}`,
          },
          innerTx,
        );
      }

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: id,
        eventType: EventType.STATUS_CHANGED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          orderNumber: wo.orderNumber,
          productId: wo.productId,
          productName: wo.productName,
          completedQuantity: wo.targetQuantity,
          totalCost: totalCostNum.toFixed(2),
        },
      });
    };

    if (tx) {
      await executeComplete(tx);
    } else {
      await this.db.transaction(executeComplete);
    }

    return await this.queryService.findOne(id, tx);
  }

  async cancel(id: string, username?: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

    const executeCancel = async (innerTx: DrizzleDB) => {
      if (wo.stateCode === WORK_ORDER_STATE.IN_PROGRESS) {
        let wipBinId = wo.wipBinId;
        if (!wipBinId) {
          const [wipBin] = await innerTx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, wo.locationId),
                eq(bins.binType, BIN_TYPE.WIP),
              ),
            )
            .limit(1);
          wipBinId = wipBin?.binId;
        }

        const reversalLines: {
          productId: string;
          binId: string;
          quantity: number;
          uomCode: string;
        }[] = [];

        const picks = await innerTx
          .select()
          .from(workOrderPicks)
          .where(
            and(
              eq(workOrderPicks.workOrderId, id),
              eq(workOrderPicks.stateCode, WORK_ORDER_PICK_STATE.PICKED),
            ),
          );

        for (const pick of picks) {
          const comp = wo.components.find(
            (c) => c.workOrderComponentId === pick.workOrderComponentId,
          );
          const pickQty = parseFloat(pick.quantity || '0');
          if (
            pickQty > 0 &&
            pick.binId &&
            wo.wipBinId &&
            pick.binId !== wo.wipBinId &&
            comp
          ) {
            reversalLines.push(
              {
                productId: comp.productId,
                binId: wo.wipBinId,
                quantity: -pickQty,
                uomCode: comp.baseUom || 'EA',
              },
              {
                productId: comp.productId,
                binId: pick.binId,
                quantity: pickQty,
                uomCode: comp.baseUom || 'EA',
              },
            );
          }
        }

        if (reversalLines.length > 0) {
          await this.inventoryMovementService.recordInventoryMovement(innerTx, {
            entryNumber: `WO-RVT-${wo.orderNumber}`,
            sourceType: 'WORK_ORDER',
            sourceId: id,
            memo: `Staged component reversal on Work Order cancellation for ${wo.orderNumber}`,
            userId: username || 'system',
            lines: reversalLines,
          });
        }
      }

      await this.changeWorkOrderState(
        id,
        WORK_ORDER_STATE.CANCELLED,
        username,
        innerTx,
      );

      await this.backordersService.cancelDemandForWorkOrder(
        innerTx,
        id,
        username || 'system',
      );

      await innerTx
        .update(workOrderPicks)
        // eslint-disable-next-line no-restricted-syntax -- Bulk cancelling work order picks on work order cancellation
        .set({ stateCode: WORK_ORDER_PICK_STATE.CANCELLED })
        .where(eq(workOrderPicks.workOrderId, id));

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER_PICK,
        entityId: id,
        eventType: EventType.STATUS_CHANGED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          workOrderId: id,
          orderNumber: wo.orderNumber,
          stateCode: WORK_ORDER_PICK_STATE.CANCELLED,
        },
      });

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: id,
        eventType: EventType.STATUS_CHANGED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          orderNumber: wo.orderNumber,
          productId: wo.productId,
          productName: wo.productName,
        },
      });
    };

    if (tx) {
      await executeCancel(tx);
    } else {
      await this.db.transaction(executeCancel);
    }

    return await this.queryService.findOne(id, tx);
  }
}
