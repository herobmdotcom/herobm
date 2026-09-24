import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import { transferOrders } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import {
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';
import type { TransferOrderState } from '@herobm/shared';

export const VALID_TRANSFER_STATES = getValidStates(TRANSFER_ORDER_TRANSITIONS);

export async function changeTransferOrderState(
  db: DrizzleDB,
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

  const activeDb = tx || db;

  const [order] = await activeDb
    .select()
    .from(transferOrders)
    .where(eq(transferOrders.transferOrderId, transferOrderId));

  if (!order) {
    throw new NotFoundException(`Transfer Order ${transferOrderId} not found`);
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

  const [updated] = await activeDb
    .update(transferOrders)
    .set({ stateCode: newState, modifiedOn: new Date() })
    .where(eq(transferOrders.transferOrderId, transferOrderId))
    .returning();

  await emitEvent(activeDb as unknown as DrizzleDB, {
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
