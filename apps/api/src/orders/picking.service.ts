import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDB } from '../drizzle/drizzle.module';

import { PickingQueryService } from './picking-query.service';
import { PickingShippingQueryService } from './picking-shipping-query.service';
import { PickingActionService } from './picking-action.service';
import { PickingQueueQueryDto } from './dto';

@Injectable()
export class PickingService {
  private readonly logger = new Logger(PickingService.name);

  constructor(
    private readonly pickingQueryService: PickingQueryService,
    private readonly pickingShippingQueryService: PickingShippingQueryService,
    private readonly pickingActionService: PickingActionService,
  ) {}

  async getPickingSummary(orderId: string) {
    return this.pickingQueryService.getPickingSummary(orderId);
  }

  async pickLine(
    orderId: string,
    lineId: string,
    binId: string,
    quantity: string,
    actor: string,
  ) {
    return this.pickingActionService.pickLine(
      orderId,
      lineId,
      binId,
      quantity,
      actor,
    );
  }

  async assertFullyPicked(orderId: string): Promise<void> {
    return this.pickingQueryService.assertFullyPicked(orderId);
  }

  async assertFullyShipped(orderId: string): Promise<void> {
    return this.pickingQueryService.assertFullyShipped(orderId);
  }

  async getPickingQueue(query?: PickingQueueQueryDto | string) {
    return this.pickingQueryService.getPickingQueue(query);
  }

  async cancelPick(orderId: string, pickId: string, actor: string) {
    return this.pickingActionService.cancelPick(orderId, pickId, actor);
  }

  async changeSalesPickState(
    pickId: string,
    newState: string,
    actor: string,
    tx: DrizzleDB,
  ) {
    return this.pickingActionService.changeSalesPickState(
      pickId,
      newState,
      actor,
      tx,
    );
  }

  async getShippingQueue(locationId?: string) {
    return this.pickingShippingQueryService.getShippingQueue(locationId);
  }

  async getShippingContext(orderId: string) {
    return this.pickingShippingQueryService.getShippingContext(orderId);
  }
}
