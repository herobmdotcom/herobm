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
  warehouseEvents,
  locations,
  bins,
  zones,
  binContents,
  backorders,
  salesOrderLineItems,
  products,
  inventoryLedger,
  inventoryEntries,
  products as coreProducts,
} from '../../drizzle/herobm-core-schema';
import { eq, and, inArray, sum, sql, desc, or, ilike, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../../common/pagination';
import {
  CreateTransferOrderDto,
  UpdateTransferOrderDto,
  CreateTransferOrderLineDto,
  UpdateTransferOrderLineDto,
  TransferPaginationQuery,
} from './dto';
import { CreateShipmentDto } from '../dto';
import { InventoryService } from '../../inventory/inventory.service';
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
} from '@herobm/shared';
import type {
  TransferOrderState,
  TransferOrderPickState,
} from '@herobm/shared';
import { v4 as uuidv4 } from 'uuid';

const VALID_TRANSFER_STATES = getValidStates(TRANSFER_ORDER_TRANSITIONS);
const VALID_PICK_STATES = getValidStates(TRANSFER_ORDER_PICK_TRANSITIONS);

@Injectable()
export class TransferService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
  ) {}

  // -------------------------------------------------------------------------
  // Creation
  // -------------------------------------------------------------------------

  async createTransferFromDemands(
    sourceLocationId: string,
    backorderIds: string[],
    actor: string,
  ) {
    if (!backorderIds || backorderIds.length === 0) {
      throw new BadRequestException('No demands specified');
    }

    return await this.db.transaction(async (tx) => {
      // Find backorders
      const lines = await tx
        .select({
          backorderId: backorders.backorderId,
          productId: backorders.productId,
          quantity: backorders.quantity,
          locationId: salesOrderLineItems.fulfillmentLocationId,
          salesOrderId: backorders.salesOrderId,
          salesOrderLineId: backorders.salesOrderLineId,
        })
        .from(backorders)
        .innerJoin(
          salesOrderLineItems,
          eq(backorders.salesOrderLineId, salesOrderLineItems.salesOrderLineId),
        )
        .where(
          and(
            inArray(backorders.backorderId, backorderIds),
            eq(backorders.stateCode, BACKORDER_STATE.PENDING_SUPPLY),
            sql`${backorders.purchaseOrderId} IS NULL`,
            sql`${backorders.transferOrderId} IS NULL`,
          ),
        );

      if (lines.length !== backorderIds.length) {
        throw new BadRequestException(
          'Some demands could not be found or are not open',
        );
      }

      // Check they are all for the same destination location
      const destLocationId = lines[0].locationId;
      if (!lines.every((l) => l.locationId === destLocationId)) {
        throw new BadRequestException(
          'All demands must be for the same destination location',
        );
      }

      // 1) Generate transfer_order_number
      const prefix = `TO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
      const lastOrder = await tx
        .select({ orderNumber: transferOrders.orderNumber })
        .from(transferOrders)
        .where(sql`${transferOrders.orderNumber} LIKE ${prefix + '%'}`)
        .orderBy(desc(transferOrders.orderNumber))
        .limit(1);

      let nextNum = 1;
      if (lastOrder.length > 0) {
        const parts = lastOrder[0].orderNumber.split('-');
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const orderNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;

      const transferOrderId = uuidv4();

      // 2) Insert Header
      await tx.insert(transferOrders).values({
        transferOrderId,
        orderNumber,
        sourceLocationId,
        destinationLocationId: destLocationId,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: actor,
      });

      // 3) Insert Lines and Update Backorders
      for (const line of lines) {
        const transferOrderLineId = uuidv4();
        await tx.insert(transferOrderLines).values({
          transferOrderLineId,
          transferOrderId,
          productId: line.productId,
          quantity: line.quantity,
        });

        // "Allocate" the backorder to this transfer order
        await tx
          .update(backorders)
          .set({
            transferOrderId,
            transferOrderLineId,
            // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
            stateCode: BACKORDER_STATE.AWAITING_RECEIPT,
          })
          .where(eq(backorders.backorderId, line.backorderId));
      }

      const [[sourceLoc], [destLoc]] = await Promise.all([
        tx
          .select({ name: locations.name })
          .from(locations)
          .where(eq(locations.locationId, sourceLocationId)),
        tx
          .select({ name: locations.name })
          .from(locations)
          .where(eq(locations.locationId, destLocationId)),
      ]);

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.CREATED,
        entityDisplayName: orderNumber,
        payload: {
          orderNumber,
          sourceLocationId,
          sourceLocationName: sourceLoc?.name,
          destinationLocationId: destLocationId,
          destinationLocationName: destLoc?.name,
          lineCount: lines.length,
        },
        actor,
      });

      return { transferOrderId, orderNumber };
    });
  }

  // -------------------------------------------------------------------------
  // Picking
  // -------------------------------------------------------------------------

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
        salesOrderLineId: transferOrderLines.transferOrderLineId, // Alias for UI
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
        salesOrderLineId: transferOrderPicks.transferOrderLineId, // Alias for UI
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

    // For each line, compute remaining and get available bins
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
        hasAllocation: false, // Transfer orders don't have backorder allocations in the same way
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

    const result = await this.db.transaction(async (tx) => {
      await tx.insert(transferOrderPicks).values({
        transferOrderId,
        transferOrderLineId: lineId,
        productId: line.productId,
        binId,
        quantity: quantity.toString(),
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

      const [bin] = binId
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
          binNumber: bin?.binNumber,
        },
      });
    });

    return result;
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
      // @herobm-skip-audit - DB write is performed by changePickState, emitting cross-entity event here
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

  // -------------------------------------------------------------------------
  // Shipping
  // -------------------------------------------------------------------------

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

      // 1) Get the INTRA_TRANSIT bin for the source location
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

      // 2) Find picks matching the requested lines
      const picks = await tx.query.transferOrderPicks.findMany({
        where: and(
          eq(transferOrderPicks.transferOrderId, transferOrderId),
          eq(transferOrderPicks.stateCode, TRANSFER_ORDER_PICK_STATE.PICKED),
        ),
      });

      // Filter and allocate quantities
      const requestedLines = dto.lines.filter(
        (l) => parseFloat(l.quantityShipped) > 0,
      );
      if (requestedLines.length === 0) {
        throw new BadRequestException(
          'At least one line must have a quantity > 0',
        );
      }

      // Generate Shipment Number
      const shipmentPrefix = `TSH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
      const lastShipment = await tx
        .select({ shipmentNumber: transferOrderShipments.shipmentNumber })
        .from(transferOrderShipments)
        .where(
          sql`${transferOrderShipments.shipmentNumber} LIKE ${shipmentPrefix + '%'}`,
        )
        .orderBy(desc(transferOrderShipments.shipmentNumber))
        .limit(1);

      let nextNum = 1;
      if (lastShipment.length > 0) {
        const parts = lastShipment[0].shipmentNumber.split('-');
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const shipmentNumber = `${shipmentPrefix}${String(nextNum).padStart(3, '0')}`;
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

          // A. Create shipment line
          await tx.insert(transferOrderShipmentLines).values({
            shipmentLineId: uuidv4(),
            shipmentId,
            transferOrderLineId: pick.transferOrderLineId,
            productId: pick.productId,
            pickId: pick.pickId,
            quantity: shipQty.toString(),
          });

          const uomCode = uomMap.get(pick.productId) || 'EA';

          // B. Decrease from source pick bin
          inventoryLines.push({
            productId: pick.productId,
            binId: pick.binId!,
            quantity: -shipQty,
            uomCode,
          });

          // C. Increase into INTRA_TRANSIT bin
          inventoryLines.push({
            productId: pick.productId,
            binId: transitBin.binId,
            quantity: shipQty,
            uomCode,
          });

          // D. Mark pick as shipped or partial
          if (shipQty === pickQty) {
            await tx
              .update(transferOrderPicks)
              // eslint-disable-next-line no-restricted-syntax -- Needed for legacy code
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

          // E. Update shipped quantity on order line
          await tx
            .update(transferOrderLines)
            .set({
              quantityShipped: sql`${transferOrderLines.quantityShipped} + ${shipQty}`,
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

      await this.inventoryService.recordInventoryMovement(tx, {
        entryNumber: `TR-DISP-${shipmentNumber}`,
        sourceType: 'TO_DISPATCH',
        sourceId: transferOrderId,
        memo: `Dispatch to INTRA_TRANSIT`,
        userId: actor,
        lines: inventoryLines,
      });

      // Update transfer order status
      const summary = await this.getPickingSummary(
        transferOrderId,
        tx as unknown as DrizzleDB,
      );
      const isFullyShipped = summary.lines.every(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for legacy code
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

      // 1) Get the INTRA_TRANSIT bin for the source location
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

      // 2) Find all picked items
      const picks = await tx.query.transferOrderPicks.findMany({
        where: and(
          eq(transferOrderPicks.transferOrderId, transferOrderId),
          eq(transferOrderPicks.stateCode, TRANSFER_ORDER_PICK_STATE.PICKED),
        ),
      });

      if (picks.length === 0) {
        throw new BadRequestException('No items have been picked to ship');
      }

      // 3) Generate Shipment Number
      const shipmentPrefix = `TSH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
      const lastShipment = await tx
        .select({ shipmentNumber: transferOrderShipments.shipmentNumber })
        .from(transferOrderShipments)
        .where(
          sql`${transferOrderShipments.shipmentNumber} LIKE ${shipmentPrefix + '%'}`,
        )
        .orderBy(desc(transferOrderShipments.shipmentNumber))
        .limit(1);

      let nextNum = 1;
      if (lastShipment.length > 0) {
        const parts = lastShipment[0].shipmentNumber.split('-');
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const shipmentNumber = `${shipmentPrefix}${String(nextNum).padStart(3, '0')}`;
      const shipmentId = uuidv4();

      // 4) Create Shipment Header
      await tx.insert(transferOrderShipments).values({
        shipmentId,
        transferOrderId,
        shipmentNumber,
        stateCode: SHIPMENT_STATE.DISPATCHED,
        shippedBy: actor,
      });

      // 5) Build Inventory Movements
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

        // A. Create shipment line
        shipmentLinesInsert.push({
          shipmentLineId: uuidv4(),
          shipmentId,
          transferOrderLineId: pick.transferOrderLineId,
          productId: pick.productId,
          pickId: pick.pickId,
          quantity: pickQty.toString(),
        });

        const uomCode = uomMap.get(pick.productId) || 'EA';

        // B. Decrease from source pick bin
        inventoryLines.push({
          productId: pick.productId,
          binId: pick.binId!,
          quantity: -pickQty,
          uomCode,
        });

        // C. Increase into INTRA_TRANSIT bin
        inventoryLines.push({
          productId: pick.productId,
          binId: transitBin.binId,
          quantity: pickQty,
          uomCode,
        });

        // D. Mark pick as shipped
        await tx
          .update(transferOrderPicks)
          // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
          .set({ stateCode: TRANSFER_ORDER_PICK_STATE.SHIPPED })
          .where(eq(transferOrderPicks.pickId, pick.pickId));

        // E. Update shipped quantity on order line
        await tx
          .update(transferOrderLines)
          .set({
            quantityShipped: sql`${transferOrderLines.quantityShipped} + ${pick.quantity}`,
          })
          .where(
            eq(
              transferOrderLines.transferOrderLineId,
              pick.transferOrderLineId,
            ),
          );
      }

      await tx.insert(transferOrderShipmentLines).values(shipmentLinesInsert);

      // 6) Execute Inventory Movement
      await this.inventoryService.recordInventoryMovement(tx, {
        entryNumber: `INTRA-OUT-${shipmentNumber}-${Date.now().toString().slice(-4)}`,
        sourceType: 'TRANSFER_OUT',
        sourceId: shipmentId,
        memo: `Intracompany Shipment ${shipmentNumber}`,
        userId: actor,
        lines: inventoryLines,
      });

      // 7) Update Order State
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

      // 1) Find the INTRA_TRANSIT bin for the source location
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

      // 2) Revert inventory movement
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

        // Fetch original pick to know which bin it was picked from
        const pick = await tx.query.transferOrderPicks.findFirst({
          where: eq(transferOrderPicks.pickId, line.pickId),
        });

        if (!pick) throw new NotFoundException(`Pick ${line.pickId} not found`);

        // Revert from INTRA_TRANSIT back to source pick bin
        inventoryLines.push({
          productId: line.productId,
          binId: transitBin.binId,
          quantity: -pickQty, // Remove from transit
          uomCode,
        });

        inventoryLines.push({
          productId: line.productId,
          binId: pick.binId!,
          quantity: pickQty, // Put back in pick bin
          uomCode,
        });

        // Mark pick as PICKED
        await this.changePickState(
          pick.pickId,
          TRANSFER_ORDER_PICK_STATE.PICKED,
          actor,
          tx,
        );

        // Decrease shipped quantity on order line
        await tx
          .update(transferOrderLines)
          .set({
            quantityShipped: sql`${transferOrderLines.quantityShipped} - ${line.quantity}`,
          })
          .where(
            eq(
              transferOrderLines.transferOrderLineId,
              line.transferOrderLineId,
            ),
          );
      }

      // Execute Inventory Movement
      if (inventoryLines.length > 0) {
        await this.inventoryService.recordInventoryMovement(tx, {
          entryNumber: `INTRA-REV-${shipment.shipmentNumber}-${Date.now().toString().slice(-4)}`,
          sourceType: 'TRANSFER_OUT',
          sourceId: shipment.shipmentId,
          memo: `Intracompany Shipment Cancellation ${shipment.shipmentNumber}`,
          userId: actor,
          lines: inventoryLines,
        });
      }

      // Mark shipment as cancelled
      await tx
        .update(transferOrderShipments)
        // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
        .set({ stateCode: SHIPMENT_STATE.CANCELLED })
        .where(eq(transferOrderShipments.shipmentId, shipmentId));

      // Revert order state to PICKING
      await this.changeTransferState(
        transferOrderId,
        TRANSFER_ORDER_STATE.PICKING,
        actor,
        tx,
      );

      // Emit Event
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
    return this.findOne(transferOrderId);
  }

  // -------------------------------------------------------------------------
  // Receiving
  // -------------------------------------------------------------------------

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

      // 1) Verify destination bin is valid for the destination location
      // Using RECEIVING bin for general receipt
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

      // 2) Get the INTRA_TRANSIT bin for the source location (where stock currently resides)
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

      // 3) Find all shipments that haven't been fully received yet
      // For simplicity, we'll receive the entire 'shipped' balance of the order.
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

      // 4) Generate Receipt Number
      const receiptPrefix = `TRC-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
      const lastReceipt = await tx
        .select({ receiptNumber: transferOrderReceipts.receiptNumber })
        .from(transferOrderReceipts)
        .where(
          sql`${transferOrderReceipts.receiptNumber} LIKE ${receiptPrefix + '%'}`,
        )
        .orderBy(desc(transferOrderReceipts.receiptNumber))
        .limit(1);

      let nextNum = 1;
      if (lastReceipt.length > 0) {
        const parts = lastReceipt[0].receiptNumber.split('-');
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const receiptNumber = `${receiptPrefix}${String(nextNum).padStart(3, '0')}`;
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
          });

          // Decrease from INTRA_TRANSIT bin
          inventoryLines.push({
            productId: line.productId,
            binId: transitBin.binId,
            quantity: -qtyToReceive,
            uomCode: uomMap.get(line.productId) || 'EA',
          });

          // Increase into Destination Bin
          inventoryLines.push({
            productId: line.productId,
            binId: destinationBinId,
            quantity: qtyToReceive,
            uomCode: uomMap.get(line.productId) || 'EA',
          });

          // Update received quantity on order line
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

      // 5) Execute Inventory Movement
      await this.inventoryService.recordInventoryMovement(tx, {
        entryNumber: `INTRA-IN-${receiptNumber}-${Date.now().toString().slice(-4)}`,
        sourceType: 'TRANSFER_IN',
        sourceId: receiptId,
        memo: `Intracompany Receipt ${receiptNumber}`,
        userId: actor,
        lines: inventoryLines,
      });

      // 6) Check if fully received
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

      // Update Order State
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

  /**
   * Universal changeState for Transfer Orders
   */
  async changeTransferState(
    transferOrderId: string,
    newState: TransferOrderState,
    actor: string,
    tx: DrizzleDB,
  ) {
    if (!VALID_TRANSFER_STATES.includes(newState)) {
      throw new BadRequestException(
        `Invalid transfer order state: '${newState}'`,
      );
    }

    const [order] = await tx
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

    const [updated] = await tx
      .update(transferOrders)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(transferOrders.transferOrderId, transferOrderId))
      .returning();

    await emitEvent(tx as unknown as DrizzleDB, {
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

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async findAll(query?: TransferPaginationQuery) {
    const { page, limit, cursor, direction, searchTerm, states } =
      parsePagination(query);

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${transferOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${transferOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${transferOrders.notes} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${transferOrders.notes} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(transferOrders.orderNumber, `%${rawSearchTerm}%`),
          ilike(transferOrders.notes, `%${rawSearchTerm}%`),
        ),
      );
    }

    if (states && states.length > 0) {
      if (states.length === 1) {
        conditions.push(eq(transferOrders.stateCode, states[0]));
      } else {
        conditions.push(inArray(transferOrders.stateCode, states));
      }
    }

    if (query?.destinationLocationId) {
      conditions.push(
        eq(transferOrders.destinationLocationId, query.destinationLocationId),
      );
    }

    const destLoc = alias(locations, 'destLoc');
    const sourceLoc = alias(locations, 'sourceLoc');

    let qb = this.db
      .select({
        id: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        stateCode: transferOrders.stateCode,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        destinationLocationId: transferOrders.destinationLocationId,
        destinationLocationName: destLoc.name,
        createdBy: transferOrders.createdBy,
        createdOn: transferOrders.createdOn,
        notes: transferOrders.notes,
        shippingNotes: transferOrders.shippingNotes,
        score: scoreSql,
      })
      .from(transferOrders)
      .leftJoin(
        sourceLoc,
        eq(transferOrders.sourceLocationId, sourceLoc.locationId),
      )
      .leftJoin(
        destLoc,
        eq(transferOrders.destinationLocationId, destLoc.locationId),
      )
      .$dynamic();

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    if (whereClause) {
      qb = qb.where(whereClause);
    }

    const { data, nextCursor, prevCursor } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        id: string;
      } | null,
      direction: direction,
      applyWhere: (q, c, dir) => {
        const cDate = c.createdOn;
        if (dir === 'next') {
          const cursorCond = or(
            sql`${scoreSql} < ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`${transferOrders.createdOn} < ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              eq(transferOrders.createdOn, sql`${cDate}::timestamp`),
              sql`${transferOrders.transferOrderId} < ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        } else {
          const cursorCond = or(
            sql`${scoreSql} > ${c.score}`,
            and(
              eq(scoreSql, c.score),
              sql`${transferOrders.createdOn} > ${cDate}::timestamp`,
            ),
            and(
              eq(scoreSql, c.score),
              eq(transferOrders.createdOn, sql`${cDate}::timestamp`),
              sql`${transferOrders.transferOrderId} > ${c.id}`,
            ),
          );
          return q.where(
            whereClause ? and(whereClause, cursorCond) : cursorCond,
          );
        }
      },
      applyOrderBy: (q, dir) => {
        const orderFn = dir === 'next' ? desc : asc;
        return q.orderBy(
          orderFn(scoreSql),
          orderFn(transferOrders.createdOn),
          orderFn(transferOrders.transferOrderId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: (row.createdOn || new Date()).toISOString(),
        id: row.id,
      }),
    });

    let countQb = this.db
      .select({ count: sql<number>`count(*)` })
      .from(transferOrders)
      .$dynamic();

    if (conditions.length > 0) {
      countQb = countQb.where(and(...conditions));
    }

    const [{ count }] = await countQb;

    return { data, page, limit, total: Number(count), nextCursor, prevCursor };
  }

  async findShipments(transferOrderId: string) {
    const data = await this.db
      .select({
        shipmentId: transferOrderShipments.shipmentId,
        shipmentNumber: transferOrderShipments.shipmentNumber,
        stateCode: transferOrderShipments.stateCode,
        notes: sql<string | null>`NULL`,
        trackingNumber: transferOrderShipments.trackingNumber,
        createdOn: transferOrderShipments.createdOn,
        createdBy: transferOrderShipments.shippedBy,
      })
      .from(transferOrderShipments)
      .where(eq(transferOrderShipments.transferOrderId, transferOrderId))
      .orderBy(desc(transferOrderShipments.createdOn));

    if (data.length === 0) return [];

    const shipmentIds = data.map((s) => s.shipmentId);

    const linesData = await this.db
      .select({
        shipmentLineId: transferOrderShipmentLines.shipmentLineId,
        shipmentId: transferOrderShipmentLines.shipmentId,
        salesOrderLineId: transferOrderShipmentLines.transferOrderLineId, // mapping to match UI
        quantityShipped: transferOrderShipmentLines.quantity,
      })
      .from(transferOrderShipmentLines)
      .where(
        sql`${transferOrderShipmentLines.shipmentId} IN (${sql.join(
          shipmentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const linesMap = new Map<string, typeof linesData>();
    for (const line of linesData) {
      if (!linesMap.has(line.shipmentId)) linesMap.set(line.shipmentId, []);
      linesMap.get(line.shipmentId)!.push(line);
    }

    return data.map((s) => ({
      ...s,
      lines: linesMap.get(s.shipmentId) || [],
    }));
  }

  async findOne(id: string) {
    const destLoc = alias(locations, 'destLoc');
    const sourceLoc = alias(locations, 'sourceLoc');

    const [order] = await this.db
      .select({
        id: transferOrders.transferOrderId,
        transferOrderId: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        stateCode: transferOrders.stateCode,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        destinationLocationId: transferOrders.destinationLocationId,
        destinationLocationName: destLoc.name,
        createdBy: transferOrders.createdBy,
        createdOn: transferOrders.createdOn,
        notes: transferOrders.notes,
        shippingNotes: transferOrders.shippingNotes,
      })
      .from(transferOrders)
      .leftJoin(
        sourceLoc,
        eq(transferOrders.sourceLocationId, sourceLoc.locationId),
      )
      .leftJoin(
        destLoc,
        eq(transferOrders.destinationLocationId, destLoc.locationId),
      )
      .where(eq(transferOrders.transferOrderId, id));

    if (!order) {
      throw new NotFoundException('Transfer Order not found');
    }

    const lines = await this.db
      .select({
        id: transferOrderLines.transferOrderLineId,
        transferOrderLineId: transferOrderLines.transferOrderLineId,
        productId: transferOrderLines.productId,
        productNumber: coreProducts.productNumber,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
        quantityShipped: transferOrderLines.quantityShipped,
        quantityReceived: transferOrderLines.quantityReceived,
      })
      .from(transferOrderLines)
      .innerJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(eq(transferOrderLines.transferOrderId, id));

    const events = await this.db
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
          eq(warehouseEvents.entityType, EntityType.TRANSFER_ORDER),
          eq(warehouseEvents.entityId, id),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return { ...order, lines, events };
  }

  async create(dto: CreateTransferOrderDto, actor: string) {
    return await this.db.transaction(async (tx) => {
      const prefix = `TO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
      const lastOrder = await tx
        .select({ orderNumber: transferOrders.orderNumber })
        .from(transferOrders)
        .where(sql`${transferOrders.orderNumber} LIKE ${prefix + '%'}`)
        .orderBy(desc(transferOrders.orderNumber))
        .limit(1);

      let nextNum = 1;
      if (lastOrder.length > 0) {
        const parts = lastOrder[0].orderNumber.split('-');
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const orderNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;
      const transferOrderId = uuidv4();

      await tx.insert(transferOrders).values({
        transferOrderId,
        orderNumber,
        sourceLocationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        notes: dto.notes,
        shippingNotes: dto.shippingNotes,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: actor,
      });

      if (dto.lines && dto.lines.length > 0) {
        const linesInsert = dto.lines.map((l) => ({
          transferOrderLineId: uuidv4(),
          transferOrderId,
          productId: l.productId,
          quantity: l.quantity,
        }));
        await tx.insert(transferOrderLines).values(linesInsert);
      }

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: transferOrderId,
        eventType: EventType.UPDATED,
        entityDisplayName: orderNumber,
        payload: { orderNumber },
        actor,
      });

      return { id: transferOrderId, transferOrderId, orderNumber };
    });
  }

  async update(id: string, dto: UpdateTransferOrderDto, actor: string) {
    const [existing] = await this.db
      .select({ stateCode: transferOrders.stateCode })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');

    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      if (dto.sourceLocationId || dto.destinationLocationId) {
        throw new BadRequestException(
          'Cannot edit locations on an order that is already in progress',
        );
      }
    }

    const updates: Record<string, unknown> = { modifiedOn: new Date() };
    if (dto.sourceLocationId) updates.sourceLocationId = dto.sourceLocationId;
    if (dto.destinationLocationId)
      updates.destinationLocationId = dto.destinationLocationId;
    if (dto.notes !== undefined) updates.notes = dto.notes;
    if (dto.shippingNotes !== undefined)
      updates.shippingNotes = dto.shippingNotes;

    if (Object.keys(updates).length > 1) {
      const [updatedRecord] = await this.db
        .update(transferOrders)
        .set(updates)
        .where(eq(transferOrders.transferOrderId, id))
        .returning();

      if (updatedRecord) {
        await emitEvent(this.db, {
          entityType: EntityType.TRANSFER_ORDER,
          entityId: id,
          eventType: EventType.UPDATED,
          entityDisplayName: updatedRecord.orderNumber,
          payload: { changes: updates },
          actor,
        });
      }
    }

    return { success: true };
  }

  async addLine(id: string, dto: CreateTransferOrderLineDto, actor: string) {
    const [existing] = await this.db
      .select({
        stateCode: transferOrders.stateCode,
        orderNumber: transferOrders.orderNumber,
      })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');
    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException(
        'Cannot edit an order that is already in progress',
      );
    }

    const lineId = uuidv4();
    await this.db.insert(transferOrderLines).values({
      transferOrderLineId: lineId,
      transferOrderId: id,
      productId: dto.productId,
      quantity: dto.quantity,
    });

    await emitEvent(this.db, {
      entityType: EntityType.TRANSFER_ORDER,
      entityId: id,
      eventType: EventType.LINE_ADDED,
      entityDisplayName: existing.orderNumber,
      payload: { action: 'addLine', lineId },
      actor,
    });

    return { lineId };
  }

  async updateLine(
    id: string,
    lineId: string,
    dto: UpdateTransferOrderLineDto,
    actor: string,
  ) {
    const [existing] = await this.db
      .select({
        stateCode: transferOrders.stateCode,
        orderNumber: transferOrders.orderNumber,
      })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');
    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException(
        'Cannot edit an order that is already in progress',
      );
    }

    if (dto.quantity !== undefined) {
      await this.db
        .update(transferOrderLines)
        .set({ quantity: dto.quantity })
        .where(eq(transferOrderLines.transferOrderLineId, lineId));

      await emitEvent(this.db, {
        entityType: EntityType.TRANSFER_ORDER,
        entityId: id,
        eventType: EventType.LINE_UPDATED,
        entityDisplayName: existing.orderNumber,
        payload: { action: 'updateLine', lineId },
        actor,
      });
    }
    return { success: true };
  }

  async removeLine(id: string, lineId: string, actor: string) {
    const [existing] = await this.db
      .select({
        stateCode: transferOrders.stateCode,
        orderNumber: transferOrders.orderNumber,
      })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');
    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException(
        'Cannot edit an order that is already in progress',
      );
    }

    await this.db
      .delete(transferOrderLines)
      .where(eq(transferOrderLines.transferOrderLineId, lineId));

    await emitEvent(this.db, {
      entityType: EntityType.TRANSFER_ORDER,
      entityId: id,
      eventType: EventType.LINE_REMOVED,
      entityDisplayName: existing.orderNumber,
      payload: { action: 'removeLine', lineId },
      actor,
    });

    return { success: true };
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

      // Reset linked backorders
      await tx
        .update(backorders)
        .set({
          transferOrderId: null,
          transferOrderLineId: null,
          // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
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

  async findEvents(transferOrderId: string) {
    const events = await this.db
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
          eq(warehouseEvents.entityType, EntityType.TRANSFER_ORDER),
          eq(warehouseEvents.entityId, transferOrderId),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return events;
  }
}
