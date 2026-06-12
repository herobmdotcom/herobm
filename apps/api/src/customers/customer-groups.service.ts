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
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class AccountGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(customerGroups);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid customer group ID: ${id}`);
    }

    const rows = await db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.customerGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Customer group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateAccountGroupDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(customerGroups)
        .values({
          groupCode: dto.groupCode,
          name: dto.name,
          defaultArAccountId: dto.defaultArAccountId || null,
          defaultRevenueAccountId: dto.defaultRevenueAccountId || null,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.CUSTOMER_GROUP,
        entityId: rows[0].customerGroupId,
        eventType: EventType.CREATED,
        entityDisplayName: rows[0].groupCode,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async update(id: string, dto: UpdateAccountGroupDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      await this.findOne(id, tx); // ensure exists

      const rows = await tx
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

      await emitEvent(tx, {
        entityType: EntityType.CUSTOMER_GROUP,
        entityId: rows[0].customerGroupId,
        eventType: EventType.UPDATED,
        entityDisplayName: rows[0].groupCode,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async delete(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);

      // Check for referencing customers
      const deps = await tx
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(eq(customers.customerGroupId, id));

      if (Number(deps[0].count) > 0) {
        throw new ConflictException(
          `Cannot delete customer group '${id}' because it is currently assigned to one or more customers.`,
        );
      }

      await tx
        .delete(customerGroups)
        .where(eq(customerGroups.customerGroupId, id));

      await emitEvent(tx, {
        entityType: EntityType.CUSTOMER_GROUP,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: existing.groupCode,
        payload: {},
        actor: userId,
      });

      return { deleted: true };
    });
  }
}
