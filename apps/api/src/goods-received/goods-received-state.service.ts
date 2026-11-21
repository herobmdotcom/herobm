import { goodsReceived } from '@herobm/db-schema';
import {
  GOODS_RECEIVED_TRANSITIONS,
  GoodsReceivedState,
  getValidStates,
} from '@herobm/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { GoodsReceivedCoreService } from './goods-received-core.service';

const VALID_GRN_STATES = getValidStates(GOODS_RECEIVED_TRANSITIONS);

@Injectable()
export class GoodsReceivedStateService {
  private readonly logger = new Logger(GoodsReceivedStateService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly coreService: GoodsReceivedCoreService,
  ) {}

  /**
   * Universal changeState for Goods Receipt
   */
  async changeReceiptState(
    receiptId: string,
    newState: GoodsReceivedState,
    actor: string,
    tx: DrizzleDB,
  ) {
    if (!VALID_GRN_STATES.includes(newState)) {
      throw new BadRequestException(
        `Invalid goods receipt state: '${newState}'`,
      );
    }

    const [receipt] = await tx
      .select({
        stateCode: goodsReceived.stateCode,
        receiptNumber: goodsReceived.receiptNumber,
      })
      .from(goodsReceived)
      .where(eq(goodsReceived.goodsReceivedId, receiptId));

    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptId} not found`);
    }

    const allowed = GOODS_RECEIVED_TRANSITIONS[receipt.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition receipt from '${receipt.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await tx
      .update(goodsReceived)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(goodsReceived.goodsReceivedId, receiptId))
      .returning();

    await emitEvent(tx as unknown as DrizzleDB, {
      entityType: EntityType.WAREHOUSE,
      entityId: receiptId,
      eventType: EventType.RECEIPT_STATUS_CHANGED,
      entityDisplayName: receipt.receiptNumber,
      payload: {
        entity: 'goods_receipt',
        entityId: receiptId,
        receiptNumber: receipt.receiptNumber,
        from: receipt.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }
}
