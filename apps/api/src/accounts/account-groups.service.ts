import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { accountGroups } from '../drizzle/modbm-core-schema';

export interface CreateAccountGroupDto {
  groupCode: string;
  name: string;
  defaultDiscountPercentage?: string;
  defaultArAccountId?: string;
  defaultRevenueAccountId?: string;
}

export type UpdateAccountGroupDto = Partial<CreateAccountGroupDto>;

@Injectable()
export class AccountGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(accountGroups);
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid account group ID: ${id}`);
    }

    const rows = await this.db
      .select()
      .from(accountGroups)
      .where(eq(accountGroups.accountGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Account group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateAccountGroupDto) {
    const rows = await this.db
      .insert(accountGroups)
      .values({
        groupCode: dto.groupCode,
        name: dto.name,
        defaultDiscountPercentage: dto.defaultDiscountPercentage || '0',
        defaultArAccountId: dto.defaultArAccountId || null,
        defaultRevenueAccountId: dto.defaultRevenueAccountId || null,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateAccountGroupDto) {
    await this.findOne(id); // ensure exists

    const rows = await this.db
      .update(accountGroups)
      .set({
        ...(dto.groupCode !== undefined && { groupCode: dto.groupCode }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultDiscountPercentage !== undefined && {
          defaultDiscountPercentage: dto.defaultDiscountPercentage,
        }),
        ...(dto.defaultArAccountId !== undefined && {
          defaultArAccountId: dto.defaultArAccountId,
        }),
        ...(dto.defaultRevenueAccountId !== undefined && {
          defaultRevenueAccountId: dto.defaultRevenueAccountId,
        }),
      })
      .where(eq(accountGroups.accountGroupId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.db
      .delete(accountGroups)
      .where(eq(accountGroups.accountGroupId, id));
    return { deleted: true };
  }
}
