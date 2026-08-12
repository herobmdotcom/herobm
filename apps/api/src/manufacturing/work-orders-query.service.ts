import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  workOrders,
  workOrderComponents,
  workOrderPicks,
  products,
  locations,
  bins,
  binContents,
  zones,
  warehouseEvents,
} from '@herobm/db-schema';
import {
  eq,
  desc,
  gte,
  and,
  aliasedTable,
  sql,
  inArray,
  gt,
} from 'drizzle-orm';
import { PICKABLE_BIN_TYPES } from '../inventory/inventory-math.utils';
import { WORK_ORDER_PICK_STATE } from '@herobm/shared';
import { EntityType } from '../common/event-types';

const outputBins = aliasedTable(bins, 'output_bins');

export interface WorkOrderRow {
  workOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productNumber: string;
  targetQuantity: string;
  completedQuantity: string;
  locationId: string;
  locationName: string;
  wipBinId?: string | null;
  wipBinName?: string | null;
  outputBinId?: string | null;
  outputBinName?: string | null;
  stateCode: string;
  putawayStatus?: string | null;
  totalCost?: string | null;
  createdBy?: string | null;
  createdOn?: string | Date | null;
  modifiedOn?: string | Date | null;
  baseUom?: string | null;
}

@Injectable()
export class WorkOrdersQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(days?: number, tx?: DrizzleDB): Promise<WorkOrderRow[]> {
    const db = tx || this.db;
    const query = db
      .select({
        workOrderId: workOrders.workOrderId,
        orderNumber: workOrders.orderNumber,
        productId: workOrders.productId,
        productName: products.name,
        productNumber: products.productNumber,
        targetQuantity: workOrders.targetQuantity,
        completedQuantity: workOrders.completedQuantity,
        locationId: workOrders.locationId,
        locationName: locations.name,
        wipBinId: workOrders.wipBinId,
        wipBinName: bins.binNumber,
        outputBinId: workOrders.outputBinId,
        outputBinName: outputBins.binNumber,
        stateCode: workOrders.stateCode,
        putawayStatus: workOrders.putawayStatus,
        totalCost: workOrders.totalCost,
        createdBy: workOrders.createdBy,
        createdOn: workOrders.createdOn,
        modifiedOn: workOrders.modifiedOn,
      })
      .from(workOrders)
      .innerJoin(products, eq(workOrders.productId, products.productId))
      .innerJoin(locations, eq(workOrders.locationId, locations.locationId))
      .leftJoin(bins, eq(workOrders.wipBinId, bins.binId))
      .leftJoin(outputBins, eq(workOrders.outputBinId, outputBins.binId))
      .orderBy(desc(workOrders.createdOn));

