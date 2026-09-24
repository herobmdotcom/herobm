import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { purchasingSettings } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import type { PaginationQuery } from '../common/pagination';
import type { PurchaseOrderState } from '@herobm/shared';
import type { UpdatePurchasingSettingsDto } from './dto';

import { PurchaseOrdersQueryService } from './purchase-orders-query.service';
import { PurchaseOrdersStateService } from './purchase-orders-state.service';
import { PurchaseOrdersWriteService } from './purchase-orders-write.service';

export type { UnifiedPurchaseOrderRow } from './purchase-orders-query.service';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
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

  async getSettings(tx?: DrizzleDB) {
    const db = tx || this.db;
    const [settings] = await db.select().from(purchasingSettings).limit(1);
    return (
      settings || {
        purchaseOrderMetadataSchema: null,
        debitNoteMetadataSchema: null,
      }
    );
  }

  async updateSettings(data: UpdatePurchasingSettingsDto, tx?: DrizzleDB) {
    const db = tx || this.db;
    const [existing] = await db.select().from(purchasingSettings).limit(1);

    if (!existing) {
      const [created] = await db
        .insert(purchasingSettings)
        .values({
          purchaseOrderMetadataSchema: data.purchaseOrderMetadataSchema ?? null,
          debitNoteMetadataSchema: data.debitNoteMetadataSchema ?? null,
        })
        .returning();

      await emitEvent(db, {
        entityType: EntityType.PURCHASING_SETTINGS,
        entityId: created.purchasingSettingsId,
        entityDisplayName: 'Purchasing Settings',
        eventType: EventType.UPDATED,
        payload: { changes: data },
        actor: 'system',
      });

      return created;
    }

    const [updated] = await db
      .update(purchasingSettings)
      .set({
        purchaseOrderMetadataSchema:
          data.purchaseOrderMetadataSchema !== undefined
            ? data.purchaseOrderMetadataSchema
            : existing.purchaseOrderMetadataSchema,
        debitNoteMetadataSchema:
          data.debitNoteMetadataSchema !== undefined
            ? data.debitNoteMetadataSchema
            : existing.debitNoteMetadataSchema,
        modifiedOn: new Date(),
      })
      .where(
        eq(
          purchasingSettings.purchasingSettingsId,
          existing.purchasingSettingsId,
        ),
      )
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PURCHASING_SETTINGS,
      entityId: updated.purchasingSettingsId,
      entityDisplayName: 'Purchasing Settings',
      eventType: EventType.UPDATED,
      payload: { changes: data },
      actor: 'system',
    });

    return updated;
  }
}
