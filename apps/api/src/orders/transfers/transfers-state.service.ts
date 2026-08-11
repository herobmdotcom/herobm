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
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  locations,
  bins,
  zones,
  binContents,
  backorders,
  products,
  products as coreProducts,
} from '@herobm/db-schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { CreateShipmentDto } from '../dto';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import {
  BACKORDER_STATE,
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_TRANSITIONS,
  TRANSFER_ORDER_PICK_STATE,
  TRANSFER_ORDER_PICK_TRANSITIONS,
  getValidStates,
  SHIPMENT_STATE,
  PUTAWAY_STATUS,
  MATCH_STATUS,
} from '@herobm/shared';
import type {
  TransferOrderState,
  TransferOrderPickState,
} from '@herobm/shared';
import { v4 as uuidv4 } from 'uuid';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { TransfersCoreService } from './transfers-core.service';

const VALID_TRANSFER_STATES = getValidStates(TRANSFER_ORDER_TRANSITIONS);
const VALID_PICK_STATES = getValidStates(TRANSFER_ORDER_PICK_TRANSITIONS);

@Injectable()
export class TransfersStateService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly coreService: TransfersCoreService,
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

    const productIds = Array.from(
      new Set(
        lines
          .map((l: Record<string, unknown>) => l.productId)
          .filter(Boolean) as string[],
      ),
    );
    const binStock =
      productIds.length > 0
        ? await db
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
            )
        : [];

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
          eq(
            zones.locationId,
            (await this.db.query.transferOrders.findFirst({
              where: eq(transferOrders.transferOrderId, transferOrderId),
            }))!.sourceLocationId,
          ),
          isPickableBinCondition(bins),
        ),
      );

    const availableBins = rawBins;

    const bin = availableBins.find(
      (b: Record<string, unknown>) => b.binId === binId,
    );
    if (!bin) {
      throw new BadRequestException('Bin not found or not pickable');
    }

    if (parseFloat(bin.onHand) < quantity) {
      throw new BadRequestException('Insufficient stock in selected bin');
    }

    return await this.db.transaction(async (tx) => {
      await tx.insert(transferOrderPicks).values({
        transferOrderId,
        transferOrderLineId: lineId,
        productId: line.productId,
        binId,
        quantity: quantity.toString(),
        stateCode: TRANSFER_ORDER_PICK_STATE.PICKED,
        createdBy: actor,
      });

      const [order] = await tx
        .select({
          stateCode: transferOrders.stateCode,
          orderNumber: transferOrders.orderNumber,
        })
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));

      if (order && order.stateCode === TRANSFER_ORDER_STATE.CONFIRMED) {
        await this.changeTransferState(
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
        entityDisplayName: `Pick for ${order?.orderNumber || transferOrderId}`,
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

    await this.db.transaction(async (tx) => {
      await this.changePickState(
        pickId,
        TRANSFER_ORDER_PICK_STATE.CANCELLED,
        actor,
        tx,
      );

      const [order] = await tx
        .select({ orderNumber: transferOrders.orderNumber })
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, transferOrderId));
      // @herobm-skip-audit DB write is performed in helper method changePickState
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: order?.orderNumber || transferOrderId,
        actor,
        payload: { pickId },
      });
    });
  }

  async createShipment(
    transferOrderId: string,
    dto: CreateShipmentDto,
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.transferOrders.findFirst({
        where: eq(transferOrders.transferOrderId, transferOrderId),
      });

      if (!order) throw new NotFoundException('Transfer Order not found');
      if (
        order.stateCode !== TRANSFER_ORDER_STATE.PICKING &&
        order.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED
      ) {
        throw new BadRequestException(
          'Transfer order must be picking or released to ship',
        );
      }

      const [transitBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order.sourceLocationId),
            eq(bins.binNumber, 'INTRA_TRANSIT'),
          ),
        );

      if (!transitBin) {
        throw new BadRequestException(
          'Source location is missing INTRA_TRANSIT system bin. Please contact support.',
        );
      }

      const picks = await tx.query.transferOrderPicks.findMany({
        where: and(
          eq(transferOrderPicks.transferOrderId, transferOrderId),
          eq(transferOrderPicks.stateCode, TRANSFER_ORDER_PICK_STATE.PICKED),
        ),
      });

      const requestedLines = dto.lines.filter(
        (l) => parseFloat(l.quantityShipped) > 0,
      );
      if (requestedLines.length === 0) {
        throw new BadRequestException(
          'At least one line must have a quantity > 0',
        );
      }

      const shipmentNumber = await this.coreService.generateShipmentNumber(tx);
      const shipmentId = uuidv4();

      await tx.insert(transferOrderShipments).values({
        shipmentId,
        transferOrderId,
        shipmentNumber,
        stateCode: SHIPMENT_STATE.DISPATCHED,
        shippedBy: actor,
        trackingNumber: dto.trackingNumber,
        notes: dto.notes,
      });

      const inventoryLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];

      const productIds = Array.from(new Set(picks.map((p) => p.productId)));
      const productUoms = await tx
        .select({ productId: products.productId, baseUom: products.baseUom })
        .from(products)
        .where(inArray(products.productId, productIds));
      const uomMap = new Map(productUoms.map((p) => [p.productId, p.baseUom]));

      for (const line of requestedLines) {
        let remainingToShip = parseFloat(line.quantityShipped);
        const linePicks = picks.filter(
          (p) => p.transferOrderLineId === line.salesOrderLineId,
        );

        for (const pick of linePicks) {
          if (remainingToShip <= 0) break;
          const pickQty = parseFloat(pick.quantity);
          const shipQty = Math.min(pickQty, remainingToShip);

          remainingToShip -= shipQty;

          await tx.insert(transferOrderShipmentLines).values({
            shipmentLineId: uuidv4(),
            shipmentId,
            transferOrderLineId: pick.transferOrderLineId,
            productId: pick.productId,
            pickId: pick.pickId,
            quantity: shipQty.toString(),
          });

          const uomCode = uomMap.get(pick.productId) || 'EA';

          inventoryLines.push({
            productId: pick.productId,
            binId: pick.binId!,
            quantity: -shipQty,
            uomCode,
          });

          inventoryLines.push({
            productId: pick.productId,
            binId: transitBin.binId,
            quantity: shipQty,
            uomCode,
          });

          if (shipQty === pickQty) {
            await tx
              .update(transferOrderPicks)
              // eslint-disable-next-line no-restricted-syntax -- State bypass required
              .set({ stateCode: TRANSFER_ORDER_PICK_STATE.SHIPPED })
              .where(eq(transferOrderPicks.pickId, pick.pickId));
          } else {
            await tx
              .update(transferOrderPicks)
              .set({ quantity: (pickQty - shipQty).toString() })
              .where(eq(transferOrderPicks.pickId, pick.pickId));
            await tx.insert(transferOrderPicks).values({
              ...pick,
              pickId: uuidv4(),
              quantity: shipQty.toString(),
              stateCode: TRANSFER_ORDER_PICK_STATE.SHIPPED,
            });
          }

          await tx
            .update(transferOrderLines)
            .set({
              quantityShipped: sql`CAST(COALESCE(${transferOrderLines.quantityShipped}, '0') AS NUMERIC) + CAST(${shipQty} AS NUMERIC)`,
            })
            .where(
              eq(
                transferOrderLines.transferOrderLineId,
                pick.transferOrderLineId,
              ),
            );
        }
        if (remainingToShip > 0) {
          throw new BadRequestException(
            `Cannot ship more than picked for line ${line.salesOrderLineId}`,
          );
        }
      }

      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `TR-DISP-${shipmentNumber}`,
        sourceType: 'TO_DISPATCH',
        sourceId: transferOrderId,
        memo: `Dispatch to INTRA_TRANSIT`,
        userId: actor,
        lines: inventoryLines,
      });

      const summary = await this.getPickingSummary(
        transferOrderId,
        tx as unknown as DrizzleDB,
      );
      const isFullyShipped = summary.lines.every(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Any allowed here
        (l: any) => parseFloat(l.quantityShipped) >= parseFloat(l.quantity),
      );

      if (isFullyShipped) {
        await this.changeTransferState(
          transferOrderId,
          TRANSFER_ORDER_STATE.SHIPPED,
          actor,
          tx,
        );
      } else {
        await this.changeTransferState(
          transferOrderId,
          TRANSFER_ORDER_STATE.PICKING,
          actor,
          tx,
        );
      }

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.STOCK_DISPATCHED,
        entityDisplayName: order.orderNumber,
        actor,
        payload: { shipmentId, shipmentNumber },
      });

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.SHIPMENT,
        entityId: shipmentId,
        eventType: EventType.SHIPMENT_CREATED,
        entityDisplayName: shipmentNumber,
        actor,
        payload: { transferOrderId, shipmentNumber },
      });

      return { shipmentId, shipmentNumber };
    });
  }

  async shipTransferOrder(transferOrderId: string, actor: string) {
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.transferOrders.findFirst({
        where: eq(transferOrders.transferOrderId, transferOrderId),
      });

      if (!order) throw new NotFoundException('Transfer Order not found');
      if (
        order.stateCode !== TRANSFER_ORDER_STATE.PICKING &&
        order.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED
      ) {
        throw new BadRequestException(
          'Transfer order must be picking or released to ship',
        );
      }

      const [transitBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order.sourceLocationId),
            eq(bins.binNumber, 'INTRA_TRANSIT'),
          ),
        );

      if (!transitBin) {
        throw new BadRequestException(
          'Source location is missing INTRA_TRANSIT system bin. Please contact support.',
        );
      }

      const picks = await tx.query.transferOrderPicks.findMany({
        where: and(
          eq(transferOrderPicks.transferOrderId, transferOrderId),
          eq(transferOrderPicks.stateCode, TRANSFER_ORDER_PICK_STATE.PICKED),
        ),
      });

      if (picks.length === 0) {
        throw new BadRequestException('No items have been picked to ship');
      }

      const shipmentNumber = await this.coreService.generateShipmentNumber(tx);
      const shipmentId = uuidv4();

      await tx.insert(transferOrderShipments).values({
        shipmentId,
        transferOrderId,
        shipmentNumber,
        stateCode: SHIPMENT_STATE.DISPATCHED,
        shippedBy: actor,
      });

      const inventoryLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];
      const shipmentLinesInsert = [];

      const productIds = Array.from(new Set(picks.map((p) => p.productId)));
      const productUoms = await tx
        .select({ productId: products.productId, baseUom: products.baseUom })
        .from(products)
        .where(inArray(products.productId, productIds));
      const uomMap = new Map(productUoms.map((p) => [p.productId, p.baseUom]));

      for (const pick of picks) {
        const pickQty = parseFloat(pick.quantity);

        shipmentLinesInsert.push({
          shipmentLineId: uuidv4(),
          shipmentId,
          transferOrderLineId: pick.transferOrderLineId,
          productId: pick.productId,
          pickId: pick.pickId,
          quantity: pickQty.toString(),
        });

        const uomCode = uomMap.get(pick.productId) || 'EA';

        inventoryLines.push({
          productId: pick.productId,
          binId: pick.binId!,
          quantity: -pickQty,
          uomCode,
        });

        inventoryLines.push({
          productId: pick.productId,
          binId: transitBin.binId,
          quantity: pickQty,
          uomCode,
        });

        await tx
          .update(transferOrderPicks)
          // eslint-disable-next-line no-restricted-syntax -- State bypass required
          .set({ stateCode: TRANSFER_ORDER_PICK_STATE.SHIPPED })
          .where(eq(transferOrderPicks.pickId, pick.pickId));

        await tx
          .update(transferOrderLines)
          .set({
            quantityShipped: sql`CAST(COALESCE(${transferOrderLines.quantityShipped}, '0') AS NUMERIC) + CAST(${pick.quantity} AS NUMERIC)`,
          })
          .where(
            eq(
              transferOrderLines.transferOrderLineId,
              pick.transferOrderLineId,
            ),
          );
      }

      await tx.insert(transferOrderShipmentLines).values(shipmentLinesInsert);

      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `INTRA-OUT-${shipmentNumber}-${Date.now().toString().slice(-4)}`,
        sourceType: 'TRANSFER_OUT',
        sourceId: shipmentId,
        memo: `Intracompany Shipment ${shipmentNumber}`,
        userId: actor,
        lines: inventoryLines,
      });

      await this.changeTransferState(
        transferOrderId,
        TRANSFER_ORDER_STATE.SHIPPED,
        actor,
        tx,
      );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.STOCK_DISPATCHED,
        entityDisplayName: order.orderNumber,
        payload: { shipmentNumber, itemCount: picks.length },
        actor,
      });

      return { shipmentId, shipmentNumber };
    });
  }

  async cancelShipment(
    transferOrderId: string,
    shipmentId: string,
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const shipment = await tx.query.transferOrderShipments.findFirst({
        where: eq(transferOrderShipments.shipmentId, shipmentId),
      });

      if (!shipment) throw new NotFoundException('Shipment not found');
      if (shipment.transferOrderId !== transferOrderId) {
        throw new BadRequestException('Shipment does not belong to this order');
      }
      if (shipment.stateCode === TRANSFER_ORDER_STATE.CANCELLED) {
        throw new BadRequestException('Shipment is already cancelled');
      }

      const lines = await tx
        .select()
        .from(transferOrderShipmentLines)
        .where(eq(transferOrderShipmentLines.shipmentId, shipmentId));

      const order = await tx.query.transferOrders.findFirst({
        where: eq(transferOrders.transferOrderId, transferOrderId),
      });

      const [transitBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order!.sourceLocationId),
            eq(bins.binNumber, 'INTRA_TRANSIT'),
          ),
        );

      if (!transitBin) {
        throw new BadRequestException(
          'Source location is missing INTRA_TRANSIT system bin.',
        );
      }

      const productIds = Array.from(new Set(lines.map((p) => p.productId)));
      const productUoms = await tx
        .select({ productId: products.productId, baseUom: products.baseUom })
        .from(products)
        .where(inArray(products.productId, productIds));
      const uomMap = new Map(productUoms.map((p) => [p.productId, p.baseUom]));

      const inventoryLines = [];
      for (const line of lines) {
        const pickQty = parseFloat(line.quantity);
        const uomCode = uomMap.get(line.productId) || 'EA';

        if (!line.pickId) continue;

        const pick = await tx.query.transferOrderPicks.findFirst({
          where: eq(transferOrderPicks.pickId, line.pickId),
        });

        if (!pick) throw new NotFoundException(`Pick ${line.pickId} not found`);

        inventoryLines.push({
          productId: line.productId,
          binId: transitBin.binId,
          quantity: -pickQty,
          uomCode,
        });

        inventoryLines.push({
          productId: line.productId,
          binId: pick.binId!,
          quantity: pickQty,
          uomCode,
        });

        await this.changePickState(
          pick.pickId,
          TRANSFER_ORDER_PICK_STATE.PICKED,
          actor,
          tx,
        );

        await tx
          .update(transferOrderLines)
          .set({
            quantityShipped: sql`CAST(COALESCE(${transferOrderLines.quantityShipped}, '0') AS NUMERIC) - CAST(${line.quantity} AS NUMERIC)`,
          })
          .where(
            eq(
              transferOrderLines.transferOrderLineId,
              line.transferOrderLineId,
            ),
          );
      }

      if (inventoryLines.length > 0) {
        await this.inventoryMovementService.recordInventoryMovement(tx, {
          entryNumber: `INTRA-REV-${shipment.shipmentNumber}-${Date.now().toString().slice(-4)}`,
          sourceType: 'TRANSFER_OUT',
          sourceId: shipment.shipmentId,
          memo: `Intracompany Shipment Cancellation ${shipment.shipmentNumber}`,
          userId: actor,
          lines: inventoryLines,
        });
      }

      await tx
        .update(transferOrderShipments)
        // eslint-disable-next-line no-restricted-syntax -- State bypass required
        .set({ stateCode: SHIPMENT_STATE.CANCELLED })
        .where(eq(transferOrderShipments.shipmentId, shipmentId));

      await this.changeTransferState(
        transferOrderId,
        TRANSFER_ORDER_STATE.PICKING,
        actor,
        tx,
      );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: order!.orderNumber,
        actor,
        payload: {
          entity: 'transfer_order',
          entityId: transferOrderId,
          from: TRANSFER_ORDER_STATE.SHIPPED,
          to: TRANSFER_ORDER_STATE.PICKING,
          shipmentId,
        },
      });

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.SHIPMENT,
        entityId: shipmentId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: shipment.shipmentNumber,
        actor,
        payload: {
          from: SHIPMENT_STATE.DISPATCHED,
          to: SHIPMENT_STATE.CANCELLED,
        },
      });

      return { success: true };
    });
  }

  async cancelActiveShipment(transferOrderId: string, actor: string) {
    const shipment = await this.db.query.transferOrderShipments.findFirst({
      where: and(
        eq(transferOrderShipments.transferOrderId, transferOrderId),
        eq(transferOrderShipments.stateCode, SHIPMENT_STATE.DISPATCHED),
      ),
    });

    if (!shipment) {
      throw new BadRequestException(
        'No active shipment found for this order. Ensure the order is in a shipped state.',
      );
    }

    await this.cancelShipment(transferOrderId, shipment.shipmentId, actor);
    return this.coreService.findOne(transferOrderId);
  }

  async receiveTransferOrder(
    transferOrderId: string,
    lines: { transferOrderLineId: string; quantityReceived: string }[],
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.transferOrders.findFirst({
        where: eq(transferOrders.transferOrderId, transferOrderId),
      });

      if (!order) throw new NotFoundException('Transfer Order not found');
      if (
        order.stateCode !== TRANSFER_ORDER_STATE.SHIPPED &&
        order.stateCode !== TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          'Transfer order must be shipped or partially received to receive items',
        );
      }

      const [destBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order.destinationLocationId),
            eq(bins.binNumber, 'RECEIVING'),
          ),
        );

      if (!destBin) {
        throw new BadRequestException(
          'Destination location is missing RECEIVING system bin. Please contact support.',
        );
      }
      const destinationBinId = destBin.binId;

      const [transitBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order.sourceLocationId),
            eq(bins.binNumber, 'INTRA_TRANSIT'),
          ),
        );

      if (!transitBin) {
        throw new BadRequestException(
          'Source location is missing INTRA_TRANSIT system bin. Please contact support.',
        );
      }

      const orderLines = await tx.query.transferOrderLines.findMany({
        where: eq(transferOrderLines.transferOrderId, transferOrderId),
      });

      let totalReceived = 0;
      const inventoryLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];
      const receiptLinesInsert = [];

      const receiptNumber = await this.coreService.generateReceiptNumber(tx);
      const receiptId = uuidv4();

      await tx.insert(transferOrderReceipts).values({
        receiptId,
        transferOrderId,
        receiptNumber,
        stateCode: TRANSFER_ORDER_STATE.RECEIVED,
        receivedBy: actor,
      });

      const productIds = Array.from(
        new Set(orderLines.map((p) => p.productId)),
      );
      const productUoms = await tx
        .select({ productId: products.productId, baseUom: products.baseUom })
        .from(products)
        .where(inArray(products.productId, productIds));
      const uomMap = new Map(productUoms.map((p) => [p.productId, p.baseUom]));

      const lineUpdates = new Map<string, number>();
      for (const line of lines) {
        lineUpdates.set(
          line.transferOrderLineId,
          parseFloat(line.quantityReceived),
        );
      }

      for (const line of orderLines) {
        const qtyToReceive = lineUpdates.get(line.transferOrderLineId) || 0;

        if (qtyToReceive > 0) {
          const shipped = parseFloat(line.quantityShipped || '0');
          const previouslyReceived = parseFloat(line.quantityReceived || '0');

          if (previouslyReceived + qtyToReceive > shipped) {
            throw new BadRequestException(
              `Cannot receive more than shipped quantity for line ${line.transferOrderLineId}`,
            );
          }

          totalReceived += qtyToReceive;

          receiptLinesInsert.push({
            receiptLineId: uuidv4(),
            receiptId,
            transferOrderLineId: line.transferOrderLineId,
            productId: line.productId,
            quantity: qtyToReceive.toString(),
            binId: destinationBinId,
            putawayStatus: PUTAWAY_STATUS.COMPLETED,
            matchStatus: MATCH_STATUS.MATCHED,
          });

          inventoryLines.push({
            productId: line.productId,
            binId: transitBin.binId,
            quantity: -qtyToReceive,
            uomCode: uomMap.get(line.productId) || 'EA',
          });

          inventoryLines.push({
            productId: line.productId,
            binId: destinationBinId,
            quantity: qtyToReceive,
            uomCode: uomMap.get(line.productId) || 'EA',
          });

          await tx
            .update(transferOrderLines)
            .set({
              quantityReceived: sql`${transferOrderLines.quantityReceived} + ${qtyToReceive.toString()}`,
            })
            .where(
              eq(
                transferOrderLines.transferOrderLineId,
                line.transferOrderLineId,
              ),
            );
        }
      }

      if (totalReceived === 0) {
        throw new BadRequestException(
          'No items pending receipt on this transfer order',
        );
      }

      await tx.insert(transferOrderReceiptLines).values(receiptLinesInsert);

      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `INTRA-IN-${receiptNumber}-${Date.now().toString().slice(-4)}`,
        sourceType: 'TRANSFER_IN',
        sourceId: receiptId,
        memo: `Intracompany Receipt ${receiptNumber}`,
        userId: actor,
        lines: inventoryLines,
      });

      const updatedOrderLines = await tx.query.transferOrderLines.findMany({
        where: eq(transferOrderLines.transferOrderId, transferOrderId),
      });

      const isFullyReceived = updatedOrderLines.every((l) => {
        return (
          parseFloat(l.quantityReceived || '0') >=
          parseFloat(l.quantityShipped || '0')
        );
      });

      const nextState = isFullyReceived
        ? TRANSFER_ORDER_STATE.RECEIVED
        : TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED;

      await this.changeTransferState(transferOrderId, nextState, actor, tx);

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.UPDATED,
        entityDisplayName: order.orderNumber,
        payload: { receiptNumber, totalReceived, action: 'stock_received' },
        actor,
      });

      return { receiptId, receiptNumber };
    });
  }

  async changeTransferState(
    transferOrderId: string,
    newState: TransferOrderState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    if (!VALID_TRANSFER_STATES.includes(newState)) {
      throw new BadRequestException(
        `Invalid transfer order state: '${newState}'`,
      );
    }

    const db = tx || this.db;

    const [order] = await db
      .select()
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, transferOrderId));

    if (!order) {
      throw new NotFoundException(
        `Transfer Order ${transferOrderId} not found`,
      );
    }

    if (order.stateCode === newState) {
      return order;
    }

    if (
      order.stateCode === TRANSFER_ORDER_STATE.SHIPPED &&
      newState === TRANSFER_ORDER_STATE.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot cancel a shipped transfer order. Please cancel the shipment first.',
      );
    }

    const allowed = TRANSFER_ORDER_TRANSITIONS[order.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition transfer order from '${order.stateCode}' to '${newState}'.`,
      );
    }

    const [updated] = await db
      .update(transferOrders)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(transferOrders.transferOrderId, transferOrderId))
      .returning();

    await emitEvent(db as unknown as DrizzleDB, {
      entityType: EntityType.TRANSFER_ORDER,
      entityId: transferOrderId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: order.orderNumber,
      payload: {
        entity: 'transfer_order',
        entityId: transferOrderId,
        from: order.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }

  private async changePickState(
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

  async cancelTransferOrder(id: string, actor: string) {
    return await this.db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          stateCode: transferOrders.stateCode,
          orderNumber: transferOrders.orderNumber,
        })
        .from(transferOrders)
        .where(eq(transferOrders.transferOrderId, id));

      await this.changeTransferState(
        id,
        TRANSFER_ORDER_STATE.CANCELLED,
        actor,
        tx,
      );

      await tx
        .update(backorders)
        .set({
          transferOrderId: null,
          transferOrderLineId: null,
          // eslint-disable-next-line no-restricted-syntax -- State bypass required
          stateCode: BACKORDER_STATE.PENDING_SUPPLY,
        })
        .where(eq(backorders.transferOrderId, id));

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: id,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: order?.orderNumber || id,
        actor,
        payload: {
          entity: 'transfer_order',
          entityId: id,
          from: order?.stateCode,
          to: TRANSFER_ORDER_STATE.CANCELLED,
        },
      });

      return { success: true };
    });
  }
}
