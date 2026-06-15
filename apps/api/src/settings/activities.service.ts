import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { activities } from '../drizzle/herobm-core-schema';
import { CreateActivityDto, UpdateActivityDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ActivitiesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(activities).orderBy(activities.code);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select()
      .from(activities)
      .where(eq(activities.activityId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Activity with ID '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateActivityDto, userId?: string) {
    try {
      return await this.db.transaction(async (tx) => {
        const rows = await tx
          .insert(activities)
          .values({
            code: dto.code.trim(),
            name: dto.name.trim(),
            isActive: dto.isActive ?? true,
          })
          .returning();

        await emitEvent(tx, {
          entityType: EntityType.ACTIVITY,
          entityId: rows[0].activityId,
          eventType: EventType.CREATED,
          entityDisplayName: rows[0].code,
          payload: dto,
          actor: userId,
        });

        return rows[0];
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === '23505') {
        throw new BadRequestException(
          `Activity code '${dto.code}' already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateActivityDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);

      const rows = await tx
        .update(activities)
        .set({
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          modifiedOn: new Date(),
        })
        .where(eq(activities.activityId, id))
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.ACTIVITY,
        entityId: rows[0].activityId,
        eventType: EventType.UPDATED,
        entityDisplayName: rows[0].code,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async delete(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);
      if (existing.isSystem) {
        throw new BadRequestException('Cannot delete a system activity');
      }

      try {
        await tx.delete(activities).where(eq(activities.activityId, id));

        await emitEvent(tx, {
          entityType: EntityType.ACTIVITY,
          entityId: id,
          eventType: EventType.DELETED,
          entityDisplayName: existing.code,
          payload: {},
          actor: userId,
        });

        return { deleted: true };
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.code === '23503') {
          throw new BadRequestException(
            `Cannot delete activity '${existing.code}' because it is in use by journal entries.`,
          );
        }
        throw err;
      }
    });
  }

  async importMany(data: CreateActivityDto[], userId?: string) {
    if (data.length === 0) return { count: 0, updated: 0 };

    const values = data.map((d) => ({
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      isActive: d.isActive ?? true,
    }));

    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(activities)
        .values(values)
        .onConflictDoUpdate({
          target: activities.code,
          set: {
            name: sql`EXCLUDED.name`,
            isActive: sql`EXCLUDED.is_active`,
            modifiedOn: new Date(),
          },
        })
        .returning();

      for (const row of rows) {
        await emitEvent(tx, {
          entityType: EntityType.ACTIVITY,
          entityId: row.activityId,
          eventType: EventType.UPDATED,
          entityDisplayName: row.code,
          payload: {},
          actor: userId,
        });
      }

      return {
        count: rows.length,
        updated: rows.length,
      };
    });
  }
}
