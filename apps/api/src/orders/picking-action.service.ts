import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  products as coreProducts,
  bins,
  zones,
  salesOrderPicks,
} from '@herobm/db-schema';
import { findOrder, findOrderLine } from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { evaluateLifecycleRules } from './order-lifecycle-rules';
import {
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_PICK_TRANSITIONS,
  SALES_ORDER_STATE,
  getValidStates,
} from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';

const VALID_PICK_STATES = getValidStates(SALES_ORDER_PICK_TRANSITIONS);

@Injectable()
export class PickingActionService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

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

    const [shippingBin] = await this.db
      .select({ binId: bins.binId })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(
        and(
          eq(bins.binNumber, 'SHIPPING'),
          eq(zones.locationId, line.fulfillmentLocationId!),
        ),
      )
      .limit(1);

    if (!shippingBin) {
      throw new BadRequestException(
        `No SHIPPING staging bin found for location ${line.fulfillmentLocationId}.`,
      );
    }

    if (binId === shippingBin.binId) {
      throw new BadRequestException(
        `Cannot pick from the SHIPPING bin. Stock is already staged for dispatch.`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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
            quantity: -qty,
            uomCode: line.unitOfMeasure || 'EA',
          },
          {
            productId: pick.productId,
            binId: pick.binId!,
            quantity: qty,
            uomCode: line.unitOfMeasure || 'EA',
          },
        ],
      });

      const updatedPick = await this.changeSalesPickState(
        pickId,
        SALES_ORDER_PICK_STATE.CANCELLED,
        actor,
        tx,
      );

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
}
