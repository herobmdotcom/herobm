import { isPickableBinCondition } from '../../inventory/inventory-math.utils';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  locations,
  bins,
  zones,
  binContents,
  products,
  products as coreProducts,
  projects,
} from '@herobm/db-schema';
import { eq, and, inArray } from 'drizzle-orm';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import {
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_PICK_STATE,
  TRANSFER_ORDER_PICK_TRANSITIONS,
} from '@herobm/shared';
import type { TransferOrderPickState } from '@herobm/shared';
import { v4 as uuidv4 } from 'uuid';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { changeTransferOrderState } from './transfer-state.helper';

@Injectable()
export class TransfersPickingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  async getPickingSummary(transferOrderId: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const order = await db.query.transferOrders.findFirst({
      where: eq(transferOrders.transferOrderId, transferOrderId),
    });

    if (!order) {
      throw new NotFoundException('Transfer Order not found');
    }

    const sourceLoc = await db.query.locations.findFirst({
      where: eq(locations.locationId, order.sourceLocationId),
    });

    const lines = await db
      .select({
        transferOrderLineId: transferOrderLines.transferOrderLineId,
        salesOrderLineId: transferOrderLines.transferOrderLineId,
        productId: transferOrderLines.productId,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
        quantityShipped: transferOrderLines.quantityShipped,
      })
      .from(transferOrderLines)
      .innerJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(eq(transferOrderLines.transferOrderId, transferOrderId));

    const picks = await db
      .select({
        pickId: transferOrderPicks.pickId,
        transferOrderId: transferOrderPicks.transferOrderId,
        transferOrderLineId: transferOrderPicks.transferOrderLineId,
        salesOrderLineId: transferOrderPicks.transferOrderLineId,
        productId: transferOrderPicks.productId,
        binId: transferOrderPicks.binId,
        binName: bins.binNumber,
        quantity: transferOrderPicks.quantity,
        stateCode: transferOrderPicks.stateCode,
      })
      .from(transferOrderPicks)
      .leftJoin(bins, eq(transferOrderPicks.binId, bins.binId))
      .where(eq(transferOrderPicks.transferOrderId, transferOrderId));

    let projectStagingBin: { binId: string; binName: string } | null = null;
    if (order.projectId && order.isProjectReturn) {
      const [proj] = await db
        .select({
          stagingBinId: projects.stagingBinId,
          binNumber: bins.binNumber,
        })
        .from(projects)
        .leftJoin(bins, eq(projects.stagingBinId, bins.binId))
        .where(eq(projects.projectId, order.projectId))
        .limit(1);

      if (proj?.stagingBinId) {
        projectStagingBin = {
          binId: proj.stagingBinId,
          binName: proj.binNumber || 'STAGING',
        };
      }
    }

    const productIds = Array.from(
      new Set(
        lines
          .map((l: Record<string, unknown>) => l.productId)
          .filter(Boolean) as string[],
      ),
    );

    let binStock: {
      productId: string;
      binId: string;
      binName: string;
      onHand: string;
    }[] = [];

    if (productIds.length > 0) {
      if (projectStagingBin) {
        // For project returns, the pick origin is strictly the project's staging bin
        const stagingStock = await db
          .select({
            productId: binContents.productId,
            binId: bins.binId,
            binName: bins.binNumber,
            onHand: binContents.actualQuantity,
          })
          .from(binContents)
          .innerJoin(bins, eq(binContents.binId, bins.binId))
          .where(
            and(
              inArray(binContents.productId, productIds),
              eq(binContents.binId, projectStagingBin.binId),
            ),
          );

        const foundProductIds = new Set(stagingStock.map((s) => s.productId));
        binStock = [...stagingStock];

        for (const line of lines as Record<string, unknown>[]) {
          const prodId = line.productId as string;
          if (prodId && !foundProductIds.has(prodId)) {
            binStock.push({
              productId: prodId,
              binId: projectStagingBin.binId,
              binName: projectStagingBin.binName,
              onHand: (line.quantity as string) || '0',
            });
            foundProductIds.add(prodId);
          }
        }
      } else {
        // Standard transfer order: query pickable warehouse bins
        binStock = await db
          .select({
            productId: binContents.productId,
            binId: bins.binId,
            binName: bins.binNumber,
            onHand: binContents.actualQuantity,
          })
          .from(binContents)
          .innerJoin(bins, eq(binContents.binId, bins.binId))
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              inArray(binContents.productId, productIds),
              eq(zones.locationId, order.sourceLocationId),
              isPickableBinCondition(bins),
            ),
          );
      }
    }

    const enrichedLines = lines.map((line: Record<string, unknown>) => {
      const linePicks = picks.filter(
        (p: Record<string, unknown>) =>
          p.transferOrderLineId === line.transferOrderLineId &&
          p.stateCode !== TRANSFER_ORDER_PICK_STATE.CANCELLED,
      );
      const pickedQty = linePicks.reduce(
        (acc: number, p: Record<string, unknown>) =>
          acc + parseFloat(p.quantity as string),
        0,
      );
      const orderedQty = parseFloat(line.quantity as string);
      const remaining = orderedQty - pickedQty;

      let availableBins: Record<string, unknown>[] = [];
      let totalOnHand = 0;

      if (line.productType === 'inventory') {
        availableBins = binStock
          .filter(
            (b: Record<string, unknown>) => b.productId === line.productId,
          )
          .map((b: Record<string, unknown>) => ({
            binId: b.binId,
            binName: b.binName,
            onHand: b.onHand,
          }));

        totalOnHand = availableBins.reduce(
          (acc: number, b: Record<string, unknown>) =>
            acc + parseFloat(b.onHand as string),
          0,
        );
      }

      return {
        ...line,
        locationName: sourceLoc?.name || 'Unknown',
        availableBins,
        quantityPicked: pickedQty.toString(),
        remaining: remaining.toString(),
        isFullyPicked: remaining <= 0,
        isPhysical: line.productType === 'inventory',
        onHand: totalOnHand.toString(),
        hasAllocation: false,
      };
    });

    const filteredLines = enrichedLines.filter(
      (l: Record<string, unknown>) => parseFloat(l.quantity as string) > 0,
    );
    const activePhysicalLines = filteredLines.filter(
      (l: Record<string, unknown>) => l.isPhysical,
    );
    const totalLines = activePhysicalLines.length;
    const fullyPickedLines = activePhysicalLines.filter(
      (l: Record<string, unknown>) => l.isFullyPicked,
    ).length;
    const isFullyPicked = totalLines > 0 && totalLines === fullyPickedLines;

    return {
      totalLines,
      fullyPickedLines,
      isFullyPicked,
      lines: filteredLines,
      picks,
    };
  }

  async pickLine(
    transferOrderId: string,
    lineId: string,
    binId: string,
    quantity: number,
    actor: string,
  ) {
    const line = await this.db.query.transferOrderLines.findFirst({
      where: eq(transferOrderLines.transferOrderLineId, lineId),
    });

    if (!line || line.transferOrderId !== transferOrderId) {
      throw new BadRequestException('Invalid line for this transfer order');
    }

    const order = await this.db.query.transferOrders.findFirst({
      where: eq(transferOrders.transferOrderId, transferOrderId),
    });

    if (!order) {
      throw new NotFoundException('Transfer Order not found');
    }

    let projectStagingBinId: string | null = null;
    if (order.projectId && order.isProjectReturn) {
      const project = await this.db.query.projects.findFirst({
        where: eq(projects.projectId, order.projectId),
      });
      projectStagingBinId = project?.stagingBinId || null;
    }

    if (projectStagingBinId && order.isProjectReturn) {
      if (binId !== projectStagingBinId) {
        throw new BadRequestException(
          'Project return must be picked from the project staging bin',
        );
      }
    } else {
      const rawBins = await this.db
        .select({
          binId: bins.binId,
          onHand: binContents.actualQuantity,
        })
        .from(binContents)
        .innerJoin(bins, eq(binContents.binId, bins.binId))
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(binContents.productId, line.productId),
            eq(zones.locationId, order.sourceLocationId),
            isPickableBinCondition(bins),
          ),
        );

      const bin = rawBins.find(
        (b: Record<string, unknown>) => b.binId === binId,
      );
      if (!bin) {
        throw new BadRequestException('Bin not found or not pickable');
      }

      if (parseFloat(bin.onHand) < quantity) {
        throw new BadRequestException('Insufficient stock in selected bin');
      }
    }

    const [shippingBin] = await this.db
      .select({ binId: bins.binId })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(bins.binNumber, 'SHIPPING'),
          eq(zones.locationId, order.sourceLocationId),
        ),
      )
      .limit(1);

    if (!shippingBin) {
      throw new BadRequestException(
        `No SHIPPING staging bin found for location ${order.sourceLocationId}.`,
      );
    }

    if (binId === shippingBin.binId) {
      throw new BadRequestException(
        'Cannot pick from the SHIPPING bin. Stock is already staged for dispatch.',
      );
    }

    return await this.db.transaction(async (tx) => {
      const [prod] = await tx
        .select({
          baseUom: products.baseUom,
          productType: products.productType,
        })
        .from(products)
        .where(eq(products.productId, line.productId));

      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `TR-PCK-${transferOrderId.substring(0, 8)}-${uuidv4().substring(0, 8)}`,
        sourceType: 'TO_PICK',
        sourceId: transferOrderId,
        memo: `Transfer Order Pick`,
        userId: actor,
        allowNegativeInventory: Boolean(order.isProjectReturn),
        lines: [
          {
            productId: line.productId,
            binId: binId,
            quantity: -quantity,
            uomCode: prod?.baseUom || 'EA',
          },
          {
            productId: line.productId,
            binId: shippingBin.binId,
            quantity: quantity,
            uomCode: prod?.baseUom || 'EA',
          },
        ],
      });

      await tx.insert(transferOrderPicks).values({
        transferOrderId,
        transferOrderLineId: lineId,
        productId: line.productId,
        binId,
        quantity: quantity.toString(),
        stateCode: TRANSFER_ORDER_PICK_STATE.PICKED,
        createdBy: actor,
      });

      const [orderRec] = await tx
        .select({
          stateCode: transferOrders.stateCode,
          orderNumber: transferOrders.orderNumber,
        })
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));

      if (orderRec && orderRec.stateCode === TRANSFER_ORDER_STATE.CONFIRMED) {
        await changeTransferOrderState(
          this.db,
          transferOrderId,
          TRANSFER_ORDER_STATE.PICKING,
          actor,
          tx,
        );
      }

      const [binEntity] = binId
        ? await tx
            .select({ binNumber: bins.binNumber })
            .from(bins)
            .where(eq(bins.binId, binId))
        : [null];

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.WAREHOUSE,
        entityId: lineId,
        eventType: EventType.PICK_CREATED,
        entityDisplayName: `Pick for ${orderRec?.orderNumber || transferOrderId}`,
        actor,
        payload: {
          pickId: lineId,
          transferOrderId,
          quantity,
          binId,
          binNumber: binEntity?.binNumber,
        },
      });
      return { success: true };
    });
  }

  async cancelPick(transferOrderId: string, pickId: string, actor: string) {
    const pick = await this.db.query.transferOrderPicks.findFirst({
      where: eq(transferOrderPicks.pickId, pickId),
    });

    if (!pick || pick.transferOrderId !== transferOrderId) {
      throw new BadRequestException('Invalid pick');
    }

    if (pick.stateCode !== TRANSFER_ORDER_PICK_STATE.PICKED) {
      throw new BadRequestException(
        'Can only cancel picks that are in picked state',
      );
    }

    const order = await this.db.query.transferOrders.findFirst({
      where: eq(transferOrders.transferOrderId, transferOrderId),
    });

    if (!order) {
      throw new NotFoundException('Transfer Order not found');
    }

    const [shippingBin] = await this.db
      .select({ binId: bins.binId })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(bins.binNumber, 'SHIPPING'),
          eq(zones.locationId, order.sourceLocationId),
        ),
      )
      .limit(1);

    if (!shippingBin) {
      throw new BadRequestException(
        `No SHIPPING staging bin found for location ${order.sourceLocationId}.`,
      );
    }

    return await this.db.transaction(async (tx) => {
      const [prod] = await tx
        .select({
          baseUom: products.baseUom,
          productType: products.productType,
        })
        .from(products)
        .where(eq(products.productId, pick.productId));

      if (!pick.binId) {
        throw new BadRequestException('Pick does not have a source bin');
      }

      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `TR-UPK-${transferOrderId.substring(0, 8)}-${uuidv4().substring(0, 8)}`,
        sourceType: 'TO_PICK',
        sourceId: transferOrderId,
        memo: `Transfer Order Pick Reversal`,
        userId: actor,
        allowNegativeInventory: Boolean(order.isProjectReturn),
        lines: [
          {
            productId: pick.productId,
            binId: shippingBin.binId,
            quantity: -parseFloat(pick.quantity),
            uomCode: prod?.baseUom || 'EA',
          },
          {
            productId: pick.productId,
            binId: pick.binId,
            quantity: parseFloat(pick.quantity),
            uomCode: prod?.baseUom || 'EA',
          },
        ],
      });

      await this.changePickState(
        pickId,
        TRANSFER_ORDER_PICK_STATE.CANCELLED,
        actor,
        tx,
      );

      const [orderRec] = await tx
        .select({ orderNumber: transferOrders.orderNumber })
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      // @herobm-skip-audit DB write is performed in helper method changePickState
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: orderRec?.orderNumber || transferOrderId,
        actor,
        payload: { pickId },
      });
    });
  }

  async changePickState(
    pickId: string,
    newState: TransferOrderPickState,
    actor: string,
    tx: DrizzleDB,
  ) {
    const [existing] = await tx
      .select({
        stateCode: transferOrderPicks.stateCode,
        transferOrderId: transferOrderPicks.transferOrderId,
      })
      .from(transferOrderPicks)
      .where(eq(transferOrderPicks.pickId, pickId))
      .limit(1);

    if (!existing) return;
    if (existing.stateCode === newState) return;

    const allowed = TRANSFER_ORDER_PICK_TRANSITIONS[existing.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition transfer pick from '${existing.stateCode}' to '${newState}'.`,
      );
    }

    await tx
      .update(transferOrderPicks)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(transferOrderPicks.pickId, pickId));

    if (newState === TRANSFER_ORDER_PICK_STATE.CANCELLED) {
      const [order] = await tx
        .select({ orderNumber: transferOrders.orderNumber })
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, existing.transferOrderId));
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.WAREHOUSE,
        entityId: pickId,
        eventType: EventType.PICK_CANCELLED,
        entityDisplayName: order?.orderNumber || existing.transferOrderId,
        payload: {
          pickId,
          transferOrderId: existing.transferOrderId,
        },
        actor,
      });
    }
  }
}