    if (days && !isNaN(days)) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      return await query.where(gte(workOrders.createdOn, dateLimit));
    }

    return await query;
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const [wo] = await db
      .select({
        workOrderId: workOrders.workOrderId,
        orderNumber: workOrders.orderNumber,
        productId: workOrders.productId,
        productName: products.name,
        productNumber: products.productNumber,
        targetQuantity: workOrders.targetQuantity,
        completedQuantity: workOrders.completedQuantity,
        locationId: workOrders.locationId,
        locationName: locations.name,
        wipBinId: workOrders.wipBinId,
        wipBinName: bins.binNumber,
        outputBinId: workOrders.outputBinId,
        outputBinName: outputBins.binNumber,
        stateCode: workOrders.stateCode,
        putawayStatus: workOrders.putawayStatus,
        totalCost: workOrders.totalCost,
        createdBy: workOrders.createdBy,
        createdOn: workOrders.createdOn,
        modifiedOn: workOrders.modifiedOn,
        baseUom: products.baseUom,
      })
      .from(workOrders)
      .innerJoin(products, eq(workOrders.productId, products.productId))
      .innerJoin(locations, eq(workOrders.locationId, locations.locationId))
      .leftJoin(bins, eq(workOrders.wipBinId, bins.binId))
      .leftJoin(outputBins, eq(workOrders.outputBinId, outputBins.binId))
      .where(eq(workOrders.workOrderId, id));

    if (!wo) {
      throw new NotFoundException(`Work order with ID ${id} not found`);
    }

    const rawComponents = await db
      .select({
        workOrderComponentId: workOrderComponents.workOrderComponentId,
        productId: workOrderComponents.productId,
        productName: products.name,
        productNumber: products.productNumber,
        expectedQuantity: workOrderComponents.expectedQuantity,
        unitCost: workOrderComponents.unitCost,
        baseUom: products.baseUom,
      })
      .from(workOrderComponents)
      .innerJoin(
        products,
        eq(workOrderComponents.productId, products.productId),
      )
      .where(eq(workOrderComponents.workOrderId, id));

    const componentsList = await Promise.all(
      rawComponents.map(async (comp) => {
        const [pickedSum] = await db
          .select({
            sum: sql<number>`COALESCE(SUM(${workOrderPicks.quantity}::numeric), 0)`.mapWith(
              Number,
            ),
          })
          .from(workOrderPicks)
          .where(
            and(
              eq(
                workOrderPicks.workOrderComponentId,
                comp.workOrderComponentId,
              ),
              eq(workOrderPicks.stateCode, WORK_ORDER_PICK_STATE.PICKED),
            ),
          );

        let wipStockOnHand = 0;
        if (wo.wipBinId) {
          const [wipStock] = await db
            .select({
              onHand:
                sql<number>`COALESCE(SUM(${binContents.actualQuantity}::numeric), 0)`.mapWith(
                  Number,
                ),
            })
            .from(binContents)
            .where(
              and(
                eq(binContents.binId, wo.wipBinId),
                eq(binContents.productId, comp.productId),
              ),
            );
          wipStockOnHand = wipStock?.onHand || 0;
        }

        const currentQtyNum = Math.max(pickedSum?.sum || 0, wipStockOnHand);

        return {
          ...comp,
          currentQuantity: currentQtyNum.toString(),
          stagedQuantity: (pickedSum?.sum || 0).toString(),
          wipBinQuantity: wipStockOnHand.toString(),
        };
      }),
    );

    const eventsList = await db
      .select({
        eventId: warehouseEvents.eventId,
        eventType: warehouseEvents.eventType,
        payload: warehouseEvents.payload,
        actor: warehouseEvents.actor,
        createdOn: warehouseEvents.createdOn,
      })
      .from(warehouseEvents)
      .where(
        and(
          eq(warehouseEvents.entityType, EntityType.WORK_ORDER),
          eq(warehouseEvents.entityId, id),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return {
      ...wo,
      components: componentsList,
      events: eventsList,
    };
  }

  async getPickingSummary(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    const pickableBinCondition = inArray(bins.binType, [...PICKABLE_BIN_TYPES]);

    const lines = await Promise.all(
      wo.components.map(async (comp, idx) => {
        const requiredQty = parseFloat(comp.expectedQuantity || '0');

        const [pickedSum] = await db
          .select({
            sum: sql<number>`COALESCE(SUM(quantity), 0)`.mapWith(Number),
          })
          .from(workOrderPicks)
          .where(
            and(
              eq(
                workOrderPicks.workOrderComponentId,
                comp.workOrderComponentId,
              ),
              eq(workOrderPicks.stateCode, WORK_ORDER_PICK_STATE.PICKED),
            ),
          );

        const qtyPicked = pickedSum?.sum || 0;
        const remaining = Math.max(0, requiredQty - qtyPicked);

        const availableBins = await db
          .select({
            binId: bins.binId,
            binName: bins.binNumber,
            onHand: binContents.actualQuantity,
          })
          .from(binContents)
          .innerJoin(bins, eq(binContents.binId, bins.binId))
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(zones.locationId, wo.locationId),
              eq(binContents.productId, comp.productId),
              eq(bins.isUnavailable, false),
              pickableBinCondition,
              gt(binContents.actualQuantity, '0'),
            ),
          )
          .orderBy(desc(binContents.actualQuantity));

        const totalOnHand = availableBins.reduce(
          (acc, b) => acc + parseFloat(b.onHand || '0'),
          0,
        );

        return {
          salesOrderLineId: comp.workOrderComponentId,
          lineNumber: idx + 1,
          productId: comp.productId,
          productNumber: comp.productNumber,
          productType: 'inventory',
          productDescription: comp.productName,
          locationName: wo.locationName,
          quantity: comp.expectedQuantity,
          quantityPicked: qtyPicked.toString(),
          quantityShipped: '0',
          remaining: remaining.toString(),
          isFullyPicked: remaining <= 0,
          isPhysical: true,
          onHand: totalOnHand.toString(),
          availableBins,
        };
      }),
    );

    const picks = await db
      .select({
        pickId: workOrderPicks.pickId,
        salesOrderId: workOrderPicks.workOrderId,
        salesOrderLineId: workOrderPicks.workOrderComponentId,
        productId: workOrderComponents.productId,
        binId: workOrderPicks.binId,
        quantity: workOrderPicks.quantity,
        stateCode: workOrderPicks.stateCode,
        binName: bins.binNumber,
      })
      .from(workOrderPicks)
      .innerJoin(
        workOrderComponents,
        eq(
          workOrderPicks.workOrderComponentId,
          workOrderComponents.workOrderComponentId,
        ),
      )
      .leftJoin(bins, eq(workOrderPicks.binId, bins.binId))
      .where(eq(workOrderPicks.workOrderId, id));

    const totalLines = lines.length;
    const fullyPickedLines = lines.filter((l) => l.isFullyPicked).length;
    const isFullyPicked = totalLines > 0 && fullyPickedLines === totalLines;

    return {
      totalLines,
      fullyPickedLines,
      isFullyPicked,
      lines,
      picks,
    };
  }
}
