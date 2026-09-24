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
  bins,
  zones,
  products,
} from '@herobm/db-schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { CreateShipmentDto } from '../dto';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import {
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_PICK_STATE,
  SHIPMENT_STATE,
} from '@herobm/shared';
import { v4 as uuidv4 } from 'uuid';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { TransfersCoreService } from './transfers-core.service';
import { TransfersPickingService } from './transfers-picking.service';
import { changeTransferOrderState } from './transfer-state.helper';

@Injectable()
export class TransfersShipmentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly coreService: TransfersCoreService,
    private readonly pickingService: TransfersPickingService,
  ) {}

  async createShipment(
    transferOrderId: string,
    dto: CreateShipmentDto,
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.transferOrders.findFirst({
        where: eq(transferOrders.transferOrderId, transferOrderId),
      });

      if (!order) {
        throw new NotFoundException('Transfer Order not found');
      }

      if (
        order.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED &&
        order.stateCode !== TRANSFER_ORDER_STATE.PICKING
      ) {
        throw new BadRequestException(
          'Transfer order must be in confirmed or picking state to ship',
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

      const [shippingBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order.sourceLocationId),
            eq(bins.binNumber, 'SHIPPING'),
          ),
        );

      if (!shippingBin) {
        throw new BadRequestException(
          'Source location is missing SHIPPING system bin. Please contact support.',
        );
      }

      const shipmentNumber = await this.coreService.generateShipmentNumber(tx);
      const shipmentId = uuidv4();

      await tx.insert(transferOrderShipments).values({
        shipmentId,
        transferOrderId,
        shipmentNumber,
        stateCode: SHIPMENT_STATE.DISPATCHED,
        trackingNumber: dto.trackingNumber,
        notes: dto.notes ?? null,
        shippingNotes: dto.shippingNotes ?? order.shippingNotes ?? null,
        shippedBy: actor,
      });

      const inventoryLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];

      const targetLineIds = dto.lines.map((l) => l.salesOrderLineId);
      const picks = await tx.query.transferOrderPicks.findMany({
        where: and(
          eq(transferOrderPicks.transferOrderId, transferOrderId),
          inArray(transferOrderPicks.transferOrderLineId, targetLineIds),
          eq(transferOrderPicks.stateCode, TRANSFER_ORDER_PICK_STATE.PICKED),
        ),
      });

      const productIds = Array.from(new Set(picks.map((p) => p.productId)));
      const productUoms = await tx
        .select({ productId: products.productId, baseUom: products.baseUom })
        .from(products)
        .where(inArray(products.productId, productIds));
      const uomMap = new Map(productUoms.map((p) => [p.productId, p.baseUom]));

      for (const line of dto.lines) {
        let remainingToShip = parseFloat(
          line.quantityShipped ||
            (line as { quantity?: string }).quantity ||
            '0',
        );
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
            binId: shippingBin.binId,
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
        allowNegativeInventory: Boolean(order.isProjectReturn),
        lines: inventoryLines,
      });

      const summary = await this.pickingService.getPickingSummary(
        transferOrderId,
        tx as unknown as DrizzleDB,
      );
      const isFullyShipped = summary.lines.every(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Any allowed here
        (l: any) => parseFloat(l.quantityShipped) >= parseFloat(l.quantity),
      );

      if (isFullyShipped) {
        await changeTransferOrderState(
          this.db,
          transferOrderId,
          TRANSFER_ORDER_STATE.SHIPPED,
          actor,
          tx,
        );
      } else {
        await changeTransferOrderState(
          this.db,
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

      const [shippingBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order.sourceLocationId),
            eq(bins.binNumber, 'SHIPPING'),
          ),
        );

      if (!shippingBin) {
        throw new BadRequestException(
          'Source location is missing SHIPPING system bin. Please contact support.',
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
        shippingNotes: order.shippingNotes ?? null,
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
          binId: shippingBin.binId,
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
        allowNegativeInventory: Boolean(order.isProjectReturn),
        lines: inventoryLines,
      });

      await changeTransferOrderState(
        this.db,
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

      const [shippingBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, order!.sourceLocationId),
            eq(bins.binNumber, 'SHIPPING'),
          ),
        );

      if (!shippingBin) {
        throw new BadRequestException(
          'Source location is missing SHIPPING system bin.',
        );
      }

      const productIds = Array.from(new Set(lines.map((p) => p.productId)));
      const productUoms = await tx
        .select({ productId: products.productId, baseUom: products.baseUom })
        .from(products)
        .where(inArray(products.productId, productIds));
      const uomMap = new Map(productUoms.map((p) => [p.productId, p.baseUom]));

      const pickIds = lines.map((l) => l.pickId).filter(Boolean) as string[];
      const picks =
        pickIds.length > 0
          ? await tx.query.transferOrderPicks.findMany({
              where: inArray(transferOrderPicks.pickId, pickIds),
            })
          : [];
      const picksMap = new Map(picks.map((p) => [p.pickId, p]));

      const inventoryLines = [];
      for (const line of lines) {
        const pickQty = parseFloat(line.quantity);
        const uomCode = uomMap.get(line.productId) || 'EA';

        if (!line.pickId) continue;

        const pick = picksMap.get(line.pickId);
        if (!pick) throw new NotFoundException(`Pick ${line.pickId} not found`);

        inventoryLines.push({
          productId: line.productId,
          binId: transitBin.binId,
          quantity: -pickQty,
          uomCode,
        });

        inventoryLines.push({
          productId: line.productId,
          binId: shippingBin.binId,
          quantity: pickQty,
          uomCode,
        });

        await this.pickingService.changePickState(
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
          entryNumber: `INTRA-REV-${shipment.shipmentNumber}-${uuidv4().substring(0, 8)}`,
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

      await changeTransferOrderState(
        this.db,
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
}
