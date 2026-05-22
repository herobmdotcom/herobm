import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { customerGroups, customers } from '../drizzle/modbm-core-schema';
import { CreateAccountGroupDto, UpdateAccountGroupDto } from './dto';

@Injectable()
export class AccountGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(customerGroups);
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid customer group ID: ${id}`);
    }

    const rows = await this.db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.customerGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Customer group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateAccountGroupDto) {
    const rows = await this.db
      .insert(customerGroups)
      .values({
        groupCode: dto.groupCode,
        name: dto.name,
        defaultArAccountId: dto.defaultArAccountId || null,
        defaultRevenueAccountId: dto.defaultRevenueAccountId || null,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateAccountGroupDto) {
    await this.findOne(id); // ensure exists

    const rows = await this.db
      .update(customerGroups)
      .set({
        ...(dto.groupCode !== undefined && { groupCode: dto.groupCode }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultArAccountId !== undefined && {
          defaultArAccountId: dto.defaultArAccountId,
        }),
        ...(dto.defaultRevenueAccountId !== undefined && {
          defaultRevenueAccountId: dto.defaultRevenueAccountId,
        }),
      })
      .where(eq(customerGroups.customerGroupId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check for referencing customers
    const deps = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(eq(customers.customerGroupId, id));

    if (Number(deps[0].count) > 0) {
      throw new ConflictException(
        `Cannot delete customer group '${id}' because it is currently assigned to one or more customers.`,
      );
    }

    await this.db
      .delete(customerGroups)
      .where(eq(customerGroups.customerGroupId, id));
    return { deleted: true };
  }
}
