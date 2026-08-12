import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
  productDefaultBins,
  zones,
  productComponents,
  backorders,
  warehouseEvents,
} from '@herobm/db-schema';
import { eq, desc, gte, and, aliasedTable, sql } from 'drizzle-orm';
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
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import {
  UpdateWorkOrderDto,
  UpdateWorkOrderComponentDto,
} from './dto/update-work-order.dto';

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
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  private generateWorkOrderNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WO-${today}-${rand}`;
  }

  async changeWorkOrderState(
    id: string,
    newState: WorkOrderState,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    const allowedNext = WORK_ORDER_TRANSITIONS[wo.stateCode] || [];
    if (!allowedNext.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition Work Order from state '${wo.stateCode}' to '${newState}'`,
      );
    }

    await db
      .update(workOrders)
      // eslint-disable-next-line no-restricted-syntax -- Helper method changeWorkOrderState
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

    return await this.findOne(id, db);
  }

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

    const componentsList = await db
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

  async create(dto: CreateWorkOrderDto, username?: string, tx?: DrizzleDB) {
    const db = tx || this.db;

    // Validate output product exists
    const [product] = await db
      .select({ productId: products.productId, name: products.name })
      .from(products)
      .where(eq(products.productId, dto.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    // Validate location exists
    const [location] = await db
      .select({ locationId: locations.locationId, name: locations.name })
      .from(locations)
      .where(eq(locations.locationId, dto.locationId))
      .limit(1);

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found`,
      );
    }

    // Validate WIP Bin if specified
    if (dto.wipBinId) {
      const [bin] = await db
        .select({
          binId: bins.binId,
          binType: bins.binType,
          isUnavailable: bins.isUnavailable,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.wipBinId))
        .limit(1);

      if (!bin) {
        throw new NotFoundException(
          `WIP Bin with ID ${dto.wipBinId} not found`,
        );
      }

      if (bin.locationId !== dto.locationId) {
        throw new BadRequestException(
          `Selected WIP bin does not belong to location ${dto.locationId}`,
        );
      }

      if (bin.isUnavailable) {
        throw new BadRequestException(
          `Selected WIP bin is currently unavailable`,
        );
      }

      if (bin.binType === 'quarantine') {
        throw new BadRequestException(
          `Quarantine bins cannot be used as WIP staging bins`,
        );
      }
    }

    // Validate Output Bin if specified
    if (dto.outputBinId) {
      const [bin] = await db
        .select({
          binId: bins.binId,
          binType: bins.binType,
          isUnavailable: bins.isUnavailable,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.outputBinId))
        .limit(1);

      if (!bin) {
        throw new NotFoundException(
          `Output Bin with ID ${dto.outputBinId} not found`,
        );
      }

      if (bin.locationId !== dto.locationId) {
        throw new BadRequestException(
          `Selected Output bin does not belong to location ${dto.locationId}`,
        );
      }

      if (bin.isUnavailable) {
        throw new BadRequestException(
          `Selected Output bin is currently unavailable`,
        );
      }

      if (bin.binType === 'quarantine') {
        throw new BadRequestException(
          `Quarantine bins cannot be used as Output bins`,
        );
      }
    }

    const orderNumber =
      dto.orderNumber?.trim() || this.generateWorkOrderNumber();

    const executeCreate = async (innerTx: DrizzleDB) => {
      const [newWo] = await innerTx
        .insert(workOrders)
        .values({
          orderNumber,
          productId: dto.productId,
          targetQuantity: dto.targetQuantity.toString(),
          completedQuantity: '0',
          locationId: dto.locationId,
          wipBinId: dto.wipBinId || null,
          outputBinId: dto.outputBinId || null,
          stateCode: WORK_ORDER_STATE.DRAFT,
          totalCost: '0',
          createdBy: username || null,
        })
        .returning();

      // Components handling
      if (dto.components && dto.components.length > 0) {
        for (const comp of dto.components) {
          await innerTx.insert(workOrderComponents).values({
            workOrderId: newWo.workOrderId,
            productId: comp.productId,
            expectedQuantity: comp.expectedQuantity.toString(),
            unitCost: comp.unitCost ? comp.unitCost.toString() : null,
          });
        }
      } else {
        // Look up BOM components if no explicit components provided
        const bomComponents = await innerTx
          .select({
            childProductId: productComponents.childProductId,
            quantity: productComponents.quantity,
          })
          .from(productComponents)
          .where(eq(productComponents.parentProductId, dto.productId));

        const targetQtyNum = parseFloat(dto.targetQuantity) || 1;

        for (const comp of bomComponents) {
          const compQtyNum = parseFloat(comp.quantity || '0');
          const expectedQuantity = (compQtyNum * targetQtyNum).toString();
          await innerTx.insert(workOrderComponents).values({
            workOrderId: newWo.workOrderId,
            productId: comp.childProductId,
            expectedQuantity,
          });
        }
      }

      await this.recalculateTotalCost(newWo.workOrderId, innerTx);

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: newWo.workOrderId,
        eventType: EventType.CREATED,
        actor: username || 'system',
        entityDisplayName: orderNumber,
        payload: {
          orderNumber,
          productId: dto.productId,
          productName: product.name,
          targetQuantity: dto.targetQuantity,
          locationId: dto.locationId,
          locationName: location.name,
        },
      });

      return newWo.workOrderId;
    };

    const newWorkOrderId = tx
      ? await executeCreate(tx)
      : await this.db.transaction(executeCreate);

    return await this.findOne(newWorkOrderId, tx);
  }

  private async recalculateTotalCost(workOrderId: string, tx: DrizzleDB) {
    const componentsList = await tx
      .select({
        expectedQuantity: workOrderComponents.expectedQuantity,
        unitCost: workOrderComponents.unitCost,
      })
      .from(workOrderComponents)
      .where(eq(workOrderComponents.workOrderId, workOrderId));

    let totalCostNum = 0;
    for (const comp of componentsList) {
      const qty = parseFloat(comp.expectedQuantity || '0');
      const cost = comp.unitCost ? parseFloat(comp.unitCost) : 0;
      totalCostNum += qty * cost;
    }

    await tx
      .update(workOrders)
      .set({ totalCost: totalCostNum.toFixed(2) })
      .where(eq(workOrders.workOrderId, workOrderId));
  }

  async update(
    id: string,
    dto: UpdateWorkOrderDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    if (wo.stateCode !== WORK_ORDER_STATE.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT work orders can be edited. Current state: ${wo.stateCode}`,
      );
    }

    if (dto.locationId) {
      const [location] = await db
        .select({ locationId: locations.locationId })
        .from(locations)
        .where(eq(locations.locationId, dto.locationId))
        .limit(1);

      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.locationId} not found`,
        );
      }
    }

    if (dto.wipBinId) {
      const targetLocationId = dto.locationId || wo.locationId;
      const [bin] = await db
        .select({
          binId: bins.binId,
          binType: bins.binType,
          isUnavailable: bins.isUnavailable,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.wipBinId))
        .limit(1);

      if (!bin) {
        throw new NotFoundException(
          `WIP Bin with ID ${dto.wipBinId} not found`,
        );
      }

      if (bin.locationId !== targetLocationId) {
        throw new BadRequestException(
          `Selected WIP bin does not belong to work order location ${targetLocationId}`,
        );
      }

      if (bin.isUnavailable) {
        throw new BadRequestException(
          `Selected WIP bin is currently unavailable`,
        );
      }

      if (bin.binType === 'quarantine') {
        throw new BadRequestException(
          `Quarantine bins cannot be used as WIP staging bins`,
        );
      }
    }

    if (dto.outputBinId) {
      const targetLocationId = dto.locationId || wo.locationId;
      const [bin] = await db
        .select({
          binId: bins.binId,
          binType: bins.binType,
          isUnavailable: bins.isUnavailable,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.outputBinId))
        .limit(1);

      if (!bin) {
        throw new NotFoundException(
          `Output Bin with ID ${dto.outputBinId} not found`,
        );
      }

      if (bin.locationId !== targetLocationId) {
        throw new BadRequestException(
          `Selected Output bin does not belong to work order location ${targetLocationId}`,
        );
      }

      if (bin.isUnavailable) {
        throw new BadRequestException(
          `Selected Output bin is currently unavailable`,
        );
      }

      if (bin.binType === 'quarantine') {
        throw new BadRequestException(
          `Quarantine bins cannot be used as Output bins`,
        );
      }
    }

    const executeUpdate = async (innerTx: DrizzleDB) => {
      // Scale components if target quantity changes
      if (dto.targetQuantity && dto.targetQuantity !== wo.targetQuantity) {
        const oldTarget = parseFloat(wo.targetQuantity) || 1;
        const newTarget = parseFloat(dto.targetQuantity) || 1;
        const ratio = newTarget / oldTarget;

        for (const comp of wo.components) {
          const expectedQty = parseFloat(comp.expectedQuantity || '0');
          const newExpectedQty = (expectedQty * ratio).toString();

          await innerTx
            .update(workOrderComponents)
            .set({ expectedQuantity: newExpectedQty })
            .where(
              eq(
                workOrderComponents.workOrderComponentId,
                comp.workOrderComponentId,
              ),
            );
        }
      }

      const updateData: Record<string, unknown> = { modifiedOn: new Date() };
      if (dto.targetQuantity !== undefined)
        updateData.targetQuantity = dto.targetQuantity.toString();
      if (dto.locationId !== undefined) updateData.locationId = dto.locationId;
      if (dto.wipBinId !== undefined) updateData.wipBinId = dto.wipBinId;
      if (dto.outputBinId !== undefined)
        updateData.outputBinId = dto.outputBinId;

      await innerTx
        .update(workOrders)
        // eslint-disable-next-line no-restricted-syntax -- Helper method update
        .set(updateData)
        .where(eq(workOrders.workOrderId, id));

      await this.recalculateTotalCost(id, innerTx);

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: id,
        eventType: EventType.UPDATED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          orderNumber: wo.orderNumber,
          productId: wo.productId,
          productName: wo.productName,
          ...dto,
        },
      });
    };

    if (tx) {
      await executeUpdate(tx);
    } else {
      await this.db.transaction(executeUpdate);
    }

    return await this.findOne(id, tx);
  }

  async updateComponent(
    workOrderId: string,
    componentId: string,
    dto: UpdateWorkOrderComponentDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.findOne(workOrderId, db);

    if (wo.stateCode !== WORK_ORDER_STATE.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT work orders can be edited. Current state: ${wo.stateCode}`,
      );
    }

    const component = wo.components.find(
      (c) => c.workOrderComponentId === componentId,
    );
    if (!component) {
      throw new NotFoundException(
        `Component ${componentId} not found on Work Order ${workOrderId}`,
      );
    }

    const executeUpdate = async (innerTx: DrizzleDB) => {
      const updateData: Record<string, unknown> = {};
      if (dto.unitCost !== undefined) updateData.unitCost = dto.unitCost;

      await innerTx
        .update(workOrderComponents)
        .set(updateData)
        .where(eq(workOrderComponents.workOrderComponentId, componentId));

      await this.recalculateTotalCost(workOrderId, innerTx);

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: workOrderId,
        eventType: EventType.UPDATED,
        actor: username || 'system',
        entityDisplayName: `Updated component ${component.productNumber} unit cost`,
        payload: {
          componentId,
          ...dto,
        },
      });
    };

    if (tx) {
      await executeUpdate(tx);
    } else {
      await this.db.transaction(executeUpdate);
    }

    return await this.findOne(workOrderId, tx);
  }

  async release(id: string, username?: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    const executeRelease = async (innerTx: DrizzleDB) => {
      await this.changeWorkOrderState(
        id,
        WORK_ORDER_STATE.IN_PROGRESS,
        username,
        innerTx,
      );

      for (const comp of wo.components) {
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

    return await this.findOne(id, tx);
  }

  async completeBuild(
    id: string,
    outputBinId?: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    let totalCostNum = 0;
    for (const comp of wo.components) {
      const qty = parseFloat(comp.expectedQuantity || '0');
      const cost = comp.unitCost ? parseFloat(comp.unitCost) : 0;
      totalCostNum += qty * cost;
    }

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
        // eslint-disable-next-line no-restricted-syntax -- Pick item status update
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

      // Record physical inventory movements (Output Credit & Component Consumption)
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

    return await this.findOne(id, tx);
  }

  async putawayFinishedGoods(
    id: string,
    targetBinId?: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    if (wo.stateCode !== WORK_ORDER_STATE.COMPLETED) {
      throw new BadRequestException(
        `Work order must be COMPLETED before putaway into warehouse bin. Current state: ${wo.stateCode}`,
      );
    }

    const executePutaway = async (innerTx: DrizzleDB) => {
      const linkedBackorders = await innerTx
        .select({ backorderId: backorders.backorderId })
        .from(backorders)
        .where(eq(backorders.workOrderId, id));

      for (const bo of linkedBackorders) {
        await innerTx
          .update(backorders)
          .set({
            // eslint-disable-next-line no-restricted-syntax -- Fulfill backorder
            stateCode: BACKORDER_STATE.FULFILLED,
            modifiedOn: new Date(),
          })
          .where(eq(backorders.backorderId, bo.backorderId));
      }

      let sourceBinId = wo.outputBinId || wo.wipBinId;
      if (!sourceBinId) {
        const [defaultBin] = await innerTx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(zones.locationId, wo.locationId))
          .limit(1);
        sourceBinId = defaultBin?.binId;
      }

      let finalBinId = targetBinId;
      if (!finalBinId) {
        const [defaultBin] = await innerTx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(zones.locationId, wo.locationId))
          .limit(1);
        finalBinId = defaultBin?.binId;
      }

      if (!sourceBinId || !finalBinId) {
        throw new BadRequestException(
          `Source and target bins must exist for finished goods putaway at location ${wo.locationId}`,
        );
      }

      const putawayLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];

      if (sourceBinId !== finalBinId) {
        const putawayQty = parseFloat(wo.targetQuantity || '0');
        putawayLines.push(
          {
            productId: wo.productId,
            binId: sourceBinId,
            quantity: -putawayQty,
            uomCode: wo.baseUom || 'EA',
          },
          {
            productId: wo.productId,
            binId: finalBinId,
            quantity: putawayQty,
            uomCode: wo.baseUom || 'EA',
          },
        );
      }

      if (putawayLines.length > 0) {
        await this.inventoryMovementService.recordInventoryMovement(innerTx, {
          entryNumber: `WO-PUT-${wo.orderNumber}`,
          sourceType: 'WORK_ORDER',
          sourceId: id,
          memo: `Finished goods putaway into warehouse bin for ${wo.orderNumber}`,
          userId: username || 'system',
          lines: putawayLines,
        });
      }

      await innerTx
        .update(workOrders)
        .set({
          putawayStatus: PUTAWAY_STATUS.COMPLETED,
          modifiedOn: new Date(),
        })
        .where(eq(workOrders.workOrderId, id));

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER,
        entityId: id,
        eventType: EventType.PUTAWAY_COMPLETED,
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
      await executePutaway(tx);
    } else {
      await this.db.transaction(executePutaway);
    }

    return await this.findOne(id, tx);
  }

  async cancel(id: string, username?: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const wo = await this.findOne(id, db);

    const executeCancel = async (innerTx: DrizzleDB) => {
      await this.changeWorkOrderState(
        id,
        WORK_ORDER_STATE.CANCELLED,
        username,
        innerTx,
      );

      await innerTx
        .update(workOrderPicks)
        // eslint-disable-next-line no-restricted-syntax -- Pick item status update
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

    return await this.findOne(id, tx);
  }
}
