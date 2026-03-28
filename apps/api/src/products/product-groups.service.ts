import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { productGroups } from '../drizzle/modbm-core-schema';

export interface CreateProductGroupDto {
  groupCode: string;
  name: string;
  defaultRevenueAccountId?: string;
  defaultExpenseAccountId?: string;
}

export type UpdateProductGroupDto = Partial<CreateProductGroupDto>;

@Injectable()
export class ProductGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(productGroups);
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid product group ID: ${id}`);
    }

    const rows = await this.db
      .select()
      .from(productGroups)
      .where(eq(productGroups.productGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Product group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateProductGroupDto) {
    const rows = await this.db
      .insert(productGroups)
      .values({
        groupCode: dto.groupCode,
        name: dto.name,
        defaultRevenueAccountId: dto.defaultRevenueAccountId || null,
        defaultExpenseAccountId: dto.defaultExpenseAccountId || null,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateProductGroupDto) {
    await this.findOne(id);

    const rows = await this.db
      .update(productGroups)
      .set({
        ...(dto.groupCode !== undefined && { groupCode: dto.groupCode }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultRevenueAccountId !== undefined && {
          defaultRevenueAccountId: dto.defaultRevenueAccountId,
        }),
        ...(dto.defaultExpenseAccountId !== undefined && {
          defaultExpenseAccountId: dto.defaultExpenseAccountId,
        }),
      })
      .where(eq(productGroups.productGroupId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.db
      .delete(productGroups)
      .where(eq(productGroups.productGroupId, id));
    return { deleted: true };
  }
}
