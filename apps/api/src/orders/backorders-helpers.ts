import type { DrizzleDB } from '../drizzle/drizzle.module';
import { backorders, purchaseOrders } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { eq, inArray } from 'drizzle-orm';
import { BACKORDER_STATE } from '@herobm/shared';

export type ChangeStateFn = (
  backorderId: string,
  targetState: string,
  actor: string,
  tx: DrizzleDB,
  updates?: Record<string, unknown>,
) => Promise<unknown>;

export async function executeUnlinkDemandForPoLine(
  tx: DrizzleDB,
  purchaseOrderLineId: string,
  actor: string,
  changeBackorderState: ChangeStateFn,
): Promise<void> {
  const lineDemands = await tx
    .select({
      backorderId: backorders.backorderId,
      purchaseOrderId: backorders.purchaseOrderId,
      salesOrderId: backorders.salesOrderId,
    })
    .from(backorders)
    .where(eq(backorders.purchaseOrderLineId, purchaseOrderLineId));

  if (lineDemands.length === 0) return;

  const purchaseOrderIds = Array.from(
    new Set(
      lineDemands
        .map((bo) => bo.purchaseOrderId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const poMap = new Map<string, string>();
  if (purchaseOrderIds.length > 0) {
    const pos = await tx
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
      })
      .from(purchaseOrders)
      .where(inArray(purchaseOrders.purchaseOrderId, purchaseOrderIds));

    for (const po of pos) {
      if (po.orderNumber) {
        poMap.set(po.purchaseOrderId, po.orderNumber);
      }
    }
  }

  for (const bo of lineDemands) {
    await changeBackorderState(
      bo.backorderId,
      BACKORDER_STATE.PENDING_SUPPLY,
      actor,
      tx,
      {
        purchaseOrderId: null,
        purchaseOrderLineId: null,
      },
    );

    if (bo.purchaseOrderId) {
      const orderNumber = poMap.get(bo.purchaseOrderId);
      // @herobm-skip-audit - DB write is performed by changeBackorderState, emitting cross-entity event here
      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: bo.purchaseOrderId,
        eventType: EventType.DEMAND_UNALLOCATED,
        entityDisplayName: orderNumber || 'Purchase Order',
        actor,
        payload: { backorderId: bo.backorderId, purchaseOrderLineId },
      });
    }
  }
}

export async function executeUnlinkDemandForPurchaseOrder(
  tx: DrizzleDB,
  purchaseOrderId: string,
  actor: string,
  changeBackorderState: ChangeStateFn,
): Promise<void> {
  const poDemands = await tx
    .select({
      backorderId: backorders.backorderId,
      salesOrderId: backorders.salesOrderId,
    })
    .from(backorders)
    .where(eq(backorders.purchaseOrderId, purchaseOrderId));

  for (const bo of poDemands) {
    await changeBackorderState(
      bo.backorderId,
      BACKORDER_STATE.PENDING_SUPPLY,
      actor,
      tx,
      {
        purchaseOrderId: null,
        purchaseOrderLineId: null,
      },
    );

    if (bo.salesOrderId) {
      // @herobm-skip-audit - DB write is performed by changeBackorderState, emitting cross-entity event here
      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: bo.salesOrderId,
        eventType: EventType.DEMAND_UNALLOCATED,
        entityDisplayName: `Sales Order`,
        payload: { backorderId: bo.backorderId },
        actor,
      });
    }
  }
}

export async function executeCancelDemandForSalesOrder(
  tx: DrizzleDB,
  salesOrderId: string,
  actor: string,
  changeBackorderState: ChangeStateFn,
): Promise<void> {
  const list = await tx
    .select({ backorderId: backorders.backorderId })
    .from(backorders)
    .where(eq(backorders.salesOrderId, salesOrderId));

  for (const bo of list) {
    await changeBackorderState(
      bo.backorderId,
      BACKORDER_STATE.CANCELLED,
      actor,
      tx,
    );
  }

  // @herobm-skip-audit - DB write is performed by changeBackorderState, emitting cross-entity event here
  await emitEvent(tx, {
    entityType: EntityType.SALES_ORDER,
    entityId: salesOrderId,
    eventType: EventType.STATUS_CHANGED,
    entityDisplayName: 'Sales Order',
    actor,
    payload: { reason: 'sales_order_cancelled_backorders_cancelled' },
  });
}

export async function executeCancelDemandForWorkOrder(
  tx: DrizzleDB,
  workOrderId: string,
  actor: string,
  changeBackorderState: ChangeStateFn,
): Promise<void> {
  const list = await tx
    .select({ backorderId: backorders.backorderId })
    .from(backorders)
    .where(eq(backorders.demandWorkOrderId, workOrderId));

  for (const bo of list) {
    await changeBackorderState(
      bo.backorderId,
      BACKORDER_STATE.CANCELLED,
      actor,
      tx,
    );
  }

  // @herobm-skip-audit - DB write is performed by changeBackorderState, emitting cross-entity event here
  await emitEvent(tx, {
    entityType: EntityType.WORK_ORDER,
    entityId: workOrderId,
    eventType: EventType.STATUS_CHANGED,
    entityDisplayName: 'Work Order',
    actor,
    payload: { reason: 'work_order_cancelled_backorders_cancelled' },
  });
}

export async function executeLinkDemandToTransferOrder(
  tx: DrizzleDB,
  backorderId: string,
  transferOrderId: string,
  transferOrderLineId: string,
  actor: string,
  changeBackorderState: ChangeStateFn,
): Promise<void> {
  await changeBackorderState(
    backorderId,
    BACKORDER_STATE.AWAITING_RECEIPT,
    actor,
    tx,
    {
      transferOrderId,
      transferOrderLineId,
    },
  );

  // @herobm-skip-audit - DB write is performed by changeBackorderState, emitting cross-entity event here
  await emitEvent(tx, {
    entityType: EntityType.TRANSFER_ORDER,
    entityId: transferOrderId,
    eventType: EventType.DEMAND_ALLOCATED,
    entityDisplayName: 'Transfer Order',
    actor,
    payload: { backorderId, transferOrderLineId },
  });
}

export async function executeUnlinkDemandForTransferOrder(
  tx: DrizzleDB,
  transferOrderId: string,
  actor: string,
  changeBackorderState: ChangeStateFn,
): Promise<void> {
  const list = await tx
    .select({ backorderId: backorders.backorderId })
    .from(backorders)
    .where(eq(backorders.transferOrderId, transferOrderId));

  for (const bo of list) {
    await changeBackorderState(
      bo.backorderId,
      BACKORDER_STATE.PENDING_SUPPLY,
      actor,
      tx,
      {
        transferOrderId: null,
        transferOrderLineId: null,
      },
    );
  }

  // @herobm-skip-audit - DB write is performed by changeBackorderState, emitting cross-entity event here
  await emitEvent(tx, {
    entityType: EntityType.TRANSFER_ORDER,
    entityId: transferOrderId,
    eventType: EventType.DEMAND_UNALLOCATED,
    entityDisplayName: 'Transfer Order',
    actor,
    payload: { transferOrderId },
  });
}
