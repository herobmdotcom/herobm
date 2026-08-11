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
  backorders,
  salesOrderLineItems,
  locations,
} from '@herobm/db-schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  CreateTransferOrderDto,
  UpdateTransferOrderDto,
  CreateTransferOrderLineDto,
  UpdateTransferOrderLineDto,
} from './dto';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import { BACKORDER_STATE, TRANSFER_ORDER_STATE } from '@herobm/shared';
import { v4 as uuidv4 } from 'uuid';
import { TransfersCoreService } from './transfers-core.service';

@Injectable()
export class TransfersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly coreService: TransfersCoreService,
  ) {}

  async createTransferFromDemands(
    sourceLocationId: string,
    backorderIds: string[],
    actor: string,
  ) {
    if (!backorderIds || backorderIds.length === 0) {
      throw new BadRequestException('No demands specified');
    }

    return await this.db.transaction(async (tx) => {
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

      const destLocationId = lines[0].locationId;
      if (!lines.every((l) => l.locationId === destLocationId)) {
        throw new BadRequestException(
          'All demands must be for the same destination location',
        );
      }

      const orderNumber = await this.coreService.generateTransferNumber(tx);
      const transferOrderId = uuidv4();

      await tx.insert(transferOrders).values({
        transferOrderId,
        orderNumber,
        sourceLocationId,
        destinationLocationId: destLocationId,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: actor,
      });

      for (const line of lines) {
        const transferOrderLineId = uuidv4();
        await tx.insert(transferOrderLines).values({
          transferOrderLineId,
          transferOrderId,
          productId: line.productId,
          quantity: line.quantity,
        });

        await tx
          .update(backorders)
          .set({
            transferOrderId,
            transferOrderLineId,
            // eslint-disable-next-line no-restricted-syntax -- State bypass required
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

  async create(dto: CreateTransferOrderDto, actor: string) {
    return await this.db.transaction(async (tx) => {
      const orderNumber = await this.coreService.generateTransferNumber(tx);
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
      .select({
        stateCode: transferOrders.stateCode,
        orderNumber: transferOrders.orderNumber,
      })
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
}
