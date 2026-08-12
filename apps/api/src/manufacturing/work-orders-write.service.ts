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
  zones,
  productComponents,
} from '@herobm/db-schema';
import { eq, and } from 'drizzle-orm';
import { WORK_ORDER_STATE, WORK_ORDER_PICK_STATE } from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { InventoryMovementService } from '../inventory/inventory-movement.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import {
  UpdateWorkOrderDto,
  UpdateWorkOrderComponentDto,
} from './dto/update-work-order.dto';
import { WorkOrdersQueryService } from './work-orders-query.service';

@Injectable()
export class WorkOrdersWriteService {
  private readonly logger = new Logger(WorkOrdersWriteService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly queryService: WorkOrdersQueryService,
  ) {}

  private generateWorkOrderNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WO-${today}-${rand}`;
  }

  async validateBinSelection(
    db: DrizzleDB,
    binId: string,
    locationId: string,
    binRoleName: string,
  ) {
    const [bin] = await db
      .select({
        binId: bins.binId,
        binType: bins.binType,
        isUnavailable: bins.isUnavailable,
        locationId: zones.locationId,
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(eq(bins.binId, binId))
      .limit(1);

    if (!bin) {
      throw new NotFoundException(
        `${binRoleName} Bin with ID ${binId} not found`,
      );
    }
    if (bin.locationId !== locationId) {
      throw new BadRequestException(
        `Selected ${binRoleName} bin does not belong to location ${locationId}`,
      );
    }
    if (bin.isUnavailable) {
      throw new BadRequestException(
        `Selected ${binRoleName} bin is currently unavailable`,
      );
    }
    if (bin.binType === 'quarantine') {
      throw new BadRequestException(
        `Quarantine bins cannot be used as ${binRoleName} bins`,
      );
    }
  }

  async recalculateTotalCost(workOrderId: string, tx: DrizzleDB) {
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

  async create(dto: CreateWorkOrderDto, username?: string, tx?: DrizzleDB) {
    const db = tx || this.db;

    const [product] = await db
      .select({ productId: products.productId, name: products.name })
      .from(products)
      .where(eq(products.productId, dto.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

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

    if (dto.wipBinId) {
      await this.validateBinSelection(db, dto.wipBinId, dto.locationId, 'WIP');
    }

    if (dto.outputBinId) {
      await this.validateBinSelection(
        db,
        dto.outputBinId,
        dto.locationId,
        'Output',
      );
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

    return await this.queryService.findOne(newWorkOrderId, tx);
  }

  async update(
    id: string,
    dto: UpdateWorkOrderDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

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
      await this.validateBinSelection(
        db,
        dto.wipBinId,
        targetLocationId,
        'WIP',
      );
    }

    if (dto.outputBinId) {
      const targetLocationId = dto.locationId || wo.locationId;
      await this.validateBinSelection(
        db,
        dto.outputBinId,
        targetLocationId,
        'Output',
      );
    }

    const executeUpdate = async (innerTx: DrizzleDB) => {
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

    return await this.queryService.findOne(id, tx);
  }

  async updateComponent(
    workOrderId: string,
    componentId: string,
    dto: UpdateWorkOrderComponentDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(workOrderId, db);

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

    return await this.queryService.findOne(workOrderId, tx);
  }

  async pickComponent(
    id: string,
    componentId: string,
    binId: string,
    quantity: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

    if (wo.stateCode !== WORK_ORDER_STATE.IN_PROGRESS) {
      throw new BadRequestException(
        `Work order must be IN_PROGRESS to pick components. Current state: ${wo.stateCode}`,
      );
    }

    const comp = wo.components.find(
      (c) => c.workOrderComponentId === componentId,
    );
    if (!comp) {
      throw new NotFoundException(
        `Work Order Component ${componentId} not found on Work Order ${id}`,
      );
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestException('Picked quantity must be greater than 0');
    }

    if (!wo.wipBinId) {
      throw new BadRequestException(
        'WIP Bin must be assigned to pick components',
      );
    }

    if (binId === wo.wipBinId) {
      throw new BadRequestException('Cannot pick from the WIP bin itself.');
    }

    const executePick = async (innerTx: DrizzleDB) => {
      await this.inventoryMovementService.recordInventoryMovement(innerTx, {
        entryNumber: `WO-STG-${wo.orderNumber}-${comp.workOrderComponentId.slice(0, 6)}-${Date.now().toString().slice(-4)}`,
        sourceType: 'WORK_ORDER',
        sourceId: id,
        memo: `Component staging pick into WIP bin for ${wo.orderNumber}`,
        userId: username || 'system',
        lines: [
          {
            productId: comp.productId,
            binId,
            quantity: -qty,
            uomCode: comp.baseUom || 'EA',
          },
          {
            productId: comp.productId,
            binId: wo.wipBinId!,
            quantity: qty,
            uomCode: comp.baseUom || 'EA',
          },
        ],
      });

      const [pickBin] = await innerTx
        .select({ binNumber: bins.binNumber })
        .from(bins)
        .where(eq(bins.binId, binId))
        .limit(1);

      const [pick] = await innerTx
        .insert(workOrderPicks)
        .values({
          workOrderId: id,
          workOrderComponentId: comp.workOrderComponentId,
          binId,
          quantity: quantity,
          stateCode: WORK_ORDER_PICK_STATE.PICKED,
          createdBy: username || null,
        })
        .returning();

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER_PICK,
        entityId: pick.pickId,
        eventType: EventType.STATUS_CHANGED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          workOrderId: id,
          orderNumber: wo.orderNumber,
          productId: comp.productId,
          productName: comp.productName,
          binId,
          binName: pickBin?.binNumber,
          binNumber: pickBin?.binNumber,
          quantity: quantity,
          stateCode: WORK_ORDER_PICK_STATE.PICKED,
        },
      });

      return pick;
    };

    if (tx) {
      await executePick(tx);
    } else {
      await this.db.transaction(executePick);
    }

    return await this.queryService.getPickingSummary(id, tx);
  }

  async cancelComponentPick(
    id: string,
    pickId: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const wo = await this.queryService.findOne(id, db);

    const executeCancel = async (innerTx: DrizzleDB) => {
      const [pick] = await innerTx
        .select()
        .from(workOrderPicks)
        .where(
          and(
            eq(workOrderPicks.pickId, pickId),
            eq(workOrderPicks.workOrderId, id),
          ),
        )
        .limit(1);

      if (!pick) {
        throw new NotFoundException(
          `Pick ${pickId} not found on Work Order ${id}`,
        );
      }

      if (pick.stateCode === WORK_ORDER_PICK_STATE.CANCELLED) {
        return;
      }

      const comp = wo.components.find(
        (c) => c.workOrderComponentId === pick.workOrderComponentId,
      );

      const pickQty = parseFloat(pick.quantity || '0');

      const reversalLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];

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

      if (reversalLines.length > 0) {
        await this.inventoryMovementService.recordInventoryMovement(innerTx, {
          entryNumber: `WO-RVT-${wo.orderNumber}-${pickId.slice(0, 6)}-${Date.now().toString().slice(-4)}`,
          sourceType: 'WORK_ORDER',
          sourceId: id,
          memo: `Component pick cancellation reversal for ${wo.orderNumber}`,
          userId: username || 'system',
          lines: reversalLines,
        });
      }

      await innerTx
        .update(workOrderPicks)
        .set({
          // eslint-disable-next-line no-restricted-syntax -- Updating work order pick state on cancellation
          stateCode: WORK_ORDER_PICK_STATE.CANCELLED,
          modifiedOn: new Date(),
        })
        .where(eq(workOrderPicks.pickId, pickId));

      await emitEvent(innerTx, {
        entityType: EntityType.WORK_ORDER_PICK,
        entityId: pickId,
        eventType: EventType.PICK_CANCELLED,
        actor: username || 'system',
        entityDisplayName: wo.orderNumber,
        payload: {
          workOrderId: id,
          orderNumber: wo.orderNumber,
          pickId,
          stateCode: WORK_ORDER_PICK_STATE.CANCELLED,
        },
      });
    };

    if (tx) {
      await executeCancel(tx);
    } else {
      await this.db.transaction(executeCancel);
    }

    return await this.queryService.getPickingSummary(id, tx);
  }
}
