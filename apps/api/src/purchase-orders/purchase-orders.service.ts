import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import type { PaginationQuery } from '../common/pagination';
import type { PurchaseOrderState } from '@herobm/shared';

import { PurchaseOrdersQueryService } from './purchase-orders-query.service';
import { PurchaseOrdersStateService } from './purchase-orders-state.service';
import { PurchaseOrdersWriteService } from './purchase-orders-write.service';

export type { UnifiedPurchaseOrderRow } from './purchase-orders-query.service';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly queryService: PurchaseOrdersQueryService,
    private readonly stateService: PurchaseOrdersStateService,
    private readonly writeService: PurchaseOrdersWriteService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async create(createDto: any, userId: string) {
    return this.writeService.create(createDto, userId);
  }

  async findAll(query?: PaginationQuery) {
    return this.queryService.findAll(query);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async findOne(id: string, tx: any = undefined) {
    return this.queryService.findOne(id, tx);
  }

  async changePurchaseOrderState(
    id: string,
    stateCode: PurchaseOrderState,
    actor: string = 'system',
    tx?: DrizzleDB,
    bypassValidation: boolean = false,
  ) {
    return this.stateService.changePurchaseOrderState(
      id,
      stateCode,
      actor,
      tx,
      bypassValidation,
    );
  }

  async archive(id: string, actor: string) {
    return this.stateService.archive(id, actor);
  }

  async unarchive(id: string, actor: string) {
    return this.stateService.unarchive(id, actor);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async addLine(orderId: string, lineDto: any, actor: string = 'system') {
    return this.writeService.addLine(orderId, lineDto, actor);
  }

  async updateLine(
    orderId: string,
    lineId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    lineDto: any,
    actor: string = 'system',
  ) {
    return this.writeService.updateLine(orderId, lineId, lineDto, actor);
  }

  async removeLine(orderId: string, lineId: string, actor: string = 'system') {
    return this.writeService.removeLine(orderId, lineId, actor);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async update(id: string, updateDto: any, userId: string) {
    return this.writeService.update(id, updateDto, userId);
  }

  async findPendingLines(productId?: string, vendorId?: string) {
    return this.queryService.findPendingLines(productId, vendorId);
  }

  async findReturnableLines(productId: string) {
    return this.queryService.findReturnableLines(productId);
  }

  async resolveTaxForLine(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    tx: any,
    vendorId: string,
    productId?: string,
    taxCategoryIdOverride?: string,
  ) {
    return this.writeService.resolveTaxForLine(
      tx,
      vendorId,
      productId,
      taxCategoryIdOverride,
    );
  }
}
