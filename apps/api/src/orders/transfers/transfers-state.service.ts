import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  transferOrders,
  transferOrderLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  transferOrderShipments,
  bins,
  zones,
  products,
} from '@herobm/db-schema';
import { eq, and, inArray } from 'drizzle-orm';
import { CreateShipmentDto } from '../dto';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import {
  TRANSFER_ORDER_STATE,
  SHIPMENT_STATE,
  PUTAWAY_STATUS,
} from '@herobm/shared';
import type { TransferOrderState } from '@herobm/shared';
import { v4 as uuidv4 } from 'uuid';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { TransfersCoreService } from './transfers-core.service';
import { BackordersService } from '../backorders.service';
import { TransfersPickingService } from './transfers-picking.service';
import { TransfersShipmentService } from './transfers-shipment.service';
import { changeTransferOrderState } from './transfer-state.helper';

@Injectable()
export class TransfersStateService {
  private readonly pickingService: TransfersPickingService;
  private readonly shipmentService: TransfersShipmentService;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly coreService: TransfersCoreService,
    private readonly backordersService: BackordersService,
    @Optional()
    @Inject(forwardRef(() => TransfersPickingService))
    pickingService?: TransfersPickingService,
    @Optional()
    @Inject(forwardRef(() => TransfersShipmentService))
    shipmentService?: TransfersShipmentService,
  ) {
    this.pickingService =
      pickingService ||
      new TransfersPickingService(db, inventoryMovementService);
    this.shipmentService =
      shipmentService ||
      new TransfersShipmentService(
        db,
        inventoryMovementService,
        coreService,
        this.pickingService,
      );
  }

  // --- Facade delegations for Picking ---

  async getPickingSummary(transferOrderId: string, tx?: DrizzleDB) {
    return this.pickingService.getPickingSummary(transferOrderId, tx);
  }

  async pickLine(
    transferOrderId: string,
    lineId: string,
    binId: string,
    quantity: number,
    actor: string,
  ) {
    return this.pickingService.pickLine(
      transferOrderId,
      lineId,
      binId,
      quantity,
      actor,
    );
  }

  async cancelPick(transferOrderId: string, pickId: string, actor: string) {
    return this.pickingService.cancelPick(transferOrderId, pickId, actor);
  }

  // --- Facade delegations for Shipping ---

  async createShipment(
    transferOrderId: string,
    dto: CreateShipmentDto,
    actor: string,
  ) {
    return this.shipmentService.createShipment(transferOrderId, dto, actor);
  }

  async shipTransferOrder(transferOrderId: string, actor: string) {
    return this.shipmentService.shipTransferOrder(transferOrderId, actor);
  }

  async cancelShipment(
    transferOrderId: string,
    shipmentId: string,
    actor: string,
  ) {
    return this.shipmentService.cancelShipment(
      transferOrderId,
      shipmentId,
      actor,
    );
  }

  async cancelActiveShipment(transferOrderId: string, actor: string) {
    return this.shipmentService.cancelActiveShipment(transferOrderId, actor);
  }

  // --- Receiving & Order State Transitions ---

  async receiveTransferOrder(
    transferOrderId: string,
    lines: { transferOrderLineId: string; quantityReceived: string }[],
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.transferOrders.findFirst({
        where: eq(transferOrders.transferOrderId, transferOrderId),
        with: { lines: true },
      });

      if (!order) {
        throw new NotFoundException('Transfer Order not found');
      }

      const hasShippedItems = order.lines.some(
        (l) =>
          parseFloat(l.quantityShipped || '0') >
          parseFloat(l.quantityReceived || '0'),
      );

      if (
        order.stateCode !== TRANSFER_ORDER_STATE.SHIPPED &&
        order.stateCode !== TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED &&
        !(order.stateCode === TRANSFER_ORDER_STATE.PICKING && hasShippedItems)
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
            putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY,
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

          const updatedReceivedQty = (
            previouslyReceived + qtyToReceive
          ).toString();
          await tx
            .update(transferOrderLines)
            .set({
              quantityReceived: updatedReceivedQty,
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
        entryNumber: `INTRA-IN-${receiptNumber}-${uuidv4().substring(0, 8)}`,
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
          parseFloat(l.quantityReceived || '0') >= parseFloat(l.quantity || '0')
        );
      });

      const isAllShippedReceived = updatedOrderLines.every((l) => {
        return (
          parseFloat(l.quantityReceived || '0') >=
          parseFloat(l.quantityShipped || '0')
        );
      });

      const nextState = isFullyReceived
        ? TRANSFER_ORDER_STATE.RECEIVED
        : isAllShippedReceived
          ? TRANSFER_ORDER_STATE.PICKING
          : TRANSFER_ORDER_STATE.PARTIALLY_RECEIVED;

      await changeTransferOrderState(
        this.db,
        transferOrderId,
        nextState,
        actor,
        tx,
      );

      const activeShipments = await tx
        .select()
        .from(transferOrderShipments)
        .where(
          and(
            eq(transferOrderShipments.transferOrderId, transferOrderId),
            inArray(transferOrderShipments.stateCode, [
              SHIPMENT_STATE.DISPATCHED,
              SHIPMENT_STATE.PARTIALLY_RECEIVED,
            ]),
          ),
        );

      const targetShipmentState = isAllShippedReceived
        ? SHIPMENT_STATE.RECEIVED
        : SHIPMENT_STATE.PARTIALLY_RECEIVED;

      for (const shipment of activeShipments) {
        if (shipment.stateCode !== targetShipmentState) {
          await tx
            .update(transferOrderShipments)
            // eslint-disable-next-line no-restricted-syntax -- State bypass required
            .set({ stateCode: targetShipmentState })
            .where(eq(transferOrderShipments.shipmentId, shipment.shipmentId));

          await emitEvent(tx as unknown as DrizzleDB, {
            entityType: EntityType.SHIPMENT,
            entityId: shipment.shipmentId,
            eventType: EventType.STATUS_CHANGED,
            entityDisplayName: shipment.shipmentNumber,
            actor,
            payload: {
              from: shipment.stateCode,
              to: targetShipmentState,
            },
          });
        }
      }

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
    return changeTransferOrderState(
      this.db,
      transferOrderId,
      newState,
      actor,
      tx,
    );
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

      await changeTransferOrderState(
        this.db,
        id,
        TRANSFER_ORDER_STATE.CANCELLED,
        actor,
        tx,
      );

      await this.backordersService.unlinkDemandForTransferOrder(tx, id, actor);

      // @herobm-skip-audit - DB write is performed by changeTransferState, emitting event here
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
