import { isPickableBinSqlCondition } from '../inventory/inventory-math.utils';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
  bins,
  zones,
  binContents,
  locations,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  backorders,
  customers as coreAccounts,
  customerGroups,
  salesInvoices,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  actors,
} from '../drizzle/schema';
import {
  findOrder,
  findOrderLine,
  getCommittedPerLine,
} from './shipment-helpers';
import { getCreditBlockedSql } from './orders.sql';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { ShipmentService } from './shipment.service';
import { calculatePickAllocations } from './picking-math.utils';
import { evaluateLifecycleRules } from './order-lifecycle-rules';
import {
  filterPickableBins,
  calculatePickableOnHand,
} from '../inventory/inventory-math.utils';
import {
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_PICK_TRANSITIONS,
  SALES_ORDER_STATE,
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_PICK_STATE,
  BACKORDER_STATE,
  getValidStates,
} from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';

const VALID_PICK_STATES = getValidStates(SALES_ORDER_PICK_TRANSITIONS);

@Injectable()
export class PickingService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly shipmentService: ShipmentService,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  private readonly logger = new Logger(PickingService.name);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  /**
   * Get picking summary for an order, including shipped quantities.
   */
  async getPickingSummary(orderId: string) {
    await findOrder(this.db, orderId);

    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
        productId: salesOrderLineItems.productId,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
        locationName: locations.name,
        fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .leftJoin(
        locations,
        eq(salesOrderLineItems.fulfillmentLocationId, locations.locationId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    const committedMap = await getCommittedPerLine(this.db, orderId);

    // Fetch backorder allocation status per line
    const lineIds = lines.map((l) => l.salesOrderLineId);
    const allocations =
      lineIds.length > 0
        ? await this.db
            .select({
              salesOrderLineId: backorders.salesOrderLineId,
              allocatedQty:
                sql<number>`COALESCE(SUM(${backorders.quantity}), 0)`.mapWith(
                  Number,
                ),
            })
            .from(backorders)
            .where(
              and(
                inArray(backorders.salesOrderLineId, lineIds),
                eq(backorders.stateCode, BACKORDER_STATE.RECEIVED_RESERVED),
              ),
            )
            .groupBy(backorders.salesOrderLineId)
        : [];
    const allocationMap = new Map(
      allocations.map((a) => [a.salesOrderLineId, a.allocatedQty]),
    );

    const productIds = Array.from(
      new Set(lines.map((l) => l.productId).filter(Boolean) as string[]),
    );
    const binStock =
      productIds.length > 0
        ? await this.db
            .select({
              productId: binContents.productId,
              locationId: zones.locationId,
              zoneCode: zones.code,
              binId: bins.binId,
              binNumber: bins.binNumber,
              binType: bins.binType,
              isUnavailable: bins.isUnavailable,
              onHand: binContents.actualQuantity,
            })
            .from(binContents)
            .innerJoin(bins, eq(binContents.binId, bins.binId))
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(inArray(binContents.productId, productIds))
        : [];

    const picksRaw = await this.db
      .select({
        pick: salesOrderPicks,
        binName: bins.binNumber,
      })
      .from(salesOrderPicks)
      .leftJoin(bins, eq(salesOrderPicks.binId, bins.binId))
      .where(eq(salesOrderPicks.salesOrderId, orderId));

    const picks = picksRaw.map((p) => ({
      ...p.pick,
      binName: p.binName,
    }));

    const pickedMap = new Map<string, number>();
    for (const pick of picks) {
      if (pick.stateCode !== SALES_ORDER_PICK_STATE.CANCELLED) {
        const current = pickedMap.get(pick.salesOrderLineId) || 0;
        pickedMap.set(
          pick.salesOrderLineId,
          current + parseFloat(pick.quantity),
        );
      }
    }

    const summary = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const isPhysical = !line.productType || line.productType === 'inventory';
      const picked = isPhysical
        ? (pickedMap.get(line.salesOrderLineId) ?? 0)
        : ordered;
      const committed = isPhysical
        ? (committedMap.get(line.salesOrderLineId) ?? 0)
        : ordered;

      const productLocationBins = binStock.filter(
        (s) =>
          s.productId === line.productId &&
          s.locationId === line.fulfillmentLocationId,
      );

      const availableBins = filterPickableBins(productLocationBins)
        .sort(
          (a, b) =>
            parseFloat(String(b.onHand || 0)) -
            parseFloat(String(a.onHand || 0)),
        )
        .map((b) => ({
          binId: b.binId,
          binName: `${b.zoneCode}.${b.binNumber}`,
          onHand: String(b.onHand || 0),
        }));

      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productType: line.productType,
        productDescription: line.productDescription,
        locationName: line.locationName || 'System Default',
        quantity: line.quantity,
        quantityPicked: isPhysical ? String(picked) : String(ordered),
        quantityShipped: String(committed),
        remaining: String(ordered - picked),
        isFullyPicked: picked >= ordered,
        isPhysical,
        onHand: String(calculatePickableOnHand(productLocationBins)),
        availableBins,
        hasAllocation: (allocationMap.get(line.salesOrderLineId) ?? 0) > 0,
      };
    });

    const filteredSummary = summary.filter((s) => parseFloat(s.quantity) > 0);
    const activePhysicalLines = filteredSummary.filter((s) => s.isPhysical);

    const totalLines = activePhysicalLines.length;
    const fullyPickedLines = activePhysicalLines.filter(
      (s) => s.isFullyPicked,
    ).length;

    return {
      totalLines,
      fullyPickedLines,
      isFullyPicked: totalLines > 0 && fullyPickedLines === totalLines,
      lines: filteredSummary,
      picks, // Include raw picks for UI
    };
  }

  // -------------------------------------------------------------------------
  // Pick Line
  // -------------------------------------------------------------------------

  async pickLine(
    orderId: string,
    lineId: string,
    binId: string,
    quantity: string,
    actor: string,
  ) {
    const order = await findOrder(this.db, orderId);
    if (
      order.stateCode !== SALES_ORDER_STATE.PICKING &&
      order.stateCode !== SALES_ORDER_STATE.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot pick lines on order in state '${order.stateCode}'. Order must be in '${SALES_ORDER_STATE.CONFIRMED}' or '${SALES_ORDER_STATE.PICKING}'.`,
      );
    }

    const line = await findOrderLine(this.db, lineId, orderId);
    const qty = parseFloat(quantity);
    const ordered = parseFloat(line.quantity);

    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestException('Picked quantity must be > 0');
    }

    // Get current picked amount
    const [currentPickSum] = await this.db
      .select({ sum: sql<number>`COALESCE(SUM(quantity), 0)`.mapWith(Number) })
      .from(salesOrderPicks)
      .where(
        and(
          eq(salesOrderPicks.salesOrderLineId, lineId),
          sql`state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}`,
        ),
      );

    const currentlyPicked = parseFloat(String(currentPickSum?.sum ?? 0));

    if (currentlyPicked + qty > ordered) {
      throw new BadRequestException(
        `Cannot pick ${qty} — only ${ordered - currentlyPicked} remaining on this line`,
      );
    }

    // Resolve SHIPPING bin for physical stock movement
    const [shippingBin] = await this.db
      .select({ binId: bins.binId })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(bins.binNumber, 'SHIPPING'),
          eq(zones.locationId, line.fulfillmentLocationId),
        ),
      )
      .limit(1);

    if (!shippingBin) {
      throw new BadRequestException(
        `No SHIPPING staging bin found for location ${line.fulfillmentLocationId}.`,
      );
    }

    // Guard: source bin must not be the SHIPPING bin itself — picking from
    // SHIPPING to SHIPPING creates cancelling ledger entries (net zero).
    // Cross-dock picks from RECEIVING are valid and intentionally allowed.
    if (binId === shippingBin.binId) {
      throw new BadRequestException(
        `Cannot pick from the SHIPPING bin. Stock is already staged for dispatch.`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // 1. Record physical inventory movement
      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `PCK-${orderId.substring(0, 8)}-${line.lineNumber}-${Date.now()
          .toString()
          .slice(-4)}`,
        sourceType: 'SO_PICK',
        sourceId: orderId,
        memo: `Sales Order Pick`,
        userId: actor,
        lines: [
          {
            productId: line.productId!,
            binId: binId,
            quantity: -qty,
            uomCode: line.unitOfMeasure || 'EA',
          },
          {
            productId: line.productId!,
            binId: shippingBin.binId,
            quantity: qty,
            uomCode: line.unitOfMeasure || 'EA',
          },
        ],
      });

      // 2. Insert into sales_order_picks
      const [newPick] = await tx
        .insert(salesOrderPicks)
        .values({
          salesOrderId: orderId,
          salesOrderLineId: lineId,
          productId: line.productId!,
          binId: binId,
          quantity: quantity,
          createdBy: actor,
          stateCode: SALES_ORDER_PICK_STATE.PICKED,
        })
        .returning();

      // 3. Update order modifiedOn
      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      const [bin] = await tx
        .select({ binNumber: bins.binNumber })
        .from(bins)
        .where(eq(bins.binId, binId));

      await emitEvent(tx, {
        entityType: EntityType.WAREHOUSE,
        entityId: newPick.pickId,
        eventType: EventType.PICK_CREATED,
        entityDisplayName: order.orderNumber,
        payload: {
          pickId: newPick.pickId,
          salesOrderId: orderId,
          quantityPicked: quantity,
          binId,
          binNumber: bin?.binNumber,
        },
        actor,
      });

      await evaluateLifecycleRules(
        tx,
        orderId,
        { entity: 'picking', id: lineId, action: 'pick_created' },
        actor,
      );

      return newPick;
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // Shipped gate — called from OrdersWriteService
  // -------------------------------------------------------------------------

  /**
   * Check if all lines on an order are fully picked.
   * Throws BadRequestException if not.
   */
  async assertFullyPicked(orderId: string): Promise<void> {
    const summary = await this.getPickingSummary(orderId);

    const unpicked = summary.lines.filter((l) => {
      const ordered = parseFloat(l.quantity);
      const picked = parseFloat(l.quantityPicked ?? '0');
      return picked < ordered;
    });

    if (unpicked.length > 0) {
      const details = unpicked.map(
        (l) =>
          `line ${l.lineNumber}: picked ${l.quantityPicked ?? '0'} of ${l.quantity}`,
      );
      throw new BadRequestException(
        `Cannot transition to '${SALES_ORDER_STATE.SHIPPED}' - ${unpicked.length} line(s) not fully picked: ${details.join('; ')}`,
      );
    }
  }

  /**
   * Check if all lines on an order are fully shipped.
   * Throws BadRequestException if not.
   */
  async assertFullyShipped(orderId: string): Promise<void> {
    const summary = await this.getPickingSummary(orderId);

    const unshipped = summary.lines.filter((l) => {
      const ordered = parseFloat(l.quantity);
      const shipped = parseFloat(l.quantityShipped ?? '0');
      return shipped < ordered;
    });

    if (unshipped.length > 0) {
      const details = unshipped.map(
        (l) =>
          `line ${l.lineNumber}: shipped ${l.quantityShipped ?? '0'} of ${l.quantity}`,
      );
      throw new BadRequestException(
        `Cannot transition to '${SALES_ORDER_STATE.SHIPPED}' - ${unshipped.length} line(s) not fully shipped: ${details.join('; ')}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Picking Queue
  // -------------------------------------------------------------------------

  /**
   * Returns a queue of orders pending picking, enriched with pickability status.
   * Pickability is determined by physical on-hand stock in pickable bins.
   */
  async getPickingQueue(locationId?: string) {
    const rawLines = await this.db
      .select({
        id: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        name: salesOrders.name,
        customerName: actors.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        stateCode: salesOrders.stateCode,
        createdOn: salesOrders.createdOn,
        createdBy: salesOrders.createdBy,
        currencyCode: salesOrders.currencyCode,
        isCreditBlocked: getCreditBlockedSql(),
        lineId: salesOrderLineItems.salesOrderLineId,
        lineQuantity: salesOrderLineItems.quantity,
        isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' THEN true ELSE false END`,
        onHand: sql<number>`COALESCE((
          SELECT sum(bc.actual_quantity)
          FROM herobm_core.bin_contents bc
          JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
          JOIN herobm_core.zones z ON z.zone_id = b.zone_id
          WHERE bc.product_id = ${salesOrderLineItems.productId}
            AND z.location_id = ${salesOrderLineItems.fulfillmentLocationId}
            AND ${isPickableBinSqlCondition('b')}
        ), 0)`,
        pickedQty: sql<number>`COALESCE((
          SELECT SUM(quantity) 
          FROM herobm_core.sales_order_picks 
          WHERE sales_order_line_id = ${salesOrderLineItems.salesOrderLineId}
            AND state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
        hasAllocation: sql<boolean>`EXISTS(
          SELECT 1 FROM herobm_core.backorders bo
          WHERE bo.sales_order_line_id = ${salesOrderLineItems.salesOrderLineId}
            AND bo.state_code = ${BACKORDER_STATE.RECEIVED_RESERVED}
        )`,
      })
      .from(salesOrders)
      .innerJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(
        and(
          inArray(salesOrders.stateCode, [
            SALES_ORDER_STATE.CONFIRMED,
            SALES_ORDER_STATE.PICKING,
          ]),
          locationId
            ? eq(salesOrderLineItems.fulfillmentLocationId, locationId)
            : undefined,
        ),
      )
      .orderBy(salesOrders.createdOn);

    const rawTransferLines = await this.db
      .select({
        id: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        name: sql<string>`'Internal Transfer'`,
        customerName: locations.name,
        customerOrderNumber: sql<string>`'N/A'`,
        stateCode: transferOrders.stateCode,
        createdOn: transferOrders.createdOn,
        createdBy: transferOrders.createdBy,
        currencyCode: sql<string>`'N/A'`,
        isCreditBlocked: sql<boolean>`false`,
        lineId: transferOrderLines.transferOrderLineId,
        lineQuantity: transferOrderLines.quantity,
        isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' THEN true ELSE false END`,
        onHand: sql<number>`COALESCE((
          SELECT sum(bc.actual_quantity)
          FROM herobm_core.bin_contents bc
          JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
          JOIN herobm_core.zones z ON z.zone_id = b.zone_id
          WHERE bc.product_id = ${transferOrderLines.productId}
            AND z.location_id = ${transferOrders.sourceLocationId}
            AND ${isPickableBinSqlCondition('b')}
        ), 0)`,
        pickedQty: sql<number>`COALESCE((
          SELECT SUM(quantity) 
          FROM herobm_core.transfer_order_picks 
          WHERE transfer_order_line_id = ${transferOrderLines.transferOrderLineId}
            AND state_code != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
        hasAllocation: sql<boolean>`false`,
        type: sql<string>`'transfer_order'`,
      })
      .from(transferOrders)
      .innerJoin(
        transferOrderLines,
        eq(transferOrders.transferOrderId, transferOrderLines.transferOrderId),
      )
      .leftJoin(
        locations,
        eq(transferOrders.destinationLocationId, locations.locationId),
      )
      .leftJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(
        and(
          inArray(transferOrders.stateCode, [
            TRANSFER_ORDER_STATE.CONFIRMED,
            TRANSFER_ORDER_STATE.PICKING,
          ]),
          locationId
            ? eq(transferOrders.sourceLocationId, locationId)
            : undefined,
        ),
      );

    const allLines = [
      ...rawLines.map((r) => ({ ...r, type: 'sales_order' })),
      ...rawTransferLines,
    ];

    const orderMap = new Map<
      string,
      Record<string, unknown> & {
        id: string;
        orderNumber: string;
        name: string | null;
        customerName: string | null;
        customerOrderNumber: string | null;
        stateCode: string;
        createdOn: Date | null;
        createdBy: string | null;
        totalPrice: string | null;
        currencyCode: string | null;
        isCreditBlocked: boolean;
        type: string;
        _hasAllocation?: boolean;
        _linesUnfulfilled?: number;
        _linesFullyPickable?: number;
        _linesPartiallyPickable?: number;
      }
    >();

    for (const row of allLines) {
      if (!orderMap.has(row.id)) {
        orderMap.set(row.id, {
          id: row.id,
          orderNumber: row.orderNumber,
          name: row.name,
          customerName: row.customerName,
          customerOrderNumber: row.customerOrderNumber,
          // eslint-disable-next-line no-restricted-syntax -- State initialization on a map object query result, not a database mutation.
          stateCode: row.stateCode,
          createdOn: row.createdOn,
          createdBy: row.createdBy,
          totalPrice: null,
          currencyCode: row.currencyCode,
          isCreditBlocked: row.isCreditBlocked,
          _linesUnfulfilled: 0,
          _linesFullyPickable: 0,
          _linesPartiallyPickable: 0,
          _hasAllocation: false,
          type: row.type,
        });
      }

      const order = orderMap.get(row.id);
      if (!order) continue;

      if (row.hasAllocation) {
        order._hasAllocation = true;
      }
      if (row.isPhysical) {
        const required = parseFloat(row.lineQuantity ?? '0');
        const picked = parseFloat(row.pickedQty?.toString() ?? '0');
        const remaining = required - picked;

        if (remaining > 0) {
          order._linesUnfulfilled = (order._linesUnfulfilled || 0) + 1;
          const onHand = parseFloat(row.onHand?.toString() ?? '0');

          if (onHand >= remaining) {
            order._linesFullyPickable = (order._linesFullyPickable || 0) + 1;
          } else if (onHand > 0) {
            order._linesPartiallyPickable =
              (order._linesPartiallyPickable || 0) + 1;
          }
          // else: blocked (no on-hand) — counted implicitly
        }
      }
    }

    const queue = Array.from(orderMap.values())
      .filter((order) => (order._linesUnfulfilled || 0) > 0)
      .map((order) => {
        let pickabilityStatus: 'ready' | 'partial' | 'blocked';

        if (order._linesFullyPickable === order._linesUnfulfilled) {
          pickabilityStatus = 'ready';
        } else if (
          (order._linesFullyPickable || 0) > 0 ||
          (order._linesPartiallyPickable || 0) > 0
        ) {
          pickabilityStatus = 'partial';
        } else {
          pickabilityStatus = 'blocked';
        }

        const hasAllocation = order._hasAllocation;
        delete order._linesUnfulfilled;
        delete order._linesFullyPickable;
        delete order._linesPartiallyPickable;
        delete order._hasAllocation;

        return {
          ...order,
          pickabilityStatus,
          hasAllocation,
        };
      });

    // Sort: allocated orders first within each status group
    queue.sort((a, b) => {
      if (a.hasAllocation !== b.hasAllocation) {
        return a.hasAllocation ? -1 : 1;
      }
      return 0; // preserve original createdOn ordering within same allocation status
    });

    return queue;
  }

  // -------------------------------------------------------------------------
  // Cancel Pick Line
  // -------------------------------------------------------------------------

  async cancelPick(orderId: string, pickId: string, actor: string) {
    const pickRows = await this.db
      .select({
        pick: salesOrderPicks,
        locationId: zones.locationId,
      })
      .from(salesOrderPicks)
      .innerJoin(bins, eq(salesOrderPicks.binId, bins.binId))
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(salesOrderPicks.pickId, pickId),
          eq(salesOrderPicks.salesOrderId, orderId),
        ),
      )
      .limit(1);

    if (pickRows.length === 0) {
      throw new BadRequestException(
        `Pick not found or does not belong to this order.`,
      );
    }

    const { pick, locationId } = pickRows[0];

    if (pick.stateCode !== SALES_ORDER_PICK_STATE.PICKED) {
      throw new BadRequestException(
        `Cannot cancel pick in state '${pick.stateCode}'. Only 'picked' lines can be cancelled.`,
      );
    }

    const qty = parseFloat(pick.quantity);
    const line = await findOrderLine(this.db, pick.salesOrderLineId, orderId);

    // Resolve SHIPPING bin for physical stock movement reversal
    const [shippingBin] = await this.db
      .select({ binId: bins.binId })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(eq(bins.binNumber, 'SHIPPING'), eq(zones.locationId, locationId)),
      )
      .limit(1);

    if (!shippingBin) {
      throw new BadRequestException(
        `No SHIPPING staging bin found for location ${locationId}.`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // 1. Record physical inventory movement (reverse the pick)
      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `UPK-${orderId.substring(0, 8)}-${Date.now()
          .toString()
          .slice(-4)}`,
        sourceType: 'SO_PICK',
        sourceId: orderId,
        memo: `Sales Order Pick Reversal`,
        userId: actor,
        lines: [
          {
            productId: pick.productId,
            binId: shippingBin.binId,
            quantity: -qty, // remove from shipping
            uomCode: line.unitOfMeasure || 'EA',
          },
          {
            productId: pick.productId,
            binId: pick.binId!, // put back to original bin
            quantity: qty,
            uomCode: line.unitOfMeasure || 'EA',
          },
        ],
      });

      // 2. Update sales_order_picks
      const updatedPick = await this.changeSalesPickState(
        pickId,
        SALES_ORDER_PICK_STATE.CANCELLED,
        actor,
        tx,
      );

      // 3. Update order modifiedOn
      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.UPDATED,
        entityDisplayName: orderId,
        payload: { pickId, action: 'cancelled' },
        actor,
      });

      return updatedPick;
    });

    return result;
  }

  /**
   * Universal changeState for Sales Order Picks
   */
  async changeSalesPickState(
    pickId: string,
    newState: string,
    actor: string,
    tx: DrizzleDB,
  ) {
    if (!VALID_PICK_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid pick state: '${newState}'`);
    }

    const [pick] = await tx
      .select({
        stateCode: salesOrderPicks.stateCode,
        salesOrderLineId: salesOrderPicks.salesOrderLineId,
        productId: salesOrderPicks.productId,
        quantity: salesOrderPicks.quantity,
        binId: salesOrderPicks.binId,
        salesOrderId: salesOrderPicks.salesOrderId,
      })
      .from(salesOrderPicks)
      .where(eq(salesOrderPicks.pickId, pickId));

    if (!pick) {
      throw new BadRequestException(`Pick ${pickId} not found`);
    }

    const allowed = SALES_ORDER_PICK_TRANSITIONS[pick.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition pick from '${pick.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await tx
      .update(salesOrderPicks)
      .set({
        stateCode: newState as typeof salesOrderPicks.$inferInsert.stateCode,
        modifiedOn: new Date(),
      })
      .where(eq(salesOrderPicks.pickId, pickId))
      .returning();

    if (newState === SALES_ORDER_PICK_STATE.CANCELLED) {
      const [[order], [product], [bin]] = await Promise.all([
        tx
          .select({ orderNumber: salesOrders.orderNumber })
          .from(salesOrders)
          .where(eq(salesOrders.salesOrderId, pick.salesOrderId)),
        tx
          .select({ name: coreProducts.name })
          .from(coreProducts)
          .where(eq(coreProducts.productId, pick.productId)),
        pick.binId
          ? tx
              .select({ binNumber: bins.binNumber })
              .from(bins)
              .where(eq(bins.binId, pick.binId))
          : Promise.resolve([null]),
      ]);
      await emitEvent(tx, {
        entityType: EntityType.WAREHOUSE,
        entityId: pickId,
        eventType: EventType.PICK_CANCELLED,
        entityDisplayName: order.orderNumber,
        payload: {
          pickId,
          salesOrderId: pick.salesOrderId,
          salesOrderLineId: pick.salesOrderLineId,
          productId: pick.productId,
          productName: product?.name,
          quantityPicked: pick.quantity,
          binId: pick.binId,
          binNumber: bin?.binNumber,
        },
        actor,
      });
    }

    return updated;
  }

  // -------------------------------------------------------------------------
  // Shipping Queue
  // -------------------------------------------------------------------------

  /**
   * Returns a queue of orders pending shipment, enriched with shippability status.
   * Shippability is determined by comparing picked quantities to shipped quantities.
   */
  async getShippingQueue(locationId?: string) {
    const rawLines = await this.db
      .select({
        id: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        name: salesOrders.name,
        customerName: actors.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        stateCode: salesOrders.stateCode,
        createdOn: salesOrders.createdOn,
        createdBy: salesOrders.createdBy,
        currencyCode: salesOrders.currencyCode,
        isCreditBlocked: getCreditBlockedSql(),
        lineId: salesOrderLineItems.salesOrderLineId,
        lineQuantity: salesOrderLineItems.quantity,
        isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' OR ${coreProducts.productType} IS NULL THEN true ELSE false END`,
        pickedQty: sql<number>`COALESCE((
          SELECT SUM(quantity)
          FROM herobm_core.sales_order_picks
          WHERE sales_order_line_id = ${salesOrderLineItems.salesOrderLineId}
            AND state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
        shippedQty: sql<number>`COALESCE((
          SELECT SUM(sl.quantity_shipped)
          FROM herobm_core.sales_order_shipment_lines sl
          JOIN herobm_core.sales_order_shipments s ON s.shipment_id = sl.shipment_id
          WHERE sl.sales_order_line_id = ${salesOrderLineItems.salesOrderLineId}
             AND s.state_code != ${SALES_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
      })
      .from(salesOrders)
      .innerJoin(
        salesOrderLineItems,
        eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(
        and(
          eq(salesOrders.stateCode, SALES_ORDER_STATE.PICKING),
          locationId
            ? eq(salesOrderLineItems.fulfillmentLocationId, locationId)
            : undefined,
        ),
      )
      .orderBy(salesOrders.createdOn);

    const rawTransferLines = await this.db
      .select({
        id: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        name: sql<string | null>`NULL`,
        customerName: locations.name,
        customerOrderNumber: sql<string | null>`NULL`,
        stateCode: transferOrders.stateCode,
        createdOn: transferOrders.createdOn,
        createdBy: transferOrders.createdBy,
        currencyCode: sql<string | null>`NULL`,
        isCreditBlocked: sql<boolean>`false`,
        lineId: transferOrderLines.transferOrderLineId,
        lineQuantity: transferOrderLines.quantity,
        isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' OR ${coreProducts.productType} IS NULL THEN true ELSE false END`,
        pickedQty: sql<number>`COALESCE((
          SELECT SUM(quantity)
          FROM herobm_core.transfer_order_picks
          WHERE transfer_order_line_id = ${transferOrderLines.transferOrderLineId}
            AND state_code != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}
        ), 0)`,
        shippedQty: sql<number>`COALESCE((
          SELECT SUM(sl.quantity)
          FROM herobm_core.transfer_order_shipment_lines sl
          JOIN herobm_core.transfer_order_shipments s ON s.shipment_id = sl.shipment_id
          WHERE sl.transfer_order_line_id = ${transferOrderLines.transferOrderLineId}
             AND s.state_code != 'cancelled'
        ), 0)`,
      })
      .from(transferOrders)
      .innerJoin(
        transferOrderLines,
        eq(transferOrders.transferOrderId, transferOrderLines.transferOrderId),
      )
      .leftJoin(
        locations,
        eq(transferOrders.destinationLocationId, locations.locationId),
      )
      .leftJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(
        and(
          eq(transferOrders.stateCode, TRANSFER_ORDER_STATE.PICKING),
          locationId
            ? eq(transferOrders.sourceLocationId, locationId)
            : undefined,
        ),
      )
      .orderBy(transferOrders.createdOn);

    const allLines = [
      ...rawLines.map((r) => ({ ...r, type: 'sales_order' })),
      ...rawTransferLines.map((r) => ({ ...r, type: 'transfer_order' })),
    ];

    const orderMap = new Map<
      string,
      Record<string, unknown> & {
        id: string;
        orderNumber: string;
        name: string | null;
        customerName: string | null;
        customerOrderNumber: string | null;
        stateCode: string;
        createdOn: Date | null;
        createdBy: string | null;
        currencyCode: string | null;
        type: string;
        _totalPhysicalLines?: number;
        _fullyPickedLines?: number;
        _shippableLines?: number;
      }
    >();

    for (const row of allLines) {
      if (!orderMap.has(row.id)) {
        orderMap.set(row.id, {
          id: row.id,
          orderNumber: row.orderNumber,
          name: row.name,
          customerName: row.customerName,
          customerOrderNumber: row.customerOrderNumber,
          // eslint-disable-next-line no-restricted-syntax -- State initialization on a map object query result, not a database mutation.
          stateCode: row.stateCode,
          createdOn: row.createdOn,
          createdBy: row.createdBy,
          currencyCode: row.currencyCode,
          type: row.type,
          _totalPhysicalLines: 0,
          _fullyPickedLines: 0,
          _shippableLines: 0,
        });
      }

      const order = orderMap.get(row.id);
      if (!order) continue;

      const ordered = parseFloat(row.lineQuantity ?? '0');
      if (row.isPhysical && ordered > 0) {
        order._totalPhysicalLines = (order._totalPhysicalLines || 0) + 1;
        const picked = parseFloat(row.pickedQty?.toString() ?? '0');
        const shipped = parseFloat(row.shippedQty?.toString() ?? '0');
        const availableToShip = picked - shipped;

        if (picked >= ordered) {
          order._fullyPickedLines = (order._fullyPickedLines || 0) + 1;
        }

        if (availableToShip > 0) {
          order._shippableLines = (order._shippableLines || 0) + 1;
        }
      }
    }

    const queue = Array.from(orderMap.values())
      .filter((order) => (order._shippableLines || 0) > 0)
      .map((order) => {
        let shippabilityStatus: 'ready' | 'partial';

        if (
          (order._totalPhysicalLines || 0) > 0 &&
          order._fullyPickedLines === order._totalPhysicalLines
        ) {
          shippabilityStatus = 'ready';
        } else {
          shippabilityStatus = 'partial';
        }

        const totalShippableLines = order._shippableLines || 0;
        const totalLines = order._totalPhysicalLines || 0;
        delete order._totalPhysicalLines;
        delete order._fullyPickedLines;
        delete order._shippableLines;

        return {
          ...order,
          shippabilityStatus,
          totalShippableLines,
          totalLines,
        };
      });

    return queue;
  }

  // -------------------------------------------------------------------------
  // Shipping Context
  // -------------------------------------------------------------------------

  /**
   * Returns shipping context for an order: lines enriched with picked/shipped
   * quantities and available-to-ship amounts, plus existing shipment summaries.
   */
  async getShippingContext(orderId: string) {
    const [transferOrder] = await this.db
      .select()
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, orderId));
    if (transferOrder) {
      return this.getTransferShippingContext(orderId, transferOrder);
    }

    const order = await findOrder(this.db, orderId);

    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
        productId: salesOrderLineItems.productId,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    // Get picked quantities from the picks sub-ledger
    const lineIds = lines.map((l) => l.salesOrderLineId);
    const pickedMap = new Map<string, number>();
    if (lineIds.length > 0) {
      const pickSums = await this.db
        .select({
          salesOrderLineId: salesOrderPicks.salesOrderLineId,
          totalPicked:
            sql<number>`COALESCE(SUM(${salesOrderPicks.quantity}), 0)`.mapWith(
              Number,
            ),
        })
        .from(salesOrderPicks)
        .where(
          and(
            inArray(salesOrderPicks.salesOrderLineId, lineIds),
            sql`${salesOrderPicks.stateCode} != ${SALES_ORDER_PICK_STATE.CANCELLED}`,
          ),
        )
        .groupBy(salesOrderPicks.salesOrderLineId);

      for (const row of pickSums) {
        pickedMap.set(
          row.salesOrderLineId,
          parseFloat(String(row.totalPicked)),
        );
      }
    }

    // Get shipped quantities from committed (non-cancelled) shipment lines
    const committedMap = await getCommittedPerLine(this.db, orderId);

    const enrichedLines = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const isPhysical = !line.productType || line.productType === 'inventory';
      const picked = isPhysical
        ? (pickedMap.get(line.salesOrderLineId) ?? 0)
        : ordered;
      const shipped = committedMap.get(line.salesOrderLineId) ?? 0;
      const availableToShip = Math.max(0, picked - shipped);

      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productDescription: line.productDescription,
        isPhysical,
        quantity: line.quantity,
        quantityPicked: String(picked),
        quantityShipped: String(shipped),
        availableToShip: String(availableToShip),
      };
    });

    // Existing shipments summary
    const shipments = await this.db
      .select({
        shipmentId: salesOrderShipments.shipmentId,
        shipmentNumber: salesOrderShipments.shipmentNumber,
        stateCode: salesOrderShipments.stateCode,
        notes: salesOrderShipments.notes,
        trackingNumber: salesOrderShipments.trackingNumber,
        createdOn: salesOrderShipments.createdOn,
      })
      .from(salesOrderShipments)
      .where(
        and(
          eq(salesOrderShipments.salesOrderId, orderId),
          sql`${salesOrderShipments.stateCode} != ${SALES_ORDER_STATE.CANCELLED}`,
        ),
      )
      .orderBy(desc(salesOrderShipments.createdOn));

    // Get line counts per shipment
    const shipmentIds = shipments.map((s) => s.shipmentId);
    const lineCountMap = new Map<string, number>();
    if (shipmentIds.length > 0) {
      const lineCounts = await this.db
        .select({
          shipmentId: salesOrderShipmentLines.shipmentId,
          lineCount: sql<number>`COUNT(*)`,
        })
        .from(salesOrderShipmentLines)
        .where(inArray(salesOrderShipmentLines.shipmentId, shipmentIds))
        .groupBy(salesOrderShipmentLines.shipmentId);

      for (const row of lineCounts) {
        lineCountMap.set(row.shipmentId, Number(row.lineCount));
      }
    }

    return {
      order,
      lines: enrichedLines,
      shipments: shipments.map((s) => ({
        ...s,
        lineCount: lineCountMap.get(s.shipmentId) ?? 0,
      })),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for legacy code
  private async getTransferShippingContext(orderId: string, order: any) {
    const lines = await this.db
      .select({
        salesOrderLineId: transferOrderLines.transferOrderLineId, // alias to salesOrderLineId for UI compat
        lineNumber: sql<number>`0`, // No line number on transfer orders
        productId: transferOrderLines.productId,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
      })
      .from(transferOrderLines)
      .leftJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(eq(transferOrderLines.transferOrderId, orderId));

    // Get picked quantities
    const pickedMap = new Map<string, number>();
    const picks = await this.db
      .select({
        lineId: transferOrderPicks.transferOrderLineId,
        totalPicked:
          sql<number>`COALESCE(SUM(${transferOrderPicks.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transferOrderPicks)
      .where(
        and(
          eq(transferOrderPicks.transferOrderId, orderId),
          sql`${transferOrderPicks.stateCode} != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}`,
        ),
      )
      .groupBy(transferOrderPicks.transferOrderLineId);

    for (const p of picks) {
      pickedMap.set(p.lineId, p.totalPicked);
    }

    // Get shipped quantities
    const shippedMap = new Map<string, number>();
    const shipmentsLines = await this.db
      .select({
        lineId: transferOrderShipmentLines.transferOrderLineId,
        totalShipped:
          sql<number>`COALESCE(SUM(${transferOrderShipmentLines.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(transferOrderShipmentLines)
      .innerJoin(
        transferOrderShipments,
        eq(
          transferOrderShipmentLines.shipmentId,
          transferOrderShipments.shipmentId,
        ),
      )
      .where(
        and(
          eq(transferOrderShipments.transferOrderId, orderId),
          sql`${transferOrderShipments.stateCode} != 'cancelled'`,
        ),
      )
      .groupBy(transferOrderShipmentLines.transferOrderLineId);

    for (const s of shipmentsLines) {
      shippedMap.set(s.lineId, s.totalShipped);
    }

    const enrichedLines = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const isPhysical = true; // All transfer order lines are physical
      const picked = pickedMap.get(line.salesOrderLineId) ?? 0;
      const shipped = shippedMap.get(line.salesOrderLineId) ?? 0;
      const availableToShip = Math.max(0, picked - shipped);

      return {
        salesOrderLineId: line.salesOrderLineId, // keep key for UI compatibility
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productDescription: line.productDescription || '',
        isPhysical,
        quantity: line.quantity,
        quantityPicked: String(picked),
        quantityShipped: String(shipped),
        availableToShip: String(availableToShip),
      };
    });

    // Existing shipments summary
    const shipments = await this.db
      .select({
        shipmentId: transferOrderShipments.shipmentId,
        shipmentNumber: transferOrderShipments.shipmentNumber,
        stateCode: transferOrderShipments.stateCode,
        notes: sql<string>`''`,
        trackingNumber: sql<string>`''`,
        createdOn: transferOrderShipments.createdOn,
      })
      .from(transferOrderShipments)
      .where(
        and(
          eq(transferOrderShipments.transferOrderId, orderId),
          sql`${transferOrderShipments.stateCode} != 'cancelled'`,
        ),
      )
      .orderBy(desc(transferOrderShipments.createdOn));

    // Get line counts per shipment
    const shipmentIds = shipments.map((s) => s.shipmentId);
    const lineCountMap = new Map<string, number>();
    if (shipmentIds.length > 0) {
      const lineCounts = await this.db
        .select({
          shipmentId: transferOrderShipmentLines.shipmentId,
          lineCount: sql<number>`COUNT(*)`,
        })
        .from(transferOrderShipmentLines)
        .where(inArray(transferOrderShipmentLines.shipmentId, shipmentIds))
        .groupBy(transferOrderShipmentLines.shipmentId);

      for (const row of lineCounts) {
        lineCountMap.set(row.shipmentId, Number(row.lineCount));
      }
    }

    const destLocation = await this.db.query.locations.findFirst({
      where: eq(locations.locationId, order.destinationLocationId as string),
    });

    return {
      order: {
        id: order.transferOrderId,
        orderNumber: order.orderNumber,
        name: 'Internal Transfer',
        type: 'transfer_order',
        deliveryAddressLine1: destLocation?.name ?? 'Unknown Location',
        shippingNotes: order.shippingNotes ?? null,
      },
      lines: enrichedLines,
      shipments: shipments.map((s) => ({
        ...s,
        lineCount: lineCountMap.get(s.shipmentId) ?? 0,
      })),
    };
  }
}
