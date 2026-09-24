import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { manufacturingSettings } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import type { WorkOrderState } from '@herobm/shared';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import {
  UpdateWorkOrderDto,
  UpdateWorkOrderComponentDto,
} from './dto/update-work-order.dto';
import { UpdateManufacturingSettingsDto } from './dto/manufacturing-settings.dto';

import {
  WorkOrdersQueryService,
  WorkOrderRow,
} from './work-orders-query.service';
import { WorkOrdersWriteService } from './work-orders-write.service';
import { WorkOrdersExecutionService } from './work-orders-execution.service';

export type { WorkOrderRow } from './work-orders-query.service';

@Injectable()
export class WorkOrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly queryService: WorkOrdersQueryService,
    private readonly writeService: WorkOrdersWriteService,
    private readonly executionService: WorkOrdersExecutionService,
  ) {}

  async changeWorkOrderState(
    id: string,
    newState: WorkOrderState,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.executionService.changeWorkOrderState(
      id,
      newState,
      username,
      tx,
    );
  }

  async findAll(days?: number, tx?: DrizzleDB): Promise<WorkOrderRow[]> {
    return this.queryService.findAll(days, tx);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    return this.queryService.findOne(id, tx);
  }

  async create(dto: CreateWorkOrderDto, username?: string, tx?: DrizzleDB) {
    return this.writeService.create(dto, username, tx);
  }

  async update(
    id: string,
    dto: UpdateWorkOrderDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.update(id, dto, username, tx);
  }

  async updateComponent(
    workOrderId: string,
    componentId: string,
    dto: UpdateWorkOrderComponentDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.updateComponent(
      workOrderId,
      componentId,
      dto,
      username,
      tx,
    );
  }

  async release(id: string, username?: string, tx?: DrizzleDB) {
    return this.executionService.release(id, username, tx);
  }

  async completeBuild(
    id: string,
    outputBinId?: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.executionService.completeBuild(id, outputBinId, username, tx);
  }

  async cancel(id: string, username?: string, tx?: DrizzleDB) {
    return this.executionService.cancel(id, username, tx);
  }

  async getPickingSummary(id: string, tx?: DrizzleDB) {
    return this.queryService.getPickingSummary(id, tx);
  }

  async pickComponent(
    id: string,
    componentId: string,
    binId: string,
    quantity: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.pickComponent(
      id,
      componentId,
      binId,
      quantity,
      username,
      tx,
    );
  }

  async cancelComponentPick(
    id: string,
    pickId: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.cancelComponentPick(id, pickId, username, tx);
  }

  async getSettings(tx?: DrizzleDB) {
    const db = tx || this.db;
    const [settings] = await db.select().from(manufacturingSettings).limit(1);
    return (
      settings || {
        workOrderMetadataSchema: null,
      }
    );
  }

  async updateSettings(data: UpdateManufacturingSettingsDto, tx?: DrizzleDB) {
    const db = tx || this.db;
    const [existing] = await db.select().from(manufacturingSettings).limit(1);

    if (!existing) {
      const [created] = await db
        .insert(manufacturingSettings)
        .values({
          workOrderMetadataSchema: data.workOrderMetadataSchema ?? null,
        })
        .returning();

      await emitEvent(db, {
        entityType: EntityType.MANUFACTURING_SETTINGS,
        entityId: created.manufacturingSettingsId,
        entityDisplayName: 'Manufacturing Settings',
        eventType: EventType.UPDATED,
        payload: { changes: data },
        actor: 'system',
      });

      return created;
    }

    const [updated] = await db
      .update(manufacturingSettings)
      .set({
        workOrderMetadataSchema:
          data.workOrderMetadataSchema !== undefined
            ? data.workOrderMetadataSchema
            : existing.workOrderMetadataSchema,
        modifiedOn: new Date(),
      })
      .where(
        eq(
          manufacturingSettings.manufacturingSettingsId,
          existing.manufacturingSettingsId,
        ),
      )
      .returning();

    await emitEvent(db, {
      entityType: EntityType.MANUFACTURING_SETTINGS,
      entityId: updated.manufacturingSettingsId,
      entityDisplayName: 'Manufacturing Settings',
      eventType: EventType.UPDATED,
      payload: { changes: data },
      actor: 'system',
    });

    return updated;
  }
}
