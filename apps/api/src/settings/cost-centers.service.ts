import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { costCenters } from '../drizzle/modbm-core-schema';
import { CreateCostCenterDto, UpdateCostCenterDto } from './dto';

@Injectable()
export class CostCentersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(costCenters).orderBy(costCenters.code);
  }

  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(costCenters)
      .where(eq(costCenters.costCenterId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Cost center with ID '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateCostCenterDto) {
    try {
      const rows = await this.db
        .insert(costCenters)
        .values({
          code: dto.code.trim(),
          name: dto.name.trim(),
          isActive: dto.isActive ?? true,
        })
        .returning();
      return rows[0];
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === '23505') {
        throw new BadRequestException(
          `Cost center code '${dto.code}' already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCostCenterDto) {
    const existing = await this.findOne(id);

    const rows = await this.db
      .update(costCenters)
      .set({
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        modifiedOn: new Date(),
      })
      .where(eq(costCenters.costCenterId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    const existing = await this.findOne(id);
    if (existing.isSystem) {
      throw new BadRequestException('Cannot delete a system cost center');
    }

    try {
      await this.db.delete(costCenters).where(eq(costCenters.costCenterId, id));
      return { deleted: true };
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === '23503') {
        throw new BadRequestException(
          `Cannot delete cost center '${existing.code}' because it is in use by journal entries.`,
        );
      }
      throw err;
    }
  }

  async importMany(data: CreateCostCenterDto[]) {
    if (data.length === 0) return { count: 0, updated: 0 };

    const values = data.map((d) => ({
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      isActive: d.isActive ?? true,
    }));

    const rows = await this.db
      .insert(costCenters)
      .values(values)
      .onConflictDoUpdate({
        target: costCenters.code,
        set: {
          name: sql`EXCLUDED.name`,
          isActive: sql`EXCLUDED.is_active`,
          modifiedOn: new Date(),
        },
      })
      .returning();

    return {
      count: rows.length,
      updated: rows.length, // Simplified for now as returning() gives all affected
    };
  }
}
