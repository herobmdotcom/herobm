import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  workOrders,
  workOrderPicks,
  bins,
  binContents,
  zones,
  backorders,
} from '@herobm/db-schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { isPickableBinCondition } from '../inventory/inventory-math.utils';
import {
  WORK_ORDER_STATE,
  WORK_ORDER_TRANSITIONS,
  WORK_ORDER_PICK_STATE,
  BACKORDER_STATE,
  PUTAWAY_STATUS,
  BIN_TYPE,
  type WorkOrderState,
} from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { WorkOrdersQueryService } from './work-orders-query.service';

@Injectable()
export class WorkOrdersExecutionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly queryService: WorkOrdersQueryService,
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
          await innerTx.insert(backorders).values({
            demandWorkOrderId: id,
            workOrderComponentId: comp.workOrderComponentId,
            productId: comp.productId,
            quantity: shortfall.toString(),
            stateCode: BACKORDER_STATE.PENDING_SUPPLY,
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

    let componentsCost = 0;
    for (const comp of wo.components) {
      const qty = parseFloat(comp.expectedQuantity || '0');
      const cost = comp.unitCost ? parseFloat(comp.unitCost) : 0;
      componentsCost += qty * cost;
    }

    const targetQty = parseFloat(wo.targetQuantity || '0') || 0;
    const unitAssemblyCost = wo.assemblyCostPerUnit
      ? parseFloat(wo.assemblyCostPerUnit)
      : 0;
    const assemblyTotal = unitAssemblyCost * targetQty;
    const additionalCost = wo.additionalCost
      ? parseFloat(wo.additionalCost)
      : 0;

    const totalCostNum = componentsCost + assemblyTotal + additionalCost;

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

      const movementLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [
        {
          productId: wo.productId,
          binId: buildOutputBinId,
          quantity: parseFloat(wo.targetQuantity || '0'),
          uomCode: wo.baseUom || 'EA',
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

      await innerTx
        .update(backorders)
        // eslint-disable-next-line no-restricted-syntax -- Bulk cancelling backorders on work order cancellation
        .set({ stateCode: BACKORDER_STATE.CANCELLED })
        .where(eq(backorders.demandWorkOrderId, id));

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
