import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { activities } from '../drizzle/modbm-core-schema';
import { CreateActivityDto, UpdateActivityDto } from './dto';

@Injectable()
export class ActivitiesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(activities).orderBy(activities.code);
  }

  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(activities)
      .where(eq(activities.activityId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Activity with ID '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateActivityDto) {
    try {
      const rows = await this.db
        .insert(activities)
        .values({
          code: dto.code.trim(),
          name: dto.name.trim(),
          isActive: dto.isActive ?? true,
        })
        .returning();
      return rows[0];
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException(
          `Activity code '${dto.code}' already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateActivityDto) {
    const existing = await this.findOne(id);

    const rows = await this.db
      .update(activities)
      .set({
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        modifiedOn: new Date(),
      })
      .where(eq(activities.activityId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    const existing = await this.findOne(id);
    if (existing.isSystem) {
      throw new BadRequestException('Cannot delete a system activity');
    }

    try {
      await this.db.delete(activities).where(eq(activities.activityId, id));
      return { deleted: true };
    } catch (err: any) {
      if (err?.code === '23503') {
        throw new BadRequestException(
          `Cannot delete activity '${existing.code}' because it is in use by journal entries.`,
        );
      }
      throw err;
    }
  }

  async importMany(data: CreateActivityDto[]) {
    if (data.length === 0) return { count: 0, updated: 0 };

    const values = data.map((d) => ({
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      isActive: d.isActive ?? true,
    }));

    const rows = await this.db
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

    return {
      count: rows.length,
      updated: rows.length,
    };
  }
}
